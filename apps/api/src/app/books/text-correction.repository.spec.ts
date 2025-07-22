import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository', () => {
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

  const mockTextCorrection = {
    id: 'test-correction-id',
    bookId: 'test-book-id',
    paragraphId: 'test-paragraph-id',
    originalWord: 'שגיאה',
    currentWord: 'שגיאה',
    correctedWord: 'תיקון',
    fixSequence: 1,
    isLatestFix: true,
    sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
    fixType: FixType.vowelization,
    ttsModel: 'test-model',
    ttsVoice: 'test-voice',
    createdAt: new Date('2025-06-22T10:00:00.000Z'),
    updatedAt: new Date('2025-06-22T10:00:00.000Z'),
  };

  const mockCorrectionData: CreateTextCorrectionData = {
    bookId: 'test-book-id',
    paragraphId: 'test-paragraph-id',
    originalWord: 'שגיאה',
    currentWord: 'שגיאה',
    correctedWord: 'תיקון',
    fixSequence: 1,
    isLatestFix: true,
    sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
    fixType: FixType.vowelization,
    ttsModel: 'test-model',
    ttsVoice: 'test-voice',
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

  describe('create', () => {
    it('should create a single text correction', async () => {
      mockPrismaService.textCorrection.create.mockResolvedValue(mockTextCorrection);

      const result = await repository.create(mockCorrectionData);

      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledWith({
        data: {
          bookId: 'test-book-id',
          paragraphId: 'test-paragraph-id',
          originalWord: 'שגיאה',
          currentWord: 'שגיאה',
          correctedWord: 'תיקון',
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      });
      expect(result).toEqual(mockTextCorrection);
    });

    it('should handle creation errors', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.textCorrection.create.mockRejectedValue(mockError);

      await expect(repository.create(mockCorrectionData)).rejects.toThrow('Database error');
      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMany', () => {
    it('should create multiple text corrections', async () => {
      const corrections = [mockCorrectionData, { ...mockCorrectionData, originalWord: 'אחר', currentWord: 'אחר' }];
      mockPrismaService.textCorrection.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.createMany(corrections);

      expect(mockPrismaService.textCorrection.createMany).toHaveBeenCalledWith({
        data: corrections.map(correction => ({
          bookId: correction.bookId,
          paragraphId: correction.paragraphId,
          originalWord: correction.originalWord,
          currentWord: correction.currentWord,
          correctedWord: correction.correctedWord,
          fixSequence: correction.fixSequence ?? 1,
          isLatestFix: correction.isLatestFix ?? true,
          sentenceContext: correction.sentenceContext,
          fixType: correction.fixType,
          ttsModel: correction.ttsModel,
          ttsVoice: correction.ttsVoice,
        })),
      });
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('findMany', () => {
    it('should find text corrections without filters', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([mockTextCorrection]);

      const result = await repository.findMany();

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockTextCorrection]);
    });

    it('should find text corrections with filters', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([mockTextCorrection]);

      const filters = {
        bookId: 'test-book-id',
        fixType: FixType.vowelization,
        originalWord: 'שגיאה',
      };

      const result = await repository.findMany(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          bookId: 'test-book-id',
          fixType: FixType.vowelization,
          originalWord: 'שגיאה',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockTextCorrection]);
    });
  });

  describe('findGroupedCorrections', () => {
    it('should find grouped corrections', async () => {
      const mockGroupedResult = [
        {
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          fixType: FixType.vowelization,
          _count: { id: 3 },
        },
      ];
      mockPrismaService.textCorrection.groupBy.mockResolvedValue(mockGroupedResult);

      const result = await repository.findGroupedCorrections({ minOccurrences: 2 });

      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledWith({
        by: ['originalWord', 'correctedWord', 'fixType'],
        where: {},
        _count: { id: true },
        having: {
          id: {
            _count: { gte: 2 },
          },
        },
        orderBy: {
          _count: { id: 'desc' },
        },
      });
      expect(result).toEqual([
        {
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          fixType: FixType.vowelization,
          occurrenceCount: 3,
        },
      ]);
    });
  });

  describe('getStats', () => {
    it('should get correction statistics', async () => {
      mockPrismaService.textCorrection.count.mockResolvedValue(10);
      mockPrismaService.textCorrection.groupBy
        .mockResolvedValueOnce([
          { originalWord: 'שגיאה' },
          { originalWord: 'טעות' },
        ])
        .mockResolvedValueOnce([
          { fixType: FixType.vowelization, _count: { id: 6 } },
          { fixType: FixType.disambiguation, _count: { id: 4 } },
        ]);

      const result = await repository.getStats({ bookId: 'test-book-id' });

      expect(result).toEqual({
        totalCorrections: 10,
        uniqueWords: 2,
        fixTypeBreakdown: [
          { fixType: FixType.vowelization, count: 6 },
          { fixType: FixType.disambiguation, count: 4 },
        ],
      });
    });
  });

  describe('findById', () => {
    it('should find a text correction by ID', async () => {
      mockPrismaService.textCorrection.findUnique.mockResolvedValue(mockTextCorrection);

      const result = await repository.findById('test-correction-id');

      expect(mockPrismaService.textCorrection.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-correction-id' },
      });
      expect(result).toEqual(mockTextCorrection);
    });

    it('should return null if correction not found', async () => {
      mockPrismaService.textCorrection.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a text correction', async () => {
      const updatedCorrection = { ...mockTextCorrection, correctedWord: 'תיקון חדש' };
      mockPrismaService.textCorrection.update.mockResolvedValue(updatedCorrection);

      const result = await repository.update('test-correction-id', {
        correctedWord: 'תיקון חדש',
      });

      expect(mockPrismaService.textCorrection.update).toHaveBeenCalledWith({
        where: { id: 'test-correction-id' },
        data: {
          correctedWord: 'תיקון חדש',
        },
      });
      expect(result).toEqual(updatedCorrection);
    });
  });

  describe('delete', () => {
    it('should delete a text correction', async () => {
      mockPrismaService.textCorrection.delete.mockResolvedValue(mockTextCorrection);

      const result = await repository.delete('test-correction-id');

      expect(mockPrismaService.textCorrection.delete).toHaveBeenCalledWith({
        where: { id: 'test-correction-id' },
      });
      expect(result).toEqual(mockTextCorrection);
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple text corrections', async () => {
      mockPrismaService.textCorrection.deleteMany.mockResolvedValue({ count: 3 });

      const result = await repository.deleteMany({
        bookId: 'test-book-id',
        fixType: 'vowelization',
      });

      expect(mockPrismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: {
          bookId: 'test-book-id',
          fixType: FixType.vowelization,
        },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('createOrReplaceWithHistory', () => {
    it('should create first fix with correct originalWord and sequence', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'correction-1',
        originalWord: 'שגיאה',
        currentWord: 'שגיאה',
        correctedWord: 'תיקון',
        fixSequence: 1,
        isLatestFix: true,
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          textCorrection: {
            findMany: jest.fn().mockResolvedValue([]), // No existing corrections
            create: mockCreate,
            updateMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await repository.createOrReplaceWithHistory({
        bookId: 'test-book-id',
        paragraphId: 'test-paragraph-id',
        originalWord: 'שגיאה',
        currentWord: 'שגיאה',
        correctedWord: 'תיקון',
        sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
        fixType: FixType.vowelization,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          bookId: 'test-book-id',
          paragraphId: 'test-paragraph-id',
          originalWord: 'שגיאה', // Should be same as currentWord for first fix
          currentWord: 'שגיאה',
          correctedWord: 'תיקון',
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      });

      expect(result.fixSequence).toBe(1);
      expect(result.isLatestFix).toBe(true);
    });

    it('should create subsequent fix preserving originalWord and incrementing sequence', async () => {
      const existingCorrection = {
        id: 'correction-1',
        originalWord: 'שגיאה',
        currentWord: 'שגיאה',
        correctedWord: 'תיקון',
        fixSequence: 1,
        isLatestFix: true,
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: 'correction-2',
        originalWord: 'שגיאה', // Preserved from first correction
        currentWord: 'תיקון',
        correctedWord: 'תיקון נכון',
        fixSequence: 2,
        isLatestFix: true,
      });

      const mockUpdateMany = jest.fn();

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          textCorrection: {
            findMany: jest.fn().mockResolvedValue([existingCorrection]),
            create: mockCreate,
            updateMany: mockUpdateMany,
          },
        };
        return callback(tx);
      });

      const result = await repository.createOrReplaceWithHistory({
        bookId: 'test-book-id',
        paragraphId: 'test-paragraph-id',
        originalWord: 'שגיאה', // Original word from first fix
        currentWord: 'תיקון', // Now fixing the previously corrected word
        correctedWord: 'תיקון נכון',
        sentenceContext: 'זה המשפט עם תיקון בתוכו.',
        fixType: FixType.default,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      });

      // Should mark previous fix as not latest
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          paragraphId: 'test-paragraph-id',
          originalWord: 'שגיאה',
        },
        data: { isLatestFix: false },
      });

      // Should create new fix with preserved originalWord
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          bookId: 'test-book-id',
          paragraphId: 'test-paragraph-id',
          originalWord: 'שגיאה', // Preserved from first correction
          currentWord: 'תיקון',
          correctedWord: 'תיקון נכון',
          fixSequence: 2,
          isLatestFix: true,
          sentenceContext: 'זה המשפט עם תיקון בתוכו.',
          fixType: FixType.default,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      });

      expect(result.fixSequence).toBe(2);
      expect(result.originalWord).toBe('שגיאה');
    });

    it('should handle transaction errors gracefully', async () => {
      const mockError = new Error('Transaction failed');
      mockPrismaService.$transaction.mockRejectedValue(mockError);

      await expect(repository.createOrReplaceWithHistory(mockCorrectionData))
        .rejects.toThrow('Transaction failed');
    });
  });

  describe('findLatestFixForWord', () => {
    it('should find the latest fix for a word', async () => {
      const mockLatestFix = {
        id: 'correction-2',
        originalWord: 'שגיאה',
        currentWord: 'תיקון',
        correctedWord: 'תיקון נכון',
        fixSequence: 2,
        isLatestFix: true,
      };

      mockPrismaService.textCorrection.findFirst.mockResolvedValue(mockLatestFix);

      const result = await repository.findLatestFixForWord('test-paragraph-id', 'שגיאה');

      expect(mockPrismaService.textCorrection.findFirst).toHaveBeenCalledWith({
        where: {
          paragraphId: 'test-paragraph-id',
          originalWord: 'שגיאה',
          isLatestFix: true,
        },
        orderBy: { fixSequence: 'desc' },
      });

      expect(result).toEqual(mockLatestFix);
    });

    it('should return null when no fix is found', async () => {
      mockPrismaService.textCorrection.findFirst.mockResolvedValue(null);

      const result = await repository.findLatestFixForWord('test-paragraph-id', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getFixHistoryForWord', () => {
    it('should return complete fix history for a word', async () => {
      const mockHistory = [
        {
          id: 'correction-1',
          originalWord: 'שגיאה',
          currentWord: 'שגיאה',
          correctedWord: 'תיקון',
          fixSequence: 1,
          isLatestFix: false,
        },
        {
          id: 'correction-2',
          originalWord: 'שגיאה',
          currentWord: 'תיקון',
          correctedWord: 'תיקון נכון',
          fixSequence: 2,
          isLatestFix: true,
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockHistory);

      const result = await repository.getFixHistoryForWord('test-paragraph-id', 'שגיאה');

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          paragraphId: 'test-paragraph-id',
          originalWord: 'שגיאה',
        },
        orderBy: { fixSequence: 'asc' },
      });

      expect(result).toEqual(mockHistory);
      expect(result).toHaveLength(2);
      expect(result[0].fixSequence).toBe(1);
      expect(result[1].fixSequence).toBe(2);
    });

    it('should return empty array when no history is found', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      const result = await repository.getFixHistoryForWord('test-paragraph-id', 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findWordsWithMultipleFixes', () => {
    it('should find words with multiple fixes', async () => {
      const mockLatestCorrections = [
        {
          originalWord: 'שגיאה',
          correctedWord: 'תיקון נכון',
        },
        {
          originalWord: 'טעות',
          correctedWord: 'נכון',
        },
      ];

      const mockFixCounts = [
        {
          originalWord: 'שגיאה',
          _count: { id: 3 },
        },
        {
          originalWord: 'טעות',
          _count: { id: 2 },
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockLatestCorrections);
      mockPrismaService.textCorrection.groupBy.mockResolvedValue(mockFixCounts);

      const result = await repository.findWordsWithMultipleFixes('test-book-id');

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          isLatestFix: true,
          bookId: 'test-book-id',
        },
        select: {
          originalWord: true,
          correctedWord: true,
        },
      });

      expect(mockPrismaService.textCorrection.groupBy).toHaveBeenCalledWith({
        by: ['originalWord'],
        where: {
          originalWord: { in: ['שגיאה', 'טעות'] },
          bookId: 'test-book-id',
        },
        _count: { id: true },
        having: {
          id: {
            _count: { gt: 1 },
          },
        },
      });

      expect(result).toEqual([
        {
          originalWord: 'שגיאה',
          fixCount: 3,
          latestCorrection: 'תיקון נכון',
        },
        {
          originalWord: 'טעות',
          fixCount: 2,
          latestCorrection: 'נכון',
        },
      ]);
    });

    it('should find words across all books when bookId is not provided', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);
      mockPrismaService.textCorrection.groupBy.mockResolvedValue([]);

      await repository.findWordsWithMultipleFixes();

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
          originalWord: { in: [] },
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
});
