import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

interface EpubParsingJobData {
  bookId: string;
  s3Key: string;
  parsingMethod?: 'page-based' | 'xhtml-based';
}

@Injectable()
@Processor('epub')
export class EpubProcessorService extends WorkerHost {
  private readonly logger = new Logger(EpubProcessorService.name);

  constructor(
    private prisma: PrismaService
  ) {
    super();
  }

  async process(job: Job<EpubParsingJobData>) {
    if (job.name !== 'parse-epub') {
      return;
    }
    
    return this.handleEpubParsing(job);
  }

  private async handleEpubParsing(job: Job<EpubParsingJobData>) {
    const { bookId, s3Key, parsingMethod } = job.data;
    const startTime = Date.now();
    
    this.logger.log(`📚 Starting EPUB parsing for book ${bookId} with method: ${parsingMethod || 'default'}`);

    try {
      // Update book status to PROCESSING
      await this.prisma.book.update({
        where: { id: bookId },
        data: { status: 'PROCESSING' }
      });

      // TODO: Implement actual EPUB parsing logic here
      // For now, we'll simulate EPUB parsing with a delay
      await this.simulateEpubParsing(s3Key);
      
      // Update book status to READY after successful parsing
      await this.prisma.book.update({
        where: { id: bookId },
        data: { status: 'READY' }
      });
      
      const duration = Date.now() - startTime;
      
      this.logger.log(`✅ EPUB parsing completed for book ${bookId} in ${duration}ms`);
      
      return { success: true, bookId, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`❌ EPUB parsing failed for book ${bookId}:`, error);
      
      // Update book status to ERROR on failure
      await this.prisma.book.update({
        where: { id: bookId },
        data: { status: 'ERROR' }
      });
      
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<EpubParsingJobData>) {
    this.logger.log(`🔄 Processing EPUB parsing job ${job.id} for book ${job.data.bookId}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EpubParsingJobData>, result: { success: boolean; bookId: string; duration: number }) {
    this.logger.log(`✅ EPUB parsing job ${job.id} completed for book ${job.data.bookId} in ${result.duration}ms`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EpubParsingJobData>, error: Error) {
    this.logger.error(`❌ EPUB parsing job ${job.id} failed for book ${job.data.bookId}:`, error);
  }

  /**
   * Simulate EPUB parsing with a realistic delay
   * TODO: Replace with actual EPUB parsing service integration
   */
  private async simulateEpubParsing(s3Key: string): Promise<void> {
    // Simulate processing time for EPUB parsing
    const processingTime = 2000; // 2 seconds for EPUB parsing
    
    this.logger.log(`📚 Simulating EPUB parsing for S3 key: ${s3Key} (${processingTime}ms)`);
    
    return new Promise((resolve) => {
      setTimeout(resolve, processingTime);
    });
  }
}
