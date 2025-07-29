import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BooksExportService } from './books-export.service';
import { CorrectionLearningService } from './correction-learning.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { TextCorrectionRepository } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { FixType } from '@prisma/client';


describe('BooksController', () => {
  let controller: BooksController;
  let textCorrectionRepository: jest.Mocked<TextCorrectionRepository>;

  const mockCorrectionLearningService = {
    // Add mock methods as needed for existing endpoints
  };

  const mockBooksService = {
    getCompletedParagraphs: jest.fn(),
    // Add other mock methods as needed
  };

  const mockBooksExportService = {
    getBookExportStatus: jest.fn(),
    startBookExport: jest.fn(),
    startPageExport: jest.fn(),
    deletePageAudio: jest.fn(),
    getPageAudioStream: jest.fn(),
    cancelPageExport: jest.fn(),
  };

  const mockBulkTextFixesService = {
    // Add mock methods as needed
  };

  const mockTextCorrectionRepository = {
    findMany: jest.fn(),
    findManyWithBookInfo: jest.fn(),
    findCorrectionsByAggregationKey: jest.fn(),
    create: jest.fn(),
    findGroupedCorrections: jest.fn(),
    getStats: jest.fn(),
    getTopCorrections: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockPrismaService = {
    // Add mock methods as needed
  };

  const mockS3Service = {
    // Add mock methods as needed
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: mockBooksService,
        },
        {
          provide: BooksExportService,
          useValue: mockBooksExportService,
        },
        {
          provide: CorrectionLearningService,
          useValue: mockCorrectionLearningService,
        },
        {
          provide: BulkTextFixesService,
          useValue: mockBulkTextFixesService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TextCorrectionRepository,
          useValue: mockTextCorrectionRepository,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);
    textCorrectionRepository = module.get(TextCorrectionRepository);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllCorrections', () => {
    it('should return all corrections with default parameters', async () => {
      const mockCorrections = [
        {
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          originalWord: 'שגיאה',
          currentWord: 'שגיאה',
          correctedWord: 'תיקון',
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: 'זה משפט עם שגיאה',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
        {
          id: 'correction-2',
          paragraphId: 'paragraph-2',
          bookId: 'book-2',
          originalWord: 'טעות',
          currentWord: 'טעות',
          correctedWord: 'נכון',
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: 'זה משפט עם טעות',
          fixType: FixType.disambiguation,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
        },
      ];

      const mockCorrectionsWithBookInfo = mockCorrections.map(correction => ({
        ...correction,
        aggregationKey: `${correction.originalWord}|${correction.correctedWord}`,
        bookTitle: correction.bookId,
        book: { id: correction.bookId, title: correction.bookId, author: 'Test Author' },
        location: { 
          pageId: 'page-1', 
          pageNumber: 1, 
          paragraphId: correction.paragraphId, 
          paragraphIndex: 1 
        }
      }));
      textCorrectionRepository.findManyWithBookInfo.mockResolvedValue(mockCorrectionsWithBookInfo);

      const result = await controller.getAllCorrections({});

      expect(textCorrectionRepository.findManyWithBookInfo).toHaveBeenCalledWith({
        bookId: undefined,
        fixType: undefined,
        originalWord: undefined,
        limit: 100,
        orderBy: 'desc',
      });

      expect(result).toEqual({
        corrections: [
          {
            id: 'correction-1',
            originalWord: 'שגיאה',
            currentWord: 'שגיאה',
            correctedWord: 'תיקון',
            aggregationKey: 'שגיאה|תיקון',
            fixSequence: 1,
            isLatestFix: true,
            sentenceContext: 'זה משפט עם שגיאה',
            fixType: FixType.vowelization,
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
            bookId: 'book-1',
            bookTitle: 'book-1',
            paragraphId: 'paragraph-1',
            ttsModel: 'test-model',
            ttsVoice: 'test-voice',
            book: {
              id: 'book-1',
              title: 'book-1',
              author: 'Test Author',
            },
            location: {
              pageId: 'page-1',
              pageNumber: 1,
              paragraphId: 'paragraph-1',
              paragraphIndex: 1,
            },
          },
          {
            id: 'correction-2',
            originalWord: 'טעות',
            currentWord: 'טעות',
            correctedWord: 'נכון',
            aggregationKey: 'טעות|נכון',
            fixSequence: 1,
            isLatestFix: true,
            sentenceContext: 'זה משפט עם טעות',
            fixType: FixType.disambiguation,
            createdAt: new Date('2023-01-02'),
            updatedAt: new Date('2023-01-02'),
            bookId: 'book-2',
            bookTitle: 'book-2',
            paragraphId: 'paragraph-2',
            ttsModel: 'test-model',
            ttsVoice: 'test-voice',
            book: {
              id: 'book-2',
              title: 'book-2',
              author: 'Test Author',
            },
            location: {
              pageId: 'page-1',
              pageNumber: 1,
              paragraphId: 'paragraph-2',
              paragraphIndex: 1,
            },
          },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
        timestamp: expect.any(String),
      });
    });

    it('should apply filters correctly', async () => {
      const mockCorrections = [
        {
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          originalWord: 'שגיאה',
          currentWord: 'שגיאה',
          correctedWord: 'תיקון',
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: 'זה משפט עם שגיאה',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
      ];

      const mockCorrectionsWithBookInfo = mockCorrections.map(correction => ({
        ...correction,
        aggregationKey: `${correction.originalWord}|${correction.correctedWord}`,
        bookTitle: correction.bookId,
        book: { id: correction.bookId, title: correction.bookId, author: 'Test Author' },
        location: { 
          pageId: 'page-1', 
          pageNumber: 1, 
          paragraphId: correction.paragraphId, 
          paragraphIndex: 1 
        }
      }));
      textCorrectionRepository.findManyWithBookInfo.mockResolvedValue(mockCorrectionsWithBookInfo);

      const filters = {
        filters: {
          bookId: 'book-1',
          fixType: FixType.vowelization,
          originalWord: 'שגיאה',
        },
        limit: 50,
        sortOrder: 'asc' as 'asc' | 'desc',
      };

      await controller.getAllCorrections(filters);

      expect(textCorrectionRepository.findManyWithBookInfo).toHaveBeenCalledWith({
        bookId: 'book-1',
        fixType: FixType.vowelization,
        originalWord: 'שגיאה',
        limit: 50,
        orderBy: 'asc',
      });
    });

    it('should handle repository errors gracefully', async () => {
      const error = new Error('Database connection failed');
      textCorrectionRepository.findManyWithBookInfo.mockRejectedValue(error);

      await expect(controller.getAllCorrections({})).rejects.toThrow('Failed to get all corrections');

      expect(textCorrectionRepository.findManyWithBookInfo).toHaveBeenCalled();
    });

    it('should return empty array when no corrections found', async () => {
      textCorrectionRepository.findManyWithBookInfo.mockResolvedValue([]);

      const result = await controller.getAllCorrections({});

      expect(result).toEqual({
        corrections: [],
        total: 0,
        page: 1,
        totalPages: 0,
        timestamp: expect.any(String),
      });
    });

    it('should use default limit when not provided', async () => {
      textCorrectionRepository.findManyWithBookInfo.mockResolvedValue([]);

      await controller.getAllCorrections({ filters: {} });

      expect(textCorrectionRepository.findManyWithBookInfo).toHaveBeenCalledWith({
        bookId: undefined,
        fixType: undefined,
        originalWord: undefined,
        limit: 100,
        orderBy: 'desc',
      });
    });
  });

  describe('getCorrectionHistory', () => {
    it('should return correction history for aggregation key', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const mockCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          location: {
            pageId: 'page-1',
            pageNumber: 1,
            paragraphId: 'para-1',
            paragraphIndex: 1,
          },
        },
        {
          id: '2',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום עליכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T11:00:00Z'),
          ttsModel: 'test-model-2',
          ttsVoice: 'test-voice-2',
          book: { id: 'book-2', title: 'Another Book', author: 'Another Author' },
          location: {
            pageId: 'page-2',
            pageNumber: 2,
            paragraphId: 'para-2',
            paragraphIndex: 2,
          },
        },
      ];

      textCorrectionRepository.findCorrectionsByAggregationKey.mockResolvedValue(mockCorrections);

      const result = await controller.getCorrectionHistory(aggregationKey);

      expect(textCorrectionRepository.findCorrectionsByAggregationKey).toHaveBeenCalledWith(aggregationKey, undefined);
      expect(result).toEqual({
        aggregationKey: 'שלום|שָׁלוֹם',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        corrections: [
          {
            id: '1',
            originalWord: 'שלום',
            correctedWord: 'שָׁלוֹם',
            sentenceContext: 'שלום לכם',
            fixType: FixType.vowelization,
            ttsModel: 'test-model',
            ttsVoice: 'test-voice',
            createdAt: new Date('2025-01-01T10:00:00Z'),
            bookTitle: 'Test Book',
            bookAuthor: 'Test Author',
            pageNumber: 1,
            paragraphOrderIndex: 1,
          },
          {
            id: '2',
            originalWord: 'שלום',
            correctedWord: 'שָׁלוֹם',
            sentenceContext: 'שלום עליכם',
            fixType: FixType.vowelization,
            ttsModel: 'test-model-2',
            ttsVoice: 'test-voice-2',
            createdAt: new Date('2025-01-01T11:00:00Z'),
            bookTitle: 'Another Book',
            bookAuthor: 'Another Author',
            pageNumber: 2,
            paragraphOrderIndex: 2,
          },
        ],
        total: 2,
        timestamp: expect.any(String),
      });
    });

    it('should filter by bookId when provided', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const bookId = 'book-1';
      const mockCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          location: {
            pageId: 'page-1',
            pageNumber: 1,
            paragraphId: 'para-1',
            paragraphIndex: 1,
          },
        },
      ];

      textCorrectionRepository.findCorrectionsByAggregationKey.mockResolvedValue(mockCorrections);

      const result = await controller.getCorrectionHistory(aggregationKey, bookId);

      expect(textCorrectionRepository.findCorrectionsByAggregationKey).toHaveBeenCalledWith(aggregationKey, bookId);
      expect(result.corrections).toHaveLength(1);
      expect(result.corrections[0].bookTitle).toBe('Test Book');
    });

    it('should return empty array when no corrections found', async () => {
      const aggregationKey = 'nonexistent|key';
      textCorrectionRepository.findCorrectionsByAggregationKey.mockResolvedValue([]);

      const result = await controller.getCorrectionHistory(aggregationKey);

      expect(result).toEqual({
        aggregationKey: 'nonexistent|key',
        originalWord: 'nonexistent',
        correctedWord: 'key',
        corrections: [],
        total: 0,
        timestamp: expect.any(String),
      });
    });

    it('should handle Hebrew vowelization in aggregation key correctly', async () => {
      const aggregationKey = 'בית|בַּיִת';
      const mockCorrections = [
        {
          id: '1',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          location: {
            pageId: 'page-1',
            pageNumber: 1,
            paragraphId: 'para-1',
            paragraphIndex: 1,
          },
        },
      ];

      textCorrectionRepository.findCorrectionsByAggregationKey.mockResolvedValue(mockCorrections);

      const result = await controller.getCorrectionHistory(aggregationKey);

      expect(result.originalWord).toBe('בית');
      expect(result.correctedWord).toBe('בַּיִת');
      expect(result.corrections[0].sentenceContext).toBe('בית גדול');
    });

    it('should handle missing book info gracefully', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const mockCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: null, // Missing book info
          location: {
            pageId: 'page-1',
            pageNumber: 0, // Missing page info
            paragraphId: 'para-1',
            paragraphIndex: 0, // Missing paragraph info
          },
        },
      ];

      textCorrectionRepository.findCorrectionsByAggregationKey.mockResolvedValue(mockCorrections);

      const result = await controller.getCorrectionHistory(aggregationKey);

      expect(result.corrections[0].bookTitle).toBe('Unknown');
      expect(result.corrections[0].bookAuthor).toBe('Unknown');
      expect(result.corrections[0].pageNumber).toBe(0);
      expect(result.corrections[0].paragraphOrderIndex).toBe(0);
    });

    it('should handle repository errors gracefully', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const error = new Error('Database connection failed');
      textCorrectionRepository.findCorrectionsByAggregationKey.mockRejectedValue(error);

      await expect(controller.getCorrectionHistory(aggregationKey)).rejects.toThrow('Failed to get correction history');

      expect(textCorrectionRepository.findCorrectionsByAggregationKey).toHaveBeenCalledWith(aggregationKey, undefined);
    });
  });

  describe('getCompletedParagraphs', () => {
    const mockBookId = 'test-book-id';
    const mockCompletedParagraphsResult = {
      bookId: mockBookId,
      bookTitle: 'Test Book Title',
      pages: [
        {
          pageId: 'page-1',
          pageNumber: 1,
          completedParagraphs: [
            {
              id: 'paragraph-1',
              content: 'This is the first completed paragraph.',
              orderIndex: 1,
              audioStatus: 'COMPLETED',
              audioDuration: 5.2,
            },
            {
              id: 'paragraph-2',
              content: 'This is the second completed paragraph.',
              orderIndex: 2,
              audioStatus: 'COMPLETED',
              audioDuration: 3.8,
            },
          ],
        },
        {
          pageId: 'page-2',
          pageNumber: 2,
          completedParagraphs: [
            {
              id: 'paragraph-3',
              content: 'This is a completed paragraph on page 2.',
              orderIndex: 1,
              audioStatus: 'COMPLETED',
              audioDuration: 4.1,
            },
          ],
        },
      ],
      totalCompletedParagraphs: 3,
    };

    it('should return completed paragraphs successfully', async () => {
      mockBooksService.getCompletedParagraphs.mockResolvedValue(mockCompletedParagraphsResult);

      const result = await controller.getCompletedParagraphs(mockBookId);

      expect(mockBooksService.getCompletedParagraphs).toHaveBeenCalledWith(mockBookId);
      expect(result).toEqual({
        ...mockCompletedParagraphsResult,
        timestamp: expect.any(String),
      });
    });

    it('should return completed paragraphs with correct structure', async () => {
      mockBooksService.getCompletedParagraphs.mockResolvedValue(mockCompletedParagraphsResult);

      const result = await controller.getCompletedParagraphs(mockBookId);

      expect(result).toHaveProperty('bookId', mockBookId);
      expect(result).toHaveProperty('bookTitle', 'Test Book Title');
      expect(result).toHaveProperty('pages');
      expect(result).toHaveProperty('totalCompletedParagraphs', 3);
      expect(result).toHaveProperty('timestamp');
      
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0]).toHaveProperty('pageId', 'page-1');
      expect(result.pages[0]).toHaveProperty('pageNumber', 1);
      expect(result.pages[0]).toHaveProperty('completedParagraphs');
      expect(result.pages[0].completedParagraphs).toHaveLength(2);
      
      expect(result.pages[0].completedParagraphs[0]).toHaveProperty('id', 'paragraph-1');
      expect(result.pages[0].completedParagraphs[0]).toHaveProperty('content');
      expect(result.pages[0].completedParagraphs[0]).toHaveProperty('orderIndex', 1);
      expect(result.pages[0].completedParagraphs[0]).toHaveProperty('audioStatus', 'COMPLETED');
      expect(result.pages[0].completedParagraphs[0]).toHaveProperty('audioDuration', 5.2);
    });

    it('should handle empty completed paragraphs result', async () => {
      const emptyResult = {
        bookId: mockBookId,
        bookTitle: 'Test Book Title',
        pages: [],
        totalCompletedParagraphs: 0,
      };
      
      mockBooksService.getCompletedParagraphs.mockResolvedValue(emptyResult);

      const result = await controller.getCompletedParagraphs(mockBookId);

      expect(result).toEqual({
        ...emptyResult,
        timestamp: expect.any(String),
      });
      expect(result.pages).toHaveLength(0);
      expect(result.totalCompletedParagraphs).toBe(0);
    });

    it('should throw NotFoundException when book not found', async () => {
      mockBooksService.getCompletedParagraphs.mockResolvedValue(null);

      await expect(controller.getCompletedParagraphs(mockBookId)).rejects.toThrow(
        expect.objectContaining({
          message: `Book with ID ${mockBookId} not found`,
          status: 404,
        })
      );

      expect(mockBooksService.getCompletedParagraphs).toHaveBeenCalledWith(mockBookId);
    });

    it('should handle service errors and throw InternalServerErrorException', async () => {
      const serviceError = new Error('Database connection failed');
      mockBooksService.getCompletedParagraphs.mockRejectedValue(serviceError);

      await expect(controller.getCompletedParagraphs(mockBookId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to retrieve completed paragraphs',
          status: 500,
        })
      );

      expect(mockBooksService.getCompletedParagraphs).toHaveBeenCalledWith(mockBookId);
    });

    it('should not re-throw NotFoundException from service', async () => {
      const notFoundError = new NotFoundException('Book not found');
      mockBooksService.getCompletedParagraphs.mockRejectedValue(notFoundError);

      await expect(controller.getCompletedParagraphs(mockBookId)).rejects.toThrow(NotFoundException);

      expect(mockBooksService.getCompletedParagraphs).toHaveBeenCalledWith(mockBookId);
    });

    it('should log appropriate messages', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      
      mockBooksService.getCompletedParagraphs.mockResolvedValue(mockCompletedParagraphsResult);

      await controller.getCompletedParagraphs(mockBookId);

      expect(logSpy).toHaveBeenCalledWith(`🔍 [API] Getting completed paragraphs for book: ${mockBookId}`);
      expect(logSpy).toHaveBeenCalledWith(`✅ [API] Retrieved completed paragraphs for book ${mockBookId}: 3 paragraphs across 2 pages`);
      
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should log error messages on service failure', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      
      const serviceError = new Error('Service failure');
      mockBooksService.getCompletedParagraphs.mockRejectedValue(serviceError);

      await expect(controller.getCompletedParagraphs(mockBookId)).rejects.toThrow();

      expect(logSpy).toHaveBeenCalledWith(`🔍 [API] Getting completed paragraphs for book: ${mockBookId}`);
      expect(errorSpy).toHaveBeenCalledWith(
        `💥 [API] Error getting completed paragraphs for book ${mockBookId}: Service failure`,
        expect.any(String)
      );
      
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
