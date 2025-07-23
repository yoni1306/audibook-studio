import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - Aggregation Edge Cases', () => {
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

  describe('Aggregation Key Edge Cases', () => {
    it('should handle aggregation keys with special characters', async () => {
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום!',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום!|שָׁלוֹם',
          sentenceContext: 'שלום! איך שלומך?',
          fixType: FixType.punctuation,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].aggregationKey).toBe('שלום!|שָׁלוֹם');
      expect(result[0].originalWord).toBe('שלום!');
      expect(result[0].fixType).toBe(FixType.punctuation);
    });

    it('should handle aggregation keys with pipe characters in words', async () => {
      // Edge case: what if the original word contains a pipe character?
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'word|with|pipes',
          correctedWord: 'corrected',
          aggregationKey: 'word|with|pipes|corrected', // This could be problematic
          sentenceContext: 'Some context',
          fixType: FixType.default,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].originalWord).toBe('word|with|pipes');
      expect(result[0].correctedWord).toBe('corrected');
    });

    it('should handle empty aggregation results', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle malformed aggregation keys gracefully', async () => {
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'malformed-key-without-pipe', // Invalid format
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
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].aggregationKey).toBe('malformed-key-without-pipe');
    });
  });

  describe('Hebrew Text Edge Cases', () => {
    it('should handle Hebrew text with mixed vowelization', async () => {
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום', // No vowels
          correctedWord: 'שָׁלוֹם', // With vowels
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
          originalWord: 'שָׁלוֹם', // With vowels
          correctedWord: 'שלום', // No vowels (reverse correction)
          aggregationKey: 'שָׁלוֹם|שלום',
          sentenceContext: 'שָׁלוֹם עליכם',
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

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(2); // Should be treated as separate corrections
      expect(result.some(r => r.aggregationKey === 'שלום|שָׁלוֹם')).toBe(true);
      expect(result.some(r => r.aggregationKey === 'שָׁלוֹם|שלום')).toBe(true);
    });

    it('should handle Hebrew text with RTL marks and special characters', async () => {
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום\u200F', // With RTL mark
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום\u200F|שָׁלוֹם',
          sentenceContext: 'שלום\u200F לכם',
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
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].originalWord).toBe('שלום\u200F');
    });

    it('should handle very long Hebrew words', async () => {
      const longHebrewWord = 'שלוםשלוםשלוםשלוםשלוםשלוםשלוםשלוםשלוםשלום';
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: longHebrewWord,
          correctedWord: 'שָׁלוֹם',
          aggregationKey: `${longHebrewWord}|שָׁלוֹם`,
          sentenceContext: `${longHebrewWord} לכם`,
          fixType: FixType.expansion,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].originalWord).toBe(longHebrewWord);
      expect(result[0].fixType).toBe(FixType.expansion);
    });
  });

  describe('Database Error Handling', () => {
    it('should handle database connection errors in findAggregatedCorrections', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.textCorrection.findMany.mockRejectedValue(dbError);

      await expect(repository.findAggregatedCorrections()).rejects.toThrow('Database connection failed');
    });

    it('should handle database connection errors in findCorrectionsByAggregationKey', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.textCorrection.findMany.mockRejectedValue(dbError);

      await expect(repository.findCorrectionsByAggregationKey('test|key')).rejects.toThrow('Database connection failed');
    });

    it('should handle database connection errors in getTopCorrections', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.textCorrection.groupBy.mockRejectedValue(dbError);

      await expect(repository.getTopCorrections()).rejects.toThrow('Database connection failed');
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle zero minOccurrences filter', async () => {
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
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections({ minOccurrences: 0 });

      expect(result).toHaveLength(1); // Should include all corrections
    });

    it('should handle negative minOccurrences filter', async () => {
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
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections({ minOccurrences: -1 });

      expect(result).toHaveLength(1); // Should treat negative as 0
    });

    it('should handle zero limit filter', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      const result = await repository.findAggregatedCorrections({ limit: 0 });

      expect(result).toHaveLength(0);
    });

    it('should handle very large limit filter', async () => {
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
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections({ limit: 999999 });

      expect(result).toHaveLength(1); // Should return all available results
    });
  });

  describe('Multiple FixType Aggregation', () => {
    it('should properly aggregate corrections with different fix types for same word pair', async () => {
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
          fixType: FixType.disambiguation, // Different fix type, same word pair
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

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1); // Should aggregate by aggregationKey regardless of fixType
      expect(result[0].fixCount).toBe(2);
      expect(result[0].corrections).toHaveLength(2);
      
      // Should contain both fix types in corrections array
      const fixTypes = result[0].corrections.map(c => c.fixType);
      expect(fixTypes).toContain(FixType.vowelization);
      expect(fixTypes).toContain(FixType.disambiguation);
    });
  });

  describe('Date Handling Edge Cases', () => {
    it('should handle corrections with identical timestamps', async () => {
      const sameTimestamp = new Date('2025-01-01T10:00:00Z');
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: sameTimestamp,
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
          createdAt: sameTimestamp,
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

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].fixCount).toBe(2);
      expect(result[0].latestCorrection).toEqual(sameTimestamp);
    });

    it('should handle very old and very new timestamps', async () => {
      const veryOldDate = new Date('1900-01-01T00:00:00Z');
      const veryNewDate = new Date('2099-12-31T23:59:59Z');
      
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: veryOldDate,
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
          createdAt: veryNewDate,
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

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].latestCorrection).toEqual(veryNewDate); // Should use the latest date
    });
  });

  describe('Null and Undefined Value Handling', () => {
    it('should handle null book information gracefully', async () => {
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
          book: null, // Null book reference
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].book).toBeNull();
    });

    it('should handle null ttsModel and ttsVoice', async () => {
      const mockPrismaCorrections = [
        {
          id: '1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date('2025-01-01T10:00:00Z'),
          ttsModel: null,
          ttsVoice: null,
          paragraphId: 'para-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
          paragraph: {
            orderIndex: 1,
            page: { id: 'page-1', pageNumber: 1 }
          }
        }
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockPrismaCorrections);

      const result = await repository.findAggregatedCorrections();

      expect(result).toHaveLength(1);
      expect(result[0].ttsModel).toBeNull();
      expect(result[0].ttsVoice).toBeNull();
    });
  });
});
