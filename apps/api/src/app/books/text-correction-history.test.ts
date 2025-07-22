import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TextCorrectionRepository } from './text-correction.repository';
import { Logger } from '@nestjs/common';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - Fix History', () => {
  let repository: TextCorrectionRepository;
  let prismaService: PrismaService;
  let module: TestingModule;

  // Test data
  const mockBookId = 'test-book-id';
  const mockParagraphId = 'test-paragraph-id';
  const testWord = 'orignal'; // Intentional typo
  const firstFix = 'original';
  const secondFix = 'Original';

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
              groupBy: jest.fn(),
            },
            $transaction: jest.fn(),
          },
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
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('createOrReplaceWithHistory', () => {
    it('should create first fix with correct originalWord and sequence', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'correction-1',
        originalWord: testWord,
        currentWord: testWord,
        correctedWord: firstFix,
        fixSequence: 1,
        isLatestFix: true,
      });

      // Mock transaction behavior
      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          textCorrection: {
            findMany: jest.fn().mockResolvedValue([]), // No existing corrections
            create: mockCreate,
            updateMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      const testData = {
        bookId: 'test-book-id',
        paragraphId: 'test-paragraph-id',
        originalWord: 'שלום',
        currentWord: 'שלום',
        correctedWord: 'שלום תיקון',
        sentenceContext: 'זה משפט לדוגמה עם שלום בתוכו.',
        fixType: FixType.vowelization,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      };

      const result = await repository.createOrReplaceWithHistory(testData);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          bookId: testData.bookId,
          paragraphId: testData.paragraphId,
          originalWord: testData.originalWord,
          currentWord: testData.currentWord,
          correctedWord: testData.correctedWord,
          fixSequence: 1,
          isLatestFix: true,
          sentenceContext: testData.sentenceContext,
          fixType: testData.fixType,
          ttsModel: testData.ttsModel,
          ttsVoice: testData.ttsVoice,
        },
      });

      expect(result.fixSequence).toBe(1);
      expect(result.isLatestFix).toBe(true);
    });

    it('should create subsequent fix preserving originalWord and incrementing sequence', async () => {
      const existingCorrection = {
        id: 'correction-1',
        originalWord: testWord,
        currentWord: testWord,
        correctedWord: firstFix,
        fixSequence: 1,
        isLatestFix: true,
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: 'correction-2',
        originalWord: testWord, // Preserved from first correction
        currentWord: firstFix,
        correctedWord: secondFix,
        fixSequence: 2,
        isLatestFix: true,
      });

      const mockUpdateMany = jest.fn();

      // Mock transaction behavior
      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
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
        bookId: mockBookId,
        paragraphId: mockParagraphId,
        originalWord: testWord, // Original word preserved from first fix
        currentWord: firstFix, // Now fixing the previously corrected word
        correctedWord: secondFix,
        sentenceContext: 'This is the original text.',
        fixType: FixType.default,
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      });

      // Should mark previous fix as not latest
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          paragraphId: mockParagraphId,
          originalWord: testWord,
        },
        data: { isLatestFix: false },
      });

      // Should create new fix with preserved originalWord
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          bookId: mockBookId,
          paragraphId: mockParagraphId,
          originalWord: testWord, // Preserved from first correction
          currentWord: firstFix,
          correctedWord: secondFix,
          fixSequence: 2,
          isLatestFix: true,
          sentenceContext: 'This is the original text.',
          fixType: FixType.default,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      });

      expect(result.fixSequence).toBe(2);
      expect(result.originalWord).toBe(testWord);
    });
  });

  describe('findLatestFixForWord', () => {
    it('should find the latest fix for a word', async () => {
      const mockLatestFix = {
        id: 'correction-2',
        originalWord: testWord,
        currentWord: firstFix,
        correctedWord: secondFix,
        fixSequence: 2,
        isLatestFix: true,
      };

      prismaService.textCorrection.findFirst = jest.fn().mockResolvedValue(mockLatestFix);

      const result = await repository.findLatestFixForWord(mockParagraphId, testWord);

      expect(prismaService.textCorrection.findFirst).toHaveBeenCalledWith({
        where: {
          paragraphId: mockParagraphId,
          originalWord: testWord,
          isLatestFix: true,
        },
        orderBy: { fixSequence: 'desc' },
      });

      expect(result).toEqual(mockLatestFix);
    });
  });

  describe('getFixHistoryForWord', () => {
    it('should return complete fix history for a word', async () => {
      const mockHistory = [
        {
          id: 'correction-1',
          originalWord: testWord,
          currentWord: testWord,
          correctedWord: firstFix,
          fixSequence: 1,
          isLatestFix: false,
        },
        {
          id: 'correction-2',
          originalWord: testWord,
          currentWord: firstFix,
          correctedWord: secondFix,
          fixSequence: 2,
          isLatestFix: true,
        },
      ];

      prismaService.textCorrection.findMany = jest.fn().mockResolvedValue(mockHistory);

      const result = await repository.getFixHistoryForWord(mockParagraphId, testWord);

      expect(prismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          paragraphId: mockParagraphId,
          originalWord: testWord,
        },
        orderBy: { fixSequence: 'asc' },
      });

      expect(result).toEqual(mockHistory);
      expect(result).toHaveLength(2);
      expect(result[0].fixSequence).toBe(1);
      expect(result[1].fixSequence).toBe(2);
    });
  });
});
