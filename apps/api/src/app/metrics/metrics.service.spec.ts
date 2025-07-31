import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService, CreateMetricEventDto, TextChange } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '@prisma/client';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockPrismaService: any;

  const mockBookId = 'book-123';
  const mockMetricEvent = {
    id: 'event-123',
    bookId: mockBookId,
    eventType: EventType.TEXT_EDIT,
    eventData: {},
    duration: null,
    success: true,
    errorMessage: null,
    createdAt: new Date(),
  };

  const mockBookMetrics = {
    id: 'metrics-123',
    bookId: mockBookId,
    totalTextEdits: 10,
    totalAudioGenerated: 5,
    totalBulkFixes: 2,
    totalCorrections: 8,
    avgProcessingTime: 1500,
    completionPercentage: 65.5,
    lastActivity: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      metricEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      bookMetrics: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    mockPrismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordEvent', () => {
    it('should record a metric event successfully', async () => {
      const eventData: CreateMetricEventDto = {
        bookId: mockBookId,
        eventType: EventType.TEXT_EDIT,
        eventData: { paragraphId: 'para-123', changeCount: 1 },
        success: true,
      };

      mockPrismaService.metricEvent.create.mockResolvedValue(mockMetricEvent);
      mockPrismaService.bookMetrics.upsert.mockResolvedValue(mockBookMetrics);

      await service.recordEvent(eventData);

      expect(mockPrismaService.metricEvent.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.metricEvent.create).toHaveBeenCalledWith({
        data: {
          bookId: mockBookId,
          eventType: EventType.TEXT_EDIT,
          eventData: { paragraphId: 'para-123', changeCount: 1 },
          duration: undefined,
          success: true,
          errorMessage: undefined,
        },
      });
    });

    it('should throw error when database operation fails', async () => {
      const eventData: CreateMetricEventDto = {
        bookId: mockBookId,
        eventType: EventType.TEXT_EDIT,
        eventData: {},
        success: true,
      };

      mockPrismaService.metricEvent.create.mockRejectedValue(new Error('Database error'));

      await expect(service.recordEvent(eventData)).rejects.toThrow('Failed to record metric event');
    });
  });

  describe('recordTextEdit', () => {
    it('should record text edit event with correct data', async () => {
      const paragraphId = 'para-123';
      const changes: TextChange[] = [
        {
          originalWord: 'hello',
          correctedWord: 'Hello',
          position: 0,
          fixType: 'capitalization',
        },
        {
          originalWord: 'wrold',
          correctedWord: 'world',
          position: 6,
          fixType: 'spelling',
        },
      ];

      mockPrismaService.metricEvent.create.mockResolvedValue(mockMetricEvent);
      mockPrismaService.bookMetrics.upsert.mockResolvedValue(mockBookMetrics);

      await service.recordTextEdit(mockBookId, paragraphId, changes);

      expect(mockPrismaService.metricEvent.create).toHaveBeenCalledWith({
        data: {
          bookId: mockBookId,
          eventType: EventType.TEXT_EDIT,
          eventData: {
            paragraphId,
            changes,
            changeCount: 2,
            wordCount: 2,
          },
          duration: undefined,
          success: true,
          errorMessage: undefined,
        },
      });
    });
  });

  describe('recordAudioGeneration', () => {
    it('should record successful audio generation', async () => {
      const paragraphId = 'para-456';
      const duration = 1200;

      mockPrismaService.metricEvent.create.mockResolvedValue(mockMetricEvent);
      mockPrismaService.bookMetrics.upsert.mockResolvedValue(mockBookMetrics);

      await service.recordAudioGeneration(mockBookId, paragraphId, duration, true);

      expect(mockPrismaService.metricEvent.create).toHaveBeenCalledWith({
        data: {
          bookId: mockBookId,
          eventType: EventType.AUDIO_GENERATION,
          eventData: {
            paragraphId,
            processingDuration: duration,
          },
          duration: 1200,
          success: true,
          errorMessage: undefined,
        },
      });
    });

    it('should record failed audio generation', async () => {
      const paragraphId = 'para-456';
      const duration = 500;
      const errorMessage = 'Audio processing failed';

      mockPrismaService.metricEvent.create.mockResolvedValue(mockMetricEvent);
      mockPrismaService.bookMetrics.upsert.mockResolvedValue(mockBookMetrics);

      await service.recordAudioGeneration(mockBookId, paragraphId, duration, false, errorMessage);

      expect(mockPrismaService.metricEvent.create).toHaveBeenCalledWith({
        data: {
          bookId: mockBookId,
          eventType: EventType.AUDIO_GENERATION,
          eventData: {
            paragraphId,
            processingDuration: duration,
          },
          duration: 500,
          success: false,
          errorMessage: 'Audio processing failed',
        },
      });
    });
  });

  describe('recordBulkFix', () => {
    it('should record bulk fix event with correct data', async () => {
      const originalWord = 'teh';
      const correctedWord = 'the';
      const paragraphIds = ['para-1', 'para-2', 'para-3'];
      const fixType = 'spelling';

      mockPrismaService.metricEvent.create.mockResolvedValue(mockMetricEvent);
      mockPrismaService.bookMetrics.upsert.mockResolvedValue(mockBookMetrics);

      await service.recordBulkFix(mockBookId, originalWord, correctedWord, paragraphIds, fixType);

      expect(mockPrismaService.metricEvent.create).toHaveBeenCalledWith({
        data: {
          bookId: mockBookId,
          eventType: EventType.BULK_FIX_APPLIED,
          eventData: {
            originalWord,
            correctedWord,
            paragraphIds,
            fixType,
            affectedParagraphs: 3,
          },
          duration: undefined,
          success: true,
          errorMessage: undefined,
        },
      });
    });

    it('should validate parameters and throw errors for invalid input', async () => {
      await expect(
        service.recordBulkFix('', 'word', 'corrected', ['para-1'], 'spelling')
      ).rejects.toThrow('Book ID is required for bulk fix');

      await expect(
        service.recordBulkFix(mockBookId, '', 'corrected', ['para-1'], 'spelling')
      ).rejects.toThrow('Original word is required for bulk fix');

      await expect(
        service.recordBulkFix(mockBookId, 'word', '', ['para-1'], 'spelling')
      ).rejects.toThrow('Corrected word is required for bulk fix');

      await expect(
        service.recordBulkFix(mockBookId, 'word', 'corrected', [], 'spelling')
      ).rejects.toThrow('At least one paragraph ID is required for bulk fix');

      await expect(
        service.recordBulkFix(mockBookId, 'word', 'corrected', ['para-1'], '')
      ).rejects.toThrow('Fix type is required for bulk fix');
    });
  });

  describe('getBookMetrics', () => {
    it('should return book metrics when they exist', async () => {
      mockPrismaService.bookMetrics.findUnique.mockResolvedValue(mockBookMetrics);

      const result = await service.getBookMetrics(mockBookId);

      expect(result).toEqual({
        bookId: mockBookMetrics.bookId,
        totalTextEdits: mockBookMetrics.totalTextEdits,
        totalAudioGenerated: mockBookMetrics.totalAudioGenerated,
        totalBulkFixes: mockBookMetrics.totalBulkFixes,
        totalCorrections: mockBookMetrics.totalCorrections,
        avgProcessingTime: mockBookMetrics.avgProcessingTime,
        completionPercentage: mockBookMetrics.completionPercentage,
        lastActivity: mockBookMetrics.lastActivity,
      });
      expect(mockPrismaService.bookMetrics.findUnique).toHaveBeenCalledWith({
        where: { bookId: mockBookId },
      });
    });

    it('should create default metrics when none exist', async () => {
      const defaultMetrics = {
        id: 'new-metrics-123',
        bookId: mockBookId,
        totalTextEdits: 0,
        totalAudioGenerated: 0,
        totalBulkFixes: 0,
        totalCorrections: 0,
        avgProcessingTime: null,
        completionPercentage: 0,
        lastActivity: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.bookMetrics.findUnique.mockResolvedValue(null);
      mockPrismaService.bookMetrics.create.mockResolvedValue(defaultMetrics);

      const result = await service.getBookMetrics(mockBookId);

      expect(result).toEqual({
        bookId: defaultMetrics.bookId,
        totalTextEdits: defaultMetrics.totalTextEdits,
        totalAudioGenerated: defaultMetrics.totalAudioGenerated,
        totalBulkFixes: defaultMetrics.totalBulkFixes,
        totalCorrections: defaultMetrics.totalCorrections,
        avgProcessingTime: defaultMetrics.avgProcessingTime,
        completionPercentage: defaultMetrics.completionPercentage,
        lastActivity: defaultMetrics.lastActivity,
      });
      expect(mockPrismaService.bookMetrics.create).toHaveBeenCalledWith({
        data: {
          bookId: mockBookId,
          totalTextEdits: 0,
          totalAudioGenerated: 0,
          totalBulkFixes: 0,
          totalCorrections: 0,
          avgProcessingTime: null,
          completionPercentage: 0,
        },
      });
    });
  });

  // Test the modular components individually
  describe('validateBulkFixParams', () => {
    it('should pass validation with valid parameters', () => {
      // Access private method for testing
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, mockBookId, 'word', 'corrected', ['para-1'], 'spelling');
      }).not.toThrow();
    });

    it('should throw error for empty book ID', () => {
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, '', 'word', 'corrected', ['para-1'], 'spelling');
      }).toThrow('Book ID is required for bulk fix');
    });

    it('should throw error for whitespace-only book ID', () => {
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, '   ', 'word', 'corrected', ['para-1'], 'spelling');
      }).toThrow('Book ID is required for bulk fix');
    });

    it('should throw error for empty original word', () => {
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, mockBookId, '', 'corrected', ['para-1'], 'spelling');
      }).toThrow('Original word is required for bulk fix');
    });

    it('should throw error for empty corrected word', () => {
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, mockBookId, 'word', '', ['para-1'], 'spelling');
      }).toThrow('Corrected word is required for bulk fix');
    });

    it('should throw error for empty paragraph IDs array', () => {
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, mockBookId, 'word', 'corrected', [], 'spelling');
      }).toThrow('At least one paragraph ID is required for bulk fix');
    });

    it('should throw error for non-array paragraph IDs', () => {
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, mockBookId, 'word', 'corrected', null, 'spelling');
      }).toThrow('At least one paragraph ID is required for bulk fix');
    });

    it('should throw error for empty fix type', () => {
      const validateMethod = (service as any).validateBulkFixParams;
      
      expect(() => {
        validateMethod.call(service, mockBookId, 'word', 'corrected', ['para-1'], '');
      }).toThrow('Fix type is required for bulk fix');
    });
  });

  describe('createBulkFixEventData', () => {
    it('should create correct event data structure', () => {
      const createDataMethod = (service as any).createBulkFixEventData;
      const originalWord = 'teh';
      const correctedWord = 'the';
      const paragraphIds = ['para-1', 'para-2', 'para-3'];
      const fixType = 'spelling';

      const result = createDataMethod.call(service, originalWord, correctedWord, paragraphIds, fixType);

      expect(result).toEqual({
        originalWord,
        correctedWord,
        paragraphIds,
        fixType,
        affectedParagraphs: 3,
      });
    });

    it('should calculate affected paragraphs count correctly', () => {
      const createDataMethod = (service as any).createBulkFixEventData;
      const paragraphIds = ['para-1', 'para-2', 'para-3', 'para-4', 'para-5'];

      const result = createDataMethod.call(service, 'word', 'corrected', paragraphIds, 'grammar');

      expect(result.affectedParagraphs).toBe(5);
      expect(result.paragraphIds).toHaveLength(5);
    });

    it('should handle single paragraph ID', () => {
      const createDataMethod = (service as any).createBulkFixEventData;
      const paragraphIds = ['para-1'];

      const result = createDataMethod.call(service, 'word', 'corrected', paragraphIds, 'punctuation');

      expect(result.affectedParagraphs).toBe(1);
      expect(result.paragraphIds).toEqual(['para-1']);
    });

    it('should preserve all input parameters in the result', () => {
      const createDataMethod = (service as any).createBulkFixEventData;
      const originalWord = 'colour';
      const correctedWord = 'color';
      const paragraphIds = ['para-a', 'para-b'];
      const fixType = 'localization';

      const result = createDataMethod.call(service, originalWord, correctedWord, paragraphIds, fixType);

      expect(result.originalWord).toBe(originalWord);
      expect(result.correctedWord).toBe(correctedWord);
      expect(result.paragraphIds).toBe(paragraphIds);
      expect(result.fixType).toBe(fixType);
    });
  });
});
