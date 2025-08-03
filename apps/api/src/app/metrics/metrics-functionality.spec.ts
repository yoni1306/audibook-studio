import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { BooksService } from '../books/books.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Metrics Functionality Test', () => {
  let metricsService: MetricsService;
  let booksService: BooksService;
  let prismaService: PrismaService;

  // Mock Prisma service
  const mockPrismaService = {
    metricEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    bookMetrics: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    book: {
      findMany: jest.fn(),
    },
    paragraph: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    page: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    metricsService = module.get<MetricsService>(MetricsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordEvent', () => {
    it('should record a TEXT_EDIT event with proper context', async () => {
      const testEventData = {
        eventType: 'TEXT_EDIT' as const,
        bookId: 'test-book-id',
        eventData: {
          paragraphId: 'test-paragraph-id',
          pageNumber: 1,
          pageId: 'test-page-id',
          editedContent: 'This is the edited content for testing metrics',
          changesCount: 2,
          textChanges: [
            {
              originalWord: 'original',
              correctedWord: 'corrected',
              position: 10
            }
          ]
        },
        duration: 150,
        success: true
      };

      mockPrismaService.metricEvent.create.mockResolvedValue({
        id: 'event-123',
        ...testEventData,
        timestamp: new Date(),
      });

      mockPrismaService.bookMetrics.upsert.mockResolvedValue({
        id: 'metrics-123',
        bookId: testEventData.bookId,
        totalTextEdits: 1,
        totalAudioGenerated: 0,
        totalBulkFixes: 0,
        totalCorrections: 0,
        avgProcessingTime: 150,
        completionPercentage: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await metricsService.recordEvent(testEventData);

      // Verify the event was recorded with correct data
      expect(mockPrismaService.metricEvent.create).toHaveBeenCalledWith({
        data: {
          bookId: testEventData.bookId,
          eventType: testEventData.eventType,
          eventData: testEventData.eventData,
          duration: testEventData.duration,
          success: testEventData.success,
          errorMessage: undefined,
        },
      });

      // Verify book metrics were updated
      expect(mockPrismaService.bookMetrics.upsert).toHaveBeenCalled();
    });

    it('should record event data with enhanced context for analytics', async () => {
      const testEventData = {
        eventType: 'TEXT_EDIT' as const,
        bookId: 'test-book-id',
        eventData: {
          paragraphId: 'test-paragraph-id',
          pageNumber: 5,
          pageId: 'test-page-id',
          editedContent: 'Enhanced content with page and paragraph context',
          changesCount: 3,
          textChanges: []
        }
      };

      mockPrismaService.metricEvent.create.mockResolvedValue({
        id: 'event-456',
        ...testEventData,
        timestamp: new Date(),
      });

      await metricsService.recordEvent(testEventData);

      const createCall = mockPrismaService.metricEvent.create.mock.calls[0][0];
      
      // Verify enhanced context is preserved
      expect(createCall.data.eventData).toMatchObject({
        paragraphId: 'test-paragraph-id',
        pageNumber: 5,
        pageId: 'test-page-id',
        editedContent: expect.stringContaining('Enhanced content'),
        changesCount: 3,
      });
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity with proper context', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          bookId: 'book-1',
          eventType: 'TEXT_EDIT',
          eventData: {
            paragraphId: 'para-1',
            pageNumber: 3,
            editedContent: 'Sample edited text content',
            changesCount: 2
          },
          timestamp: new Date('2024-01-01T12:00:00Z'),
          success: true,
          duration: 100,
          errorMessage: null,
        },
        {
          id: 'event-2',
          bookId: 'book-1',
          eventType: 'BULK_FIX_APPLIED',
          eventData: {
            totalParagraphsUpdated: 5,
            totalWordsFixed: 12,
            pageNumber: 4
          },
          timestamp: new Date('2024-01-01T11:30:00Z'),
          success: true,
          duration: 250,
          errorMessage: null,
        }
      ];

      mockPrismaService.metricEvent.findMany.mockResolvedValue(mockEvents);
      mockPrismaService.book.findMany.mockResolvedValue([
        { id: 'book-1', title: 'Test Book' }
      ]);

      const result = await metricsService.getRecentActivity();

      expect(result).toHaveLength(2);
      
      // Verify TEXT_EDIT event has editedContent
      const textEditEvent = result.find(e => e.eventType === 'TEXT_EDIT');
      expect(textEditEvent?.eventData).toMatchObject({
        paragraphId: 'para-1',
        pageNumber: 3,
        editedContent: 'Sample edited text content',
      });

      // Verify BULK_FIX_APPLIED event has context
      const bulkFixEvent = result.find(e => e.eventType === 'BULK_FIX_APPLIED');
      expect(bulkFixEvent?.eventData).toMatchObject({
        totalParagraphsUpdated: 5,
        totalWordsFixed: 12,
        pageNumber: 4,
      });
    });
  });

  describe('getGlobalMetrics', () => {
    it('should return aggregated metrics', async () => {
      mockPrismaService.bookMetrics.aggregate.mockResolvedValue({
        _sum: {
          totalTextEdits: 25,
          totalAudioGenerated: 10,
          totalBulkFixes: 5,
          totalCorrections: 30,
        },
        _avg: {
          avgProcessingTime: 1250,
        },
        _count: {
          bookId: 3,
        },
      });

      mockPrismaService.book.findMany.mockResolvedValue([
        { id: 'book-1' },
        { id: 'book-2' },
        { id: 'book-3' },
      ]);

      const result = await metricsService.getGlobalMetrics();

      expect(result).toMatchObject({
        totalBooks: 3,
        totalTextEdits: 25,
        totalAudioGenerated: 10,
        totalBulkFixes: 5,
        totalCorrections: 30,
        avgProcessingTime: 1250,
        activeBooks: 3,
      });
    });
  });
});
