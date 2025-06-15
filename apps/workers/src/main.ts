import { Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import * as dotenv from 'dotenv';

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
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { processed: true, message: job.data.message };

      case 'parse-epub':
        logger.log(`Parsing EPUB: ${job.data.s3Key} for book ${job.data.bookId}`);
        // TODO: Implement EPUB parsing in Day 5
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { processed: true, bookId: job.data.bookId };

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