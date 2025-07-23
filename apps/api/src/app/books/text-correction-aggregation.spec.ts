import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - Aggregation', () => {
  let repository: TextCorrectionRepository;
  let mockPrismaService: {
    textCorrection: {
      create: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      groupBy: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockPrismaService = {
      textCorrection: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
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
    it('should group corrections by aggregationKey and return aggregated results', async () => {
      const mockPrismaCorrections = [
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
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '2',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום עליכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T11:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-2',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 2,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '3',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T12:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-3',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 3,
            page: { id: 'page-2', pageNumber: 2 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(2); // Two unique aggregation keys
      
      // Check first aggregated correction (שלום|שָׁלוֹם)
      const shalomFix = result.find(r => r.aggregationKey === 'שלום|שָׁלוֹם');
      expect(shalomFix).toBeDefined();
      if (shalomFix) {
        expect(shalomFix.originalWord).toBe('שלום');
        expect(shalomFix.correctedWord).toBe('שָׁלוֹם');
        expect(shalomFix.fixCount).toBe(2);
        expect(shalomFix.corrections).toHaveLength(2);
        const contexts = shalomFix.corrections.map(c => c.sentenceContext);
        expect(contexts).toContain('שלום לכם');
        expect(contexts).toContain('שלום עליכם');
      }

      // Check second aggregated correction (בית|בַּיִת)
      const bayitFix = result.find(r => r.aggregationKey === 'בית|בַּיִת');
      expect(bayitFix).toBeDefined();
      if (bayitFix) {
        expect(bayitFix.originalWord).toBe('בית');
        expect(bayitFix.correctedWord).toBe('בַּיִת');
        expect(bayitFix.fixCount).toBe(1);
        expect(bayitFix.corrections).toHaveLength(1);
      }
    });

    it('should apply minOccurrences filter', async () => {
      const mockPrismaCorrections = [
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
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '2',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T12:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-3',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 3,
            page: { id: 'page-2', pageNumber: 2 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections({ minOccurrences: 2 });

      expect(result).toHaveLength(0); // No corrections appear 2+ times
    });

    it('should apply limit filter', async () => {
      const mockPrismaCorrections = [
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
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '2',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T12:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-3',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 3,
            page: { id: 'page-2', pageNumber: 2 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections({ limit: 1 });

      expect(result).toHaveLength(1);
    });
  });

  describe('findWordCorrectionHistory', () => {
    it('should return all corrections for a specific original word', async () => {
      const mockPrismaCorrections = [
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
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '2',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום עליכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T11:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-2',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 2,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findWordCorrectionHistory('שלום');

      expect(result).toHaveLength(2);
      expect(result[0].originalWord).toBe('שלום');
      expect(result[1].originalWord).toBe('שלום');
      expect(result[0].sentenceContext).toBe('שלום לכם');
      expect(result[1].sentenceContext).toBe('שלום עליכם');
    });

    it('should filter by bookId when provided', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findWordCorrectionHistory('שלום', 'book-1');

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: { originalWord: 'שלום', bookId: 'book-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findCorrectionsByAggregationKey', () => {
    it('should return all corrections for a specific aggregation key', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      
      // Mock Prisma result structure (what Prisma returns)
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם איך אתם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '2',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום עליכם רבותי',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T11:00:00Z'),
          ttsModel: 'test-model-2',
          ttsVoice: 'test-voice-2',
          paragraphId: 'para-2',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 2,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '3',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום רב לכולם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T12:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-3',
          book: { id: 'book-2', title: 'Another Book', author: 'Another Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-2', pageNumber: 3 }
          }
        }
      ];
      
      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findCorrectionsByAggregationKey(aggregationKey);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: { aggregationKey },
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
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(3);
      expect(result[0].aggregationKey).toBe(aggregationKey);
      expect(result[0].originalWord).toBe('שלום');
      expect(result[0].correctedWord).toBe('שָׁלוֹם');
      expect(result[0].sentenceContext).toBe('שלום לכם איך אתם');
      expect(result[0].book.title).toBe('Test Book');
      expect(result[0].location.pageNumber).toBe(1);
      expect(result[0].location.paragraphIndex).toBe(1);
      expect(result[0].location.paragraphId).toBe('para-1');
      
      expect(result[1].sentenceContext).toBe('שלום עליכם רבותי');
      expect(result[2].sentenceContext).toBe('שלום רב לכולם');
      expect(result[2].book.title).toBe('Another Book');
    });

    it('should filter by bookId when provided', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const bookId = 'book-1';
      
      const mockPrismaCorrections = [
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
          paragraphId: 'para-1',
          bookId: 'book-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findCorrectionsByAggregationKey(aggregationKey, bookId);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: { 
          aggregationKey,
          bookId 
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
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].location.paragraphId).toBe('para-1');
    });

    it('should return empty array when no corrections found for aggregation key', async () => {
      const aggregationKey = 'nonexistent|key';
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      const result = await repository.findCorrectionsByAggregationKey(aggregationKey);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle Hebrew vowelization variations correctly', async () => {
      const aggregationKey = 'בית|בַּיִת';
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול ויפה',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-1',
          bookId: 'book-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findCorrectionsByAggregationKey(aggregationKey);

      expect(result).toHaveLength(1);
      expect(result[0].originalWord).toBe('בית');
      expect(result[0].correctedWord).toBe('בַּיִת');
      expect(result[0].aggregationKey).toBe('בית|בַּיִת');
    });

    it('should order results by createdAt desc', async () => {
      const aggregationKey = 'שלום|שָׁלוֹם';
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום ראשון',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T12:00:00Z'), // Latest
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-1',
          bookId: 'book-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        },
        {
          id: '2',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום שני',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'), // Earliest
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-2',
          bookId: 'book-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 2,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findCorrectionsByAggregationKey(aggregationKey);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' }
        })
      );
      
      expect(result[0].sentenceContext).toBe('שלום ראשון'); // Latest first
      expect(result[1].sentenceContext).toBe('שלום שני'); // Earliest second
    });
  });

  describe('create with aggregationKey', () => {
    it('should create a text correction with aggregationKey', async () => {
      const correctionData: CreateTextCorrectionData = {
        bookId: 'book-1',
        paragraphId: 'para-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        aggregationKey: 'שלום|שָׁלוֹם',
        sentenceContext: 'שלום לכם',
        fixType: FixType.vowelization,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      };

      const mockResult = {
        id: 'new-id',
        ...correctionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.textCorrection.create.mockResolvedValue(mockResult);

      const result = await repository.create(correctionData);

      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledWith({
        data: correctionData,
      });
      expect(result).toEqual(mockResult);
    });
  });
});
