import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getCurrentCorrelationId } from '@audibook/correlation';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue('audio-processing') private audioQueue: Queue) {}

  async addEpubParsingJob(data: { bookId: string; s3Key: string; parsingMethod?: 'page-based' | 'xhtml-based' }) {
    const correlationId = getCurrentCorrelationId();
    const job = await this.audioQueue.add('parse-epub', {
      ...data,
      correlationId,
    });
    this.logger.log(
      `Added EPUB parsing job ${job.id} for book ${data.bookId}`,
      {
        jobId: job.id,
        correlationId,
      }
    );
    return { jobId: job.id };
  }

  async addAudioGenerationJob(data: {
    paragraphId: string;
    bookId: string;
    content: string;
  }) {
    const correlationId = getCurrentCorrelationId();
    const job = await this.audioQueue.add('generate-audio', {
      ...data,
      correlationId,
    });
    this.logger.log(
      `Added audio generation job ${job.id} for paragraph ${data.paragraphId}`,
      {
        jobId: job.id,
        correlationId,
      }
    );
    return { jobId: job.id };
  }

  async addPageAudioCombinationJob(data: {
    pageId: string;
    bookId: string;
  }) {
    const correlationId = getCurrentCorrelationId();
    const job = await this.audioQueue.add('combine-page-audio', {
      ...data,
      correlationId,
    });
    this.logger.log(
      `Added page audio combination job ${job.id} for page ${data.pageId}`,
      {
        jobId: job.id,
        correlationId,
      }
    );
    return { jobId: job.id };
  }

  async cancelPageAudioCombinationJob(pageId: string) {
    const correlationId = getCurrentCorrelationId();
    
    // Find jobs for this page that are waiting or active
    const waitingJobs = await this.audioQueue.getWaiting();
    const activeJobs = await this.audioQueue.getActive();
    
    const allJobs = [...waitingJobs, ...activeJobs];
    const pageJobs = allJobs.filter(job => 
      job.name === 'combine-page-audio' && job.data.pageId === pageId
    );
    
    let cancelledCount = 0;
    
    for (const job of pageJobs) {
      try {
        await job.remove();
        cancelledCount++;
        this.logger.log(
          `Cancelled page audio combination job ${job.id} for page ${pageId}`,
          {
            jobId: job.id,
            correlationId,
          }
        );
      } catch (error) {
        this.logger.warn(
          `Failed to cancel job ${job.id} for page ${pageId}: ${error.message}`,
          {
            jobId: job.id,
            error: error.message,
            correlationId,
          }
        );
      }
    }
    
    return { cancelledJobs: cancelledCount };
  }
}
