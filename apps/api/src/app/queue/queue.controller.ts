import { Controller, Post, Get, Delete, Body, Param, Logger, InternalServerErrorException } from '@nestjs/common';
import { QueueService } from './queue.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(
    private queueService: QueueService,
    @InjectQueue('audio-processing') private audioQueue: Queue
  ) {}

  @Post('parse-epub')
  async addEpubParsingJob(@Body() body: { bookId: string; s3Key: string }) {
    try {
      this.logger.log(`🔄 [API] Adding EPUB parsing job for book: ${body.bookId}`);
      
      const result = await this.queueService.addEpubParsingJob(body);
      
      this.logger.log(`🔄 [API] Successfully added EPUB parsing job`);
      return {
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error adding EPUB parsing job: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to add EPUB parsing job',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('status')
  async getQueueStatus() {
    try {
      this.logger.log('📊 [API] Getting queue status');
      
      const waiting = await this.audioQueue.getWaitingCount();
      const active = await this.audioQueue.getActiveCount();
      const completed = await this.audioQueue.getCompletedCount();
      const failed = await this.audioQueue.getFailedCount();
      const delayed = await this.audioQueue.getDelayedCount();

      const status = {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
        timestamp: new Date().toISOString(),
      };
      
      this.logger.log(`📊 [API] Queue status retrieved - Total: ${status.total} jobs`);
      return status;
    } catch (error) {
      this.logger.error(`💥 [API] Error getting queue status: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get queue status',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('jobs/:status')
  async getJobsByStatus(@Param('status') status: string) {
    try {
      this.logger.log(`📋 [API] Getting jobs by status: ${status}`);
      
      let jobs = [];

      switch (status) {
        case 'waiting':
          jobs = await this.audioQueue.getWaiting(0, 100);
          break;
        case 'active':
          jobs = await this.audioQueue.getActive(0, 100);
          break;
        case 'completed':
          jobs = await this.audioQueue.getCompleted(0, 100);
          break;
        case 'failed':
          jobs = await this.audioQueue.getFailed(0, 100);
          break;
        case 'delayed':
          jobs = await this.audioQueue.getDelayed(0, 100);
          break;
        default:
          this.logger.warn(`📋 [API] Invalid status requested: ${status}`);
          return {
            error: 'Invalid status. Use: waiting, active, completed, failed, or delayed',
            timestamp: new Date().toISOString(),
          };
      }

      const jobsData = jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        returnvalue: job.returnvalue,
      }));

      this.logger.log(`📋 [API] Found ${jobsData.length} jobs with status: ${status}`);
      
      return {
        jobs: jobsData,
        status,
        total: jobsData.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting jobs by status: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: `Failed to get jobs by status: ${status}`,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('job/:id')
  async getJob(@Param('id') id: string) {
    try {
      this.logger.log(`🔍 [API] Getting job details for ID: ${id}`);
      
      const job = await this.audioQueue.getJob(id);
      if (!job) {
        this.logger.warn(`🔍 [API] Job not found: ${id}`);
        return { 
          job: null,
          found: false,
          timestamp: new Date().toISOString(),
        };
      }

      const state = await job.getState();

      const jobData = {
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        returnvalue: job.returnvalue,
        opts: job.opts,
      };

      this.logger.log(`🔍 [API] Job details retrieved for ID: ${id}`);
      
      return {
        job: jobData,
        found: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting job: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: `Failed to get job: ${id}`,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Delete('clean/:status')
  async cleanJobs(@Param('status') status: string) {
    try {
      this.logger.log(`🧹 [API] Cleaning jobs with status: ${status}`);
      
      const grace = 0; // Clean immediately
      const limit = 1000; // Clean up to 1000 jobs

      switch (status) {
        case 'completed':
          await this.audioQueue.clean(grace, limit, 'completed');
          break;
        case 'failed':
          await this.audioQueue.clean(grace, limit, 'failed');
          break;
        default:
          this.logger.warn(`🧹 [API] Invalid clean status: ${status}`);
          return { 
            error: 'Can only clean completed or failed jobs',
            timestamp: new Date().toISOString(),
          };
      }

      this.logger.log(`🧹 [API] Successfully cleaned ${status} jobs`);
      
      return { 
        message: `Cleaned ${status} jobs`,
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error cleaning jobs: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: `Failed to clean ${status} jobs`,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Post('retry/:id')
  async retryJob(@Param('id') id: string) {
    try {
      this.logger.log(`🔄 [API] Retrying job: ${id}`);
      
      const job = await this.audioQueue.getJob(id);
      if (!job) {
        this.logger.warn(`🔄 [API] Job not found for retry: ${id}`);
        return { 
          job: null,
          found: false,
          message: 'Job not found',
          timestamp: new Date().toISOString(),
        };
      }

      const state = await job.getState();
      if (state !== 'failed') {
        this.logger.warn(`🔄 [API] Cannot retry job in state: ${state}`);
        return { 
          error: 'Can only retry failed jobs',
          currentState: state,
          timestamp: new Date().toISOString(),
        };
      }

      await job.retry();
      
      this.logger.log(`🔄 [API] Successfully retried job: ${id}`);
      
      return { 
        message: `Job ${id} added back to queue`,
        jobId: id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error retrying job: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: `Failed to retry job: ${id}`,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
