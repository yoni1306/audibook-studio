import { Logger } from '@nestjs/common';
import { NatsJavaScriptWorker } from './nats-worker';
import { JobProcessor } from './job-processor';
import {
  EpubParsingResult,
  AudioGenerationResult,
  PageAudioCombinationResult,
} from './job-types';

// Mock NATS
const mockNatsConnection = {
  jetstream: jest.fn(),
  close: jest.fn(),
};

const mockJetStream = {
  consumers: {
    get: jest.fn(),
  },
};

const mockConsumer = {
  consume: jest.fn(),
};

const mockStringCodec = {
  encode: jest.fn((str: string) => Buffer.from(str)),
  decode: jest.fn((buffer: Buffer) => buffer.toString()),
};

jest.mock('nats', () => ({
  connect: jest.fn(() => Promise.resolve(mockNatsConnection)),
  StringCodec: jest.fn(() => mockStringCodec),
}));

// Mock JobProcessor class
jest.mock('./job-processor', () => ({
  JobProcessor: jest.fn().mockImplementation(() => ({
    processEpubParsing: jest.fn(),
    processAudioGeneration: jest.fn(),
    processPageAudioCombination: jest.fn(),
  })),
}));

describe('NatsJavaScriptWorker', () => {
  let worker: NatsJavaScriptWorker;
  let mockJobProcessor: jest.Mocked<JobProcessor>;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create worker instance
    worker = new NatsJavaScriptWorker();
    
    // Get the mocked job processor instance
    mockJobProcessor = (worker as any).jobProcessor;
  });

  describe('Job Data Structure Parsing', () => {
    it('should correctly extract bookId and s3Key from nested job data structure', async () => {
      // Arrange: Create the nested job data structure as sent by the API
      const nestedJobData = {
        jobId: 'test-job-123',
        jobName: 'parse-epub',
        data: {
          bookId: 'book-123',
          s3Key: 'books/test.epub',
          correlationId: 'corr-123'
        },
        correlationId: 'corr-123',
        timestamp: Date.now()
      };

      const mockMessage = {
        subject: 'jobs.js.parse-epub',
        data: mockStringCodec.encode(JSON.stringify(nestedJobData)),
        seq: 1,
        ack: jest.fn(),
        nak: jest.fn()
      };

      // Mock successful processing with proper return type
      const mockResult: EpubParsingResult = {
        processed: true,
        bookId: 'book-123',
        paragraphCount: 42,
        duration: 1500,
      };
      mockJobProcessor.processEpubParsing.mockResolvedValue(mockResult);

      // Act: Process the message using the private method (access via any)
      await (worker as any).processMessage(mockMessage);

      // Assert: Verify the job processor received the correct data
      expect(mockJobProcessor.processEpubParsing).toHaveBeenCalledWith({
        bookId: 'book-123',
        s3Key: 'books/test.epub',
        correlationId: 'corr-123'
      });

      expect(mockMessage.ack).toHaveBeenCalled();
    });

    it('should handle flat job data structure (backward compatibility)', async () => {
      // Arrange: Create flat job data structure
      const flatJobData = {
        bookId: 'book-456',
        s3Key: 'books/test2.epub',
        correlationId: 'corr-456'
      };

      const mockMessage = {
        subject: 'jobs.js.parse-epub',
        data: mockStringCodec.encode(JSON.stringify(flatJobData)),
        seq: 2,
        ack: jest.fn(),
        nak: jest.fn()
      };

      const mockResult: EpubParsingResult = {
        processed: true,
        bookId: 'test-book-123',
        paragraphCount: 42,
        duration: 1500,
      };
      mockJobProcessor.processEpubParsing.mockResolvedValue(mockResult);

      // Act
      await (worker as any).processMessage(mockMessage);

      // Assert
      expect(mockJobProcessor.processEpubParsing).toHaveBeenCalledWith({
        bookId: 'book-456',
        s3Key: 'books/test2.epub',
        correlationId: 'corr-456'
      });

      expect(mockMessage.ack).toHaveBeenCalled();
    });

    it('should fail gracefully when bookId is missing from job data', async () => {
      // Arrange: Create job data with missing bookId
      const invalidJobData = {
        jobId: 'test-job-789',
        jobName: 'parse-epub',
        data: {
          s3Key: 'books/test3.epub',
          correlationId: 'corr-789'
          // bookId is missing
        },
        correlationId: 'corr-789',
        timestamp: Date.now()
      };

      const mockMessage = {
        subject: 'jobs.js.parse-epub',
        data: mockStringCodec.encode(JSON.stringify(invalidJobData)),
        seq: 3,
        ack: jest.fn(),
        nak: jest.fn()
      };

      // Mock processEpubParsing to throw error for missing bookId
      mockJobProcessor.processEpubParsing.mockRejectedValue(
        new Error('No value provided for input HTTP label: Key.')
      );

      // Act
      await (worker as any).processMessage(mockMessage);

      // Assert: Should call nak() on error
      expect(mockMessage.nak).toHaveBeenCalled();
      expect(mockMessage.ack).not.toHaveBeenCalled();
    });

    it('should fail gracefully when s3Key is missing from job data', async () => {
      // Arrange: Create job data with missing s3Key
      const invalidJobData = {
        jobId: 'test-job-999',
        jobName: 'parse-epub',
        data: {
          bookId: 'book-999',
          correlationId: 'corr-999'
          // s3Key is missing
        },
        correlationId: 'corr-999',
        timestamp: Date.now()
      };

      const mockMessage = {
        subject: 'jobs.js.parse-epub',
        data: mockStringCodec.encode(JSON.stringify(invalidJobData)),
        seq: 4,
        ack: jest.fn(),
        nak: jest.fn()
      };

      mockJobProcessor.processEpubParsing.mockRejectedValue(
        new Error('No value provided for input HTTP label: Key.')
      );

      // Act
      await (worker as any).processMessage(mockMessage);

      // Assert
      expect(mockMessage.nak).toHaveBeenCalled();
      expect(mockMessage.ack).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON gracefully', async () => {
      // Arrange: Create malformed JSON
      const mockMessage = {
        subject: 'jobs.js.parse-epub',
        data: mockStringCodec.encode('{ invalid json }'),
        seq: 5,
        ack: jest.fn(),
        nak: jest.fn()
      };

      // Act
      await (worker as any).processMessage(mockMessage);

      // Assert: Should call nak() on JSON parse error
      expect(mockMessage.nak).toHaveBeenCalled();
      expect(mockMessage.ack).not.toHaveBeenCalled();
      expect(mockJobProcessor.processEpubParsing).not.toHaveBeenCalled();
    });
  });

  describe('Job Type Routing', () => {
    it('should route parse-epub jobs correctly', async () => {
      const jobData = {
        data: {
          bookId: 'book-123',
          s3Key: 'books/test.epub'
        }
      };

      const mockMessage = {
        subject: 'jobs.js.parse-epub',
        data: mockStringCodec.encode(JSON.stringify(jobData)),
        seq: 1,
        ack: jest.fn(),
        nak: jest.fn()
      };

      const mockResult: EpubParsingResult = {
        processed: true,
        bookId: 'test-book-123',
        paragraphCount: 42,
        duration: 1500,
      };
      mockJobProcessor.processEpubParsing.mockResolvedValue(mockResult);

      await (worker as any).processMessage(mockMessage);

      expect(mockJobProcessor.processEpubParsing).toHaveBeenCalled();
      expect(mockJobProcessor.processAudioGeneration).not.toHaveBeenCalled();
      expect(mockJobProcessor.processPageAudioCombination).not.toHaveBeenCalled();
    });

    it('should route generate-audio jobs correctly', async () => {
      const jobData = {
        data: {
          paragraphId: 'para-123',
          bookId: 'book-123',
          content: 'Test content'
        }
      };

      const mockMessage = {
        subject: 'jobs.js.generate-audio',
        data: mockStringCodec.encode(JSON.stringify(jobData)),
        seq: 1,
        ack: jest.fn(),
        nak: jest.fn()
      };

      const mockResult: AudioGenerationResult = {
        processed: true,
        paragraphId: 'test-paragraph-456',
        s3Key: 'audio/test-book-123/test-paragraph-456.mp3',
        duration: 30.5,
        processingTime: 2000,
      };
      mockJobProcessor.processAudioGeneration.mockResolvedValue(mockResult);

      await (worker as any).processMessage(mockMessage);

      expect(mockJobProcessor.processAudioGeneration).toHaveBeenCalled();
      expect(mockJobProcessor.processEpubParsing).not.toHaveBeenCalled();
      expect(mockJobProcessor.processPageAudioCombination).not.toHaveBeenCalled();
    });

    it('should handle unknown job types gracefully', async () => {
      const jobData = {
        data: {
          someData: 'test'
        }
      };

      const mockMessage = {
        subject: 'jobs.js.unknown-job-type',
        data: mockStringCodec.encode(JSON.stringify(jobData)),
        seq: 1,
        ack: jest.fn(),
        nak: jest.fn()
      };

      await (worker as any).processMessage(mockMessage);

      expect(mockMessage.nak).toHaveBeenCalled();
      expect(mockJobProcessor.processEpubParsing).not.toHaveBeenCalled();
      expect(mockJobProcessor.processAudioGeneration).not.toHaveBeenCalled();
      expect(mockJobProcessor.processPageAudioCombination).not.toHaveBeenCalled();
    });
  });

  describe('Automatic Diacritics Job Trigger Integration', () => {
    it('should verify that JobProcessor.processEpubParsing is called with correct parameters', async () => {
      // This test verifies the NATS worker correctly calls the JobProcessor
      // The actual diacritics trigger logic is tested in job-processor.spec.ts
      
      // Arrange: Create EPUB parsing job data
      const testBookId = 'test-book-' + Date.now();
      const correlationId = 'test-correlation-' + Date.now();
      
      const epubJobData = {
        jobId: 'job-' + Date.now(),
        jobName: 'parse-epub',
        data: {
          bookId: testBookId,
          s3Key: 'test/sample.epub',
          parsingMethod: 'xhtml-based',
          correlationId: correlationId
        },
        correlationId: correlationId,
        timestamp: Date.now()
      };

      const mockMessage = {
        subject: 'jobs.js.parse-epub',
        data: mockStringCodec.encode(JSON.stringify(epubJobData)),
        seq: 1,
        ack: jest.fn(),
        nak: jest.fn()
      };

      // Mock successful EPUB parsing result
      const mockResult: EpubParsingResult = {
        processed: true,
        bookId: testBookId,
        paragraphCount: 5,
        duration: 2000,
      };
      mockJobProcessor.processEpubParsing.mockResolvedValue(mockResult);

      // Act: Process the EPUB parsing message
      await (worker as any).processMessage(mockMessage);

      // Assert: Verify EPUB parsing was called with correct parameters
      expect(mockJobProcessor.processEpubParsing).toHaveBeenCalledWith({
        bookId: testBookId,
        s3Key: 'test/sample.epub',
        parsingMethod: 'xhtml-based',
        correlationId: correlationId
      });

      // Verify message was acknowledged
      expect(mockMessage.ack).toHaveBeenCalled();
      expect(mockMessage.nak).not.toHaveBeenCalled();
    });

  });
});
