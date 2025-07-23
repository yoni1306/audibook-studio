import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, TextCorrectionFilters } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - Aggregated Operations', () => {
  let repository: TextCorrectionRepository;
  let mockPrismaService: {
    textCorrection: {
      findMany: jest.Mock;
      groupBy: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      textCorrection: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextCorrectionRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<TextCorrectionRepository>(TextCorrectionRepository);
  });

  describe('findAggregatedCorrections', () => {
    it('should return aggregated corrections with book info', async () => {
      const mockCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          bookId: 'book-1',
          paragraphId: 'para-1',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
          },
          paragraph: {
            id: 'para-1',
            orderIndex: 0,
            page: {
              id: 'page-1',
              pageNumber: 1,
            },
          },
        },
        {
          id: '2',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום עליכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          bookId: 'book-1',
          paragraphId: 'para-2',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
          },
          paragraph: {
            id: 'para-2',
            orderIndex: 1,
            page: {
              id: 'page-1',
              pageNumber: 1,
            },
          },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        aggregationKey: 'שלום|שָׁלוֹם',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        fixType: FixType.vowelization,
        fixCount: 2,
        latestCorrection: new Date('2024-01-03'),
        book: {
          id: 'book-1',
          title: 'Test Book',
          author: 'Test Author',
        },
        location: {
          pageId: 'page-1',
          pageNumber: 1,
          paragraphId: 'para-2',
          paragraphIndex: 1,
        },
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
        corrections: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            originalWord: 'שלום',
            correctedWord: 'שָׁלוֹם',
            sentenceContext: 'שלום לכם',
            fixType: FixType.vowelization,
          }),
          expect.objectContaining({
            id: '2',
            originalWord: 'שלום',
            correctedWord: 'שָׁלוֹם',
            sentenceContext: 'שלום עליכם',
            fixType: FixType.vowelization,
          }),
        ]),
      });
    });

    it('should apply filters correctly', async () => {
      const filters: TextCorrectionFilters = {
        bookId: 'book-1',
        fixType: FixType.vowelization,
        minOccurrences: 2,
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findAggregatedCorrections(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          fixType: FixType.vowelization,
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
          paragraph: {
            include: {
              page: {
                select: {
                  id: true,
                  pageNumber: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should handle empty results', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      const result = await repository.findAggregatedCorrections();

      expect(result).toEqual([]);
    });

    it('should group corrections by aggregation key correctly', async () => {
      const mockCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          bookId: 'book-1',
          paragraphId: 'para-1',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
          },
          paragraph: {
            id: 'para-1',
            orderIndex: 0,
            page: {
              id: 'page-1',
              pageNumber: 1,
            },
          },
        },
        {
          id: '2',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          bookId: 'book-1',
          paragraphId: 'para-2',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
          },
          paragraph: {
            id: 'para-2',
            orderIndex: 1,
            page: {
              id: 'page-1',
              pageNumber: 1,
            },
          },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(2);
      expect(result[0].aggregationKey).toBe('שלום|שָׁלוֹם');
      expect(result[1].aggregationKey).toBe('בית|בַּיִת');
    });
  });

  describe('findCorrectionsByAggregationKey', () => {
    it('should return corrections for a specific aggregation key', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const mockCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          bookId: 'book-1',
          paragraphId: 'para-1',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
          },
          paragraph: {
            id: 'para-1',
            orderIndex: 0,
            page: {
              id: 'page-1',
              pageNumber: 1,
            },
          },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);

      const result = await repository.findCorrectionsByAggregationKey(aggregationKey);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          aggregationKey: 'שלום|שָׁלוֹם',
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
          paragraph: {
            include: {
              page: {
                select: {
                  id: true,
                  pageNumber: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        id: '1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        sentenceContext: 'שלום לכם',
        fixType: FixType.vowelization,
        book: {
          id: 'book-1',
          title: 'Test Book',
          author: 'Test Author',
        },
        location: {
          pageId: 'page-1',
          pageNumber: 1,
          paragraphId: 'para-1',
          paragraphIndex: 0,
        },
      }));
    });

    it('should filter by bookId when provided', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const bookId = 'book-1';

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findCorrectionsByAggregationKey(aggregationKey, bookId);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          aggregationKey: 'שלום|שָׁלוֹם',
          bookId: 'book-1',
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
          paragraph: {
            include: {
              page: {
                select: {
                  id: true,
                  pageNumber: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should handle empty results', async () => {
      const aggregationKey = 'nonexistent|key';
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      const result = await repository.findCorrectionsByAggregationKey(aggregationKey);

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correction statistics', async () => {
      const mockCount = 150;
      const mockGroupBy = [
        { fixType: FixType.vowelization, _count: { id: 100 } },
        { fixType: FixType.punctuation, _count: { id: 30 } },
        { fixType: FixType.expansion, _count: { id: 20 } },
      ];
      const mockUniqueWords = [
        { originalWord: 'שלום', correctedWord: 'שָׁלוֹם' },
        { originalWord: 'בית', correctedWord: 'בַּיִת' },
        { originalWord: 'ספר', correctedWord: 'סֵפֶר' },
      ];

      mockPrismaService.textCorrection.count.mockResolvedValue(mockCount);
      mockPrismaService.textCorrection.groupBy
        .mockResolvedValueOnce(mockUniqueWords) // For unique words count (first call)
        .mockResolvedValueOnce(mockGroupBy); // For fix type breakdown (second call)

      const result = await repository.getStats();

      expect(result).toEqual({
        totalCorrections: 150,
        uniqueWords: 3,
        fixTypeBreakdown: [
          { fixType: 'vowelization', count: 100 },
          { fixType: 'punctuation', count: 30 },
          { fixType: 'expansion', count: 20 },
        ],
      });

      expect(mockPrismaService.textCorrection.count).toHaveBeenCalledWith({
        where: {},
      });
      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledTimes(2);
    });

    it('should apply filters to stats', async () => {
      const filters: TextCorrectionFilters = {
        bookId: 'book-1',
        fixType: FixType.vowelization,
      };

      mockPrismaService.textCorrection.count.mockResolvedValue(50);
      mockPrismaService.textCorrection.groupBy
        .mockResolvedValueOnce([{ originalWord: 'שלום', correctedWord: 'שָׁלוֹם' }]) // For unique words count (first call)
        .mockResolvedValueOnce([{ fixType: FixType.vowelization, _count: { id: 50 } }]); // For fix type breakdown (second call)

      const result = await repository.getStats(filters);

      expect(mockPrismaService.textCorrection.count).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          fixType: FixType.vowelization,
        },
      });

      expect(result).toEqual({
        totalCorrections: 50,
        uniqueWords: 1,
        fixTypeBreakdown: [
          { fixType: 'vowelization', count: 50 },
        ],
      });
    });

    it('should handle empty stats', async () => {
      mockPrismaService.textCorrection.count.mockResolvedValue(0);
      mockPrismaService.textCorrection.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repository.getStats();

      expect(result).toEqual({
        totalCorrections: 0,
        uniqueWords: 0,
        fixTypeBreakdown: [],
      });
    });
  });

  describe('getTopCorrections', () => {
    it('should return top corrections by occurrence count', async () => {
      const mockTopCorrections = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          fixType: FixType.vowelization,
          _count: { id: 25 },
          _max: { updatedAt: new Date('2024-01-10') },
        },
        {
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          fixType: FixType.vowelization,
          _count: { id: 15 },
          _max: { updatedAt: new Date('2024-01-09') },
        },
        {
          originalWord: 'ספר',
          correctedWord: 'סֵפֶר',
          fixType: FixType.vowelization,
          _count: { id: 10 },
          _max: { updatedAt: new Date('2024-01-08') },
        },
      ];

      mockPrismaService.textCorrection.groupBy.mockResolvedValue(mockTopCorrections);

      const result = await repository.getTopCorrections({ take: 3 });

      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledWith({
        by: ['originalWord', 'correctedWord', 'fixType'],
        _count: {
          id: true,
        },
        _max: {
          updatedAt: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 3,
      });

      expect(result).toEqual([
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          fixType: FixType.vowelization,
          occurrenceCount: 25,
          lastUsed: new Date('2024-01-10'),
        },
        {
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          fixType: FixType.vowelization,
          occurrenceCount: 15,
          lastUsed: new Date('2024-01-09'),
        },
        {
          originalWord: 'ספר',
          correctedWord: 'סֵפֶר',
          fixType: FixType.vowelization,
          occurrenceCount: 10,
          lastUsed: new Date('2024-01-08'),
        },
      ]);
    });

    it('should use default take value when not provided', async () => {
      mockPrismaService.textCorrection.groupBy.mockResolvedValue([]);

      await repository.getTopCorrections();

      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should handle empty results', async () => {
      mockPrismaService.textCorrection.groupBy.mockResolvedValue([]);

      const result = await repository.getTopCorrections();

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle database errors in findAggregatedCorrections', async () => {
      const mockError = new Error('Database connection failed');
      mockPrismaService.textCorrection.findMany.mockRejectedValue(mockError);

      await expect(repository.findAggregatedCorrections()).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors in getStats', async () => {
      const mockError = new Error('Database connection failed');
      mockPrismaService.textCorrection.count.mockRejectedValue(mockError);

      await expect(repository.getStats()).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors in getTopCorrections', async () => {
      const mockError = new Error('Database connection failed');
      mockPrismaService.textCorrection.groupBy.mockRejectedValue(mockError);

      await expect(repository.getTopCorrections()).rejects.toThrow('Database connection failed');
    });
  });
});
