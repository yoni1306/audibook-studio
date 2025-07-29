import { Test, TestingModule } from '@nestjs/testing';
import { EpubProcessorService } from './epub-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { S3Service } from '../s3/s3.service';
import { Job } from 'bullmq';

describe('EpubProcessorService', () => {
  let service: EpubProcessorService;
  let mockPrismaService: jest.Mocked<Partial<PrismaService>>;
  let mockMetricsService: jest.Mocked<Partial<MetricsService>>;
  let mockS3Service: jest.Mocked<Partial<S3Service>>;

  beforeEach(async () => {
    mockPrismaService = {
      book: {
        update: jest.fn(),
      },
    } as any;

    mockMetricsService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockS3Service = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpubProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    service = module.get<EpubProcessorService>(EpubProcessorService);
  });

  describe('process', () => {
    it('should process parse-epub jobs successfully', async () => {
      // Arrange
      const jobData = {
        bookId: 'test-book-id',
        s3Key: 'test-s3-key',
        parsingMethod: 'default',
      };
      const mockJob = {
        data: jobData,
      } as any;

      // Mock successful database operations
      mockPrismaService.book!.update = jest.fn().mockResolvedValue({});

      // Act
      const result = await service.process(mockJob);

      // Assert
      expect(result).toEqual({
        success: true,
        bookId: jobData.bookId,
        duration: 0,
        note: 'Job coordinated - actual parsing handled by workers service',
      });

      // Verify database updates - coordinator only sets status to PROCESSING
      expect(mockPrismaService.book!.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.book!.update).toHaveBeenCalledWith({
        where: { id: jobData.bookId },
        data: { status: 'PROCESSING' },
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const jobData = {
        bookId: 'test-book-id',
        s3Key: 'test-s3-key',
        parsingMethod: 'default',
      };
      const mockJob = {
        data: jobData,
      } as any;

      // Mock database error
      mockPrismaService.book!.update = jest.fn()
        .mockRejectedValueOnce(new Error('Database connection failed'));

      // Act & Assert - coordinator handles errors but doesn't throw
      const result = await service.process(mockJob);
      
      // Coordinator returns success even if DB update fails (workers will handle actual parsing)
      expect(result).toEqual({
        success: true,
        bookId: jobData.bookId,
        duration: 0,
        note: 'Job coordinated - actual parsing handled by workers service',
      });

      // Verify attempt to set status to PROCESSING
      expect(mockPrismaService.book!.update).toHaveBeenCalledWith({
        where: { id: jobData.bookId },
        data: { status: 'PROCESSING' },
      });
    });

    it('should coordinate job processing without actual parsing', async () => {
      // Arrange
      const jobData = {
        bookId: 'test-book-id',
        s3Key: 'test-s3-key',
        parsingMethod: 'default',
      };
      const mockJob = {
        data: jobData,
      } as any;

      // Mock successful status update
      mockPrismaService.book!.update = jest.fn().mockResolvedValue({});

      // Act
      const result = await service.process(mockJob);

      // Assert - coordinator always succeeds and delegates to workers
      expect(result).toEqual({
        success: true,
        bookId: jobData.bookId,
        duration: 0,
        note: 'Job coordinated - actual parsing handled by workers service',
      });

      // Verify only PROCESSING status is set (workers handle the rest)
      expect(mockPrismaService.book!.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.book!.update).toHaveBeenCalledWith({
        where: { id: jobData.bookId },
        data: { status: 'PROCESSING' },
      });
    });

    it('should ignore non-parse-epub jobs', async () => {
      // Arrange
      const mockJob: Job = {
        id: 'test-job-id',
        name: 'unknown-job-type',
        data: {},
      } as any;

      // Act
      const result = await service.process(mockJob);

      // Assert
      expect(result).toBeUndefined();
      expect(mockPrismaService.book!.update).not.toHaveBeenCalled();
    });

    it('should handle jobs with default parsing method', async () => {
      // Arrange
      const jobData = {
        bookId: 'test-book-id',
        s3Key: 'test-s3-key',
        // No parsingMethod specified - should default
      };
      const mockJob = {
        data: jobData,
      } as any;

      // Mock successful database operations
      mockPrismaService.book!.update = jest.fn().mockResolvedValue({});

      // Act
      const result = await service.process(mockJob);

      // Assert
      expect(result).toEqual({
        success: true,
        bookId: jobData.bookId,
        duration: 0,
        note: 'Job coordinated - actual parsing handled by workers service',
      });

      // Verify database updates - coordinator only sets PROCESSING status
      expect(mockPrismaService.book!.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.book!.update).toHaveBeenCalledWith({
        where: { id: jobData.bookId },
        data: { status: 'PROCESSING' },
      });
    });
  });

  describe('service instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have the correct constructor name', () => {
      expect(service.constructor.name).toBe('EpubProcessorService');
    });
  });
});
