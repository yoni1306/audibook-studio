import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment-specific .env file
const envFile =
  process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { Worker, Job } from 'bullmq';
import { createLogger } from '@audibook/logger';
import { downloadFromS3, uploadToS3 } from './s3-client';
import { PageBasedEPUBParser } from './text-processing/page-based-epub-parser';
import {
  updateBookStatus,
  getParagraph,
} from './database.service';
import { saveEPUBParseResult, } from './page-based-database.service';
import { BookStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import { getTTSService } from './tts-service';
import {
  withCorrelationId,
  generateCorrelationId,
} from '@audibook/correlation';

// Set service name for logging
process.env['SERVICE_NAME'] = 'audibook-worker';

const logger = createLogger('Worker');

// Create worker
const worker = new Worker(
  'audio-processing',
  async (job: Job) => {
    // Extract correlation ID from job data or generate new one
    const correlationId = job.data.correlationId || generateCorrelationId();

    // Run job processing with correlation context
    return withCorrelationId(correlationId, async () => {
      logger.info(`Processing job ${job.id} of type ${job.name}`, {
        jobId: job.id,
        jobType: job.name,
        jobData: job.data,
      });

      const startTime = Date.now();

      logger.info('Job started', {
        jobId: job.id,
        jobType: job.name,
        attemptNumber: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts || 1,
      });

      try {
        switch (job.name) {
          case 'test-job':
            logger.info('Processing test job', {
              message: job.data.message,
            });
            await new Promise((resolve) => setTimeout(resolve, 2000));
            logger.info('Test job completed', {
              duration: Date.now() - startTime,
            });
            return { processed: true, message: job.data.message };

          case 'parse-epub':
            logger.info('Starting page-based EPUB parsing', {
              bookId: job.data.bookId,
              s3Key: job.data.s3Key,
            });

            try {
              // Download EPUB from S3
              logger.debug('Downloading EPUB from S3', {
                s3Key: job.data.s3Key,
              });
              const downloadStart = Date.now();
              const localPath = await downloadFromS3(job.data.s3Key);
              logger.info('EPUB downloaded successfully', {
                downloadDuration: Date.now() - downloadStart,
                localPath,
              });

              // Update status to PROCESSING
              await updateBookStatus(job.data.bookId, BookStatus.PROCESSING);
              logger.debug('Book status updated to PROCESSING');

              // Parse the EPUB using page-based approach
              logger.info('Starting page-based EPUB parsing', {
                localPath,
              });
              const parseStart = Date.now();
              const parser = new PageBasedEPUBParser({
                pageBreakDetection: {
                  targetPageSizeChars: 2000,
                  minPageSizeChars: 500,
                  maxPageSizeChars: 5000,
                  includeExplicit: true,
                  includeStructural: true,
                  includeStylistic: true,
                  includeSemantic: true,
                  includeComputed: false,
                  minConfidence: 0.6,
                },
                paragraphMinLengthChars: 50,
                paragraphTargetLengthChars: 3000,
                paragraphTargetLengthWords: 600,
                paragraphMaxLengthChars: 5000,
              });
              
              const result = await parser.parseEpub(localPath);
              logger.info('Page-based EPUB parsing completed', {
                parseDuration: Date.now() - parseStart,
                totalPages: result.pages.length,
                totalParagraphs: result.metadata.totalParagraphs,
                averageParagraphsPerPage: result.metadata.averageParagraphsPerPage,
              });

              if (result.pages.length === 0) {
                throw new Error('No pages extracted from EPUB');
              }

              // Save pages and paragraphs to database
              logger.info('Saving pages to database', {
                pageCount: result.pages.length,
                paragraphCount: result.metadata.totalParagraphs,
              });
              const saveStart = Date.now();
              await saveEPUBParseResult(job.data.bookId, result.pages, result.metadata);
              logger.info('Pages saved successfully', {
                saveDuration: Date.now() - saveStart,
              });

              // Update book status to READY
              await updateBookStatus(job.data.bookId, BookStatus.READY);
              logger.info('Book processing completed', {
                bookId: job.data.bookId,
                totalDuration: Date.now() - startTime,
                paragraphCount: result.metadata.totalParagraphs,
              });

              // Clean up temp file
              await fs.unlink(localPath).catch((error) => {
                logger.warn('Failed to clean up temp file', {
                  path: localPath,
                  error: error.message,
                });
              });

              return {
                processed: true,
                bookId: job.data.bookId,
                paragraphCount: result.metadata.totalParagraphs,
                duration: Date.now() - startTime,
              };
            } catch (error) {
              logger.error('EPUB parsing failed', {
                bookId: job.data.bookId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime,
              });

              // Update book status to ERROR
              await updateBookStatus(job.data.bookId, BookStatus.ERROR);

              throw error;
            }

          case 'generate-audio':
            logger.info('Starting audio generation', {
              paragraphId: job.data.paragraphId,
              bookId: job.data.bookId,
              contentLength: job.data.content?.length,
            });

            try {
              // Mark as GENERATING
              // Removed updateParagraphStatus and updateParagraphAudio imports
              // Assuming these functions are no longer needed
              // If needed, add them back in

              // Get paragraph details
              const paragraph = await getParagraph(job.data.paragraphId);
              if (!paragraph) {
                throw new Error('Paragraph not found');
              }

              logger.debug('Paragraph retrieved', {
                paragraphId: paragraph.id,
                contentLength: paragraph.content.length,
                orderIndex: paragraph.orderIndex,
              });

              // Generate audio
              const ttsService = getTTSService();
              const outputPath = `/tmp/audio-${job.data.paragraphId}.mp3`;

              logger.info('Calling TTS service', {
                outputPath,
                contentPreview: paragraph.content.substring(0, 50) + '...',
              });
              const ttsStart = Date.now();
              const result = await ttsService.generateAudio(
                paragraph.content,
                outputPath
              );
              logger.info('TTS generation completed', {
                ttsDuration: Date.now() - ttsStart,
                audioDuration: result.duration,
                filePath: result.filePath,
              });

              // Upload to S3
              const s3Key = `audio/${job.data.bookId}/${job.data.paragraphId}.mp3`;
              logger.debug('Uploading audio to S3', {
                s3Key,
                localPath: outputPath,
              });
              const uploadStart = Date.now();
              await uploadToS3(outputPath, s3Key);
              logger.info('Audio uploaded to S3', {
                uploadDuration: Date.now() - uploadStart,
                s3Key,
              });

              logger.info('Audio generation completed successfully', {
                paragraphId: job.data.paragraphId,
                totalDuration: Date.now() - startTime,
                audioDuration: result.duration,
                s3Key,
              });

              // Clean up temp file
              await fs.unlink(outputPath).catch((error) => {
                logger.warn('Failed to clean up temp audio file', {
                  path: outputPath,
                  error: error.message,
                });
              });

              return {
                processed: true,
                paragraphId: job.data.paragraphId,
                duration: result.duration,
                s3Key,
                processingTime: Date.now() - startTime,
              };
            } catch (error) {
              logger.error('Audio generation failed', {
                paragraphId: job.data.paragraphId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime,
              });

              throw error;
            }

          default:
            logger.warn('Unknown job type received', {
              jobType: job.name,
              jobId: job.id,
            });
            throw new Error(`Unknown job type: ${job.name}`);
        }
      } catch (error) {
        logger.error('Job processing failed', {
          jobId: job.id,
          jobType: job.name,
          error: error.message,
          stack: error.stack,
          duration: Date.now() - startTime,
          willRetry: job.attemptsMade < (job.opts.attempts || 1) - 1,
        });
        throw error;
      }
    });
  },
  {
    connection: {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'], 10) || 6379,
    },
    concurrency: parseInt(process.env['WORKER_CONCURRENCY'], 10) || 1,
  }
);

// Worker event handlers with structured logging
worker.on('completed', (job) => {
  withCorrelationId(job.data.correlationId || generateCorrelationId(), () => {
    logger.info('Job completed successfully', {
      jobId: job.id,
      jobType: job.name,
      returnValue: job.returnvalue,
    });
  });
});

worker.on('failed', (job, err) => {
  withCorrelationId(job?.data?.correlationId || generateCorrelationId(), () => {
    logger.error('Job failed', {
      jobId: job?.id,
      jobType: job?.name,
      error: err.message,
      stack: err.stack,
      attempts: job?.attemptsMade,
    });
  });
});

worker.on('active', (job) => {
  withCorrelationId(job.data.correlationId || generateCorrelationId(), () => {
    logger.info('Job became active', {
      jobId: job.id,
      jobType: job.name,
      previousAttempts: job.attemptsMade,
    });
  });
});

worker.on('stalled', (jobId) => {
  logger.warn('Job stalled', {
    jobId,
    message: 'Job stalled and will be retried',
  });
});

worker.on('error', (error) => {
  logger.error('Worker error', {
    error: error.message,
    stack: error.stack,
  });
});

logger.info('Worker started successfully', {
  service: 'audibook-worker',
  concurrency: worker.concurrency,
  redisHost: process.env['REDIS_HOST'] || 'localhost',
  redisPort: process.env['REDIS_PORT'] || 6379,
});

// Graceful shutdown with logging
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');
  await worker.close();
  logger.info('Worker closed successfully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown');
  await worker.close();
  logger.info('Worker closed successfully');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason,
    promise,
  });
  process.exit(1);
});
