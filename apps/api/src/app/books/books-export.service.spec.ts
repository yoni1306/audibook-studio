import { Test, TestingModule } from '@nestjs/testing';
import { BooksExportService } from './books-export.service';
import { PrismaService } from '../prisma/prisma.service';
import { NatsQueueService } from '../queue/nats-queue.service';
import { S3Service } from '../s3/s3.service';
import { AudioStatus } from '@prisma/client';
import { Readable } from 'stream';

// Mock the PrismaService
const mockPrismaService = {
  book: {
    findUnique: jest.fn(),
  },
  page: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((callback) => callback(mockPrismaService)),
};

const mockQueueService = {
  addPageAudioCombinationJob: jest.fn(),
  cancelPageAudioCombinationJob: jest.fn(),
};

const mockS3Service = {
  deleteFiles: jest.fn(),
  getObjectStream: jest.fn(),
};

// Mock Logger to avoid console output during tests
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('BooksExportService', () => {
  let service: BooksExportService;
  let prismaService: typeof mockPrismaService;
  let queueService: typeof mockQueueService;
  let s3Service: typeof mockS3Service;

  const mockBook = {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    pages: [
      {
        id: 'page-1',
        pageNumber: 1,
        audioStatus: AudioStatus.READY,
        audioS3Key: 'page-1-audio.mp3',
        audioDuration: 120,
        paragraphs: [
          { id: 'para-1', completed: true, audioStatus: AudioStatus.READY, audioDuration: 60 },
          { id: 'para-2', completed: true, audioStatus: AudioStatus.READY, audioDuration: 60 },
        ],
      },
      {
        id: 'page-2',
        pageNumber: 2,
        audioStatus: AudioStatus.PENDING,
        audioS3Key: null,
        audioDuration: null,
        paragraphs: [
          { id: 'para-3', completed: false, audioStatus: null, audioDuration: null },
        ],
      },
    ],
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksExportService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NatsQueueService, useValue: mockQueueService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    })
    .setLogger(mockLogger)
    .compile();

    service = module.get<BooksExportService>(BooksExportService);
    prismaService = module.get(PrismaService);
    queueService = module.get(NatsQueueService);
    s3Service = module.get(S3Service);
  });

  describe('getBookExportStatus', () => {
    it('should return correct export status for book pages', async () => {
      prismaService.book.findUnique.mockResolvedValue(mockBook as any);

      const result = await service.getBookExportStatus('book-1');

      expect(result).toMatchObject({
        bookId: 'book-1',
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            audioStatus: AudioStatus.READY,
            audioS3Key: 'page-1-audio.mp3',
            completedParagraphsCount: 2,
            totalParagraphsCount: 2,
            willBeExported: true,
          },
          {
            id: 'page-2',
            pageNumber: 2,
            audioStatus: AudioStatus.PENDING,
            audioS3Key: null,
            completedParagraphsCount: 0,
            totalParagraphsCount: 1,
            willBeExported: false,
          },
        ],
      });
      expect(result.totalPages).toBe(2);
      expect(result.exportablePages).toBe(1);
      expect(result.pagesInProgress).toBe(0);
      expect(result.pagesReady).toBe(1);
    });

    it('should handle book with no pages', async () => {
      const bookWithNoPages = { ...mockBook, pages: [] };
      prismaService.book.findUnique.mockResolvedValue(bookWithNoPages as any);

      const result = await service.getBookExportStatus('book-1');

      expect(result.pages).toHaveLength(0);
      expect(result.totalPages).toBe(0);
      expect(result.exportablePages).toBe(0);
    });

    it('should calculate correct statistics for mixed page states', async () => {
      const complexBook = {
        ...mockBook,
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            audioStatus: AudioStatus.READY,
            audioS3Key: 'page-1.mp3',
            audioDuration: 120,
            paragraphs: [
              { id: 'para-1', completed: true, audioStatus: AudioStatus.READY, audioDuration: 60 },
              { id: 'para-2', completed: true, audioStatus: AudioStatus.READY, audioDuration: 60 },
            ],
          },
          {
            id: 'page-2',
            pageNumber: 2,
            audioStatus: AudioStatus.GENERATING,
            audioS3Key: null,
            audioDuration: null,
            paragraphs: [
              { id: 'para-3', completed: true, audioStatus: AudioStatus.READY, audioDuration: 45 },
            ],
          },
          {
            id: 'page-3',
            pageNumber: 3,
            audioStatus: AudioStatus.ERROR,
            audioS3Key: null,
            audioDuration: null,
            paragraphs: [
              { id: 'para-4', completed: true, audioStatus: AudioStatus.READY, audioDuration: 30 },
            ],
          },
          {
            id: 'page-4',
            pageNumber: 4,
            audioStatus: AudioStatus.PENDING,
            audioS3Key: null,
            audioDuration: null,
            paragraphs: [
              { id: 'para-5', completed: false, audioStatus: AudioStatus.PENDING, audioDuration: null },
            ],
          },
        ],
      };
      prismaService.book.findUnique.mockResolvedValue(complexBook as any);

      const result = await service.getBookExportStatus('book-1');

      expect(result.totalPages).toBe(4);
      expect(result.exportablePages).toBe(3); // Pages 1, 2, 3 have completed paragraphs
      expect(result.pagesInProgress).toBe(1); // Page 2 is GENERATING
      expect(result.pagesReady).toBe(1); // Page 1 is READY
      expect(result.pagesWithErrors).toBe(1); // Page 3 has ERROR
      expect(result.totalDuration).toBe(120); // Only ready pages count
    });

    it('should throw error if book not found', async () => {
      prismaService.book.findUnique.mockResolvedValue(null);

      await expect(service.getBookExportStatus('nonexistent')).rejects.toThrow(
        'Book not found'
      );
    });

    it('should handle database errors gracefully', async () => {
      prismaService.book.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getBookExportStatus('book-1')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('startBookExport', () => {
    it('should start export for all exportable pages', async () => {
      const bookWithMultiplePages = {
        ...mockBook,
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            audioStatus: AudioStatus.PENDING,
            paragraphs: [
              { id: 'para-1', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-1.mp3' },
              { id: 'para-2', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-2.mp3' },
            ],
          },
          {
            id: 'page-2',
            pageNumber: 2,
            audioStatus: AudioStatus.PENDING,
            paragraphs: [
              { id: 'para-3', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-3.mp3' },
            ],
          },
          {
            id: 'page-3',
            pageNumber: 3,
            audioStatus: AudioStatus.PENDING,
            paragraphs: [
              { id: 'para-4', completed: false, audioStatus: AudioStatus.PENDING, audioS3Key: null },
            ],
          },
        ],
      };
      
      prismaService.book.findUnique.mockResolvedValue(bookWithMultiplePages);
      queueService.addPageAudioCombinationJob.mockResolvedValue({ jobId: 'job-123' });
      prismaService.page.update.mockResolvedValue({});

      const result = await service.startBookExport('book-1');

      expect(result.success).toBe(true);
      expect(result.pagesQueued).toBe(2); // Pages 1 and 2
      expect(result.pagesSkipped).toBe(1); // Page 3
      expect(result.jobIds).toHaveLength(2);
      expect(result.message).toContain('2 pages will be processed');
      
      // Verify queue calls
      expect(queueService.addPageAudioCombinationJob).toHaveBeenCalledTimes(2);
      expect(queueService.addPageAudioCombinationJob).toHaveBeenCalledWith({
        pageId: 'page-1',
        bookId: 'book-1',
        audioFileKeys: ['para-1.mp3', 'para-2.mp3'],
      });
      expect(queueService.addPageAudioCombinationJob).toHaveBeenCalledWith({
        pageId: 'page-2',
        bookId: 'book-1',
        audioFileKeys: ['para-3.mp3'],
      });
      
      // Verify page status updates
      expect(prismaService.page.update).toHaveBeenCalledTimes(2);
    });

    it('should handle book with no exportable pages', async () => {
      const bookWithNoExportablePages = {
        ...mockBook,
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            audioStatus: AudioStatus.PENDING,
            paragraphs: [
              { id: 'para-1', completed: false, audioStatus: AudioStatus.PENDING, audioS3Key: null },
            ],
          },
        ],
      };
      
      prismaService.book.findUnique.mockResolvedValue(bookWithNoExportablePages);

      const result = await service.startBookExport('book-1');

      expect(result.success).toBe(false);
      expect(result.pagesQueued).toBe(0);
      expect(result.pagesSkipped).toBe(1);
      expect(result.jobIds).toHaveLength(0);
      expect(result.message).toContain('No pages available for export');
      
      expect(queueService.addPageAudioCombinationJob).not.toHaveBeenCalled();
      expect(prismaService.page.update).not.toHaveBeenCalled();
    });

    it('should skip pages with incomplete audio', async () => {
      const bookWithIncompleteAudio = {
        ...mockBook,
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            audioStatus: AudioStatus.PENDING,
            paragraphs: [
              { id: 'para-1', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-1.mp3' },
              { id: 'para-2', completed: true, audioStatus: AudioStatus.GENERATING, audioS3Key: null }, // Missing audio
            ],
          },
        ],
      };
      
      prismaService.book.findUnique.mockResolvedValue(bookWithIncompleteAudio);

      const result = await service.startBookExport('book-1');

      expect(result.success).toBe(false);
      expect(result.pagesQueued).toBe(0);
      expect(result.pagesSkipped).toBe(1);
      expect(queueService.addPageAudioCombinationJob).not.toHaveBeenCalled();
    });

    it('should throw error if book not found', async () => {
      prismaService.book.findUnique.mockResolvedValue(null);

      await expect(service.startBookExport('nonexistent')).rejects.toThrow(
        'Book not found: nonexistent'
      );
    });

    it('should handle queue service errors', async () => {
      const bookWithExportablePages = {
        ...mockBook,
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            audioStatus: AudioStatus.PENDING,
            paragraphs: [
              { id: 'para-1', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-1.mp3' },
            ],
          },
        ],
      };
      
      prismaService.book.findUnique.mockResolvedValue(bookWithExportablePages);
      queueService.addPageAudioCombinationJob.mockRejectedValue(new Error('Queue service unavailable'));

      await expect(service.startBookExport('book-1')).rejects.toThrow(
        'Queue service unavailable'
      );
    });
  });

  describe('startPageExport', () => {
    const mockPage = {
      id: 'page-1',
      bookId: 'book-1',
      pageNumber: 1,
      audioStatus: AudioStatus.PENDING,
      paragraphs: [
        { id: 'para-1', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-1.mp3' },
        { id: 'para-2', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-2.mp3' },
      ],
    };

    it('should start page export successfully', async () => {
      prismaService.page.findUnique.mockResolvedValue(mockPage);
      prismaService.page.update.mockResolvedValue({ ...mockPage, audioStatus: AudioStatus.GENERATING });
      queueService.addPageAudioCombinationJob.mockResolvedValue({ jobId: 'job-456' });

      const result = await service.startPageExport('book-1', 'page-1');

      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { audioStatus: 'GENERATING' },
      });
      expect(queueService.addPageAudioCombinationJob).toHaveBeenCalledWith({
        bookId: 'book-1',
        pageId: 'page-1',
        audioFileKeys: ['para-1.mp3', 'para-2.mp3'],
      });
      expect(result.success).toBe(true);
      expect(result.pagesQueued).toBe(1);
      expect(result.jobIds).toEqual(['job-456']);
    });

    it('should throw error if page not found', async () => {
      prismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.startPageExport('book-1', 'nonexistent')).rejects.toThrow(
        'Page not found: nonexistent'
      );
    });

    it('should return failure if no completed paragraphs', async () => {
      const pageWithNoCompleted = {
        ...mockPage,
        paragraphs: [{ id: 'para-1', completed: false, audioStatus: AudioStatus.PENDING, audioS3Key: null }],
      };
      prismaService.page.findUnique.mockResolvedValue(pageWithNoCompleted);

      const result = await service.startPageExport('book-1', 'page-1');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('no completed paragraphs');
      expect(result.pagesQueued).toBe(0);
      expect(result.pagesSkipped).toBe(1);
    });

    it('should return failure if paragraphs missing audio', async () => {
      const pageWithMissingAudio = {
        ...mockPage,
        paragraphs: [
          { id: 'para-1', completed: true, audioStatus: AudioStatus.READY, audioS3Key: 'para-1.mp3' },
          { id: 'para-2', completed: true, audioStatus: AudioStatus.GENERATING, audioS3Key: null },
        ],
      };
      prismaService.page.findUnique.mockResolvedValue(pageWithMissingAudio);

      const result = await service.startPageExport('book-1', 'page-1');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('2 completed paragraphs but only 1 have ready audio');
      expect(result.pagesQueued).toBe(0);
      expect(result.pagesSkipped).toBe(1);
    });
  });

  describe('deletePageAudio', () => {
    const mockPageWithAudio = {
      id: 'page-1',
      bookId: 'book-1',
      audioStatus: AudioStatus.READY,
      audioS3Key: 'page-1-audio.mp3',
    };

    it('should delete page audio successfully', async () => {
      const mockPageWithPageNumber = {
        ...mockPageWithAudio,
        pageNumber: 1,
      };
      prismaService.page.findUnique.mockResolvedValue(mockPageWithPageNumber);
      s3Service.deleteFiles.mockResolvedValue(undefined);
      prismaService.page.update.mockResolvedValue({ ...mockPageWithPageNumber, audioStatus: null, audioS3Key: null });

      const result = await service.deletePageAudio('book-1', 'page-1');

      expect(s3Service.deleteFiles).toHaveBeenCalledWith(['page-1-audio.mp3']);
      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: {
          audioStatus: null,
          audioS3Key: null,
          audioDuration: null,
        },
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('has been deleted');
    });

    it('should throw error if page not found', async () => {
      prismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.deletePageAudio('book-1', 'nonexistent')).rejects.toThrow(
        'Page not found: nonexistent'
      );
    });

    it('should return failure if no audio to delete', async () => {
      const pageWithoutAudio = {
        ...mockPageWithAudio,
        audioStatus: AudioStatus.PENDING,
        audioS3Key: null,
      };
      prismaService.page.findUnique.mockResolvedValue(pageWithoutAudio as any);

      const result = await service.deletePageAudio('book-1', 'page-1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('no exported audio');
    });
  });

  describe('getPageAudioStream', () => {
    const mockPageWithAudio = {
      id: 'page-1',
      pageNumber: 1,
      audioS3Key: 'page-1-audio.mp3',
      audioStatus: AudioStatus.READY,
    };

    it('should return audio stream successfully', async () => {
      const mockStream = new Readable();
      prismaService.page.findUnique.mockResolvedValue(mockPageWithAudio as any);
      s3Service.getObjectStream.mockResolvedValue(mockStream);

      const result = await service.getPageAudioStream('book-1', 'page-1');

      expect(s3Service.getObjectStream).toHaveBeenCalledWith('page-1-audio.mp3');
      expect(result).toBe(mockStream);
    });

    it('should throw error if page not found', async () => {
      prismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.getPageAudioStream('book-1', 'nonexistent')).rejects.toThrow(
        'Page not found'
      );
    });

    it('should throw error if no audio available', async () => {
      const pageWithoutAudio = {
        ...mockPageWithAudio,
        audioStatus: AudioStatus.PENDING,
        audioS3Key: null,
      };
      prismaService.page.findUnique.mockResolvedValue(pageWithoutAudio as any);

      await expect(service.getPageAudioStream('book-1', 'page-1')).rejects.toThrow(
        'No exported audio available for this page'
      );
    });
  });

  describe('cancelPageExport', () => {
    const mockGeneratingPage = {
      id: 'page-1',
      bookId: 'book-1',
      pageNumber: 1,
      audioStatus: AudioStatus.GENERATING,
    };

    it('should cancel page export successfully', async () => {
      prismaService.page.findUnique.mockResolvedValue(mockGeneratingPage);
      queueService.cancelPageAudioCombinationJob.mockResolvedValue({ cancelledJobs: 1 });
      prismaService.page.update.mockResolvedValue({ ...mockGeneratingPage, audioStatus: null });

      const result = await service.cancelPageExport('book-1', 'page-1');

      expect(queueService.cancelPageAudioCombinationJob).toHaveBeenCalledWith('page-1');
      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { audioStatus: null },
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('Export cancelled');
    });

    it('should throw error if page not found', async () => {
      prismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.cancelPageExport('book-1', 'nonexistent')).rejects.toThrow(
        'Page not found: nonexistent'
      );
    });

    it('should return failure if page not generating', async () => {
      const pageNotGenerating = {
        ...mockGeneratingPage,
        audioStatus: AudioStatus.READY,
      };
      prismaService.page.findUnique.mockResolvedValue(pageNotGenerating as any);

      const result = await service.cancelPageExport('book-1', 'page-1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not currently being exported');
    });
  });
});
