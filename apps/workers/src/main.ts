import { Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import * as dotenv from 'dotenv';
import { parseEpub } from './epub-parser';

// Load environment variables
dotenv.config();

const logger = new Logger('Worker');

// Create worker
const worker = new Worker(
  'audio-processing',
  async (job: Job) => {
    logger.log(`Processing job ${job.id} of type ${job.name}`);
    logger.log(`Job data:`, job.data);

    switch (job.name) {
      case 'test-job':
        logger.log(`Test job message: ${job.data.message}`);
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { processed: true, message: job.data.message };

      case 'parse-epub':
        logger.log(
          `Parsing EPUB: ${job.data.s3Key} for book ${job.data.bookId}`
        );

        try {
          // TODO: Download from S3
          // For now, we'll use mock data
          const paragraphs = await parseEpub(job.data.s3Key);

          // Save to database
          const response = await fetch(
            `http://localhost:3333/api/books/${job.data.bookId}/paragraphs`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paragraphs }),
            }
          );

          if (!response.ok) {
            throw new Error(
              `Failed to save paragraphs: ${response.statusText}`
            );
          }

          // Update book status
          await fetch(
            `http://localhost:3333/api/books/${job.data.bookId}/status`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'READY' }),
            }
          );

          return {
            processed: true,
            bookId: job.data.bookId,
            paragraphCount: paragraphs.length,
          };
        } catch (error) {
          logger.error(`Failed to parse EPUB: ${error.message}`);

          // Update book status to ERROR
          await fetch(
            `http://localhost:3333/api/books/${job.data.bookId}/status`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'ERROR' }),
            }
          );

          throw error;
        }

      case 'generate-audio':
        logger.log(`Generating audio for paragraph ${job.data.paragraphId}`);
        // TODO: Implement actual TTS in Day 8-9
        await new Promise((resolve) => setTimeout(resolve, 1000));
        logger.log(
          `Audio generation placeholder for: "${job.data.content.substring(
            0,
            50
          )}..."`
        );
        return { processed: true, paragraphId: job.data.paragraphId };

      default:
        logger.warn(`Unknown job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    },
    concurrency: 1,
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  logger.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});

worker.on('active', (job) => {
  logger.log(`Job ${job.id} started`);
});

logger.log('🚀 Worker started and listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.log('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});
