import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Mock the correlation module
jest.mock('@audibook/correlation', () => ({
  getCurrentCorrelationId: jest.fn(() => 'test-correlation-id'),
}));

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: jest.Mocked<Queue>;

  const mockJob = {
    id: 'job-123',
    data: {
      paragraphId: 'paragraph-1',
      bookId: 'book-1',
      content: 'Test content for audio generation',
      correlationId: 'correlation-123',
    },
  };

  beforeEach(async () => {
    const mockQueueInstance = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJobCounts: jest.fn(),
      clean: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken('audio-processing'),
          useValue: mockQueueInstance,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    mockQueue = module.get(getQueueToken('audio-processing'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addEpubParsingJob', () => {
    it('should add EPUB parsing job to queue', async () => {
      const jobData = {
        bookId: 'book-1',
        s3Key: 'uploads/test-book.epub',
      };

      const expectedJob = {
        id: 'epub-job-123',
        data: {
          ...jobData,
          correlationId: expect.any(String),
        },
      };

      mockQueue.add.mockResolvedValue(expectedJob as any);

      const result = await service.addEpubParsingJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('parse-epub', {
        ...jobData,
        correlationId: expect.any(String),
      });
      expect(result).toEqual({ jobId: expectedJob.id });
    });
  });

  describe('addAudioGenerationJob', () => {
    it('should add audio generation job to queue', async () => {
      const jobData = {
        paragraphId: 'paragraph-1',
        bookId: 'book-1',
        content: 'Test content for audio generation',
      };

      mockQueue.add.mockResolvedValue(mockJob as any);

      const result = await service.addAudioGenerationJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('generate-audio', {
        ...jobData,
        correlationId: expect.any(String),
      });
      expect(result).toEqual({ jobId: mockJob.id });
    });

    it('should add audio generation job with Hebrew content', async () => {
      const jobData = {
        paragraphId: 'paragraph-hebrew',
        bookId: 'book-hebrew',
        content: 'זהו תוכן עברי לבדיקת יצירת אודיו',
      };

      const hebrewJob = {
        id: 'hebrew-job-456',
        data: {
          ...jobData,
          correlationId: 'correlation-456',
        },
      };

      mockQueue.add.mockResolvedValue(hebrewJob as any);

      const result = await service.addAudioGenerationJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('generate-audio', {
        ...jobData,
        correlationId: expect.any(String),
      });
      expect(result).toEqual({ jobId: hebrewJob.id });
    });

    it('should handle long content for audio generation', async () => {
      const longContent = 'This is a very long paragraph that contains multiple sentences and should be processed correctly by the audio generation system. '.repeat(10);
      
      const jobData = {
        paragraphId: 'paragraph-long',
        bookId: 'book-1',
        content: longContent,
      };

      const longJob = {
        id: 'long-job-789',
        data: {
          ...jobData,
          correlationId: 'correlation-789',
        },
      };

      mockQueue.add.mockResolvedValue(longJob as any);

      const result = await service.addAudioGenerationJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('generate-audio', {
        ...jobData,
        correlationId: expect.any(String),
      });
      expect(result).toEqual({ jobId: longJob.id });
    });

    it('should handle queue errors gracefully', async () => {
      const jobData = {
        paragraphId: 'paragraph-error',
        bookId: 'book-1',
        content: 'Test content',
      };

      const queueError = new Error('Queue connection failed');
      mockQueue.add.mockRejectedValue(queueError);

      await expect(service.addAudioGenerationJob(jobData)).rejects.toThrow('Queue connection failed');
      
      expect(mockQueue.add).toHaveBeenCalledWith('generate-audio', {
        ...jobData,
        correlationId: expect.any(String),
      });
    });
  });

  describe('Audio Generation Workflow Integration', () => {
    it('should queue multiple audio jobs for different paragraphs', async () => {
      const jobs = [
        {
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          content: 'First paragraph content',
        },
        {
          paragraphId: 'paragraph-2',
          bookId: 'book-1',
          content: 'Second paragraph content',
        },
        {
          paragraphId: 'paragraph-3',
          bookId: 'book-1',
          content: 'Third paragraph content',
        },
      ];

      mockQueue.add
        .mockResolvedValueOnce({ id: 'job-1', data: jobs[0] } as any)
        .mockResolvedValueOnce({ id: 'job-2', data: jobs[1] } as any)
        .mockResolvedValueOnce({ id: 'job-3', data: jobs[2] } as any);

      const results = await Promise.all(
        jobs.map(job => service.addAudioGenerationJob(job))
      );

      expect(results).toEqual([
        { jobId: 'job-1' },
        { jobId: 'job-2' },
        { jobId: 'job-3' },
      ]);
      expect(mockQueue.add).toHaveBeenCalledTimes(3);
    });

    it('should maintain job data integrity', async () => {
      const jobData = {
        paragraphId: 'test-paragraph',
        bookId: 'test-book',
        content: 'Test content with special characters: !@#$%^&*()',
      };

      mockQueue.add.mockResolvedValue({
        id: 'integrity-job',
        data: { ...jobData, correlationId: 'test-correlation' },
      } as any);

      await service.addAudioGenerationJob(jobData);

      const addCall = mockQueue.add.mock.calls[0];
      expect(addCall[0]).toBe('generate-audio');
      expect(addCall[1]).toMatchObject(jobData);
      expect(addCall[1]).toHaveProperty('correlationId');
    });
  });

  describe('addPageAudioCombinationJob', () => {
    it('should add page audio combination job to queue', async () => {
      const jobData = {
        bookId: 'book-1',
        pageId: 'page-1',
      };

      const expectedJob = {
        id: 'combine-job-123',
        data: {
          ...jobData,
          correlationId: expect.any(String),
        },
      };

      mockQueue.add.mockResolvedValue(expectedJob as any);

      const result = await service.addPageAudioCombinationJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('combine-page-audio', {
        ...jobData,
        correlationId: expect.any(String),
      });
      expect(result).toEqual({ jobId: expectedJob.id });
    });

    it('should handle queue errors for page combination', async () => {
      const jobData = {
        bookId: 'book-1',
        pageId: 'page-1',
      };

      const queueError = new Error('Queue connection failed');
      mockQueue.add.mockRejectedValue(queueError);

      await expect(service.addPageAudioCombinationJob(jobData)).rejects.toThrow('Queue connection failed');
      
      expect(mockQueue.add).toHaveBeenCalledWith('combine-page-audio', {
        ...jobData,
        correlationId: expect.any(String),
      });
    });
  });

  describe('cancelPageAudioCombinationJob', () => {
    beforeEach(() => {
      mockQueue.getWaiting = jest.fn().mockResolvedValue([]);
      mockQueue.getActive = jest.fn().mockResolvedValue([]);
    });

    it('should cancel pending page audio combination job', async () => {
      const mockPendingJob = {
        id: 'pending-job-123',
        name: 'combine-page-audio',
        data: { pageId: 'page-1', bookId: 'book-1' },
        remove: jest.fn().mockResolvedValue(undefined),
      };

      mockQueue.getWaiting.mockResolvedValue([mockPendingJob]);
      mockQueue.getActive.mockResolvedValue([]);

      const result = await service.cancelPageAudioCombinationJob('page-1');

      expect(mockQueue.getWaiting).toHaveBeenCalled();
      expect(mockQueue.getActive).toHaveBeenCalled();
      expect(mockPendingJob.remove).toHaveBeenCalled();
      expect(result).toEqual({ cancelledJobs: 1 });
    });

    it('should cancel active page audio combination job', async () => {
      const mockActiveJob = {
        id: 'active-job-456',
        name: 'combine-page-audio',
        data: { pageId: 'page-1', bookId: 'book-1' },
        remove: jest.fn().mockResolvedValue(undefined),
      };

      mockQueue.getWaiting.mockResolvedValue([]);
      mockQueue.getActive.mockResolvedValue([mockActiveJob]);

      const result = await service.cancelPageAudioCombinationJob('page-1');

      expect(mockQueue.getWaiting).toHaveBeenCalled();
      expect(mockQueue.getActive).toHaveBeenCalled();
      expect(mockActiveJob.remove).toHaveBeenCalled();
      expect(result).toEqual({ cancelledJobs: 1 });
    });

    it('should return false if no job found to cancel', async () => {
      mockQueue.getWaiting.mockResolvedValue([]);
      mockQueue.getActive.mockResolvedValue([]);

      const result = await service.cancelPageAudioCombinationJob('page-1');

      expect(mockQueue.getWaiting).toHaveBeenCalled();
      expect(mockQueue.getActive).toHaveBeenCalled();
      expect(result).toEqual({ cancelledJobs: 0 });
    });

    it('should handle multiple jobs and cancel only matching pageId', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          name: 'combine-page-audio',
          data: { pageId: 'page-1', bookId: 'book-1' },
          remove: jest.fn().mockResolvedValue(undefined),
        },
        {
          id: 'job-2',
          name: 'combine-page-audio',
          data: { pageId: 'page-2', bookId: 'book-1' },
          remove: jest.fn().mockResolvedValue(undefined),
        },
      ];

      mockQueue.getWaiting.mockResolvedValue([mockJobs[0]]);
      mockQueue.getActive.mockResolvedValue([mockJobs[1]]);

      const result = await service.cancelPageAudioCombinationJob('page-1');

      expect(mockQueue.getWaiting).toHaveBeenCalled();
      expect(mockQueue.getActive).toHaveBeenCalled();
      expect(mockJobs[0].remove).toHaveBeenCalled();
      expect(mockJobs[1].remove).not.toHaveBeenCalled();
      expect(result).toEqual({ cancelledJobs: 1 });
    });
  });
});
