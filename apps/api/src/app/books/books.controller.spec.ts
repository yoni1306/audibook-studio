import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
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
    // Add mock methods as needed
  };

  const mockBulkTextFixesService = {
    // Add mock methods as needed
  };

  const mockTextCorrectionRepository = {
    findMany: jest.fn(),
    findManyWithBookInfo: jest.fn(),
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
});
