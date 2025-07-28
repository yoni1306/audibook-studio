import { Test, TestingModule } from '@nestjs/testing';
import { BooksExportService } from './books-export.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
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
        { provide: QueueService, useValue: mockQueueService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    service = module.get<BooksExportService>(BooksExportService);
    prismaService = module.get(PrismaService) as any;
    queueService = module.get(QueueService) as any;
    s3Service = module.get(S3Service) as any;
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
    });

    it('should throw error if book not found', async () => {
      prismaService.book.findUnique.mockResolvedValue(null);

      await expect(service.getBookExportStatus('nonexistent')).rejects.toThrow(
        'Book not found'
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
        { id: 'para-1', completed: true, audioS3Key: 'para-1.mp3' },
        { id: 'para-2', completed: true, audioS3Key: 'para-2.mp3' },
      ],
    };

    it('should start page export successfully', async () => {
      prismaService.page.findUnique.mockResolvedValue(mockPage as any);
      prismaService.page.update.mockResolvedValue({ ...mockPage, audioStatus: AudioStatus.GENERATING } as any);
      queueService.addPageAudioCombinationJob.mockResolvedValue(undefined);

      const result = await service.startPageExport('book-1', 'page-1');

      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { audioStatus: 'GENERATING' },
      });
      expect(queueService.addPageAudioCombinationJob).toHaveBeenCalledWith({
        bookId: 'book-1',
        pageId: 'page-1',
      });
      expect(result).toEqual({ success: true });
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
        paragraphs: [{ id: 'para-1', completed: false, audioS3Key: null }],
      };
      prismaService.page.findUnique.mockResolvedValue(pageWithNoCompleted as any);

      const result = await service.startPageExport('book-1', 'page-1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('no completed paragraphs');
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
      prismaService.page.findUnique.mockResolvedValue(mockPageWithAudio as any);
      s3Service.deleteFiles.mockResolvedValue(undefined);
      prismaService.page.update.mockResolvedValue({ ...mockPageWithAudio, audioStatus: null, audioS3Key: null } as any);

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
      expect(result).toEqual({ success: true });
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
      audioStatus: AudioStatus.GENERATING,
    };

    it('should cancel page export successfully', async () => {
      prismaService.page.findUnique.mockResolvedValue(mockGeneratingPage as any);
      queueService.cancelPageAudioCombinationJob.mockResolvedValue({ cancelledJobs: 1 });
      prismaService.page.update.mockResolvedValue({ ...mockGeneratingPage, audioStatus: null } as any);

      const result = await service.cancelPageExport('book-1', 'page-1');

      expect(queueService.cancelPageAudioCombinationJob).toHaveBeenCalledWith('page-1');
      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { audioStatus: null },
      });
      expect(result).toEqual({ success: true });
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
