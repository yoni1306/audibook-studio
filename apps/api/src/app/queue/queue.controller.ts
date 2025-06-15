import { Controller, Post, Get, Body } from '@nestjs/common';
import { QueueService } from './queue.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('queue')
export class QueueController {
  constructor(
    private queueService: QueueService,
    @InjectQueue('audio-processing') private audioQueue: Queue
  ) {}

  @Post('test')
  async addTestJob(@Body() body: { message: string }) {
    return this.queueService.addTestJob(body);
  }

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
    
    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  @Get('jobs')
  async getJobs() {
    const waiting = await this.audioQueue.getWaiting();
    const active = await this.audioQueue.getActive();
    const completed = await this.audioQueue.getCompleted();
    const failed = await this.audioQueue.getFailed();
    
    return {
      waiting: waiting.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        timestamp: job.timestamp,
      })),
      active: active.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        timestamp: job.timestamp,
      })),
      completed: completed.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        returnvalue: job.returnvalue,
        finishedOn: job.finishedOn,
      })),
      failed: failed.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        finishedOn: job.finishedOn,
      })),
    };
  }
}