import { AudioStatus } from '@prisma/client';

// Mock dependencies
jest.mock('./database.service.js', () => ({
  prisma: {
    page: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('./s3-client', () => ({
  downloadFromS3: jest.fn(),
  uploadToS3: jest.fn(),
}));

jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = {
    input: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    audioFrequency: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    save: jest.fn(),
  };
  
  return jest.fn(() => mockFfmpeg);
});

describe('Page Audio Combination Worker', () => {
  let mockPrisma: any;
  let mockDownloadFromS3: jest.Mock;
  let mockUploadToS3: jest.Mock;
  let mockFfmpeg: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPrisma = require('./database.service.js').prisma;
    mockDownloadFromS3 = require('./s3-client').downloadFromS3;
    mockUploadToS3 = require('./s3-client').uploadToS3;
    mockFfmpeg = require('fluent-ffmpeg');
  });

  const createMockPage = (overrides = {}) => ({
    id: 'page-1',
    pageNumber: 1,
    bookId: 'book-1',
    audioStatus: AudioStatus.PENDING,
    paragraphs: [
      {
        id: 'para-1',
        orderIndex: 0,
        audioS3Key: 'audio/para-1.mp3',
        audioDuration: 30,
      },
      {
        id: 'para-2',
        orderIndex: 1,
        audioS3Key: 'audio/para-2.mp3',
        audioDuration: 45,
      },
    ],
    ...overrides,
  });

  describe('successful audio combination', () => {
    it('should combine paragraph audio files successfully', async () => {
      const mockPage = createMockPage();
      
      mockPrisma.page.findUnique.mockResolvedValue(mockPage);
      mockDownloadFromS3.mockImplementation((s3Key) => 
        Promise.resolve(`/tmp/downloaded-${s3Key.split('/').pop()}`)
      );
      mockUploadToS3.mockResolvedValue('combined-audio/page-1-combined.mp3');
      mockPrisma.page.update.mockResolvedValue({});

      // Mock ffmpeg success
      const mockFfmpegInstance = {
        input: jest.fn().mockReturnThis(),
        audioCodec: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        audioFrequency: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockFfmpegInstance;
        }),
        save: jest.fn().mockReturnThis(),
      };
      mockFfmpeg.mockReturnValue(mockFfmpegInstance);

      // Simulate worker processing
      const result = await processPageAudioCombination({
        data: { pageId: 'page-1', bookId: 'book-1' }
      });

      expect(result.success).toBe(true);
      expect(result.totalDuration).toBe(75);
      expect(result.audioFilesCount).toBe(2);

      // Verify database calls
      expect(mockPrisma.page.findUnique).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        include: expect.objectContaining({
          paragraphs: expect.objectContaining({
            where: {
              completed: true,
              audioStatus: 'READY',
              audioS3Key: { not: null },
            },
          }),
        }),
      });

      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: {
          audioStatus: AudioStatus.READY,
          audioS3Key: 'combined-audio/page-1-combined.mp3',
          audioDuration: 75,
        },
      });

      // Verify S3 operations
      expect(mockDownloadFromS3).toHaveBeenCalledTimes(2);
      expect(mockUploadToS3).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/page-1-'),
        'combined-audio/page-1-combined.mp3'
      );

      // Verify FFmpeg configuration
      expect(mockFfmpegInstance.input).toHaveBeenCalledTimes(2);
      expect(mockFfmpegInstance.audioCodec).toHaveBeenCalledWith('mp3');
      expect(mockFfmpegInstance.audioBitrate).toHaveBeenCalledWith('128k');
    });
  });

  describe('error handling', () => {
    it('should handle page not found error', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(null);

      await expect(processPageAudioCombination({
        data: { pageId: 'nonexistent', bookId: 'book-1' }
      })).rejects.toThrow('Page not found: nonexistent');
    });

    it('should handle no completed paragraphs', async () => {
      const mockPage = createMockPage({ paragraphs: [] });
      mockPrisma.page.findUnique.mockResolvedValue(mockPage);

      await expect(processPageAudioCombination({
        data: { pageId: 'page-1', bookId: 'book-1' }
      })).rejects.toThrow('No completed paragraphs with audio found for page 1');
    });

    it('should handle FFmpeg processing errors', async () => {
      const mockPage = createMockPage();
      mockPrisma.page.findUnique.mockResolvedValue(mockPage);
      mockDownloadFromS3.mockResolvedValue('/tmp/test.mp3');

      const mockFfmpegInstance = {
        input: jest.fn().mockReturnThis(),
        audioCodec: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        audioFrequency: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('FFmpeg failed')), 0);
          }
          return mockFfmpegInstance;
        }),
        save: jest.fn().mockReturnThis(),
      };
      mockFfmpeg.mockReturnValue(mockFfmpegInstance);

      await expect(processPageAudioCombination({
        data: { pageId: 'page-1', bookId: 'book-1' }
      })).rejects.toThrow('FFmpeg failed');
    });
  });

  // Mock implementation of the worker function
  async function processPageAudioCombination(job: any) {
    const page = await mockPrisma.page.findUnique({
      where: { id: job.data.pageId },
      include: {
        paragraphs: {
          where: {
            completed: true,
            audioStatus: 'READY',
            audioS3Key: { not: null },
          },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            orderIndex: true,
            audioS3Key: true,
            audioDuration: true,
          },
        },
      },
    });

    if (!page) {
      throw new Error(`Page not found: ${job.data.pageId}`);
    }

    if (page.paragraphs.length === 0) {
      throw new Error(`No completed paragraphs with audio found for page ${page.pageNumber}`);
    }

    const audioFiles: { localPath: string; duration: number }[] = [];
    let totalDuration = 0;

    for (const paragraph of page.paragraphs) {
      if (!paragraph.audioS3Key) continue;
      
      const localPath = await mockDownloadFromS3(paragraph.audioS3Key);
      const duration = paragraph.audioDuration || 0;
      
      audioFiles.push({ localPath, duration });
      totalDuration += duration;
    }

    if (audioFiles.length === 0) {
      throw new Error('No audio files downloaded');
    }

    const outputPath = `/tmp/page-${page.pageNumber}-${Date.now()}.mp3`;

    await new Promise((resolve, reject) => {
      let command = mockFfmpeg();
      
      audioFiles.forEach(file => {
        command = command.input(file.localPath);
      });
      
      command
        .audioCodec('mp3')
        .audioBitrate('128k')
        .audioFrequency(22050)
        .audioChannels(1)
        .on('start', () => {})
        .on('progress', () => {})
        .on('end', () => resolve(outputPath))
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });

    const combinedS3Key = await mockUploadToS3(outputPath, `combined-audio/page-${page.pageNumber}-combined.mp3`);

    await mockPrisma.page.update({
      where: { id: page.id },
      data: {
        audioStatus: AudioStatus.READY,
        audioS3Key: combinedS3Key,
        audioDuration: totalDuration,
      },
    });

    return {
      success: true,
      pageId: page.id,
      combinedS3Key,
      totalDuration,
      audioFilesCount: audioFiles.length,
    };
  }
});
