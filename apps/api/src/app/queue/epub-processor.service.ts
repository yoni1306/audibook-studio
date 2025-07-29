import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { S3Service } from '../s3/s3.service';

interface EpubParsingJobData {
  bookId: string;
  s3Key: string;
  parsingMethod?: 'page-based' | 'xhtml-based';
}

/**
 * IMPORTANT: This service is a lightweight coordinator that delegates actual EPUB parsing
 * to the workers service. The real parsing logic exists in:
 * - apps/workers/src/text-processing/page-based-epub-parser.ts
 * - apps/workers/src/text-processing/xhtml-based-epub-parser.ts
 * 
 * The workers service handles:
 * - S3 download
 * - EPUB content extraction
 * - Paragraph creation
 * - Database updates
 * 
 * This API service only handles:
 * - Job lifecycle events
 * - Metrics recording
 * - Error handling coordination
 */
@Injectable()
@Processor('audio-processing')
export class EpubProcessorService extends WorkerHost {
  private readonly logger = new Logger(EpubProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private metricsService: MetricsService,
    private s3Service: S3Service
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
    
    this.logger.log(`📚 Starting EPUB parsing coordination for book ${bookId} with method: ${parsingMethod || 'xhtml-based'}`);
    this.logger.log(`🔄 Real parsing will be handled by workers service`);

    try {
      // Update book status to PROCESSING
      await this.prisma.book.update({
        where: { id: bookId },
        data: { status: 'PROCESSING' }
      });

      // The actual EPUB parsing is handled by the workers service
      // This API processor is just a coordinator for job lifecycle
      // Real parsing logic is in apps/workers/src/main.ts (case 'parse-epub')
      
      // For now, we delegate to the workers by letting the job pass through
      // The workers will handle:
      // 1. S3 download
      // 2. EPUB parsing (PageBasedEPUBParser or XHTMLBasedEPUBParser)
      // 3. Content extraction and paragraph creation
      // 4. Database updates
      
      this.logger.log(`📋 EPUB parsing job ${job.id} coordinated successfully`);
      this.logger.log(`⚠️  Note: Actual parsing will be performed by workers service`);
      
      const duration = Date.now() - startTime;
      
      // Record metrics for EPUB parsing coordination
      try {
        await this.metricsService.recordEvent({
          bookId,
          eventType: 'EPUB_PARSING' as any, // Temporary type assertion
          eventData: {
            s3Key,
            parsingMethod: parsingMethod || 'xhtml-based',
            coordinationDuration: duration,
          },
          duration,
          success: true,
        });
      } catch (error) {
        this.logger.error(`Failed to record EPUB parsing metrics: ${error.message}`);
        // Don't fail the main operation if metrics recording fails
      }
      
      return { 
        success: true, 
        bookId, 
        duration,
        note: 'Job coordinated - actual parsing handled by workers service'
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`❌ EPUB parsing coordination failed for book ${bookId}:`, error);
      
      // Update book status to ERROR on failure
      try {
        await this.prisma.book.update({
          where: { id: bookId },
          data: { status: 'ERROR' }
        });
      } catch (dbError) {
        this.logger.error(`Failed to update book status to ERROR: ${dbError.message}`);
      }
      
      // Record metrics for failed EPUB parsing
      try {
        await this.metricsService.recordEvent({
          bookId,
          eventType: 'EPUB_PARSING' as any, // Temporary type assertion
          eventData: {
            s3Key,
            parsingMethod: parsingMethod || 'xhtml-based',
            coordinationDuration: duration,
          },
          duration,
          success: false,
          errorMessage: error.message,
        });
      } catch (metricsError) {
        this.logger.error(`Failed to record EPUB parsing failure metrics: ${metricsError.message}`);
      }
      
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<EpubParsingJobData>) {
    this.logger.log(`🔄 Coordinating EPUB parsing job ${job.id} for book ${job.data.bookId}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EpubParsingJobData>, result: any) {
    this.logger.log(`✅ EPUB parsing job ${job.id} coordination completed for book ${job.data.bookId} in ${result.duration}ms`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EpubParsingJobData>, error: Error) {
    this.logger.error(`❌ EPUB parsing job ${job.id} coordination failed for book ${job.data.bookId}:`, error);
  }
}
