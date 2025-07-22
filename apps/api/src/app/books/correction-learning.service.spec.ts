import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CorrectionLearningService } from './correction-learning.service';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { FixType, TextCorrection } from '@prisma/client';

describe('CorrectionLearningService', () => {
  let service: CorrectionLearningService;
  let mockTextCorrectionRepository: jest.Mocked<TextCorrectionRepository>;

  const mockTextCorrection: TextCorrection = {
    id: '1',
    bookId: 'book-1',
    paragraphId: 'para-1',
    originalWord: 'שלום',
    currentWord: 'שלום',
    correctedWord: 'שָׁלוֹם',
    fixSequence: 1,
    isLatestFix: true,
    sentenceContext: 'שלום עליכם',
    fixType: FixType.vowelization,
    ttsModel: 'test-model',
    ttsVoice: 'test-voice',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockCorrectionData: CreateTextCorrectionData = {
    bookId: 'book-1',
    paragraphId: 'para-1',
    originalWord: 'שלום',
    currentWord: 'שלום',
    correctedWord: 'שָׁלוֹם',
    sentenceContext: 'שלום עליכם',
    fixType: FixType.vowelization,
    ttsModel: 'test-model',
    ttsVoice: 'test-voice',
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findMany: jest.fn(),
      findGroupedCorrections: jest.fn(),
      getStats: jest.fn(),
      getTopCorrections: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrectionLearningService,
        {
          provide: TextCorrectionRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CorrectionLearningService>(CorrectionLearningService);
    mockTextCorrectionRepository = module.get(TextCorrectionRepository);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordCorrection', () => {
    it('should record a correction successfully', async () => {
      mockTextCorrectionRepository.create.mockResolvedValue(mockTextCorrection);

      const result = await service.recordCorrection(mockCorrectionData);

      expect(mockTextCorrectionRepository.create).toHaveBeenCalledWith(mockCorrectionData);
      expect(result).toEqual(mockTextCorrection);
    });

    it('should handle errors when recording correction', async () => {
      const error = new Error('Database error');
      mockTextCorrectionRepository.create.mockRejectedValue(error);

      await expect(service.recordCorrection(mockCorrectionData)).rejects.toThrow('Database error');
      expect(mockTextCorrectionRepository.create).toHaveBeenCalledWith(mockCorrectionData);
    });
  });

  describe('getCorrectionSuggestions', () => {
    it('should return correction suggestions for given text', async () => {
      const mockGroupedCorrections = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          fixType: FixType.vowelization,
          occurrenceCount: 5,
        },
      ];

      const mockRecentCorrections = [mockTextCorrection];

      // Mock to return corrections for 'שלום' and empty for 'עליכם'
      mockTextCorrectionRepository.findGroupedCorrections
        .mockResolvedValueOnce(mockGroupedCorrections) // for 'שלום'
        .mockResolvedValueOnce([]); // for 'עליכם'
      mockTextCorrectionRepository.findMany.mockResolvedValue(mockRecentCorrections);

      const result = await service.getCorrectionSuggestions('שלום עליכם', 2);

      expect(mockTextCorrectionRepository.findGroupedCorrections).toHaveBeenCalledTimes(2);
      expect(mockTextCorrectionRepository.findGroupedCorrections).toHaveBeenCalledWith({
        originalWord: 'שלום',
        minOccurrences: 2,
      });
      expect(mockTextCorrectionRepository.findGroupedCorrections).toHaveBeenCalledWith({
        originalWord: 'עליכם',
        minOccurrences: 2,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        originalWord: 'שלום',
        suggestedWord: 'שָׁלוֹם',
        contextSentence: 'שלום עליכם',
        occurrenceCount: 5,
        fixType: 'vowelization',
        lastUsed: new Date('2023-01-01'),
      });
    });

    it('should return empty array when no suggestions found', async () => {
      mockTextCorrectionRepository.findGroupedCorrections.mockResolvedValue([]);

      const result = await service.getCorrectionSuggestions('test text', 2);

      expect(result).toEqual([]);
    });


  });

  describe('getLearningStats', () => {
    it('should return learning statistics', async () => {
      const mockStats = {
        totalCorrections: 100,
        uniqueWords: 50,
        fixTypeBreakdown: [
          { fixType: 'vowelization', count: 60 },
          { fixType: 'disambiguation', count: 40 },
        ],
      };

      const mockTopCorrections = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          fixType: FixType.vowelization,
          occurrenceCount: 10,
          lastUsed: new Date('2023-01-01'),
        },
      ];

      const mockRecentCorrections = [mockTextCorrection];

      mockTextCorrectionRepository.getStats.mockResolvedValue(mockStats);
      mockTextCorrectionRepository.getTopCorrections.mockResolvedValue(mockTopCorrections);
      mockTextCorrectionRepository.findMany.mockResolvedValue(mockRecentCorrections);

      const result = await service.getLearningStats();

      expect(mockTextCorrectionRepository.getStats).toHaveBeenCalled();
      expect(mockTextCorrectionRepository.getTopCorrections).toHaveBeenCalledWith({ take: 10 });
      expect(mockTextCorrectionRepository.findMany).toHaveBeenCalledWith({
        limit: 5,
        orderBy: 'desc',
      });

      expect(result).toEqual({
        totalCorrections: 100,
        uniqueWords: 50,
        topCorrections: [
          {
            originalWord: 'שלום',
            correctedWord: 'שָׁלוֹם',
            occurrenceCount: 10,
            fixType: 'vowelization',
          },
        ],
        recentCorrections: [
          {
            originalWord: 'שלום',
            correctedWord: 'שָׁלוֹם',
            fixType: 'vowelization',
            createdAt: new Date('2023-01-01'),
          },
        ],
      });
    });

    it('should handle errors when getting learning stats', async () => {
      const error = new Error('Database error');
      mockTextCorrectionRepository.getStats.mockRejectedValue(error);

      await expect(service.getLearningStats()).rejects.toThrow('Database error');
    });
  });

  describe('getWordCorrections', () => {
    it('should return word corrections with suggestions', async () => {
      const mockGroupedCorrections = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          fixType: FixType.vowelization,
          occurrenceCount: 5,
          lastUsed: new Date('2023-01-01'),
        },
      ];

      const mockRecentCorrections = [mockTextCorrection];

      mockTextCorrectionRepository.findGroupedCorrections.mockResolvedValue(mockGroupedCorrections);
      mockTextCorrectionRepository.findMany.mockResolvedValue(mockRecentCorrections);

      const result = await service.getWordCorrections('שלום');

      expect(mockTextCorrectionRepository.findGroupedCorrections).toHaveBeenCalledWith({
        originalWord: 'שלום',
      });
      expect(mockTextCorrectionRepository.findMany).toHaveBeenCalledWith({
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        limit: 1,
        orderBy: 'desc',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        originalWord: 'שלום',
        suggestedWord: 'שָׁלוֹם',
        contextSentence: 'שלום עליכם',
        occurrenceCount: 5,
        fixType: 'vowelization',
        lastUsed: new Date('2023-01-01'),
      });
    });

    it('should return empty array when no corrections found', async () => {
      mockTextCorrectionRepository.findGroupedCorrections.mockResolvedValue([]);

      const result = await service.getWordCorrections('nonexistent');

      expect(result).toEqual([]);
    });

    it('should handle missing recent corrections gracefully', async () => {
      const mockGroupedCorrections = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          fixType: FixType.vowelization,
          occurrenceCount: 5,
          lastUsed: new Date('2023-01-01'),
        },
      ];

      mockTextCorrectionRepository.findGroupedCorrections.mockResolvedValue(mockGroupedCorrections);
      mockTextCorrectionRepository.findMany.mockResolvedValue([]);

      const result = await service.getWordCorrections('שלום');

      expect(result).toEqual([]);
    });

    it('should handle errors when getting word corrections', async () => {
      const error = new Error('Database error');
      mockTextCorrectionRepository.findGroupedCorrections.mockRejectedValue(error);

      await expect(service.getWordCorrections('שלום')).rejects.toThrow('Database error');
    });
  });
});
