import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue('audio-processing') private audioQueue: Queue) {}

  async addTestJob(data: { message: string }) {
    const job = await this.audioQueue.add('test-job', data);
    this.logger.log(`Added test job ${job.id} to queue`);
    return { jobId: job.id };
  }

  async addEpubParsingJob(data: { bookId: string; s3Key: string }) {
    const job = await this.audioQueue.add('parse-epub', data);
    this.logger.log(`Added EPUB parsing job ${job.id} for book ${data.bookId}`);
    return { jobId: job.id };
  }

  async addAudioGenerationJob(data: {
    paragraphId: string;
    bookId: string;
    content: string;
  }) {
    const job = await this.audioQueue.add('generate-audio', data);
    this.logger.log(
      `Added audio generation job ${job.id} for paragraph ${data.paragraphId}`
    );
    return { jobId: job.id };
  }
}
