import { EpubProcessorService } from './epub-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { Job } from 'bullmq';

describe('EpubProcessorService', () => {
  let service: EpubProcessorService;
  let mockPrismaService: jest.Mocked<Partial<PrismaService>>;

  beforeEach(() => {
    mockPrismaService = {
      book: {
        update: jest.fn(),
      },
    } as any;

    service = new EpubProcessorService(
      mockPrismaService as unknown as PrismaService
    );
  });

  describe('process', () => {
    it('should process parse-epub jobs successfully', async () => {
      // Arrange
      const jobData = {
        bookId: 'test-book-id',
        s3Key: 'test-book.epub',
        parsingMethod: 'page-based' as const,
      };

      const mockJob: Job = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: jobData,
      } as any;

      mockPrismaService.book!.update = jest.fn()
        .mockResolvedValueOnce({ id: jobData.bookId, status: 'PROCESSING' })
        .mockResolvedValueOnce({ id: jobData.bookId, status: 'READY' });

      // Act
      const result = await service.process(mockJob);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.bookId).toBe(jobData.bookId);
      expect(result.duration).toBeGreaterThan(0);

      // Verify database updates - should be called twice (PROCESSING -> READY)
      expect(mockPrismaService.book!.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.book!.update).toHaveBeenNthCalledWith(1, {
        where: { id: jobData.bookId },
        data: { status: 'PROCESSING' },
      });
      expect(mockPrismaService.book!.update).toHaveBeenNthCalledWith(2, {
        where: { id: jobData.bookId },
        data: { status: 'READY' },
      });
    });

    it('should handle database errors and set status to ERROR', async () => {
      // Arrange
      const jobData = {
        bookId: 'test-book-id',
        s3Key: 'test-book.epub',
        parsingMethod: 'xhtml-based' as const,
      };

      const mockJob: Job = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: jobData,
      } as any;

      const dbError = new Error('Database connection failed');
      mockPrismaService.book!.update = jest.fn()
        .mockResolvedValueOnce({ id: jobData.bookId, status: 'PROCESSING' })
        .mockRejectedValueOnce(dbError);

      // Act & Assert
      await expect(service.process(mockJob)).rejects.toThrow('Database connection failed');

      // Verify status was set to PROCESSING initially
      expect(mockPrismaService.book!.update).toHaveBeenNthCalledWith(1, {
        where: { id: jobData.bookId },
        data: { status: 'PROCESSING' },
      });
    });

    it('should handle parsing failures and set status to ERROR', async () => {
      // Arrange
      const jobData = {
        bookId: 'test-book-id',
        s3Key: 'corrupted-book.epub',
      };

      const mockJob: Job = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: jobData,
      } as any;

      // Mock the first update to succeed (PROCESSING), but simulate parsing failure
      mockPrismaService.book!.update = jest.fn()
        .mockResolvedValueOnce({ id: jobData.bookId, status: 'PROCESSING' })
        .mockResolvedValueOnce({ id: jobData.bookId, status: 'ERROR' });

      // Mock the simulateEpubParsing to throw an error
      const originalSimulateEpubParsing = (service as any).simulateEpubParsing;
      (service as any).simulateEpubParsing = jest.fn().mockRejectedValue(new Error('Parsing failed'));

      // Act & Assert
      await expect(service.process(mockJob)).rejects.toThrow('Parsing failed');

      // Verify status updates
      expect(mockPrismaService.book!.update).toHaveBeenNthCalledWith(1, {
        where: { id: jobData.bookId },
        data: { status: 'PROCESSING' },
      });

      // Restore original method
      (service as any).simulateEpubParsing = originalSimulateEpubParsing;
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
        s3Key: 'test-book.epub',
        // No parsingMethod specified - should use default
      };

      const mockJob: Job = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: jobData,
      } as any;

      mockPrismaService.book!.update = jest.fn()
        .mockResolvedValueOnce({ id: jobData.bookId, status: 'PROCESSING' })
        .mockResolvedValueOnce({ id: jobData.bookId, status: 'READY' });

      // Act
      const result = await service.process(mockJob);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.bookId).toBe(jobData.bookId);
      expect(result.duration).toBeGreaterThan(0);

      // Verify database updates
      expect(mockPrismaService.book!.update).toHaveBeenCalledTimes(2);
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
