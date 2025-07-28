import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getCurrentCorrelationId } from '@audibook/correlation';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('audio') private audioQueue: Queue,
    @InjectQueue('epub') private epubQueue: Queue
  ) {}

  async addEpubParsingJob(data: { bookId: string; s3Key: string; parsingMethod?: 'page-based' | 'xhtml-based' }) {
    const correlationId = getCurrentCorrelationId();
    const job = await this.epubQueue.add('parse-epub', {
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
}
