import { AudioProcessorService } from './audio-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { S3Service } from '../s3/s3.service';
import { Job } from 'bullmq';

describe('AudioProcessorService', () => {
  let service: AudioProcessorService;
  let mockPrismaService: jest.Mocked<Partial<PrismaService>>;
  let mockMetricsService: jest.Mocked<Partial<MetricsService>>;
  let mockS3Service: jest.Mocked<Partial<S3Service>>;

  beforeEach(() => {
    mockPrismaService = {
      paragraph: {
        update: jest.fn(),
      },
    } as any;

    mockMetricsService = {
      recordAudioGeneration: jest.fn(),
    };

    mockS3Service = {};

    service = new AudioProcessorService(
      mockPrismaService as unknown as PrismaService,
      mockMetricsService as unknown as MetricsService,
      mockS3Service as unknown as S3Service
    );
  });

  describe('process', () => {
    it('should process generate-audio jobs successfully', async () => {
      // Arrange
      const jobData = {
        paragraphId: 'test-paragraph-id',
        bookId: 'test-book-id',
        content: 'This is test content for audio generation.',
      };

      const mockJob: Job = {
        id: 'test-job-id',
        name: 'generate-audio',
        data: jobData,
      } as any;

      mockPrismaService.paragraph!.update = jest.fn()
        .mockResolvedValueOnce({
          id: jobData.paragraphId,
          audioStatus: 'GENERATING',
        })
        .mockResolvedValueOnce({
          id: jobData.paragraphId,
          audioStatus: 'READY',
          audioS3Key: expect.any(String),
        });

      mockMetricsService.recordAudioGeneration = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = await service.process(mockJob);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.audioS3Key).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      // Verify database updates - should be called twice (GENERATING -> READY)
      expect(mockPrismaService.paragraph!.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.paragraph!.update).toHaveBeenNthCalledWith(1, {
        where: { id: jobData.paragraphId },
        data: { audioStatus: 'GENERATING' },
      });
      expect(mockPrismaService.paragraph!.update).toHaveBeenNthCalledWith(2, {
        where: { id: jobData.paragraphId },
        data: { 
          audioStatus: 'READY',
          audioS3Key: expect.any(String)
        },
      });

      // Verify metrics recording
      expect(mockMetricsService.recordAudioGeneration).toHaveBeenCalledWith(
        jobData.bookId,
        jobData.paragraphId,
        expect.any(Number),
        true
      );
    });

    it('should handle database errors and record failure metrics', async () => {
      // Arrange
      const jobData = {
        paragraphId: 'test-paragraph-id',
        bookId: 'test-book-id',
        content: 'This is test content.',
      };

      const mockJob: Job = {
        id: 'test-job-id',
        name: 'generate-audio',
        data: jobData,
      } as any;

      const dbError = new Error('Database connection failed');
      mockPrismaService.paragraph!.update = jest.fn()
        .mockResolvedValueOnce({
          id: jobData.paragraphId,
          audioStatus: 'GENERATING',
        })
        .mockRejectedValueOnce(dbError);
      mockMetricsService.recordAudioGeneration = jest.fn().mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.process(mockJob)).rejects.toThrow('Database connection failed');

      // Verify failure metrics were recorded
      expect(mockMetricsService.recordAudioGeneration).toHaveBeenCalledWith(
        jobData.bookId,
        jobData.paragraphId,
        expect.any(Number),
        false,
        'Database connection failed'
      );
    });

    it('should ignore non-generate-audio jobs', async () => {
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
      expect(mockPrismaService.paragraph!.update).not.toHaveBeenCalled();
      expect(mockMetricsService.recordAudioGeneration).not.toHaveBeenCalled();
    });

    it('should handle metrics recording failures gracefully', async () => {
      // Arrange
      const jobData = {
        paragraphId: 'test-paragraph-id',
        bookId: 'test-book-id',
        content: 'This is test content.',
      };

      const mockJob: Job = {
        id: 'test-job-id',
        name: 'generate-audio',
        data: jobData,
      } as any;

      mockPrismaService.paragraph!.update = jest.fn()
        .mockResolvedValueOnce({
          id: jobData.paragraphId,
          audioStatus: 'GENERATING',
        })
        .mockResolvedValueOnce({
          id: jobData.paragraphId,
          audioStatus: 'READY',
          audioS3Key: expect.any(String),
        });

      // Mock metrics service to throw an error
      mockMetricsService.recordAudioGeneration = jest.fn().mockRejectedValue(
        new Error('Metrics service unavailable')
      );

      // Act
      const result = await service.process(mockJob);

      // Assert - should still succeed even if metrics fail
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.audioS3Key).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      // Verify database updates still happened
      expect(mockPrismaService.paragraph!.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.paragraph!.update).toHaveBeenNthCalledWith(1, {
        where: { id: jobData.paragraphId },
        data: { audioStatus: 'GENERATING' },
      });
      expect(mockPrismaService.paragraph!.update).toHaveBeenNthCalledWith(2, {
        where: { id: jobData.paragraphId },
        data: { 
          audioStatus: 'READY',
          audioS3Key: expect.any(String)
        },
      });
    });
  });

  describe('service instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have the correct constructor name', () => {
      expect(service.constructor.name).toBe('AudioProcessorService');
    });
  });
});
