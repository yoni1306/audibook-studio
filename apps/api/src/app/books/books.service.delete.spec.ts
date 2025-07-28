import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { TextFixesService } from './text-fixes.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';

describe('BooksService - Delete Book', () => {
  let service: BooksService;
  let prismaService: any;
  let s3Service: any;

  const mockBook = {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    s3Key: 'books/test-book.epub',
    pages: [
      {
        id: 'page-1',
        pageNumber: 1,
        audioS3Key: 'audio/page-1.mp3',
        paragraphs: [
          {
            id: 'paragraph-1',
            audioS3Key: 'audio/paragraph-1.mp3',
          },
          {
            id: 'paragraph-2',
            audioS3Key: 'audio/paragraph-2.mp3',
          },
        ],
      },
      {
        id: 'page-2',
        pageNumber: 2,
        audioS3Key: 'audio/page-2.mp3',
        paragraphs: [
          {
            id: 'paragraph-3',
            audioS3Key: null, // No audio file
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      book: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockS3Service = {
      deleteFiles: jest.fn(),
    };

    const mockQueueService = {};
    const mockTextFixesService = {};
    const mockBulkTextFixesService = {};
    const mockMetricsService = {
      recordTextEdit: jest.fn().mockResolvedValue(undefined),
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: TextFixesService,
          useValue: mockTextFixesService,
        },
        {
          provide: BulkTextFixesService,
          useValue: mockBulkTextFixesService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    prismaService = module.get(PrismaService);
    s3Service = module.get(S3Service);

    // Mock the logger to avoid console output during tests
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteBook', () => {
    it('should successfully delete a book with all related S3 files', async () => {
      // Arrange
      const bookId = 'book-1';
      prismaService.book.findUnique.mockResolvedValue(mockBook as any);
      prismaService.book.delete.mockResolvedValue(mockBook as any);
      s3Service.deleteFiles.mockResolvedValue();

      // Act
      await service.deleteBook(bookId);

      // Assert
      expect(prismaService.book.findUnique).toHaveBeenCalledWith({
        where: { id: bookId },
        include: {
          pages: {
            include: {
              paragraphs: {
                select: {
                  audioS3Key: true,
                },
              },
            },
          },
        },
      });

      expect(prismaService.book.delete).toHaveBeenCalledWith({
        where: { id: bookId },
      });

      // Should delete all S3 files: book EPUB + page audio + paragraph audio
      const expectedS3Keys = [
        'books/test-book.epub', // Book EPUB
        'audio/page-1.mp3',     // Page 1 audio
        'audio/paragraph-1.mp3', // Paragraph 1 audio
        'audio/paragraph-2.mp3', // Paragraph 2 audio
        'audio/page-2.mp3',     // Page 2 audio
        // Note: paragraph-3 has no audio file (null)
      ];

      expect(s3Service.deleteFiles).toHaveBeenCalledWith(expectedS3Keys);
    });

    it('should handle book with no S3 files', async () => {
      // Arrange
      const bookId = 'book-2';
      const bookWithoutS3Files = {
        ...mockBook,
        s3Key: null,
        pages: [
          {
            id: 'page-1',
            audioS3Key: null,
            paragraphs: [
              { id: 'paragraph-1', audioS3Key: null },
            ],
          },
        ],
      };

      prismaService.book.findUnique.mockResolvedValue(bookWithoutS3Files as any);
      prismaService.book.delete.mockResolvedValue(bookWithoutS3Files as any);

      // Act
      await service.deleteBook(bookId);

      // Assert
      expect(prismaService.book.delete).toHaveBeenCalledWith({
        where: { id: bookId },
      });

      // Should not call S3 delete since there are no files
      expect(s3Service.deleteFiles).toHaveBeenCalledWith([]);
    });

    it('should throw error when book is not found', async () => {
      // Arrange
      const bookId = 'non-existent-book';
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteBook(bookId)).rejects.toThrow('Book not found: non-existent-book');

      expect(prismaService.book.findUnique).toHaveBeenCalledWith({
        where: { id: bookId },
        include: {
          pages: {
            include: {
              paragraphs: {
                select: {
                  audioS3Key: true,
                },
              },
            },
          },
        },
      });

      // Should not attempt to delete anything
      expect(prismaService.book.delete).not.toHaveBeenCalled();
      expect(s3Service.deleteFiles).not.toHaveBeenCalled();
    });

    it('should handle database deletion failure', async () => {
      // Arrange
      const bookId = 'book-1';
      const dbError = new Error('Database connection failed');
      
      prismaService.book.findUnique.mockResolvedValue(mockBook as any);
      prismaService.book.delete.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.deleteBook(bookId)).rejects.toThrow('Database connection failed');

      expect(prismaService.book.findUnique).toHaveBeenCalled();
      expect(prismaService.book.delete).toHaveBeenCalled();
      
      // S3 deletion should not be attempted if DB deletion fails
      expect(s3Service.deleteFiles).not.toHaveBeenCalled();
    });

    it('should handle S3 deletion failure after successful database deletion', async () => {
      // Arrange
      const bookId = 'book-1';
      const s3Error = new Error('S3 deletion failed');
      
      prismaService.book.findUnique.mockResolvedValue(mockBook as any);
      prismaService.book.delete.mockResolvedValue(mockBook as any);
      s3Service.deleteFiles.mockRejectedValue(s3Error);

      // Act & Assert
      await expect(service.deleteBook(bookId)).rejects.toThrow('S3 deletion failed');

      expect(prismaService.book.delete).toHaveBeenCalled();
      expect(s3Service.deleteFiles).toHaveBeenCalled();
    });

    it('should collect S3 keys correctly from complex book structure', async () => {
      // Arrange
      const complexBook = {
        id: 'complex-book',
        title: 'Complex Book',
        s3Key: 'books/complex.epub',
        pages: [
          {
            id: 'page-1',
            audioS3Key: 'audio/page-1.mp3',
            paragraphs: [
              { id: 'p1', audioS3Key: 'audio/p1.mp3' },
              { id: 'p2', audioS3Key: null },
              { id: 'p3', audioS3Key: 'audio/p3.mp3' },
            ],
          },
          {
            id: 'page-2',
            audioS3Key: null, // No page-level audio
            paragraphs: [
              { id: 'p4', audioS3Key: 'audio/p4.mp3' },
              { id: 'p5', audioS3Key: 'audio/p5.mp3' },
            ],
          },
          {
            id: 'page-3',
            audioS3Key: 'audio/page-3.mp3',
            paragraphs: [], // No paragraphs
          },
        ],
      };

      prismaService.book.findUnique.mockResolvedValue(complexBook as any);
      prismaService.book.delete.mockResolvedValue(complexBook as any);
      s3Service.deleteFiles.mockResolvedValue();

      // Act
      await service.deleteBook('complex-book');

      // Assert
      const expectedS3Keys = [
        'books/complex.epub',  // Book EPUB
        'audio/page-1.mp3',    // Page 1 audio
        'audio/p1.mp3',        // Paragraph 1 audio
        'audio/p3.mp3',        // Paragraph 3 audio (p2 has null)
        'audio/p4.mp3',        // Paragraph 4 audio (page 2 has no audio)
        'audio/p5.mp3',        // Paragraph 5 audio
        'audio/page-3.mp3',    // Page 3 audio (no paragraphs)
      ];

      expect(s3Service.deleteFiles).toHaveBeenCalledWith(expectedS3Keys);
    });

    it('should log appropriate messages during deletion process', async () => {
      // Arrange
      const bookId = 'book-1';
      prismaService.book.findUnique.mockResolvedValue(mockBook as any);
      prismaService.book.delete.mockResolvedValue(mockBook as any);
      s3Service.deleteFiles.mockResolvedValue();

      const logSpy = jest.spyOn(service['logger'], 'log');

      // Act
      await service.deleteBook(bookId);

      // Assert
      expect(logSpy).toHaveBeenCalledWith(`🗑️ Starting deletion of book: ${bookId}`);
      expect(logSpy).toHaveBeenCalledWith(`📚 Found book "Test Book" with 2 pages`);
      expect(logSpy).toHaveBeenCalledWith(`🗂️ Found 5 S3 files to delete`);
      expect(logSpy).toHaveBeenCalledWith(`✅ Book deleted from database: ${bookId}`);
      expect(logSpy).toHaveBeenCalledWith(`🗑️ Deleting 5 files from S3...`);
      expect(logSpy).toHaveBeenCalledWith(`🎉 Book deletion completed successfully: ${bookId}`);
    });
  });
});
