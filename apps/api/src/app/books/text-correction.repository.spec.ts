import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository', () => {
  let repository: TextCorrectionRepository;
  let mockPrismaService: any;

  const mockTextCorrection = {
    id: 'test-correction-id',
    bookId: 'test-book-id',
    paragraphId: 'test-paragraph-id',
    originalWord: 'שגיאה',
    correctedWord: 'תיקון',
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
    correctedWord: 'תיקון',
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
        findUnique: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
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

  describe('create', () => {
    it('should create a single text correction', async () => {
      mockPrismaService.textCorrection.create.mockResolvedValue(mockTextCorrection);

      const result = await repository.create(mockCorrectionData);

      expect(mockPrismaService.textCorrection.create).toHaveBeenCalledWith({
        data: {
          bookId: 'test-book-id',
          paragraphId: 'test-paragraph-id',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
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
      const corrections = [mockCorrectionData, { ...mockCorrectionData, originalWord: 'אחר' }];
      mockPrismaService.textCorrection.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.createMany(corrections);

      expect(mockPrismaService.textCorrection.createMany).toHaveBeenCalledWith({
        data: corrections.map(correction => ({
          bookId: correction.bookId,
          paragraphId: correction.paragraphId,
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
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
});
