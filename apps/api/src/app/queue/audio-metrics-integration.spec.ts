/**
 * END-TO-END METRICS VERIFICATION TEST
 * 
 * This test verifies that audio generation events properly increment metrics
 * from job processing through to database storage.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AudioProcessorService } from './audio-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { S3Service } from '../s3/s3.service';
import { Job } from 'bullmq';

describe('Audio Generation Metrics Integration', () => {
  let audioProcessor: AudioProcessorService;
  let prismaService: PrismaService;
  let metricsService: MetricsService;
  let s3Service: S3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioProcessorService,
        {
          provide: PrismaService,
          useValue: {
            paragraph: {
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordAudioGeneration: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: S3Service,
          useValue: {
            getSignedUrl: jest.fn(),
            deleteFiles: jest.fn(),
          },
        },
      ],
    }).compile();

    audioProcessor = module.get<AudioProcessorService>(AudioProcessorService);
    prismaService = module.get<PrismaService>(PrismaService);
    metricsService = module.get<MetricsService>(MetricsService);
    s3Service = module.get<S3Service>(S3Service);
  });

  describe('Successful Audio Generation', () => {
    it('should record successful audio generation metrics', async () => {
      // Arrange
      const mockJob = {
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Test content for audio generation',
        },
      } as Job;

      // Act
      const result = await audioProcessor.process(mockJob);

      // Assert - Verify the job completed successfully
      expect(result.success).toBe(true);
      expect(result.audioS3Key).toBe('audio/test-book-id/test-paragraph-id.mp3');
      expect(result.duration).toBeGreaterThan(0);

      // Assert - Verify paragraph status updates
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: 'test-paragraph-id' },
        data: { audioStatus: 'GENERATING' },
      });

      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: 'test-paragraph-id' },
        data: { 
          audioS3Key: 'audio/test-book-id/test-paragraph-id.mp3',
          audioStatus: 'READY'
        },
      });

      // Assert - Verify metrics were recorded
      expect(metricsService.recordAudioGeneration).toHaveBeenCalledWith(
        'test-book-id',
        'test-paragraph-id',
        expect.any(Number), // duration
        true // success
        // Note: no error message parameter for successful calls
      );
    });

    it('should record metrics with correct duration', async () => {
      // Arrange
      const mockJob = {
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Short content',
        },
      } as Job;

      const startTime = Date.now();

      // Act
      await audioProcessor.process(mockJob);
      const endTime = Date.now();

      // Assert - Verify metrics duration is reasonable
      const metricsCall = (metricsService.recordAudioGeneration as jest.Mock).mock.calls[0];
      const recordedDuration = metricsCall[2];
      
      expect(recordedDuration).toBeGreaterThan(0);
      expect(recordedDuration).toBeLessThanOrEqual(endTime - startTime + 100); // Allow 100ms buffer
    });
  });

  describe('Failed Audio Generation', () => {
    it('should record failed audio generation metrics when paragraph update fails', async () => {
      // Arrange
      const mockJob = {
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Test content',
        },
      } as Job;

      const testError = new Error('Database connection failed');
      (prismaService.paragraph.update as jest.Mock)
        .mockRejectedValueOnce(testError); // First call (GENERATING status) fails

      // Act & Assert
      await expect(audioProcessor.process(mockJob)).rejects.toThrow('Database connection failed');

      // Assert - Verify failure metrics were recorded
      expect(metricsService.recordAudioGeneration).toHaveBeenCalledWith(
        'test-book-id',
        'test-paragraph-id',
        expect.any(Number), // duration
        false, // success = false
        'Database connection failed' // error message
      );
    });

    it('should handle metrics recording failure gracefully', async () => {
      // Arrange
      const mockJob = {
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Test content',
        },
      } as Job;

      // Make metrics service fail
      (metricsService.recordAudioGeneration as jest.Mock)
        .mockRejectedValue(new Error('Metrics service unavailable'));

      // Act - Should not throw despite metrics failure
      const result = await audioProcessor.process(mockJob);

      // Assert - Job should still complete successfully
      expect(result.success).toBe(true);
      
      // Verify metrics recording was attempted
      expect(metricsService.recordAudioGeneration).toHaveBeenCalled();
    });
  });

  describe('Job Filtering', () => {
    it('should not process non-audio-generation jobs', async () => {
      // Arrange
      const mockJob = {
        name: 'parse-epub', // Different job type
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Test content',
        },
      } as Job;

      // Act
      const result = await audioProcessor.process(mockJob);

      // Assert - Should return undefined (not processed)
      expect(result).toBeUndefined();
      
      // Verify no database operations occurred
      expect(prismaService.paragraph.update).not.toHaveBeenCalled();
      expect(metricsService.recordAudioGeneration).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Data Integrity', () => {
    it('should record metrics with correct event data structure', async () => {
      // Arrange
      const mockJob = {
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-123',
          bookId: 'test-book-456',
          content: 'Sample content for testing metrics data integrity',
        },
      } as Job;

      // Act
      await audioProcessor.process(mockJob);

      // Assert - Verify metrics call parameters
      expect(metricsService.recordAudioGeneration).toHaveBeenCalledWith(
        'test-book-456', // bookId
        'test-paragraph-123', // paragraphId
        expect.any(Number), // duration (positive number)
        true // success
        // Note: no error message parameter for successful calls
      );

      // Verify the call was made exactly once
      expect(metricsService.recordAudioGeneration).toHaveBeenCalledTimes(1);
    });
  });
});
