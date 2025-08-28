import { Test, TestingModule } from '@nestjs/testing';
import { NatsQueueController } from './nats-queue.controller';
import { NatsQueueService } from './nats-queue.service';

describe('NatsQueueController', () => {
  let controller: NatsQueueController;
  let mockQueueService: jest.Mocked<NatsQueueService>;

  beforeEach(async () => {
    // Create mock service with actual method names
    mockQueueService = {
      addDiacriticsProcessingJob: jest.fn(),
      getQueueStatus: jest.fn(),
      cleanJobs: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NatsQueueController],
      providers: [
        {
          provide: NatsQueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    controller = module.get<NatsQueueController>(NatsQueueController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('addDiacritics', () => {
    it('should add diacritics job successfully', async () => {
      const jobData = { bookId: 'test-book-123' };
      const expectedResult = {
        jobId: 'job-123',
        timestamp: new Date().toISOString(),
        subject: 'jobs.python.add-diacritics',
        ack: 1,
      };

      mockQueueService.addDiacriticsProcessingJob.mockResolvedValue(expectedResult);

      const result = await controller.addDiacritics(jobData);

      expect(mockQueueService.addDiacriticsProcessingJob).toHaveBeenCalledWith(jobData);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
      const jobData = { bookId: 'test-book-123' };
      mockQueueService.addDiacriticsProcessingJob.mockRejectedValue(new Error('Service error'));

      await expect(controller.addDiacritics(jobData)).rejects.toThrow();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', async () => {
      const expectedStatus = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
        delayed: 0,
        total: 108,
        timestamp: new Date().toISOString(),
        streamInfo: {
          messages: 7,
          bytes: 1024,
          firstSeq: 1,
          lastSeq: 108,
        },
      };

      mockQueueService.getQueueStatus.mockResolvedValue(expectedStatus);

      const result = await controller.getQueueStatus();

      expect(mockQueueService.getQueueStatus).toHaveBeenCalled();
      expect(result).toEqual(expectedStatus);
    });
  });

  describe('cleanJobs', () => {
    it('should clean completed jobs successfully', async () => {
      const expectedResult = {
        cleaned: 10,
        status: 'completed' as const,
        timestamp: new Date().toISOString(),
        message: 'Successfully cleaned 10 completed jobs',
      };

      mockQueueService.cleanJobs.mockResolvedValue(expectedResult);

      const result = await controller.cleanJobs('completed');

      expect(mockQueueService.cleanJobs).toHaveBeenCalledWith('completed');
      expect(result).toEqual(expectedResult);
    });

    it('should clean failed jobs successfully', async () => {
      const expectedResult = {
        cleaned: 5,
        status: 'failed' as const,
        timestamp: new Date().toISOString(),
        message: 'Successfully cleaned 5 failed jobs',
      };

      mockQueueService.cleanJobs.mockResolvedValue(expectedResult);

      const result = await controller.cleanJobs('failed');

      expect(mockQueueService.cleanJobs).toHaveBeenCalledWith('failed');
      expect(result).toEqual(expectedResult);
    });
  });
});
