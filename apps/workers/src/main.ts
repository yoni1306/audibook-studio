import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment-specific .env file
const envFile =
  process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { Worker, Job } from 'bullmq';
import { createLogger } from '@audibook/logger';
import { downloadFromS3, uploadToS3, deleteOldAudioFiles } from './s3-client';
import { PageBasedEPUBParser } from './text-processing/page-based-epub-parser';
import { XHTMLBasedEPUBParser } from './text-processing/xhtml-based-epub-parser';
import { DEFAULT_EPUB_PARSER_CONFIG } from './config/epub-parser-config';
import {
  updateBookStatus,
  updateBookMetadata,
  getParagraph,
  cleanupDatabase,
  checkDatabaseHealth,
} from './database.service';
import { 
  saveEPUBParseResult, 
  updateParagraphAudioStatus 
} from './page-based-database.service';
import { BookStatus, AudioStatus } from '@prisma/client';
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

          case 'parse-epub': {
            const parsingMethod = job.data.parsingMethod || 'xhtml-based';
            logger.info(`Starting ${parsingMethod} EPUB parsing`, {
              bookId: job.data.bookId,
              s3Key: job.data.s3Key,
              parsingMethod,
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

              // Parse the EPUB using selected method
              logger.info(`Starting ${parsingMethod} EPUB parsing`, {
                localPath,
              });
              const parseStart = Date.now();
              
              let result;
              if (parsingMethod === 'xhtml-based') {
                const xhtmlParser = new XHTMLBasedEPUBParser({
                  paragraphTargetLengthChars: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthChars,
                  paragraphTargetLengthWords: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthWords,
                  includeEmptyPages: false,
                });
                
                const xhtmlResult = await xhtmlParser.parseEpub(localPath);
                
                logger.info('XHTML parser results:', {
                  totalXHTMLFiles: xhtmlResult.metadata.xhtmlFiles?.length || 0,
                  totalPages: xhtmlResult.pages.length,
                  totalParagraphs: xhtmlResult.metadata.totalParagraphs,
                  averageParagraphsPerPage: xhtmlResult.metadata.averageParagraphsPerPage,
                });
                
                // Log individual page details for debugging
                logger.debug('XHTML pages breakdown:', {
                  pages: xhtmlResult.pages.map(p => ({
                    pageNumber: p.pageNumber,
                    fileName: p.fileName?.split('/').pop() || 'unknown',
                    paragraphCount: p.paragraphs.length
                  }))
                });
                
                // Convert XHTML result to page-based format for database compatibility
                result = {
                  pages: xhtmlResult.pages.map((xhtmlPage) => ({
                    pageNumber: xhtmlPage.pageNumber, // Use original page number from XHTML parser
                    sourceChapter: xhtmlPage.sourceChapter,
                    startPosition: xhtmlPage.startPosition,
                    endPosition: xhtmlPage.endPosition,
                    content: '', // Not used in page-based format
                    paragraphs: xhtmlPage.paragraphs.map(p => ({
                      orderIndex: p.orderIndex,
                      content: p.content,
                      audioStatus: 'PENDING' as const,
                    })),
                  })),
                  metadata: {
                    totalPages: xhtmlResult.metadata.totalPages,
                    totalParagraphs: xhtmlResult.metadata.totalParagraphs,
                    averageParagraphsPerPage: xhtmlResult.metadata.averageParagraphsPerPage,
                  },
                };
              } else {
                // Use page-based parser (default)
                const pageParser = new PageBasedEPUBParser({
                  pageBreakDetection: DEFAULT_EPUB_PARSER_CONFIG.pageBreakDetection,
                  paragraphTargetLengthChars: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthChars,
                  paragraphTargetLengthWords: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthWords,
                });
                
                result = await pageParser.parseEpub(localPath);
              }
              
              logger.info(`${parsingMethod} EPUB parsing completed`, {
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

              // Update book metadata with extracted EPUB information
              if (result.bookMetadata) {
                logger.info('Updating book metadata with extracted EPUB information', {
                  bookId: job.data.bookId,
                  hasTitle: !!result.bookMetadata.title,
                  hasAuthor: !!result.bookMetadata.author,
                  hasLanguage: !!result.bookMetadata.language
                });
                
                const metadataStart = Date.now();
                await updateBookMetadata(job.data.bookId, result.bookMetadata);
                logger.info('Book metadata updated successfully', {
                  metadataDuration: Date.now() - metadataStart,
                });
              } else {
                logger.warn('No book metadata extracted from EPUB - skipping metadata update');
              }

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
          }

          case 'generate-audio':
            logger.info('Starting audio generation', {
              paragraphId: job.data.paragraphId,
              bookId: job.data.bookId,
              contentLength: job.data.content?.length,
            });

            try {
              // Mark as GENERATING
              await updateParagraphAudioStatus(
                job.data.paragraphId,
                AudioStatus.GENERATING
              );

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

              // Clean up old audio files before uploading new one
              await deleteOldAudioFiles(job.data.bookId, job.data.paragraphId);
              
              // Upload to S3 with timestamp to avoid browser caching issues
              const timestamp = Date.now();
              const s3Key = `audio/${job.data.bookId}/${job.data.paragraphId}_${timestamp}.mp3`;
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

              // Update database with audio information
              logger.debug('Updating paragraph audio status in database', {
                paragraphId: job.data.paragraphId,
                s3Key,
                duration: result.duration,
              });
              await updateParagraphAudioStatus(
                job.data.paragraphId,
                AudioStatus.READY,
                s3Key,
                result.duration
              );
              logger.info('Database updated with audio information', {
                paragraphId: job.data.paragraphId,
                audioStatus: AudioStatus.READY,
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

              // Mark as ERROR
              await updateParagraphAudioStatus(
                job.data.paragraphId,
                AudioStatus.ERROR
              );

              throw error;
            }

          case 'combine-page-audio':
            logger.info('Starting page audio combination', {
              pageId: job.data.pageId,
              bookId: job.data.bookId,
            });

            try {
              // Get page and its completed paragraphs with audio
              const { prisma } = require('./database.service.js');
              
              const page = await prisma.page.findUnique({
                where: { id: job.data.pageId },
                include: {
                  paragraphs: {
                    where: {
                      completed: true,
                      audioStatus: 'READY',
                      audioS3Key: { not: null },
                    },
                    orderBy: { orderIndex: 'asc' },
                    select: {
                      id: true,
                      orderIndex: true,
                      audioS3Key: true,
                      audioDuration: true,
                    },
                  },
                },
              });
              
              if (!page) {
                throw new Error(`Page not found: ${job.data.pageId}`);
              }
              
              if (page.paragraphs.length === 0) {
                throw new Error(`No completed paragraphs with audio found for page ${page.pageNumber}`);
              }
              
              logger.info(`Found ${page.paragraphs.length} completed paragraphs with audio for page ${page.pageNumber}`);
              
              // Download all paragraph audio files
              const audioFiles: { localPath: string; duration: number }[] = [];
              let totalDuration = 0;
              
              for (const paragraph of page.paragraphs) {
                if (!paragraph.audioS3Key) continue;
                
                logger.debug(`Downloading audio for paragraph ${paragraph.id}`);
                const localPath = await downloadFromS3(paragraph.audioS3Key);
                const duration = paragraph.audioDuration || 0;
                
                audioFiles.push({ localPath, duration });
                totalDuration += duration;
              }
              
              if (audioFiles.length === 0) {
                throw new Error('No audio files downloaded');
              }
              
              // Combine audio files using ffmpeg
              const ffmpeg = require('fluent-ffmpeg');
              const path = require('path');
              const fs = require('fs/promises');
              const os = require('os');
              
              const outputPath = path.join(os.tmpdir(), `page-${page.pageNumber}-${Date.now()}.mp3`);
              
              logger.info(`Combining ${audioFiles.length} audio files into: ${outputPath}`);
              
              await new Promise((resolve, reject) => {
                let command = ffmpeg();
                
                // Add all input files
                audioFiles.forEach(file => {
                  command = command.input(file.localPath);
                });
                
                // Set output options
                command
                  .audioCodec('libmp3lame') // Use libmp3lame for better FFmpeg compatibility
                  .audioBitrate('128k')
                  .audioFrequency(22050)
                  .audioChannels(1)
                  .on('start', (commandLine) => {
                    logger.debug('FFmpeg command:', commandLine);
                  })
                  .on('progress', (progress) => {
                    logger.debug(`Processing: ${progress.percent}% done`);
                  })
                  .on('end', () => {
                    logger.info('Audio combination completed successfully');
                    resolve(outputPath);
                  })
                  .on('error', (err) => {
                    logger.error('FFmpeg error:', err.message);
                    reject(err);
                  })
                  .mergeToFile(outputPath);
              });
              
              // Upload combined audio to S3
              const s3Key = `books/${job.data.bookId}/pages/page-${page.pageNumber}-${Date.now()}.mp3`;
              logger.info(`Uploading combined audio to S3: ${s3Key}`);
              
              await uploadToS3(outputPath, s3Key);
              
              // Update page with combined audio info
              await prisma.page.update({
                where: { id: job.data.pageId },
                data: {
                  audioS3Key: s3Key,
                  audioStatus: 'READY',
                  audioDuration: totalDuration,
                },
              });
              
              // Clean up temporary files
              try {
                await fs.unlink(outputPath);
                for (const file of audioFiles) {
                  await fs.unlink(file.localPath).catch((err) => {
                    logger.debug('Failed to delete temp file:', err.message);
                  });
                }
              } catch (cleanupError) {
                logger.warn('Failed to clean up temporary files:', cleanupError.message);
              }
              
              logger.info('Page audio combination completed', {
                pageId: job.data.pageId,
                pageNumber: page.pageNumber,
                bookId: job.data.bookId,
                s3Key,
                totalDuration,
                paragraphCount: page.paragraphs.length,
                duration: Date.now() - startTime,
              });
              
              return {
                processed: true,
                pageId: job.data.pageId,
                pageNumber: page.pageNumber,
                bookId: job.data.bookId,
                s3Key,
                totalDuration,
                paragraphCount: page.paragraphs.length,
                duration: Date.now() - startTime,
              };
            } catch (error) {
              logger.error('Page audio combination failed', {
                pageId: job.data.pageId,
                bookId: job.data.bookId,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime,
              });
              
              // Update page status to ERROR
              try {
                const { prisma } = require('./database.service.js');
                await prisma.page.update({
                  where: { id: job.data.pageId },
                  data: { audioStatus: 'ERROR' },
                });
              } catch (dbError) {
                logger.error('Failed to update page status to ERROR:', dbError.message);
              }
              
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
    connection: process.env['REDIS_URL'] ? {
      // Parse Redis URL to extract connection details
      host: new URL(process.env['REDIS_URL']).hostname,
      port: parseInt(new URL(process.env['REDIS_URL']).port) || 6379,
      password: new URL(process.env['REDIS_URL']).password || undefined,
      family: 0, // Enable dual-stack lookup for Railway IPv6 support
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null, // BullMQ requirement
      lazyConnect: true,
      connectTimeout: 60000,
      commandTimeout: 30000, // Increased timeout for long-running operations
      disconnectTimeout: 5000, // Add disconnect timeout
    } : {
      // Fallback for local development
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'], 10) || 6379,
      family: 0, // Enable dual-stack lookup for Railway IPv6 support
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null, // BullMQ requirement
      lazyConnect: true,
      connectTimeout: 60000,
      commandTimeout: 30000, // Increased timeout for long-running operations
      disconnectTimeout: 5000, // Add disconnect timeout
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

// Add Redis connection monitoring
const redis = worker.opts.connection;
if (redis && typeof redis === 'object' && 'on' in redis) {
  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });
  
  redis.on('ready', () => {
    logger.info('Redis connection ready');
  });
  
  redis.on('error', (error) => {
    logger.error('Redis connection error', {
      error: error.message,
      stack: error.stack
    });
  });
  
  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });
  
  redis.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });
}

// Add periodic health check
const healthCheckInterval = setInterval(async () => {
  try {
    // Check if worker is still processing jobs
    const isActive = worker.isRunning();
    const memoryUsage = process.memoryUsage();
    
    // Check database connection health
    const dbHealthy = await checkDatabaseHealth();
    
    logger.debug('Worker health check', {
      isActive,
      dbHealthy,
      memoryUsage: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      uptime: Math.round(process.uptime()) + 's'
    });
    
    // Log warning if database is unhealthy
    if (!dbHealthy) {
      logger.warn('Database connection is unhealthy - worker may stop processing jobs');
    }
    
    // Force garbage collection if memory usage is high
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection due to high memory usage');
      }
    }
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message
    });
  }
}, 30000); // Check every 30 seconds

// Graceful shutdown with timeout handling
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`${signal} received again, forcing exit`);
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown`);
  
  try {
    // Set a timeout for the shutdown process
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 15000); // 15 second timeout
    
    // Clear health check interval
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      logger.debug('Health check interval cleared');
    }
    
    // Close the worker and cleanup database connections
    await Promise.race([
      Promise.all([
        worker.close(),
        cleanupDatabase()
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Worker close timeout')), 10000)
      )
    ]);
    
    clearTimeout(shutdownTimeout);
    logger.info('Worker closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
