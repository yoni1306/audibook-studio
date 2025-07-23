import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - Basic Operations', () => {
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

  describe('create', () => {
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

    it('should handle creation errors', async () => {
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

      const mockError = new Error('Database error');
      mockPrismaService.textCorrection.create.mockRejectedValue(mockError);

      await expect(repository.create(correctionData)).rejects.toThrow('Database error');
      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMany', () => {
    it('should create multiple text corrections', async () => {
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
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          aggregationKey: 'בית|בַּיִת',
          sentenceContext: 'בית גדול',
          fixType: FixType.vowelization,
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        }
      ];

      mockPrismaService.textCorrection.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.createMany(corrections);

      expect(mockPrismaService.textCorrection.createMany).toHaveBeenCalledWith({
        data: corrections,
      });
      expect(result).toEqual({ count: 2 });
    });
  });
});
