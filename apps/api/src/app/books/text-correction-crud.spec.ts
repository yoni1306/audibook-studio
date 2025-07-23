import { Test, TestingModule } from '@nestjs/testing';
import { TextCorrectionRepository, CreateTextCorrectionData, TextCorrectionFilters } from './text-correction.repository';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';

describe('TextCorrectionRepository - CRUD Operations', () => {
  let repository: TextCorrectionRepository;
  let mockPrismaService: {
    textCorrection: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      textCorrection: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
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

  describe('findById', () => {
    it('should find a text correction by ID', async () => {
      const mockCorrection = {
        id: 'correction-1',
        bookId: 'book-1',
        paragraphId: 'para-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        aggregationKey: 'שלום|שָׁלוֹם',
        sentenceContext: 'שלום לכם',
        fixType: FixType.vowelization,
        createdAt: new Date(),
        updatedAt: new Date(),
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      };

      mockPrismaService.textCorrection.findUnique.mockResolvedValue(mockCorrection);

      const result = await repository.findById('correction-1');

      expect(mockPrismaService.textCorrection.findUnique).toHaveBeenCalledWith({
        where: { id: 'correction-1' },
      });
      expect(result).toEqual(mockCorrection);
    });

    it('should return null when correction not found', async () => {
      mockPrismaService.textCorrection.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.textCorrection.findUnique.mockRejectedValue(mockError);

      await expect(repository.findById('correction-1')).rejects.toThrow('Database error');
    });
  });

  describe('findMany', () => {
    it('should find corrections with filters', async () => {
      const filters: TextCorrectionFilters = {
        bookId: 'book-1',
        fixType: FixType.vowelization,
        originalWord: 'שלום',
      };

      const mockCorrections = [
        {
          id: 'correction-1',
          bookId: 'book-1',
          paragraphId: 'para-1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date(),
          updatedAt: new Date(),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);

      const result = await repository.findMany(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          fixType: FixType.vowelization,
          originalWord: 'שלום',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: undefined,
      });
      expect(result).toEqual(mockCorrections);
    });

    it('should apply date filters correctly', async () => {
      const filters: TextCorrectionFilters = {
        createdAfter: new Date('2024-01-01'),
        createdBefore: new Date('2024-12-31'),
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findMany(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: undefined,
      });
    });

    it('should apply limit and ordering', async () => {
      const filters: TextCorrectionFilters = {
        limit: 50,
        orderBy: 'asc',
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findMany(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: {
          createdAt: 'asc',
        },
        take: 50,
      });
    });

    it('should handle empty filters', async () => {
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findMany();

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: {
          createdAt: 'desc',
        },
        take: undefined,
      });
    });
  });

  describe('findManyWithBookInfo', () => {
    it('should find corrections with book and paragraph information', async () => {
      const filters: TextCorrectionFilters = {
        bookId: 'book-1',
      };

      const mockCorrections = [
        {
          id: 'correction-1',
          bookId: 'book-1',
          paragraphId: 'para-1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date(),
          updatedAt: new Date(),
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

      const result = await repository.findManyWithBookInfo(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
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
            select: {
              id: true,
              orderIndex: true,
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
        take: undefined,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'correction-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        bookTitle: 'Test Book',
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

    it('should handle corrections without book info gracefully', async () => {
      const mockCorrections = [
        {
          id: 'correction-1',
          bookId: 'book-1',
          paragraphId: 'para-1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date(),
          updatedAt: new Date(),
          ttsModel: 'test-model',
          ttsVoice: 'test-voice',
          book: null,
          paragraph: null,
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);

      const result = await repository.findManyWithBookInfo();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'correction-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        aggregationKey: 'שלום|שָׁלוֹם',
        bookId: 'book-1',
        bookTitle: 'Unknown Book',
        sentenceContext: 'שלום לכם',
        fixType: 'vowelization',
        book: {
          id: 'book-1',
          title: 'Unknown Book',
          author: null,
        },
        location: {
          pageId: '',
          pageNumber: 0,
          paragraphId: 'para-1',
          paragraphIndex: 0,
        },
      }));
    });
  });

  describe('update', () => {
    it('should update a text correction', async () => {
      const updateData: Partial<CreateTextCorrectionData> = {
        correctedWord: 'שָׁלוֹם',
        sentenceContext: 'שלום עליכם',
        fixType: FixType.vowelization,
      };

      const mockUpdated = {
        id: 'correction-1',
        bookId: 'book-1',
        paragraphId: 'para-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        aggregationKey: 'שלום|שָׁלוֹם',
        sentenceContext: 'שלום עליכם',
        fixType: FixType.vowelization,
        createdAt: new Date(),
        updatedAt: new Date(),
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      };

      mockPrismaService.textCorrection.update.mockResolvedValue(mockUpdated);

      const result = await repository.update('correction-1', updateData);

      expect(mockPrismaService.textCorrection.update).toHaveBeenCalledWith({
        where: { id: 'correction-1' },
        data: {
          correctedWord: 'שָׁלוֹם',
          sentenceContext: 'שלום עליכם',
          fixType: FixType.vowelization,
        },
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should handle partial updates', async () => {
      const updateData: Partial<CreateTextCorrectionData> = {
        ttsModel: 'new-model',
      };

      const mockUpdated = {
        id: 'correction-1',
        bookId: 'book-1',
        paragraphId: 'para-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        aggregationKey: 'שלום|שָׁלוֹם',
        sentenceContext: 'שלום לכם',
        fixType: FixType.vowelization,
        createdAt: new Date(),
        updatedAt: new Date(),
        ttsModel: 'new-model',
        ttsVoice: 'test-voice',
      };

      mockPrismaService.textCorrection.update.mockResolvedValue(mockUpdated);

      const result = await repository.update('correction-1', updateData);

      expect(mockPrismaService.textCorrection.update).toHaveBeenCalledWith({
        where: { id: 'correction-1' },
        data: {
          ttsModel: 'new-model',
        },
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should handle update errors', async () => {
      const updateData: Partial<CreateTextCorrectionData> = {
        correctedWord: 'שָׁלוֹם',
      };

      const mockError = new Error('Update failed');
      mockPrismaService.textCorrection.update.mockRejectedValue(mockError);

      await expect(repository.update('correction-1', updateData)).rejects.toThrow('Update failed');
    });
  });

  describe('delete', () => {
    it('should delete a text correction by ID', async () => {
      const mockDeleted = {
        id: 'correction-1',
        bookId: 'book-1',
        paragraphId: 'para-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        aggregationKey: 'שלום|שָׁלוֹם',
        sentenceContext: 'שלום לכם',
        fixType: FixType.vowelization,
        createdAt: new Date(),
        updatedAt: new Date(),
        ttsModel: 'test-model',
        ttsVoice: 'test-voice',
      };

      mockPrismaService.textCorrection.delete.mockResolvedValue(mockDeleted);

      const result = await repository.delete('correction-1');

      expect(mockPrismaService.textCorrection.delete).toHaveBeenCalledWith({
        where: { id: 'correction-1' },
      });
      expect(result).toEqual(mockDeleted);
    });

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed');
      mockPrismaService.textCorrection.delete.mockRejectedValue(mockError);

      await expect(repository.delete('correction-1')).rejects.toThrow('Delete failed');
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple corrections by filters', async () => {
      const filters: TextCorrectionFilters = {
        bookId: 'book-1',
        fixType: FixType.vowelization,
      };

      mockPrismaService.textCorrection.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repository.deleteMany(filters);

      expect(mockPrismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          fixType: FixType.vowelization,
        },
      });
      expect(result).toEqual({ count: 5 });
    });

    it('should handle empty filters', async () => {
      mockPrismaService.textCorrection.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.deleteMany({});

      expect(mockPrismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: {},
      });
      expect(result).toEqual({ count: 0 });
    });

    it('should handle delete many errors', async () => {
      const mockError = new Error('Delete many failed');
      mockPrismaService.textCorrection.deleteMany.mockRejectedValue(mockError);

      await expect(repository.deleteMany({})).rejects.toThrow('Delete many failed');
    });
  });

  describe('findWordCorrectionHistory', () => {
    it('should find correction history for a word (deprecated method)', async () => {
      const originalWord = 'שלום';
      const mockCorrections = [
        {
          id: 'correction-1',
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          aggregationKey: 'שלום|שָׁלוֹם',
          sentenceContext: 'שלום לכם',
          fixType: FixType.vowelization,
          createdAt: new Date(),
          updatedAt: new Date(),
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

      const result = await repository.findWordCorrectionHistory(originalWord);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          originalWord: 'שלום',
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
        id: 'correction-1',
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        book: {
          id: 'book-1',
          title: 'Test Book',
          author: 'Test Author',
        },
      }));
    });

    it('should filter by bookId when provided', async () => {
      const originalWord = 'שלום';
      const bookId = 'book-1';

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findWordCorrectionHistory(originalWord, bookId);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          originalWord: 'שלום',
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

  describe('edge cases and error handling', () => {
    it('should handle malformed aggregation keys gracefully', async () => {
      const malformedKey = 'invalid-key-without-pipe';
      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      const result = await repository.findCorrectionsByAggregationKey(malformedKey);

      expect(result).toEqual([]);
      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          aggregationKey: malformedKey,
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

    it('should handle Hebrew text with special characters', async () => {
      const hebrewWord = 'שָׁלוֹם';
      const filters: TextCorrectionFilters = {
        originalWord: hebrewWord,
      };

      mockPrismaService.textCorrection.findMany.mockResolvedValue([]);

      await repository.findMany(filters);

      expect(mockPrismaService.textCorrection.findMany).toHaveBeenCalledWith({
        where: {
          originalWord: hebrewWord,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: undefined,
      });
    });

    it('should handle very long sentence contexts', async () => {
      const longContext = 'א'.repeat(1000); // Very long Hebrew text
      const filters: TextCorrectionFilters = {
        originalWord: 'test',
      };

      const mockCorrections = [
        {
          id: 'correction-1',
          originalWord: 'test',
          correctedWord: 'טֶסְט',
          sentenceContext: longContext,
          fixType: FixType.expansion,
          // ... other fields
        },
      ];

      mockPrismaService.textCorrection.findMany.mockResolvedValue(mockCorrections);

      const result = await repository.findMany(filters);

      expect(result).toHaveLength(1);
      expect(result[0].sentenceContext).toBe(longContext);
    });
  });
});
