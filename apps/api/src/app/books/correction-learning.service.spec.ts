import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CorrectionLearningService } from './correction-learning.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CorrectionLearningService', () => {
  let service: CorrectionLearningService;

  const mockPrismaService = {
    textCorrection: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    paragraph: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrectionLearningService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CorrectionLearningService>(CorrectionLearningService);

    // Setup default mocks
    mockPrismaService.paragraph.findUnique.mockResolvedValue({ bookId: 'test-book-id' });

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordCorrection', () => {
    const mockCorrectionData = {
      originalWord: 'שגיאה',
      correctedWord: 'תיקון',
      contextSentence: 'זה המשפט עם שגיאה בתוכו.',
      paragraphId: 'test-paragraph-id',
      fixType: 'substitution',
    };

    const mockCreatedCorrection = {
      id: 'test-correction-id',
      paragraphId: 'test-paragraph-id',
      originalWord: 'שגיאה',
      correctedWord: 'תיקון',
      sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
      fixType: 'substitution',
      createdAt: new Date('2025-06-22T10:00:00.000Z'),
      updatedAt: new Date('2025-06-22T10:00:00.000Z'),
    };

    it('should record a text correction with all fields', async () => {
      mockPrismaService.textCorrection.create.mockResolvedValue(mockCreatedCorrection);

      const result = await service.recordCorrection(mockCorrectionData);

      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledWith({
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: 'substitution',
        },
      });

      expect(result).toEqual(mockCreatedCorrection);
    });

    it('should record a correction without fixType', async () => {
      const dataWithoutFixType = {
        originalWord: 'שגיאה',
        correctedWord: 'תיקון',
        contextSentence: 'זה המשפט עם שגיאה בתוכו.',
        paragraphId: 'test-paragraph-id',
      };

      const expectedCreation = {
        ...mockCreatedCorrection,
        fixType: undefined,
      };

      mockPrismaService.textCorrection.create.mockResolvedValue(expectedCreation);

      const result = await service.recordCorrection(dataWithoutFixType);

      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledWith({
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: undefined,
        },
      });

      expect(result).toEqual(expectedCreation);
    });

    it('should handle empty context sentence', async () => {
      const dataWithEmptyContext = {
        ...mockCorrectionData,
        contextSentence: '',
      };

      const expectedCreation = {
        ...mockCreatedCorrection,
        sentenceContext: '',
      };

      mockPrismaService.textCorrection.create.mockResolvedValue(expectedCreation);

      const result = await service.recordCorrection(dataWithEmptyContext);

      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledWith({
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: '',
          fixType: 'substitution',
        },
      });

      expect(result).toEqual(expectedCreation);
    });

    it('should throw error when database operation fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPrismaService.textCorrection.create.mockRejectedValue(mockError);

      await expect(service.recordCorrection(mockCorrectionData)).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledTimes(1);
    });

    it('should validate required fields are passed to database', async () => {
      mockPrismaService.textCorrection.create.mockResolvedValue(mockCreatedCorrection);

      await service.recordCorrection(mockCorrectionData);

      const createCall = mockPrismaService.textCorrection.create.mock.calls[0][0];
      
      expect(createCall.data).toHaveProperty('paragraphId');
      expect(createCall.data).toHaveProperty('bookId');
      expect(createCall.data).toHaveProperty('originalWord');
      expect(createCall.data).toHaveProperty('correctedWord');
      expect(createCall.data).toHaveProperty('sentenceContext');
      expect(createCall.data.paragraphId).toBe('test-paragraph-id');
      expect(createCall.data.bookId).toBe('test-book-id');
      expect(createCall.data.originalWord).toBe('שגיאה');
      expect(createCall.data.correctedWord).toBe('תיקון');
      expect(createCall.data.sentenceContext).toBe('זה המשפט עם שגיאה בתוכו.');
    });
  });

  describe('getAllCorrections', () => {
    const mockCorrections = [
      {
        id: 'correction-1',
        paragraphId: 'paragraph-1',
        bookId: 'book-1',
        originalWord: 'שגיאה1',
        correctedWord: 'תיקון1',
        sentenceContext: 'משפט עם שגיאה1.',
        fixType: 'substitution',
        createdAt: new Date('2025-06-22T10:00:00.000Z'),
        updatedAt: new Date('2025-06-22T10:00:00.000Z'),
        book: {
          title: 'Test Book',
        },
        paragraph: {
          id: 'paragraph-1',
          orderIndex: 1,
          chapterNumber: 1,
        },
      },
      {
        id: 'correction-2',
        paragraphId: 'paragraph-2',
        bookId: 'book-1',
        originalWord: 'שגיאה2',
        correctedWord: 'תיקון2',
        sentenceContext: 'משפט עם שגיאה2.',
        fixType: 'insertion',
        createdAt: new Date('2025-06-22T11:00:00.000Z'),
        updatedAt: new Date('2025-06-22T11:00:00.000Z'),
        book: {
          title: 'Test Book',
        },
        paragraph: {
          id: 'paragraph-2',
          orderIndex: 2,
          chapterNumber: 1,
        },
      },
    ];

    it('should return paginated corrections with complete data structure', async () => {
      const filters = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);
      mockPrismaService.textCorrection.count.mockResolvedValue(2);

      const result = await service.getAllCorrections(filters);

      expect(result).toEqual({
        corrections: mockCorrections.map(correction => ({
          id: correction.id,
          paragraphId: correction.paragraphId,
          bookId: correction.bookId,
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          sentenceContext: correction.sentenceContext,
          fixType: correction.fixType,
          createdAt: correction.createdAt,
          updatedAt: correction.updatedAt,
          bookTitle: correction.book.title,
          paragraph: correction.paragraph,
        })),
        total: 2,
        page: 1,
        totalPages: 1,
      });

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          paragraph: {
            select: {
              id: true,
              orderIndex: true,
              chapterNumber: true,
            },
          },
          book: {
            select: {
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: 0,
        take: 10,
      });
    });

    it('should apply filters correctly', async () => {
      const filters = {
        page: 1,
        limit: 5,
        bookId: 'book-1',
        fixType: 'substitution',
        sortBy: 'originalWord' as const,
        sortOrder: 'asc' as const,
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue([mockCorrections[0]]);
      mockPrismaService.textCorrection.count.mockResolvedValue(1);

      const result = await service.getAllCorrections(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          fixType: 'substitution',
        },
        include: {
          paragraph: {
            select: {
              id: true,
              orderIndex: true,
              chapterNumber: true,
            },
          },
          book: {
            select: {
              title: true,
            },
          },
        },
        orderBy: {
          originalWord: 'asc',
        },
        skip: 0,
        take: 5,
      });

      expect(result.corrections).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should calculate pagination correctly', async () => {
      const filters = {
        page: 3,
        limit: 5,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);
      mockPrismaService.textCorrection.count.mockResolvedValue(12);

      const result = await service.getAllCorrections(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 3 - 1) * limit 5 = 10
          take: 5,
        })
      );

      expect(result).toEqual({
        corrections: [],
        total: 12,
        page: 3,
        totalPages: 3,
      });
    });

    it('should verify correction data structure completeness', async () => {
      const filters = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);
      mockPrismaService.textCorrection.count.mockResolvedValue(2);

      const result = await service.getAllCorrections(filters);

      // Verify each correction has all required fields
      result.corrections.forEach(correction => {
        expect(correction).toHaveProperty('id');
        expect(correction).toHaveProperty('paragraphId');
        expect(correction).toHaveProperty('originalWord');
        expect(correction).toHaveProperty('correctedWord');
        expect(correction).toHaveProperty('sentenceContext');
        expect(correction).toHaveProperty('fixType');
        expect(correction).toHaveProperty('createdAt');
        expect(correction).toHaveProperty('updatedAt');
        expect(correction).toHaveProperty('bookTitle');
        expect(typeof correction.bookTitle).toBe('string');
        
        // Verify paragraph structure
        expect(correction.paragraph).toHaveProperty('id');
        expect(correction.paragraph).toHaveProperty('orderIndex');
        expect(correction.paragraph).toHaveProperty('chapterNumber');
      });
    });

    it('should handle errors gracefully', async () => {
      const filters = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      const error = new Error('Database error');
      mockPrismaService.textCorrection.findMany.mockRejectedValue(error);

      await expect(service.getAllCorrections(filters)).rejects.toThrow('Database error');
    });

    it('should handle edge case with zero results', async () => {
      const filters = {
        page: 1,
        limit: 10,
        sortBy: 'originalWord' as const,
        sortOrder: 'asc' as const,
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);
      mockPrismaService.textCorrection.count.mockResolvedValue(0);

      const result = await service.getAllCorrections(filters);

      expect(result.corrections).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getFixTypes', () => {
    it('should return distinct fix types', async () => {
      const mockFixTypes = [
        { fixType: 'substitution' },
        { fixType: 'insertion' },
        { fixType: 'deletion' },
        { fixType: 'manual' },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockFixTypes);

      const result = await service.getFixTypes();

      expect(result).toEqual({ fixTypes: ['substitution', 'insertion', 'deletion', 'manual'] });

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          fixType: {
            not: null,
          },
        },
        select: {
          fixType: true,
        },
        distinct: ['fixType'],
      });
    });

    it('should filter out null fix types', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([
        { fixType: 'substitution' },
        { fixType: 'insertion' },
      ]);

      const result = await service.getFixTypes();

      expect(result).toEqual({ fixTypes: ['substitution', 'insertion'] });
    });
  });
});
