import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { QueueService } from './queue.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('queue')
export class QueueController {
  constructor(
    private queueService: QueueService,
    @InjectQueue('audio-processing') private audioQueue: Queue
  ) {}

  @Post('parse-epub')
  async addEpubParsingJob(@Body() body: { bookId: string; s3Key: string }) {
    return this.queueService.addEpubParsingJob(body);
  }

  @Get('status')
  async getQueueStatus() {
    const waiting = await this.audioQueue.getWaitingCount();
    const active = await this.audioQueue.getActiveCount();
    const completed = await this.audioQueue.getCompletedCount();
    const failed = await this.audioQueue.getFailedCount();
    const delayed = await this.audioQueue.getDelayedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  @Get('jobs/:status')
  async getJobsByStatus(@Param('status') status: string) {
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
        return {
          error:
            'Invalid status. Use: waiting, active, completed, failed, or delayed',
        };
    }

    return jobs.map((job) => ({
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
  }

  @Get('job/:id')
  async getJob(@Param('id') id: string) {
    const job = await this.audioQueue.getJob(id);
    if (!job) {
      return { error: 'Job not found' };
    }

    const state = await job.getState();

    return {
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
  }

  @Delete('clean/:status')
  async cleanJobs(@Param('status') status: string) {
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
        return { error: 'Can only clean completed or failed jobs' };
    }

    return { message: `Cleaned ${status} jobs` };
  }

  @Post('retry/:id')
  async retryJob(@Param('id') id: string) {
    const job = await this.audioQueue.getJob(id);
    if (!job) {
      return { error: 'Job not found' };
    }

    const state = await job.getState();
    if (state !== 'failed') {
      return { error: 'Can only retry failed jobs' };
    }

    await job.retry();
    return { message: `Job ${id} added back to queue` };
  }
}
