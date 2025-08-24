import { Controller, Post, Get, Delete, Body, Param, Logger, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GetJobsByStatusResponseDto } from './dto/queue.dto';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(
    private queueService: QueueService,
    @InjectQueue('audio-processing') private audioQueue: Queue
  ) {}

  @Post('parse-epub')
  @ApiOperation({ summary: 'Parse EPUB file', description: 'Add EPUB parsing job to the queue' })
  @ApiResponse({ status: 200, description: 'EPUB parsing job added successfully' })
  @ApiBody({
    description: 'EPUB parsing job data',
    schema: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: 'Book ID' },
        s3Key: { type: 'string', description: 'S3 key for the EPUB file' }
      },
      required: ['bookId', 's3Key']
    }
  })
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

  @Post('add-diacritics')
  @ApiOperation({ summary: 'Add diacritics processing job', description: 'Add Hebrew diacritics processing job to the queue' })
  @ApiResponse({ status: 200, description: 'Diacritics processing job added successfully' })
  @ApiBody({
    description: 'Diacritics processing job data',
    schema: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: 'Book ID' },
        paragraphIds: { type: 'array', items: { type: 'string' }, description: 'Optional: specific paragraph IDs to process' }
      },
      required: ['bookId']
    }
  })
  async addDiacriticsProcessingJob(@Body() body: { bookId: string; paragraphIds?: string[] }) {
    try {
      this.logger.log(`🔤 [API] Adding diacritics processing job for book: ${body.bookId}`);
      
      const result = await this.queueService.addDiacriticsProcessingJob(body);
      
      this.logger.log(`🔤 [API] Successfully added diacritics processing job`);
      return {
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error adding diacritics processing job: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to add diacritics processing job',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get queue status', description: 'Get current status of the job queue' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved queue status' })
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
  @ApiOperation({ summary: 'Get jobs by status', description: 'Get jobs filtered by their status' })
  @ApiParam({ name: 'status', description: 'Job status (waiting, active, completed, failed, delayed)' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved jobs by status', type: GetJobsByStatusResponseDto })
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
  @ApiOperation({ summary: 'Get job by ID', description: 'Get detailed information about a specific job' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved job details' })
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
  @ApiOperation({ summary: 'Clean jobs by status', description: 'Clean/remove jobs with specified status from the queue' })
  @ApiParam({ name: 'status', description: 'Job status to clean (completed, failed)' })
  @ApiResponse({ status: 200, description: 'Successfully cleaned jobs' })
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
  @ApiOperation({ summary: 'Retry job', description: 'Retry a failed job by its ID' })
  @ApiParam({ name: 'id', description: 'Job ID to retry' })
  @ApiResponse({ status: 200, description: 'Successfully retried job' })
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
