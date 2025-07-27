import { Test, TestingModule } from '@nestjs/testing';
import { BooksExportService } from './books-export.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { S3Service } from '../s3/s3.service';
import { AudioStatus } from '@prisma/client';
import { Readable } from 'stream';

describe('BooksExportService', () => {
  let service: BooksExportService;
  let prismaService: jest.Mocked<PrismaService>;
  let queueService: jest.Mocked<QueueService>;
  let s3Service: jest.Mocked<S3Service>;

  const mockBook = {
    id: 'book-1',
    title: 'Test Book',
    pages: [
      {
        id: 'page-1',
        pageNumber: 1,
        audioStatus: AudioStatus.READY,
        audioS3Key: 'page-1-audio.mp3',
        paragraphs: [
          { id: 'para-1', completed: true, audioS3Key: 'para-1.mp3' },
          { id: 'para-2', completed: true, audioS3Key: 'para-2.mp3' },
        ],
      },
      {
        id: 'page-2',
        pageNumber: 2,
        audioStatus: AudioStatus.PENDING,
        audioS3Key: null,
        paragraphs: [
          { id: 'para-3', completed: false, audioS3Key: null },
        ],
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      book: {
        findUnique: jest.fn(),
      },
      page: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockQueueService = {
      addPageAudioCombinationJob: jest.fn(),
      cancelPageAudioCombinationJob: jest.fn(),
    };

    const mockS3Service = {
      deleteObject: jest.fn(),
      getObjectStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksExportService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    service = module.get<BooksExportService>(BooksExportService);
    prismaService = module.get(PrismaService);
    queueService = module.get(QueueService);
    s3Service = module.get(S3Service);
  });

  describe('getBookExportStatus', () => {
    it('should return correct export status for book pages', async () => {
      prismaService.book.findUnique.mockResolvedValue(mockBook as any);

      const result = await service.getBookExportStatus('book-1');

      expect(result).toEqual({
        bookId: 'book-1',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            audioStatus: AudioStatus.READY,
            audioS3Key: 'page-1-audio.mp3',
            completedParagraphs: 2,
            totalParagraphs: 2,
            completionPercentage: 100,
          },
          {
            id: 'page-2',
            pageNumber: 2,
            audioStatus: AudioStatus.PENDING,
            audioS3Key: null,
            completedParagraphs: 0,
            totalParagraphs: 1,
            completionPercentage: 0,
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
        data: { audioStatus: AudioStatus.GENERATING },
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
        'Page not found'
      );
    });

    it('should throw error if no completed paragraphs', async () => {
      const pageWithNoCompleted = {
        ...mockPage,
        paragraphs: [{ id: 'para-1', completed: false, audioS3Key: null }],
      };
      prismaService.page.findUnique.mockResolvedValue(pageWithNoCompleted as any);

      await expect(service.startPageExport('book-1', 'page-1')).rejects.toThrow(
        'No completed paragraphs found for this page'
      );
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
      s3Service.deleteObject.mockResolvedValue(undefined);
      prismaService.page.update.mockResolvedValue({ ...mockPageWithAudio, audioStatus: AudioStatus.NONE, audioS3Key: null } as any);

      const result = await service.deletePageAudio('book-1', 'page-1');

      expect(s3Service.deleteObject).toHaveBeenCalledWith('page-1-audio.mp3');
      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: {
          audioStatus: AudioStatus.PENDING,
          audioS3Key: null,
        },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw error if page not found', async () => {
      prismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.deletePageAudio('book-1', 'nonexistent')).rejects.toThrow(
        'Page not found'
      );
    });

    it('should throw error if no audio to delete', async () => {
      const pageWithoutAudio = {
        ...mockPageWithAudio,
        audioStatus: AudioStatus.PENDING,
        audioS3Key: null,
      };
      prismaService.page.findUnique.mockResolvedValue(pageWithoutAudio as any);

      await expect(service.deletePageAudio('book-1', 'page-1')).rejects.toThrow(
        'No exported audio available for this page'
      );
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
      queueService.cancelPageAudioCombinationJob.mockResolvedValue(true);
      prismaService.page.update.mockResolvedValue({ ...mockGeneratingPage, audioStatus: AudioStatus.NONE } as any);

      const result = await service.cancelPageExport('book-1', 'page-1');

      expect(queueService.cancelPageAudioCombinationJob).toHaveBeenCalledWith('page-1');
      expect(prismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { audioStatus: AudioStatus.PENDING },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw error if page not found', async () => {
      prismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.cancelPageExport('book-1', 'nonexistent')).rejects.toThrow(
        'Page not found'
      );
    });

    it('should throw error if page not generating', async () => {
      const pageNotGenerating = {
        ...mockGeneratingPage,
        audioStatus: AudioStatus.READY,
      };
      prismaService.page.findUnique.mockResolvedValue(pageNotGenerating as any);

      await expect(service.cancelPageExport('book-1', 'page-1')).rejects.toThrow(
        'Page is not currently being exported'
      );
    });
  });
});
