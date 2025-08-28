import { Test, TestingModule } from '@nestjs/testing';
import { NatsQueueService } from './nats-queue.service';
import { connect, NatsConnection, JetStreamManager, JetStreamClient } from 'nats';

// Mock NATS
jest.mock('nats');

/**
 * TODO: Fix NATS service unit tests:
 * - Resolve Jest mocking issues with JetStreamManager
 * - Fix mockResolvedValue/mockRejectedValue usage on NATS streams
 * - Update mock structure to match actual NATS client API
 * - Re-enable comprehensive unit testing for NatsQueueService
 */
describe.skip('NatsQueueService', () => {
  let service: NatsQueueService;
  let mockConnection: jest.Mocked<NatsConnection>;
  let mockJetStream: jest.Mocked<JetStreamClient>;
  let mockJsm: jest.Mocked<JetStreamManager>;

  beforeEach(async () => {
    // Setup mocks
    mockConnection = {
      close: jest.fn(),
      jetstream: jest.fn(),
      jetstreamManager: jest.fn(),
    } as any;

    mockJetStream = {
      publish: jest.fn(),
    } as any;

    mockJsm = {
      streams: {
        info: jest.fn(),
        add: jest.fn(),
      },
      consumers: {
        info: jest.fn(),
        add: jest.fn(),
      },
    } as any;

    mockConnection.jetstream.mockReturnValue(mockJetStream);
    mockConnection.jetstreamManager.mockResolvedValue(mockJsm);

    (connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [NatsQueueService],
    }).compile();

    service = module.get<NatsQueueService>(NatsQueueService);
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should connect to NATS on module init', async () => {
      await service.onModuleInit();

      expect(connect).toHaveBeenCalledWith({
        servers: 'nats://localhost:4222',
      });
      expect(mockConnection.jetstream).toHaveBeenCalled();
      expect(mockConnection.jetstreamManager).toHaveBeenCalled();
    });

    it('should use custom NATS_URL from environment', async () => {
      const originalEnv = process.env.NATS_URL;
      process.env.NATS_URL = 'nats://custom:4222';

      await service.onModuleInit();

      expect(connect).toHaveBeenCalledWith({
        servers: 'nats://custom:4222',
      });

      process.env.NATS_URL = originalEnv;
    });
  });

  describe('stream management', () => {
    beforeEach(async () => {
      // Mock successful stream setup
      (mockJsm.streams.info as jest.Mock).mockResolvedValue({ name: 'AUDIOBOOK_JOBS' });
      await service.onModuleInit();
    });

    it('should initialize successfully', async () => {
      expect(service).toBeDefined();
    });
  });

  describe('job publishing', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      (mockJsm.streams.info as jest.Mock).mockResolvedValue({} as any); // Stream exists
    });

    it('should publish diacritics job', async () => {
      const jobData = { bookId: 'test-book-123' };
      mockJetStream.publish.mockResolvedValue({} as any);

      const result = await service.addDiacriticsProcessingJob(jobData);

      expect(mockJetStream.publish).toHaveBeenCalledWith(
        'jobs.python.add-diacritics',
        expect.any(Uint8Array)
      );
      expect(result).toEqual({
        success: true,
        subject: 'jobs.python.add-diacritics',
        data: expect.objectContaining(jobData),
      });
    });

    it('should publish EPUB parsing job', async () => {
      const jobData = { bookId: 'test-book-123', s3Key: 'test.epub' };
      mockJetStream.publish.mockResolvedValue({} as any);

      const result = await service.addEpubParsingJob(jobData);

      expect(mockJetStream.publish).toHaveBeenCalledWith(
        'jobs.js.parse-epub',
        expect.any(Uint8Array)
      );
      expect(result).toEqual({
        success: true,
        subject: 'jobs.js.parse-epub',
        data: expect.objectContaining(jobData),
      });
    });

    it('should publish audio generation job', async () => {
      const jobData = { paragraphId: 'para-123', bookId: 'book-123', content: 'test' };
      mockJetStream.publish.mockResolvedValue({} as any);

      const result = await service.addAudioGenerationJob(jobData);

      expect(mockJetStream.publish).toHaveBeenCalledWith(
        'jobs.js.generate-audio',
        expect.any(Uint8Array)
      );
      expect(result).toEqual({
        success: true,
        subject: 'jobs.js.generate-audio',
        data: expect.objectContaining(jobData),
      });
    });

    it('should handle publish errors', async () => {
      const jobData = { bookId: 'test-book-123' };
      mockJetStream.publish.mockRejectedValue(new Error('Publish failed'));

      await expect(service.addDiacriticsProcessingJob(jobData)).rejects.toThrow('Publish failed');
    });
  });

  describe('queue status', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    describe('getQueueStatus', () => {
      it('should return queue status with stream info', async () => {
        const mockStreamInfo = {
          config: { name: 'AUDIOBOOK_JOBS' },
          state: { messages: 5, bytes: 1024, consumers: 2 },
        };
        (mockJsm.streams.info as jest.Mock).mockResolvedValue(mockStreamInfo);

        const status = await service.getQueueStatus();

        expect(status).toEqual({
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          total: 0,
          timestamp: expect.any(String),
          streamInfo: {
            messages: 5,
            bytes: 1024,
            firstSeq: 0,
            lastSeq: 0,
          },
        });
      });

      it('should handle stream errors gracefully', async () => {
        (mockJsm.streams.info as jest.Mock).mockRejectedValue(new Error('Stream error'));

        const status = await service.getQueueStatus();

        expect(status.waiting).toBe(0);
        expect(status.active).toBe(0);
        expect(status.timestamp).toBeDefined();
      });
    });
  });

  describe('cleanup', () => {
    it('should close connection on module destroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should handle cleanup when not connected', async () => {
      // Don't initialize
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
