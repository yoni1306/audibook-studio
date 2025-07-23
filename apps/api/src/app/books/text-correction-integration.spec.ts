import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - Integration Tests', () => {
  let repository: TextCorrectionRepository;
  let mockPrismaService: {
    textCorrection: {
      create: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      textCorrection: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
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

  describe('bulk operations workflow', () => {
    it('should handle bulk correction creation and aggregation workflow', async () => {
      // Step 1: Create multiple corrections for the same word
      const corrections: CreateTextCorrectionData[] = [
        {
          bookId: 'book-1',
          paragraphId: 'para-1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
        {
          bookId: 'book-1',
          paragraphId: 'para-2',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום עליכם',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
        {
          bookId: 'book-1',
          paragraphId: 'para-3',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      ];

      // Mock bulk creation
      mockPrismaService.textCorrection.createMany.mockResolvedValue({ count: 3 });

      const createResult = await repository.createMany(corrections);
      expect(createResult.count).toBe(3);

      // Step 2: Mock the aggregated view data
      const mockAggregatedData = [
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
        {
          id: '3',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-06'),
          bookId: 'book-1',
          paragraphId: 'para-3',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
          },
          paragraph: {
            id: 'para-3',
            orderIndex: 0,
            page: {
              id: 'page-2',
              pageNumber: 2,
            },
          },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockAggregatedData);

      // Step 3: Get aggregated corrections
      const aggregated = await repository.findAggregatedCorrections({ bookId: 'book-1' });

      expect(aggregated).toHaveLength(2); // Two unique aggregation keys
      
      // Verify the שלום correction is aggregated correctly
      const shalomCorrection = aggregated.find(c => c.aggregationKey === 'שלום|שָׁלוֹם');
      expect(shalomCorrection).toBeDefined();
      if (shalomCorrection) {
        expect(shalomCorrection.fixCount).toBe(2);
        expect(shalomCorrection.corrections).toHaveLength(2);
      }
      
      // Verify the בית correction
      const bayitCorrection = aggregated.find(c => c.aggregationKey === 'בית|בַּיִת');
      expect(bayitCorrection).toBeDefined();
      if (bayitCorrection) {
        expect(bayitCorrection.fixCount).toBe(1);
        expect(bayitCorrection.corrections).toHaveLength(1);
      }
    });

    it('should handle filtering and pagination in aggregated view', async () => {
      const mockFilteredData = [
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

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockFilteredData);

      const result = await repository.findAggregatedCorrections({
        bookId: 'book-1',
        fixType: FixType.vowelization,
        originalWord: 'שלום',
        limit: 10,
      });

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          fixType: FixType.vowelization,
          originalWord: {
            contains: 'שלום',
            mode: 'insensitive',
          },
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
    });
  });

  describe('statistics and analytics workflow', () => {
    it('should provide comprehensive statistics for dashboard', async () => {
      // Mock total count
      mockPrismaService.textCorrection.count.mockResolvedValue(150);

      // Mock fix type breakdown
      const mockFixTypeBreakdown = [
        { fixType: FixType.vowelization, _count: { id: 100 } },
        { fixType: FixType.punctuation, _count: { id: 30 } },
        { fixType: FixType.expansion, _count: { id: 20 } },
      ];

      // Mock unique words count
      const mockUniqueWords = [
        { originalWord: 'שלום', correctedWord: 'שָׁלוֹם' },
        { originalWord: 'בית', correctedWord: 'בַּיִת' },
        { originalWord: 'ספר', correctedWord: 'סֵפֶר' },
      ];

      mockPrismaService.textCorrection.groupBy
        .mockResolvedValueOnce(mockUniqueWords) // First call for unique words
        .mockResolvedValueOnce(mockFixTypeBreakdown); // Second call for fix type breakdown

      const stats = await repository.getStats({ bookId: 'book-1' });

      expect(stats).toEqual({
        totalCorrections: 150,
        uniqueWords: 3,
        fixTypeBreakdown: [
          { fixType: 'vowelization', count: 100 },
          { fixType: 'punctuation', count: 30 },
          { fixType: 'expansion', count: 20 },
        ],
      });

      // Verify calls were made with correct filters
      expect(mockPrismaService.textCorrection.count).toHaveBeenCalledWith({
        where: { bookId: 'book-1' },
      });
    });

    it('should get top corrections for suggestion system', async () => {
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
      ];

      mockPrismaService.textCorrection.groupBy.mockResolvedValue(mockTopCorrections);

      const topCorrections = await repository.getTopCorrections({ take: 5 });

      expect(topCorrections).toEqual([
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
      ]);

      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledWith({
        by: ['originalWord', 'correctedWord', 'fixType'],
        _count: { id: true },
        _max: { updatedAt: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });
    });
  });

  describe('correction history workflow', () => {
    it('should provide detailed correction history for UI expansion', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      
      const mockHistory = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם, איך אתם?',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          bookId: 'book-1',
          paragraphId: 'para-1',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Hebrew Grammar Book',
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
          sentenceContext: 'שלום עליכם ושלום על כל ישראל',
          fixType: FixType.vowelization,
          createdAt: new Date('2024-01-02T14:30:00Z'),
          updatedAt: new Date('2024-01-02T14:30:00Z'),
          bookId: 'book-1',
          paragraphId: 'para-5',
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: {
            id: 'book-1',
            title: 'Hebrew Grammar Book',
            author: 'Test Author',
          },
          paragraph: {
            id: 'para-5',
            orderIndex: 2,
            page: {
              id: 'page-3',
              pageNumber: 3,
            },
          },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockHistory);

      const history = await repository.findCorrectionsByAggregationKey(aggregationKey, 'book-1');

      expect(history).toHaveLength(2);
      
      // Verify the history is properly formatted for UI
      expect(history[0]).toEqual(expect.objectContaining({
        id: '1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        sentenceContext: 'שלום לכם, איך אתם?',
        fixType: FixType.vowelization,
        book: {
          id: 'book-1',
          title: 'Hebrew Grammar Book',
          author: 'Test Author',
        },
        location: {
          pageId: 'page-1',
          pageNumber: 1,
          paragraphId: 'para-1',
          paragraphIndex: 0,
        },
      }));

      expect(history[1]).toEqual(expect.objectContaining({
        id: '2',
        location: {
          pageId: 'page-3',
          pageNumber: 3,
          paragraphId: 'para-5',
          paragraphIndex: 2,
        },
      }));

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
  });

  describe('performance and edge cases', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock a large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `correction-${i}`,
        originalWord: `word${i % 100}`, // 100 unique words, each appearing 10 times
        correctedWord: `corrected${i % 100}`,
        aggregationKey: `word${i % 100}|corrected${i % 100}`,
        sentenceContext: `Context for word ${i}`,
        fixType: FixType.vowelization,
        createdAt: new Date(`2024-01-${(i % 30) + 1}`),
        updatedAt: new Date(`2024-01-${(i % 30) + 1}`),
        bookId: 'book-1',
        paragraphId: `para-${i}`,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
        book: {
          id: 'book-1',
          title: 'Large Test Book',
          author: 'Test Author',
        },
        paragraph: {
          id: `para-${i}`,
          orderIndex: i % 10,
          page: {
            id: `page-${Math.floor(i / 10)}`,
            pageNumber: Math.floor(i / 10) + 1,
          },
        },
      }));

      mockPrismaService.textCorrection.findMany.mockResolvedValue(largeDataset);

      const result = await repository.findAggregatedCorrections({ bookId: 'book-1' });

      // Should aggregate 1000 corrections into 100 unique aggregation keys
      expect(result).toHaveLength(100);
      
      // Each aggregation should have 10 corrections
      result.forEach(aggregation => {
        expect(aggregation.fixCount).toBe(10);
        expect(aggregation.corrections).toHaveLength(10);
      });
    });

    it('should handle Hebrew text with various diacritics and special characters', async () => {
      const hebrewTexts = [
        'שָׁלוֹם', // with vowels
        'שלום', // without vowels
        'בְּרֵאשִׁית', // complex vowelization
        'אֱלֹהִים', // with various diacritics
        'וַיֹּאמֶר', // with vav consecutive
      ];

      const mockCorrections = hebrewTexts.map((text, i) => ({
        id: `correction-${i}`,
        originalWord: text.replace(/[\u0591-\u05C7]/g, ''), // Remove diacritics for original
        correctedWord: text,
        aggregationKey: `${text.replace(/[\u0591-\u05C7]/g, '')}|${text}`,
        sentenceContext: `${text} בהקשר של משפט`,
        fixType: FixType.vowelization,
        createdAt: new Date(),
        updatedAt: new Date(),
        bookId: 'book-1',
        paragraphId: `para-${i}`,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
        book: {
          id: 'book-1',
          title: 'Hebrew Text Book',
          author: 'Hebrew Author',
        },
        paragraph: {
          id: `para-${i}`,
          orderIndex: i,
          page: {
            id: 'page-1',
            pageNumber: 1,
          },
        },
      }));

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);

      const result = await repository.findAggregatedCorrections({ bookId: 'book-1' });

      expect(result).toHaveLength(5);
      
      // Verify Hebrew text is preserved correctly
      result.forEach((correction, i) => {
        expect(correction.correctedWord).toBe(hebrewTexts[i]);
        expect(correction.corrections[0].sentenceContext).toContain(hebrewTexts[i]);
      });
    });

    it('should handle concurrent operations safely', async () => {
      // Simulate concurrent creation and reading
      const corrections1: CreateTextCorrectionData[] = [
        {
          bookId: 'book-1',
          paragraphId: 'para-1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      ];

      const corrections2: CreateTextCorrectionData[] = [
        {
          bookId: 'book-1',
          paragraphId: 'para-2',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      ];

      mockPrismaService.textCorrection.createMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      // Simulate concurrent operations
      const [result1, result2] = await Promise.all([
        repository.createMany(corrections1),
        repository.createMany(corrections2),
      ]);

      expect(result1.count).toBe(1);
      expect(result2.count).toBe(1);
      expect(mockPrismaService.textCorrection.createMany).toHaveBeenCalledTimes(2);
    });
  });
});
