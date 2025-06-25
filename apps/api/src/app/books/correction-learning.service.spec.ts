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
      expect(createCall.data).toHaveProperty('fixType');
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
        originalWord: 'שלום',
        correctedWord: 'שלום',
        sentenceContext: 'שלום עולם',
        fixType: 'substitution',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        book: {
          title: 'Test Book 1',
        },
        paragraph: {
          id: 'paragraph-1',
          orderIndex: 1,
          pageId: 1,
          page: {
            pageNumber: 1,
          },
        },
      },
      {
        id: 'correction-2',
        paragraphId: 'paragraph-2',
        bookId: 'book-1',
        originalWord: 'עולם',
        correctedWord: 'עולם',
        sentenceContext: 'שלום עולם טוב',
        fixType: 'addition',
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        book: {
          title: 'Test Book 1',
        },
        paragraph: {
          id: 'paragraph-2',
          orderIndex: 2,
          pageId: 1,
          page: {
            pageNumber: 1,
          },
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
          paragraph: {
            id: correction.paragraph.id,
            orderIndex: correction.paragraph.orderIndex,
            pageId: correction.paragraph.pageId,
            pageNumber: correction.paragraph.page.pageNumber,
          },
        })),
        total: 2,
        page: 1,
        totalPages: 1,
      });

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          book: {
            select: {
              title: true,
            },
          },
          paragraph: {
            include: {
              page: {
                select: {
                  pageNumber: true,
                },
              },
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
          book: {
            select: {
              title: true,
            },
          },
          paragraph: {
            include: {
              page: {
                select: {
                  pageNumber: true,
                },
              },
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
        expect(correction.paragraph).toHaveProperty('pageId');
        expect(correction.paragraph).toHaveProperty('pageNumber');
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

    describe('Data Structure Mapping Tests', () => {
      it('should correctly map nested book and page data to flat structure', async () => {
        const mockRawCorrection = {
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: 'substitution',
          createdAt: new Date('2025-06-22T10:00:00.000Z'),
          updatedAt: new Date('2025-06-22T10:00:00.000Z'),
          book: {
            title: 'ספר בדיקה',
          },
          paragraph: {
            id: 'paragraph-1',
            orderIndex: 5,
            pageId: 'page-1',
            page: {
              pageNumber: 3,
            },
          },
        };

        mockPrismaService.textCorrection.findMany.mockResolvedValue([mockRawCorrection]);
        mockPrismaService.textCorrection.count.mockResolvedValue(1);

        const result = await service.getAllCorrections({ page: 1, limit: 10 });

        expect(result.corrections).toHaveLength(1);
        const correction = result.corrections[0];

        // Verify the mapping removes nested structures and flattens data
        expect(correction).toEqual({
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: 'substitution',
          createdAt: new Date('2025-06-22T10:00:00.000Z'),
          updatedAt: new Date('2025-06-22T10:00:00.000Z'),
          bookTitle: 'ספר בדיקה', // Flattened from book.title
          paragraph: {
            id: 'paragraph-1',
            orderIndex: 5,
            pageId: 'page-1',
            pageNumber: 3, // Flattened from paragraph.page.pageNumber
          },
        });

        // Ensure nested structures are removed
        expect(correction).not.toHaveProperty('book');
        expect(correction.paragraph).not.toHaveProperty('page');
      });

      it('should handle multiple corrections with consistent data structure', async () => {
        const mockRawCorrections = [
          {
            id: 'correction-1',
            paragraphId: 'paragraph-1',
            bookId: 'book-1',
            originalWord: 'שגיאה',
            correctedWord: 'תיקון',
            sentenceContext: 'משפט ראשון',
            fixType: 'substitution',
            createdAt: new Date('2025-06-22T10:00:00.000Z'),
            updatedAt: new Date('2025-06-22T10:00:00.000Z'),
            book: { title: 'ספר ראשון' },
            paragraph: {
              id: 'paragraph-1',
              orderIndex: 1,
              pageId: 'page-1',
              page: { pageNumber: 1 },
            },
          },
          {
            id: 'correction-2',
            paragraphId: 'paragraph-2',
            bookId: 'book-2',
            originalWord: 'טעות',
            correctedWord: 'נכון',
            sentenceContext: 'משפט שני',
            fixType: 'manual',
            createdAt: new Date('2025-06-22T11:00:00.000Z'),
            updatedAt: new Date('2025-06-22T11:00:00.000Z'),
            book: { title: 'ספר שני' },
            paragraph: {
              id: 'paragraph-2',
              orderIndex: 3,
              pageId: 'page-2',
              page: { pageNumber: 2 },
            },
          },
        ];

        mockPrismaService.textCorrection.findMany.mockResolvedValue(mockRawCorrections);
        mockPrismaService.textCorrection.count.mockResolvedValue(2);

        const result = await service.getAllCorrections({ page: 1, limit: 10 });

        expect(result.corrections).toHaveLength(2);

        // Verify each correction has the correct flattened structure
        result.corrections.forEach((correction, index) => {
          const expectedBookTitles = ['ספר ראשון', 'ספר שני'];
          const expectedPageNumbers = [1, 2];
          const expectedOrderIndexes = [1, 3];

          expect(correction.bookTitle).toBe(expectedBookTitles[index]);
          expect(correction.paragraph.pageNumber).toBe(expectedPageNumbers[index]);
          expect(correction.paragraph.orderIndex).toBe(expectedOrderIndexes[index]);
          
          // Verify structure consistency
          expect(correction).toHaveProperty('bookId');
          expect(correction).toHaveProperty('bookTitle');
          expect(correction.paragraph).toHaveProperty('id');
          expect(correction.paragraph).toHaveProperty('orderIndex');
          expect(correction.paragraph).toHaveProperty('pageId');
          expect(correction.paragraph).toHaveProperty('pageNumber');
          
          // Ensure nested structures are removed
          expect(correction).not.toHaveProperty('book');
          expect(correction.paragraph).not.toHaveProperty('page');
        });
      });

      it('should ensure Prisma query uses correct include structure (not select + include)', async () => {
        mockPrismaService.textCorrection.findMany.mockResolvedValue([]);
        mockPrismaService.textCorrection.count.mockResolvedValue(0);

        await service.getAllCorrections({ page: 1, limit: 10 });

        const findManyCall = mockPrismaService.textCorrection.findMany.mock.calls[0][0];
        
        // Verify the include structure is correct and doesn't mix select + include
        expect(findManyCall.include).toBeDefined();
        expect(findManyCall.include.book).toEqual({
          select: { title: true }
        });
        expect(findManyCall.include.paragraph).toEqual({
          include: {
            page: {
              select: { pageNumber: true }
            }
          }
        });

        // Ensure paragraph doesn't have both select and include
        expect(findManyCall.include.paragraph).not.toHaveProperty('select');
      });

      it('should maintain data types in mapped structure', async () => {
        const mockRawCorrection = {
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: 'substitution',
          createdAt: new Date('2025-06-22T10:00:00.000Z'),
          updatedAt: new Date('2025-06-22T10:00:00.000Z'),
          book: { title: 'ספר בדיקה' },
          paragraph: {
            id: 'paragraph-1',
            orderIndex: 5,
            pageId: 'page-1',
            page: { pageNumber: 3 },
          },
        };

        mockPrismaService.textCorrection.findMany.mockResolvedValue([mockRawCorrection]);
        mockPrismaService.textCorrection.count.mockResolvedValue(1);

        const result = await service.getAllCorrections({ page: 1, limit: 10 });
        const correction = result.corrections[0];

        // Verify data types are preserved
        expect(typeof correction.id).toBe('string');
        expect(typeof correction.bookTitle).toBe('string');
        expect(typeof correction.paragraph.orderIndex).toBe('number');
        expect(typeof correction.paragraph.pageNumber).toBe('number');
        expect(correction.createdAt).toBeInstanceOf(Date);
        expect(correction.updatedAt).toBeInstanceOf(Date);
      });

      it('should handle null fixType in mapped structure', async () => {
        const mockRawCorrection = {
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: null, // Test null fixType
          createdAt: new Date('2025-06-22T10:00:00.000Z'),
          updatedAt: new Date('2025-06-22T10:00:00.000Z'),
          book: { title: 'ספר בדיקה' },
          paragraph: {
            id: 'paragraph-1',
            orderIndex: 5,
            pageId: 'page-1',
            page: { pageNumber: 3 },
          },
        };

        mockPrismaService.textCorrection.findMany.mockResolvedValue([mockRawCorrection]);
        mockPrismaService.textCorrection.count.mockResolvedValue(1);

        const result = await service.getAllCorrections({ page: 1, limit: 10 });
        const correction = result.corrections[0];

        expect(correction.fixType).toBeNull();
        expect(correction).toHaveProperty('fixType'); // Property should exist even if null
      });
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
