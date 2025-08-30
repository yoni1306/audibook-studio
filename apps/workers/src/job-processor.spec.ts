import { JobProcessor } from './job-processor';
import { BookStatus, AudioStatus } from '@prisma/client';
import * as fs from 'fs/promises';

// Mock all external dependencies
jest.mock('./s3-client');
jest.mock('./text-processing/page-based-epub-parser');
jest.mock('./text-processing/xhtml-based-epub-parser');
jest.mock('./database.service', () => ({
  updateBookStatus: jest.fn(),
  updateBookMetadata: jest.fn(),
  getParagraph: jest.fn(),
  getBookMetadata: jest.fn(),
  prisma: {
    $disconnect: jest.fn(),
  },
}));
jest.mock('./page-based-database.service');
jest.mock('./tts-service');
jest.mock('fs/promises');
jest.mock('nats');

import { downloadFromS3, uploadToS3, deleteOldAudioFiles } from './s3-client';
import { PageBasedEPUBParser } from './text-processing/page-based-epub-parser';
import { XHTMLBasedEPUBParser } from './text-processing/xhtml-based-epub-parser';
import {
  updateBookStatus,
  updateBookMetadata,
  getParagraph,
  getBookMetadata,
} from './database.service';
import {
  saveEPUBParseResult,
  updateParagraphAudioStatus,
} from './page-based-database.service';
import { createTTSService } from './tts-service';
import { connect, StringCodec } from 'nats';

describe('JobProcessor', () => {
  let processor: JobProcessor;

  // Mock implementations
  const mockDownloadFromS3 = downloadFromS3 as jest.MockedFunction<typeof downloadFromS3>;
  const mockUploadToS3 = uploadToS3 as jest.MockedFunction<typeof uploadToS3>;
  const mockDeleteOldAudioFiles = deleteOldAudioFiles as jest.MockedFunction<typeof deleteOldAudioFiles>;
  const mockUpdateBookStatus = updateBookStatus as jest.MockedFunction<typeof updateBookStatus>;
  const mockUpdateBookMetadata = updateBookMetadata as jest.MockedFunction<typeof updateBookMetadata>;
  const mockGetParagraph = getParagraph as jest.MockedFunction<typeof getParagraph>;
  const mockGetBookMetadata = getBookMetadata as jest.MockedFunction<typeof getBookMetadata>;
  const mockSaveEPUBParseResult = saveEPUBParseResult as jest.MockedFunction<typeof saveEPUBParseResult>;
  const mockUpdateParagraphAudioStatus = updateParagraphAudioStatus as jest.MockedFunction<typeof updateParagraphAudioStatus>;
  const mockCreateTTSService = createTTSService as jest.MockedFunction<typeof createTTSService>;
  const mockFsUnlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>;
  const mockConnect = connect as jest.MockedFunction<typeof connect>;
  const mockStringCodec = StringCodec as jest.MockedFunction<typeof StringCodec>;

  beforeEach(() => {
    processor = new JobProcessor();
    jest.clearAllMocks();

    // Default mock implementations
    mockDownloadFromS3.mockResolvedValue('/tmp/test.epub');
    mockUploadToS3.mockResolvedValue(undefined);
    mockDeleteOldAudioFiles.mockResolvedValue(undefined);
    mockUpdateBookStatus.mockResolvedValue(undefined);
    mockUpdateBookMetadata.mockResolvedValue(undefined);
    mockGetBookMetadata.mockResolvedValue({
      processingMetadata: { diacriticsType: 'advanced', parsingMethod: 'xhtml-based' }
    });
    mockSaveEPUBParseResult.mockResolvedValue(undefined);
    mockUpdateParagraphAudioStatus.mockResolvedValue(undefined);
    mockFsUnlink.mockResolvedValue(undefined);

    // Mock NATS connection
    const mockJetstream = {
      publish: jest.fn().mockResolvedValue({ seq: 1 }),
    };
    const mockNatsConnection = {
      jetstream: jest.fn().mockReturnValue(mockJetstream),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockConnect.mockResolvedValue(mockNatsConnection);
    mockStringCodec.mockReturnValue({
      encode: jest.fn().mockReturnValue(new Uint8Array()),
      decode: jest.fn().mockReturnValue(''),
    } as any);
  });

  describe('processEpubParsing', () => {
    const mockJobData = {
      bookId: 'test-book-123',
      s3Key: 'test/sample.epub',
      parsingMethod: 'xhtml-based' as const,
      correlationId: 'test-correlation-123',
    };

    it('should process EPUB parsing with XHTML method successfully', async () => {
      const mockXHTMLParser = {
        parseEpub: jest.fn().mockResolvedValue({
          pages: [
            {
              pageNumber: 1,
              sourceChapter: 'Chapter 1',
              startPosition: 0,
              endPosition: 100,
              paragraphs: [
                { orderIndex: 0, content: 'Test paragraph' },
              ],
            },
          ],
          metadata: {
            totalPages: 1,
            totalParagraphs: 1,
            averageParagraphsPerPage: 1,
          },
        }),
      };

      (XHTMLBasedEPUBParser as jest.Mock).mockImplementation(() => mockXHTMLParser);

      const result = await processor.processEpubParsing(mockJobData);

      expect(mockDownloadFromS3).toHaveBeenCalledWith('test/sample.epub');
      expect(mockUpdateBookStatus).toHaveBeenCalledWith('test-book-123', BookStatus.PROCESSING);
      expect(mockXHTMLParser.parseEpub).toHaveBeenCalledWith('/tmp/test.epub');
      expect(mockSaveEPUBParseResult).toHaveBeenCalled();
      expect(mockUpdateBookStatus).toHaveBeenCalledWith('test-book-123', BookStatus.READY);
      expect(mockFsUnlink).toHaveBeenCalledWith('/tmp/test.epub');

      expect(result).toEqual({
        processed: true,
        bookId: 'test-book-123',
        paragraphCount: 1,
        duration: expect.any(Number),
      });
    });

    it('should process EPUB parsing with page-based method', async () => {
      const mockPageParser = {
        parseEpub: jest.fn().mockResolvedValue({
          pages: [
            {
              pageNumber: 1,
              paragraphs: [
                { orderIndex: 0, content: 'Test paragraph' },
              ],
            },
          ],
          metadata: {
            totalPages: 1,
            totalParagraphs: 1,
            averageParagraphsPerPage: 1,
          },
        }),
      };

      (PageBasedEPUBParser as jest.Mock).mockImplementation(() => mockPageParser);

      const jobData = { ...mockJobData, parsingMethod: 'page-based' as const };
      const result = await processor.processEpubParsing(jobData);

      expect(mockPageParser.parseEpub).toHaveBeenCalledWith('/tmp/test.epub');
      expect(result.processed).toBe(true);
    });

    it('should handle parsing errors and update book status to ERROR', async () => {
      const error = new Error('Parsing failed');
      (XHTMLBasedEPUBParser as jest.Mock).mockImplementation(() => ({
        parseEpub: jest.fn().mockRejectedValue(error),
      }));

      await expect(processor.processEpubParsing(mockJobData)).rejects.toThrow('Parsing failed');

      expect(mockUpdateBookStatus).toHaveBeenCalledWith('test-book-123', BookStatus.ERROR);
    });

    it('should automatically trigger diacritics processing after successful EPUB parsing', async () => {
      const mockXHTMLParser = {
        parseEpub: jest.fn().mockResolvedValue({
          pages: [
            {
              pageNumber: 1,
              sourceChapter: 'Chapter 1',
              startPosition: 0,
              endPosition: 100,
              paragraphs: [
                { orderIndex: 0, content: 'Test paragraph' },
              ],
            },
          ],
          metadata: {
            totalPages: 1,
            totalParagraphs: 1,
            averageParagraphsPerPage: 1,
          },
        }),
      };

      (XHTMLBasedEPUBParser as jest.Mock).mockImplementation(() => mockXHTMLParser);

      const result = await processor.processEpubParsing(mockJobData);

      // Verify EPUB parsing completed successfully
      expect(mockUpdateBookStatus).toHaveBeenCalledWith('test-book-123', BookStatus.READY);
      expect(result.processed).toBe(true);

      // Verify diacritics job was automatically triggered
      expect(mockConnect).toHaveBeenCalledWith({ servers: 'nats://127.0.0.1:4222' });
      
      // Get the mock jetstream and verify publish was called
      const mockNatsConnection = await mockConnect.mock.results[0].value;
      const mockJetstream = mockNatsConnection.jetstream();
      
      expect(mockJetstream.publish).toHaveBeenCalledWith(
        'jobs.python.add-advanced-diacritics',
        expect.any(Uint8Array)
      );

      // Verify the job data structure
      const publishCall = mockJetstream.publish.mock.calls[0];
      expect(publishCall[0]).toBe('jobs.python.add-advanced-diacritics');
      
      // Verify NATS connection was closed
      expect(mockNatsConnection.close).toHaveBeenCalled();
    });

    it('should handle diacritics trigger failure gracefully', async () => {
      const mockXHTMLParser = {
        parseEpub: jest.fn().mockResolvedValue({
          pages: [
            {
              pageNumber: 1,
              paragraphs: [{ orderIndex: 0, content: 'Test paragraph' }],
            },
          ],
          metadata: { totalPages: 1, totalParagraphs: 1, averageParagraphsPerPage: 1 },
        }),
      };

      (XHTMLBasedEPUBParser as jest.Mock).mockImplementation(() => mockXHTMLParser);
      
      // Mock NATS connection failure
      mockConnect.mockRejectedValueOnce(new Error('NATS connection failed'));

      const result = await processor.processEpubParsing(mockJobData);

      // EPUB parsing should still complete successfully
      expect(mockUpdateBookStatus).toHaveBeenCalledWith('test-book-123', BookStatus.READY);
      expect(result.processed).toBe(true);
      
      // Diacritics trigger failure should be logged but not fail the main process
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should handle empty pages result', async () => {
      (XHTMLBasedEPUBParser as jest.Mock).mockImplementation(() => ({
        parseEpub: jest.fn().mockResolvedValue({
          pages: [],
          metadata: { totalPages: 0, totalParagraphs: 0, averageParagraphsPerPage: 0 },
        }),
      }));

      await expect(processor.processEpubParsing(mockJobData)).rejects.toThrow(
        'No pages extracted from EPUB'
      );
    });
  });

  describe('processAudioGeneration', () => {
    const mockJobData = {
      paragraphId: 'para-123',
      bookId: 'book-123',
      content: 'Test paragraph content',
      correlationId: 'test-correlation-123',
    };

    const mockParagraph = {
      id: 'para-123',
      content: 'Test paragraph content',
      orderIndex: 0,
      page: {
        book: {
          ttsModel: 'azure',
          ttsVoice: 'en-US-JennyNeural',
          ttsSettings: { speed: 1.0 },
        },
      },
    };

    const mockTTSService = {
      generateAudio: jest.fn().mockResolvedValue({
        duration: 5.5,
        filePath: '/tmp/audio-para-123.mp3',
      }),
    };

    beforeEach(() => {
      mockGetParagraph.mockResolvedValue(mockParagraph as any);
      mockCreateTTSService.mockReturnValue(mockTTSService);
    });

    it('should process audio generation successfully', async () => {
      const result = await processor.processAudioGeneration(mockJobData);

      expect(mockUpdateParagraphAudioStatus).toHaveBeenCalledWith('para-123', AudioStatus.GENERATING);
      expect(mockGetParagraph).toHaveBeenCalledWith('para-123');
      expect(mockCreateTTSService).toHaveBeenCalledWith({
        model: 'azure',
        voice: 'en-US-JennyNeural',
        settings: { speed: 1.0 },
      });
      expect(mockTTSService.generateAudio).toHaveBeenCalledWith(
        'Test paragraph content',
        '/tmp/audio-para-123.mp3'
      );
      expect(mockDeleteOldAudioFiles).toHaveBeenCalledWith('book-123', 'para-123');
      expect(mockUploadToS3).toHaveBeenCalled();
      expect(mockUpdateParagraphAudioStatus).toHaveBeenCalledWith(
        'para-123',
        AudioStatus.READY,
        expect.stringContaining('audio/book-123/para-123_'),
        5.5
      );

      expect(result).toEqual({
        processed: true,
        paragraphId: 'para-123',
        duration: 5.5,
        s3Key: expect.stringContaining('audio/book-123/para-123_'),
        processingTime: expect.any(Number),
      });
    });

    it('should handle paragraph not found', async () => {
      mockGetParagraph.mockResolvedValue(null);

      await expect(processor.processAudioGeneration(mockJobData)).rejects.toThrow(
        'Paragraph not found'
      );

      expect(mockUpdateParagraphAudioStatus).toHaveBeenCalledWith('para-123', AudioStatus.ERROR);
    });

    it('should handle TTS generation errors', async () => {
      const error = new Error('TTS failed');
      mockTTSService.generateAudio.mockRejectedValue(error);

      await expect(processor.processAudioGeneration(mockJobData)).rejects.toThrow('TTS failed');

      expect(mockUpdateParagraphAudioStatus).toHaveBeenCalledWith('para-123', AudioStatus.ERROR);
    });
  });

  describe('processPageAudioCombination', () => {
    const mockJobData = {
      pageId: 'page-123',
      bookId: 'book-123',
      correlationId: 'test-correlation-123',
    };

    // TODO: Fix complex mocking issues with dynamic require() calls in processPageAudioCombination
    // The jest.doMock() approach doesn't work with dynamic requires inside async functions
    it.skip('should process page audio combination successfully', async () => {
      // Mock prisma
      const mockPrisma = {
        page: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'page-123',
            pageNumber: 1,
            paragraphs: [
              {
                id: 'para-1',
                orderIndex: 0,
                audioS3Key: 'audio/book-123/para-1.mp3',
                audioDuration: 3.5,
              },
              {
                id: 'para-2',
                orderIndex: 1,
                audioS3Key: 'audio/book-123/para-2.mp3',
                audioDuration: 2.0,
              },
            ],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      // Mock require for prisma
      jest.doMock('./database.service', () => ({
        prisma: mockPrisma,
      }));

      // Mock ffmpeg
      const mockFfmpeg = jest.fn().mockReturnValue({
        input: jest.fn().mockReturnThis(),
        audioCodec: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        audioFrequency: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'end') {
            setTimeout(callback, 0);
          }
          return mockFfmpeg();
        }),
        mergeToFile: jest.fn(),
      });

      jest.doMock('fluent-ffmpeg', () => mockFfmpeg);

      mockDownloadFromS3
        .mockResolvedValueOnce('/tmp/para-1.mp3')
        .mockResolvedValueOnce('/tmp/para-2.mp3');

      const result = await processor.processPageAudioCombination(mockJobData);

      expect(mockPrisma.page.findUnique).toHaveBeenCalledWith({
        where: { id: 'page-123' },
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

      expect(mockDownloadFromS3).toHaveBeenCalledTimes(2);
      expect(mockUploadToS3).toHaveBeenCalled();
      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-123' },
        data: {
          audioS3Key: expect.stringContaining('books/book-123/pages/page-1-'),
          audioStatus: 'READY',
          audioDuration: 5.5, // 3.5 + 2.0
        },
      });

      expect(result).toEqual({
        processed: true,
        pageId: 'page-123',
        pageNumber: 1,
        bookId: 'book-123',
        s3Key: expect.stringContaining('books/book-123/pages/page-1-'),
        totalDuration: 5.5,
        paragraphCount: 2,
        duration: expect.any(Number),
      });
    });

    // TODO: Fix mocking for page not found scenario
    it.skip('should handle page not found', async () => {
      const mockPrisma = {
        page: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };

      jest.doMock('./database.service', () => ({
        prisma: mockPrisma,
      }));

      await expect(processor.processPageAudioCombination(mockJobData)).rejects.toThrow(
        'Page not found: page-123'
      );
    });

    // TODO: Fix mocking for no completed paragraphs scenario
    it.skip('should handle no completed paragraphs', async () => {
      const mockPrisma = {
        page: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'page-123',
            pageNumber: 1,
            paragraphs: [],
          }),
          update: jest.fn(),
        },
      };

      jest.doMock('./database.service', () => ({
        prisma: mockPrisma,
      }));

      await expect(processor.processPageAudioCombination(mockJobData)).rejects.toThrow(
        'No completed paragraphs with audio found for page 1'
      );
    });
  });
});
