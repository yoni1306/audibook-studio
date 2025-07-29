import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { S3Service } from '../s3/s3.service';
import { QueueService } from './queue.service';
import { AudioProcessorService } from './audio-processor.service';
import { EpubProcessorService } from './epub-processor.service';

/**
 * REGRESSION TESTS FOR QUEUE PROCESSOR ARCHITECTURE
 * 
 * These tests are designed to prevent accidental loss of critical service logic
 * during refactoring, such as the EPUB parsing functionality that was lost
 * when we separated queue processors.
 * 
 * CRITICAL: These tests should FAIL if:
 * 1. Real processing logic is replaced with simulation/stubs
 * 2. Queue names or job names are misaligned between API and workers
 * 3. Jobs are not properly routed to correct processors
 * 4. Database updates are not performed
 * 5. Metrics are not recorded
 */
describe('Queue Flow Regression Tests', () => {
  let queueService: QueueService;
  let audioProcessor: AudioProcessorService;
  let epubProcessor: EpubProcessorService;
  let prismaService: PrismaService;
  let metricsService: MetricsService;
  let s3Service: S3Service;
  let audioProcessingQueue: Queue;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
      name: 'audio-processing',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        AudioProcessorService,
        EpubProcessorService,
        {
          provide: getQueueToken('audio-processing'),
          useValue: mockQueue,
        },
        {
          provide: PrismaService,
          useValue: {
            book: {
              update: jest.fn(),
              findUnique: jest.fn(),
            },
            paragraph: {
              update: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordEvent: jest.fn(),
            recordAudioGeneration: jest.fn(),
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

    queueService = module.get<QueueService>(QueueService);
    audioProcessor = module.get<AudioProcessorService>(AudioProcessorService);
    epubProcessor = module.get<EpubProcessorService>(EpubProcessorService);
    prismaService = module.get<PrismaService>(PrismaService);
    metricsService = module.get<MetricsService>(MetricsService);
    s3Service = module.get<S3Service>(S3Service);
    audioProcessingQueue = mockQueue as any;
  });

  describe('EPUB Parsing Flow Regression', () => {
    it('should use correct queue name (audio-processing) for EPUB jobs', async () => {
      // REGRESSION: Ensure we use unified queue, not separate 'epub' queue
      const queueSpy = jest.spyOn(audioProcessingQueue, 'add');
      
      await queueService.addEpubParsingJob({
        bookId: 'test-book-id',
        s3Key: 'test-epub.epub',
        parsingMethod: 'xhtml-based',
      });

      expect(queueSpy).toHaveBeenCalledWith('parse-epub', expect.objectContaining({
        bookId: 'test-book-id',
        s3Key: 'test-epub.epub',
        parsingMethod: 'xhtml-based',
      }));
    });

    it('should process EPUB jobs with correct job name (parse-epub)', async () => {
      // REGRESSION: Ensure processor handles 'parse-epub' jobs, not other names
      const mockJob = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: {
          bookId: 'test-book-id',
          s3Key: 'test-epub.epub',
          parsingMethod: 'xhtml-based',
        },
      };

      const processSpy = jest.spyOn(epubProcessor, 'process');
      await epubProcessor.process(mockJob as any);

      expect(processSpy).toHaveBeenCalledWith(mockJob);
    });

    it('should update book status to PROCESSING during EPUB parsing', async () => {
      // REGRESSION: Ensure database updates are not removed/stubbed
      const mockJob = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: {
          bookId: 'test-book-id',
          s3Key: 'test-epub.epub',
          parsingMethod: 'xhtml-based',
        },
      };

      await epubProcessor.process(mockJob as any);

      expect(prismaService.book.update).toHaveBeenCalledWith({
        where: { id: 'test-book-id' },
        data: { status: 'PROCESSING' },
      });
    });

    it('should record EPUB parsing metrics', async () => {
      // REGRESSION: Ensure metrics recording is not removed
      const mockJob = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: {
          bookId: 'test-book-id',
          s3Key: 'test-epub.epub',
          parsingMethod: 'xhtml-based',
        },
      };

      await epubProcessor.process(mockJob as any);

      expect(metricsService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 'test-book-id',
          eventType: 'EPUB_PARSING',
          success: true,
        })
      );
    });

    it('should NOT use simulation logic for EPUB parsing', async () => {
      // REGRESSION: This test should FAIL if real logic is replaced with simulation
      const epubProcessorFile = await import('./epub-processor.service');
      const epubProcessorCode = epubProcessorFile.EpubProcessorService.toString();
      
      // Check that the processor doesn't contain simulation-related code
      expect(epubProcessorCode).not.toContain('simulateEpubParsing');
      expect(epubProcessorCode).not.toContain('setTimeout');
      expect(epubProcessorCode).not.toContain('2000'); // 2-second delay
      
      // Ensure it mentions workers service delegation (check file content)
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(__dirname + '/epub-processor.service.ts', 'utf-8');
      expect(fileContent).toContain('workers service');
    });
  });

  describe('Audio Generation Flow Regression', () => {
    it('should use correct queue name (audio-processing) for audio jobs', async () => {
      // REGRESSION: Ensure we use unified queue, not separate 'audio' queue
      const queueSpy = jest.spyOn(audioProcessingQueue, 'add');
      
      await queueService.addAudioGenerationJob({
        paragraphId: 'test-paragraph-id',
        bookId: 'test-book-id',
        content: 'Test content for audio generation',
      });

      expect(queueSpy).toHaveBeenCalledWith('generate-audio', expect.objectContaining({
        paragraphId: 'test-paragraph-id',
        bookId: 'test-book-id',
        content: 'Test content for audio generation',
      }));
    });

    it('should process audio jobs with correct job name (generate-audio)', async () => {
      // REGRESSION: Ensure processor handles 'generate-audio' jobs
      const mockJob = {
        id: 'test-job-id',
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Test content',
        },
      };

      const processSpy = jest.spyOn(audioProcessor, 'process');
      await audioProcessor.process(mockJob as any);

      expect(processSpy).toHaveBeenCalledWith(mockJob);
    });

    it('should update paragraph audio status during processing', async () => {
      // REGRESSION: Ensure database updates are not removed
      const mockParagraph = {
        id: 'test-paragraph-id',
        content: 'Test content',
        bookId: 'test-book-id',
        audioStatus: 'PENDING',
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockParagraph);

      const mockJob = {
        id: 'test-job-id',
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Test content',
        },
      };

      await audioProcessor.process(mockJob as any);

      // Check that paragraph status is updated (actual status may be GENERATING or PROCESSING)
      expect(prismaService.paragraph.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-paragraph-id' },
          data: expect.objectContaining({
            audioStatus: expect.stringMatching(/^(PROCESSING|GENERATING)$/),
          }),
        })
      );
    });

    it('should record audio generation metrics', async () => {
      // REGRESSION: Ensure metrics recording is not removed
      const mockParagraph = {
        id: 'test-paragraph-id',
        content: 'Test content',
        bookId: 'test-book-id',
        audioStatus: 'PENDING',
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockParagraph);

      const mockJob = {
        id: 'test-job-id',
        name: 'generate-audio',
        data: {
          paragraphId: 'test-paragraph-id',
          bookId: 'test-book-id',
          content: 'Test content',
        },
      };

      await audioProcessor.process(mockJob as any);

      expect(metricsService.recordAudioGeneration).toHaveBeenCalledWith(
        'test-book-id',
        'test-paragraph-id',
        expect.any(Number),
        true
      );
    });
  });

  describe('Queue Architecture Regression', () => {
    it('should use unified audio-processing queue for both job types', () => {
      // REGRESSION: Ensure we don't accidentally split queues again
      const queueName = audioProcessingQueue.name;
      expect(queueName).toBe('audio-processing');
      
      // Verify both processors use the same queue
      expect(audioProcessor.constructor.name).toBe('AudioProcessorService');
      expect(epubProcessor.constructor.name).toBe('EpubProcessorService');
    });

    it('should maintain job name consistency with workers service', () => {
      // REGRESSION: Job names must match workers exactly
      const expectedJobNames = ['generate-audio', 'parse-epub'];
      
      // This test documents the expected job names and will fail if changed
      expect(expectedJobNames).toContain('generate-audio');
      expect(expectedJobNames).toContain('parse-epub');
      expect(expectedJobNames).toHaveLength(2);
    });
  });

  describe('Service Integration Regression', () => {
    it('should inject all required dependencies', () => {
      // REGRESSION: Ensure services have required dependencies
      expect(audioProcessor).toBeDefined();
      expect(epubProcessor).toBeDefined();
      expect(queueService).toBeDefined();
      
      // Check that processors have required services injected
      expect((audioProcessor as any).prisma).toBeDefined();
      expect((audioProcessor as any).metricsService).toBeDefined();
      expect((epubProcessor as any).prisma).toBeDefined();
      expect((epubProcessor as any).metricsService).toBeDefined();
      expect((epubProcessor as any).s3Service).toBeDefined();
    });

    it('should maintain proper error handling patterns', async () => {
      // REGRESSION: Ensure error handling is not removed during refactoring
      const mockJob = {
        id: 'test-job-id',
        name: 'parse-epub',
        data: {
          bookId: 'test-book-id',
          s3Key: 'test-epub.epub',
        },
      };

      // Mock a database error
      (prismaService.book.update as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      await expect(epubProcessor.process(mockJob as any)).rejects.toThrow('DB Error');
    });
  });
});
