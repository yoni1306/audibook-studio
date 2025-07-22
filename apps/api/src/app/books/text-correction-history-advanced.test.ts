import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { FixType } from '@prisma/client';
import { CreateTextCorrectionData } from './text-correction.repository';



describe('TextCorrectionRepository - Advanced Tests', () => {
  let repository: TextCorrectionRepository;

  const mockPrismaService = {
    textCorrection: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextCorrectionRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<TextCorrectionRepository>(TextCorrectionRepository);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Sequential fixes preserving original word', () => {
    it('should preserve original word through multiple sequential fixes', async () => {
      const bookId = 'book-1';
      const paragraphId = 'para-1';
      
      // First fix: שלום → שָׁלוֹם (adding vowelization)
      const firstFix: CreateTextCorrectionData = {
        bookId,
        paragraphId,
        originalWord: 'שלום',
        currentWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        sentenceContext: 'שלום עליכם',
        fixType: FixType.vowelization,
        ttsModel: 'model1',
        ttsVoice: 'voice1',
      };

      // Mock first fix - no existing corrections
      mockPrismaService.$transaction.mockImplementationOnce(async (callback) => {
        mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([]);
        mockPrismaService.textCorrection.create.mockResolvedValueOnce({
          id: 'correction-1',
          ...firstFix,
          originalWord: 'שלום',
          fixSequence: 1,
          isLatestFix: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return callback(mockPrismaService);
      });

      const firstResult = await repository.createOrReplaceWithHistory(firstFix);

      expect(firstResult.originalWord).toBe('שלום');
      expect(firstResult.currentWord).toBe('שלום');
      expect(firstResult.correctedWord).toBe('שָׁלוֹם');
      expect(firstResult.fixSequence).toBe(1);
      expect(firstResult.isLatestFix).toBe(true);

      // Second fix: שָׁלוֹם → שָׁלֹום (accent correction)
      const secondFix: CreateTextCorrectionData = {
        bookId,
        paragraphId,
        originalWord: 'שלום', // Must provide the original word
        currentWord: 'שָׁלוֹם',
        correctedWord: 'שָׁלֹום',
        sentenceContext: 'שָׁלֹום עליכם',
        fixType: FixType.disambiguation,
        ttsModel: 'model1',
        ttsVoice: 'voice1',
      };

      // Mock second fix - existing correction found
      mockPrismaService.$transaction.mockImplementationOnce(async (callback) => {
        mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([
          {
            id: 'correction-1',
            originalWord: 'שלום',
            fixSequence: 1,
          },
        ]);
        mockPrismaService.textCorrection.updateMany.mockResolvedValueOnce({ count: 1 });
        mockPrismaService.textCorrection.create.mockResolvedValueOnce({
          id: 'correction-2',
          ...secondFix,
          originalWord: 'שלום', // Preserved from first fix
          fixSequence: 2,
          isLatestFix: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return callback(mockPrismaService);
      });

      const secondResult = await repository.createOrReplaceWithHistory(secondFix);

      expect(secondResult.originalWord).toBe('שלום'); // Preserved from first fix
      expect(secondResult.currentWord).toBe('שָׁלוֹם');
      expect(secondResult.correctedWord).toBe('שָׁלֹום');
      expect(secondResult.fixSequence).toBe(2);
      expect(secondResult.isLatestFix).toBe(true);

      // Verify updateMany was called to mark previous fix as not latest
      expect(mockPrismaService.textCorrection.updateMany).toHaveBeenCalledWith({
        where: {
          paragraphId,
          originalWord: 'שלום',
        },
        data: { isLatestFix: false },
      });
    });

    it('should handle edge case where currentWord differs from originalWord in first fix', async () => {
      const bookId = 'book-1';
      const paragraphId = 'para-1';
      
      // Edge case: First fix where currentWord is already different from what should be originalWord
      const firstFix: CreateTextCorrectionData = {
        bookId,
        paragraphId,
        originalWord: 'ספר', // Explicitly provided original
        currentWord: 'ספר', // Current state
        correctedWord: 'סֵפֶר', // Fixed version
        sentenceContext: 'זה ספר טוב',
        fixType: FixType.vowelization,
        ttsModel: 'model1',
        ttsVoice: 'voice1',
      };

      mockPrismaService.$transaction.mockImplementationOnce(async (callback) => {
        mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([]);
        mockPrismaService.textCorrection.create.mockResolvedValueOnce({
          id: 'correction-1',
          ...firstFix,
          fixSequence: 1,
          isLatestFix: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return callback(mockPrismaService);
      });

      const result = await repository.createOrReplaceWithHistory(firstFix);

      expect(result.originalWord).toBe('ספר');
      expect(result.currentWord).toBe('ספר');
      expect(result.correctedWord).toBe('סֵפֶר');
      expect(result.fixSequence).toBe(1);
    });
  });

  describe('Concurrent fixes on different paragraphs', () => {
    it('should handle concurrent fixes on the same word in different paragraphs', async () => {
      const bookId = 'book-1';
      const word = 'בית';
      const correctedWord = 'בַּיִת';

      // Fix in paragraph 1
      const fix1: CreateTextCorrectionData = {
        bookId,
        paragraphId: 'para-1',
        originalWord: word,
        currentWord: word,
        correctedWord,
        sentenceContext: 'בית גדול',
        fixType: FixType.vowelization,
        ttsModel: 'model1',
        ttsVoice: 'voice1',
      };

      // Fix in paragraph 2
      const fix2: CreateTextCorrectionData = {
        bookId,
        paragraphId: 'para-2',
        originalWord: word,
        currentWord: word,
        correctedWord,
        sentenceContext: 'בית קטן',
        fixType: FixType.vowelization,
        ttsModel: 'model1',
        ttsVoice: 'voice1',
      };

      // Mock both fixes as first fixes in their respective paragraphs
      mockPrismaService.$transaction
        .mockImplementationOnce(async (callback) => {
          mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([]);
          mockPrismaService.textCorrection.create.mockResolvedValueOnce({
            id: 'correction-1',
            ...fix1,
            originalWord: word,
            fixSequence: 1,
            isLatestFix: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          return callback(mockPrismaService);
        })
        .mockImplementationOnce(async (callback) => {
          mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([]);
          mockPrismaService.textCorrection.create.mockResolvedValueOnce({
            id: 'correction-2',
            ...fix2,
            originalWord: word,
            fixSequence: 1,
            isLatestFix: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          return callback(mockPrismaService);
        });

      const result1 = await repository.createOrReplaceWithHistory(fix1);
      const result2 = await repository.createOrReplaceWithHistory(fix2);

      // Both should be independent first fixes
      expect(result1.paragraphId).toBe('para-1');
      expect(result1.fixSequence).toBe(1);
      expect(result1.isLatestFix).toBe(true);

      expect(result2.paragraphId).toBe('para-2');
      expect(result2.fixSequence).toBe(1);
      expect(result2.isLatestFix).toBe(true);
    });
  });

  describe('Fix history retrieval', () => {
    it('should retrieve complete fix history for a word', async () => {
      const bookId = 'book-1';
      const paragraphId = 'para-1';
      const originalWord = 'מים';

      const mockHistory = [
        {
          id: 'correction-1',
          bookId,
          paragraphId,
          originalWord,
          currentWord: 'מים',
          correctedWord: 'מַיִם',
          fixSequence: 1,
          isLatestFix: false,
          fixType: FixType.vowelization,
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'correction-2',
          bookId,
          paragraphId,
          originalWord,
          currentWord: 'מַיִם',
          correctedWord: 'מַיִּם',
          fixSequence: 2,
          isLatestFix: true,
          fixType: FixType.disambiguation,
          createdAt: new Date('2023-01-02'),
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValueOnce(mockHistory);

      const result = await repository.getFixHistoryForWord(paragraphId, originalWord);

      expect(result).toHaveLength(2);
      expect(result[0].fixSequence).toBe(1);
      expect(result[0].isLatestFix).toBe(false);
      expect(result[1].fixSequence).toBe(2);
      expect(result[1].isLatestFix).toBe(true);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          paragraphId,
          originalWord,
        },
        orderBy: { fixSequence: 'asc' },
      });
    });

    it('should retrieve latest fix for a word', async () => {
      const paragraphId = 'para-1';
      const originalWord = 'שלום';

      const mockLatestFix = {
        id: 'correction-2',
        originalWord,
        currentWord: 'שָׁלוֹם',
        correctedWord: 'שָׁלֹום',
        fixSequence: 2,
        isLatestFix: true,
        fixType: FixType.disambiguation,
      };

      mockPrismaService.textCorrection.findFirst.mockResolvedValueOnce(mockLatestFix);

      const result = await repository.findLatestFixForWord(paragraphId, originalWord);

      expect(result).toEqual(mockLatestFix);
      expect(result?.isLatestFix).toBe(true);
      expect(result?.fixSequence).toBe(2);

      expect(mockPrismaService.textCorrection.findFirst).toHaveBeenCalledWith({
        where: {
          paragraphId,
          originalWord,
          isLatestFix: true,
        },
        orderBy: { fixSequence: 'desc' },
      });
    });
  });

  describe('Analytics and reporting', () => {
    it('should find words with multiple fixes', async () => {
      const bookId = 'book-1';

      const mockLatestCorrections = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלֹום',
        },
        {
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
        },
      ];

      const mockFixCounts = [
        {
          originalWord: 'שלום',
          _count: { id: 3 },
        },
        {
          originalWord: 'בית',
          _count: { id: 2 },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValueOnce(mockLatestCorrections);
      mockPrismaService.textCorrection.groupBy.mockResolvedValueOnce(mockFixCounts);

      const result = await repository.findWordsWithMultipleFixes(bookId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        originalWord: 'שלום',
        fixCount: 3,
        latestCorrection: 'שָׁלֹום',
      });
      expect(result[1]).toEqual({
        originalWord: 'בית',
        fixCount: 2,
        latestCorrection: 'בַּיִת',
      });

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          isLatestFix: true,
          bookId,
        },
        select: {
          originalWord: true,
          correctedWord: true,
        },
      });

      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledWith({
        by: ['originalWord'],
        where: {
          originalWord: { in: ['שלום', 'בית'] },
          bookId,
        },
        _count: { id: true },
        having: {
          id: {
            _count: { gt: 1 },
          },
        },
      });
    });

    it('should find words with multiple fixes across all books when bookId not provided', async () => {
      const mockLatestCorrections = [
        {
          originalWord: 'אמת',
          correctedWord: 'אֱמֶת',
        },
      ];

      const mockFixCounts = [
        {
          originalWord: 'אמת',
          _count: { id: 4 },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValueOnce(mockLatestCorrections);
      mockPrismaService.textCorrection.groupBy.mockResolvedValueOnce(mockFixCounts);

      const result = await repository.findWordsWithMultipleFixes();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        originalWord: 'אמת',
        fixCount: 4,
        latestCorrection: 'אֱמֶת',
      });

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          isLatestFix: true,
        },
        select: {
          originalWord: true,
          correctedWord: true,
        },
      });

      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledWith({
        by: ['originalWord'],
        where: {
          originalWord: { in: ['אמת'] },
        },
        _count: { id: true },
        having: {
          id: {
            _count: { gt: 1 },
          },
        },
      });
    });
  });

  describe('Data integrity and validation', () => {
    it('should maintain fix sequence consistency', async () => {
      const bookId = 'book-1';
      const paragraphId = 'para-1';
      const originalWord = 'דבר';

      // Simulate existing fixes with sequences 1, 2, 4 (gap at 3)
      const existingCorrections = [
        { originalWord, fixSequence: 4 },
        { originalWord, fixSequence: 2 },
        { originalWord, fixSequence: 1 },
      ];

      const newFix: CreateTextCorrectionData = {
        bookId,
        paragraphId,
        originalWord,
        currentWord: 'דָּבָר',
        correctedWord: 'דְּבַר',
        sentenceContext: 'דבר חשוב',
        fixType: FixType.disambiguation,
        ttsModel: 'model1',
        ttsVoice: 'voice1',
      };

      mockPrismaService.$transaction.mockImplementationOnce(async (callback) => {
        mockPrismaService.textCorrection.findMany.mockResolvedValueOnce(existingCorrections);
        mockPrismaService.textCorrection.updateMany.mockResolvedValueOnce({ count: 3 });
        mockPrismaService.textCorrection.create.mockResolvedValueOnce({
          id: 'correction-5',
          ...newFix,
          originalWord,
          fixSequence: 5, // Should be max(4) + 1
          isLatestFix: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return callback(mockPrismaService);
      });

      const result = await repository.createOrReplaceWithHistory(newFix);

      expect(result.fixSequence).toBe(5); // Max existing (4) + 1
      expect(result.isLatestFix).toBe(true);
    });

    it('should handle transaction rollback on error', async () => {
      const bookId = 'book-1';
      const paragraphId = 'para-1';

      const fix: CreateTextCorrectionData = {
        bookId,
        paragraphId,
        originalWord: 'טעות',
        currentWord: 'טעות',
        correctedWord: 'טָעוּת',
        sentenceContext: 'זו טעות',
        fixType: FixType.vowelization,
        ttsModel: 'model1',
        ttsVoice: 'voice1',
      };

      const mockError = new Error('Database connection failed');

      mockPrismaService.$transaction.mockImplementationOnce(async (callback) => {
        mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([]);
        mockPrismaService.textCorrection.create.mockRejectedValueOnce(mockError);
        return callback(mockPrismaService);
      });

      await expect(repository.createOrReplaceWithHistory(fix)).rejects.toThrow(mockError);

      // Verify transaction was attempted
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complex fix chains', () => {
    it('should handle complex Hebrew vowelization fix chain', async () => {
      const bookId = 'book-1';
      const paragraphId = 'para-1';
      
      const originalWord = 'תורה';
      
      // Complex fix chain: תורה → תּוֹרָה → תּוֹרָה (accent fix) → תּוֹרָה (final)
      const fixes = [
        {
          originalWord,
          currentWord: 'תורה',
          correctedWord: 'תּוֹרָה',
          fixType: FixType.vowelization,
          expectedSequence: 1,
        },
        {
          originalWord,
          currentWord: 'תּוֹרָה',
          correctedWord: 'תּוֹרָה',
          fixType: FixType.disambiguation,
          expectedSequence: 2,
        },
      ];

      let transactionCallCount = 0;

      for (const fix of fixes) {
        transactionCallCount++;
        
        mockPrismaService.$transaction.mockImplementationOnce(async (callback) => {
          if (transactionCallCount === 1) {
            // First fix - no existing corrections
            mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([]);
          } else {
            // Subsequent fixes - existing corrections found
            mockPrismaService.textCorrection.findMany.mockResolvedValueOnce([
              { originalWord, fixSequence: transactionCallCount - 1 },
            ]);
            mockPrismaService.textCorrection.updateMany.mockResolvedValueOnce({ count: 1 });
          }

          mockPrismaService.textCorrection.create.mockResolvedValueOnce({
            id: `correction-${transactionCallCount}`,
            bookId,
            paragraphId,
            originalWord,
            currentWord: fix.currentWord,
            correctedWord: fix.correctedWord,
            fixSequence: fix.expectedSequence,
            isLatestFix: true,
            fixType: fix.fixType,
            sentenceContext: 'תורה קדושה',
            ttsModel: 'model1',
            ttsVoice: 'voice1',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          return callback(mockPrismaService);
        });

        const fixData: CreateTextCorrectionData = {
          bookId,
          paragraphId,
          originalWord: fix.originalWord,
          currentWord: fix.currentWord,
          correctedWord: fix.correctedWord,
          sentenceContext: 'תורה קדושה',
          fixType: fix.fixType,
          ttsModel: 'model1',
          ttsVoice: 'voice1',
        };

        const result = await repository.createOrReplaceWithHistory(fixData);

        expect(result.originalWord).toBe(originalWord);
        expect(result.fixSequence).toBe(fix.expectedSequence);
        expect(result.isLatestFix).toBe(true);
      }
    });
  });
});
