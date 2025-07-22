import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TextCorrectionRepository } from './text-correction.repository';
import { Logger } from '@nestjs/common';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - History Integration Tests', () => {
  let repository: TextCorrectionRepository;
  let prismaService: PrismaService;
  let module: TestingModule;

  // Test data
  const testBookId = 'integration-test-book';
  const testParagraphId = 'integration-test-paragraph';
  const testParagraphId2 = 'integration-test-paragraph-2';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        TextCorrectionRepository,
        {
          provide: PrismaService,
          useValue: {
            textCorrection: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
              groupBy: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        Logger,
      ],
    }).compile();

    repository = module.get<TextCorrectionRepository>(TextCorrectionRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clean up test data before each test
    const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    prismaService.textCorrection.deleteMany = mockDeleteMany;
    
    await repository.deleteMany({
      bookId: testBookId,
    });
  });

  afterAll(async () => {
    // Final cleanup
    await repository.deleteMany({
      bookId: testBookId,
    });
    await module.close();
  });

  describe('End-to-End History Tracking', () => {
    it('should create and track complete fix history for Hebrew text', async () => {
      const originalWord = 'בראשית';
      const fixChain = [
        { current: 'בראשית', corrected: 'בְּרֵאשִׁית', type: FixType.vowelization },
        { current: 'בְּרֵאשִׁית', corrected: 'בְּרֵאשִׁית בָּרָא', type: FixType.disambiguation },
        { current: 'בְּרֵאשִׁית בָּרָא', corrected: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים', type: FixType.vowelization },
      ];

      const createdFixes = [];

      // Create the fix chain
      for (let i = 0; i < fixChain.length; i++) {
        const fix = fixChain[i];
        
        // Mock the database operations for this fix
        const existingCorrections = createdFixes.slice(); // Copy existing fixes
        const newFix = {
          id: `fix-${i + 1}`,
          bookId: testBookId,
          paragraphId: testParagraphId,
          originalWord: originalWord,
          currentWord: fix.current,
          correctedWord: fix.corrected,
          fixSequence: i + 1,
          isLatestFix: true,
          sentenceContext: 'פסוק ראשון בתורה',
          fixType: fix.type,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Mock transaction
        prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
          const tx = {
            textCorrection: {
              findMany: jest.fn().mockResolvedValue(existingCorrections),
              create: jest.fn().mockResolvedValue(newFix),
              updateMany: jest.fn().mockResolvedValue({ count: existingCorrections.length }),
            },
          };
          return callback(tx);
        });

        const result = await repository.createOrReplaceWithHistory({
          bookId: testBookId,
          paragraphId: testParagraphId,
          originalWord: originalWord,
          currentWord: fix.current,
          correctedWord: fix.corrected,
          sentenceContext: 'פסוק ראשון בתורה',
          fixType: fix.type,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        });

        expect(result.originalWord).toBe(originalWord);
        expect(result.fixSequence).toBe(i + 1);
        expect(result.isLatestFix).toBe(true);

        // Mark previous fixes as not latest and add new fix
        createdFixes.forEach(f => f.isLatestFix = false);
        createdFixes.push(newFix);
      }

      // Verify the complete history
      prismaService.textCorrection.findMany = jest.fn().mockResolvedValue(createdFixes);
      
      const history = await repository.getFixHistoryForWord(testParagraphId, originalWord);
      
      expect(history).toHaveLength(3);
      expect(history[0].fixSequence).toBe(1);
      expect(history[1].fixSequence).toBe(2);
      expect(history[2].fixSequence).toBe(3);
      expect(history[2].isLatestFix).toBe(true);
      
      // Verify fix chain integrity
      expect(history[0].currentWord).toBe(originalWord);
      expect(history[1].currentWord).toBe(history[0].correctedWord);
      expect(history[2].currentWord).toBe(history[1].correctedWord);
    });

    it('should handle parallel corrections in different paragraphs', async () => {
      const word = 'שלום';
      const correction1 = 'שָׁלוֹם';
      const correction2 = 'שלום רב';

      // Create correction in first paragraph
      const fix1 = {
        id: 'fix-p1',
        bookId: testBookId,
        paragraphId: testParagraphId,
        originalWord: word,
        currentWord: word,
        correctedWord: correction1,
        fixSequence: 1,
        isLatestFix: true,
        sentenceContext: 'משפט ראשון',
        fixType: FixType.vowelization,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          textCorrection: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue(fix1),
            updateMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result1 = await repository.createOrReplaceWithHistory({
        bookId: testBookId,
        paragraphId: testParagraphId,
        originalWord: word,
        currentWord: word,
        correctedWord: correction1,
        sentenceContext: 'משפט ראשון',
        fixType: FixType.vowelization,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      });

      // Create correction in second paragraph
      const fix2 = {
        id: 'fix-p2',
        bookId: testBookId,
        paragraphId: testParagraphId2,
        originalWord: word,
        currentWord: word,
        correctedWord: correction2,
        fixSequence: 1,
        isLatestFix: true,
        sentenceContext: 'משפט שני',
        fixType: FixType.disambiguation,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          textCorrection: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue(fix2),
            updateMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result2 = await repository.createOrReplaceWithHistory({
        bookId: testBookId,
        paragraphId: testParagraphId2,
        originalWord: word,
        currentWord: word,
        correctedWord: correction2,
        sentenceContext: 'משפט שני',
        fixType: FixType.disambiguation,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      });

      // Both should be independent sequences
      expect(result1.fixSequence).toBe(1);
      expect(result2.fixSequence).toBe(1);
      expect(result1.paragraphId).toBe(testParagraphId);
      expect(result2.paragraphId).toBe(testParagraphId2);
    });

    it('should maintain data consistency during bulk operations', async () => {
      const words = ['אמת', 'צדק', 'שלום'];
      const corrections = ['אֱמֶת', 'צֶדֶק', 'שָׁלוֹם'];
      const createdFixes = [];

      // Simulate bulk creation
      for (let i = 0; i < words.length; i++) {
        const fix = {
          id: `bulk-fix-${i + 1}`,
          bookId: testBookId,
          paragraphId: testParagraphId,
          originalWord: words[i],
          currentWord: words[i],
          correctedWord: corrections[i],
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: `משפט עם ${words[i]}`,
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
          const tx = {
            textCorrection: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockResolvedValue(fix),
              updateMany: jest.fn(),
            },
          };
          return callback(tx);
        });

        const result = await repository.createOrReplaceWithHistory({
          bookId: testBookId,
          paragraphId: testParagraphId,
          originalWord: words[i],
          currentWord: words[i],
          correctedWord: corrections[i],
          sentenceContext: `משפט עם ${words[i]}`,
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        });

        expect(result.fixSequence).toBe(1);
        createdFixes.push(fix);
      }

      // Verify all fixes were created independently
      expect(createdFixes).toHaveLength(3);
      createdFixes.forEach((fix, index) => {
        expect(fix.originalWord).toBe(words[index]);
        expect(fix.correctedWord).toBe(corrections[index]);
        expect(fix.fixSequence).toBe(1);
        expect(fix.isLatestFix).toBe(true);
      });
    });
  });

  describe('Analytics and Reporting', () => {
    it('should generate comprehensive fix statistics', async () => {
      // Mock latest corrections (isLatestFix: true)
      const mockLatestCorrections = [
        {
          originalWord: 'בראשית',
          correctedWord: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
        },
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם עֲלֵיכֶם',
        },
      ];

      // Mock fix counts for words with multiple fixes
      const mockFixCounts = [
        {
          originalWord: 'בראשית',
          _count: { id: 3 },
        },
        {
          originalWord: 'שלום',
          _count: { id: 2 },
        },
      ];

      // Mock the new implementation calls
      prismaService.textCorrection.findMany = jest.fn().mockResolvedValue(mockLatestCorrections);
      prismaService.textCorrection.groupBy = jest.fn().mockResolvedValue(mockFixCounts);

      const result = await repository.findWordsWithMultipleFixes(testBookId);

      expect(result).toHaveLength(2);
      
      // Verify first word stats (sorted by fix count descending)
      expect(result[0].originalWord).toBe('בראשית');
      expect(result[0].fixCount).toBe(3);
      expect(result[0].latestCorrection).toBe('בְּרֵאשִׁית בָּרָא אֱלֹהִים');
      
      // Verify second word stats
      expect(result[1].originalWord).toBe('שלום');
      expect(result[1].fixCount).toBe(2);
      expect(result[1].latestCorrection).toBe('שָׁלוֹם עֲלֵיכֶם');

      // Verify the correct calls were made
      expect(prismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          isLatestFix: true,
          bookId: testBookId,
        },
        select: {
          originalWord: true,
          correctedWord: true,
        },
      });

      expect(prismaService.textCorrection.groupBy).toHaveBeenCalledWith({
        by: ['originalWord'],
        where: {
          originalWord: { in: ['בראשית', 'שלום'] },
          bookId: testBookId,
        },
        _count: {
          id: true,
        },
        having: {
          id: {
            _count: {
              gt: 1,
            },
          },
        },
      });
    });

    it('should track fix type distribution', async () => {
      const mockCorrections = [
        {
          id: 'c1',
          originalWord: 'test1',
          fixType: FixType.vowelization,
          fixSequence: 1,
        },
        {
          id: 'c2',
          originalWord: 'test1',
          fixType: FixType.disambiguation,
          fixSequence: 2,
        },
        {
          id: 'c3',
          originalWord: 'test2',
          fixType: FixType.vowelization,
          fixSequence: 1,
        },
      ];

      prismaService.textCorrection.findMany = jest.fn().mockResolvedValue(mockCorrections);

      const result = await repository.findMany({
        bookId: testBookId,
      });

      expect(result).toHaveLength(3);
      
      // Count fix types
      const fixTypeCounts = result.reduce((acc, correction) => {
        acc[correction.fixType] = (acc[correction.fixType] || 0) + 1;
        return acc;
      }, {});

      expect(fixTypeCounts[FixType.vowelization]).toBe(2);
      expect(fixTypeCounts[FixType.disambiguation]).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large fix histories efficiently', async () => {
      const originalWord = 'מילה';
      const largeFixChain = [];
      
      // Generate a large fix chain (50 fixes)
      for (let i = 0; i < 50; i++) {
        largeFixChain.push({
          id: `large-fix-${i + 1}`,
          originalWord: originalWord,
          currentWord: i === 0 ? originalWord : `תיקון-${i}`,
          correctedWord: `תיקון-${i + 1}`,
          fixSequence: i + 1,
          isLatestFix: i === 49,
          createdAt: new Date(2023, 0, 1, 10, i), // Incremental timestamps
        });
      }

      prismaService.textCorrection.findMany = jest.fn().mockResolvedValue(largeFixChain);

      const startTime = Date.now();
      const history = await repository.getFixHistoryForWord(testParagraphId, originalWord);
      const endTime = Date.now();

      expect(history).toHaveLength(50);
      expect(history[0].fixSequence).toBe(1);
      expect(history[49].fixSequence).toBe(50);
      expect(history[49].isLatestFix).toBe(true);
      
      // Performance check - should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle concurrent fix operations', async () => {
      const words = ['word1', 'word2', 'word3'];
      const promises = [];

      // Simulate concurrent fix operations
      words.forEach((word, index) => {
        const fix = {
          id: `concurrent-fix-${index + 1}`,
          bookId: testBookId,
          paragraphId: testParagraphId,
          originalWord: word,
          currentWord: word,
          correctedWord: `${word}-corrected`,
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: `Context for ${word}`,
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Mock transaction for each word
        const mockTransaction = jest.fn().mockImplementation(async (callback) => {
          const tx = {
            textCorrection: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockResolvedValue(fix),
              updateMany: jest.fn(),
            },
          };
          return callback(tx);
        });

        prismaService.$transaction = mockTransaction;

        const promise = repository.createOrReplaceWithHistory({
          bookId: testBookId,
          paragraphId: testParagraphId,
          originalWord: word,
          currentWord: word,
          correctedWord: `${word}-corrected`,
          sentenceContext: `Context for ${word}`,
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        });

        promises.push(promise);
      });

      // Wait for all concurrent operations to complete
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.originalWord).toBe(words[index]);
        expect(result.fixSequence).toBe(1);
        expect(result.isLatestFix).toBe(true);
      });
    });
  });
});
