import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '@prisma/client';

// DTOs for metrics operations
export interface CreateMetricEventDto {
  bookId: string;
  eventType: EventType;
  eventData?: Record<string, unknown>;
  duration?: number;
  success?: boolean;
  errorMessage?: string;
}

export interface TextChange {
  originalWord: string;
  correctedWord: string;
  position: number;
  fixType?: string;
}

export interface BookMetricsDto {
  bookId: string;
  totalTextEdits: number;
  totalAudioGenerated: number;
  totalBulkFixes: number;
  totalCorrections: number;
  avgProcessingTime: number | null;
  completionPercentage: number;
  lastActivity: Date;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Record a metric event
   */
  async recordEvent(eventData: CreateMetricEventDto): Promise<void> {
    try {
      await this.prisma.metricEvent.create({
        data: {
          bookId: eventData.bookId,
          eventType: eventData.eventType,
          eventData: eventData.eventData || {},
          duration: eventData.duration,
          success: eventData.success ?? true,
          errorMessage: eventData.errorMessage,
        },
      });

      this.logger.log(
        `📊 Recorded ${eventData.eventType} event for book ${eventData.bookId} ` +
        `(success: ${eventData.success ?? true}, duration: ${eventData.duration}ms)`
      );

      // Update book metrics asynchronously
      this.updateBookMetrics(eventData.bookId).catch(error => {
        this.logger.error(`Failed to update book metrics: ${error.message}`);
      });
    } catch (error) {
      this.logger.error(`Failed to record metric event: ${error.message}`);
      throw new Error('Failed to record metric event');
    }
  }

  /**
   * Record a text edit event
   */
  async recordTextEdit(
    bookId: string,
    paragraphId: string,
    changes: TextChange[]
  ): Promise<void> {
    const eventData = {
      paragraphId,
      changes,
      changeCount: changes.length,
      wordCount: changes.reduce((sum, change) => sum + change.originalWord.split(' ').length, 0),
    };

    await this.recordEvent({
      bookId,
      eventType: EventType.TEXT_EDIT,
      eventData,
      success: true,
    });
  }

  /**
   * Record an audio generation event
   */
  async recordAudioGeneration(
    bookId: string,
    paragraphId: string,
    duration: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const eventData = {
      paragraphId,
      processingDuration: duration,
    };

    await this.recordEvent({
      bookId,
      eventType: EventType.AUDIO_GENERATION,
      eventData,
      duration,
      success,
      errorMessage,
    });
  }

  /**
   * Record a bulk fix event
   */
  async recordBulkFix(
    bookId: string,
    originalWord: string,
    correctedWord: string,
    paragraphIds: string[],
    fixType: string
  ): Promise<void> {
    const eventData = {
      originalWord,
      correctedWord,
      paragraphIds,
      fixType,
      affectedParagraphs: paragraphIds.length,
    };

    await this.recordEvent({
      bookId,
      eventType: EventType.BULK_FIX_APPLIED,
      eventData,
      success: true,
    });
  }

  /**
   * Get metrics for a specific book
   */
  async getBookMetrics(bookId: string): Promise<BookMetricsDto> {
    try {
      // Try to get existing aggregated metrics
      let bookMetrics = await this.prisma.bookMetrics.findUnique({
        where: { bookId },
      });

      // If no metrics exist, create default ones
      if (!bookMetrics) {
        bookMetrics = await this.prisma.bookMetrics.create({
          data: {
            bookId,
            totalTextEdits: 0,
            totalAudioGenerated: 0,
            totalBulkFixes: 0,
            totalCorrections: 0,
            avgProcessingTime: null,
            completionPercentage: 0,
          },
        });
      }

      return {
        bookId: bookMetrics.bookId,
        totalTextEdits: bookMetrics.totalTextEdits,
        totalAudioGenerated: bookMetrics.totalAudioGenerated,
        totalBulkFixes: bookMetrics.totalBulkFixes,
        totalCorrections: bookMetrics.totalCorrections,
        avgProcessingTime: bookMetrics.avgProcessingTime,
        completionPercentage: bookMetrics.completionPercentage,
        lastActivity: bookMetrics.lastActivity,
      };
    } catch (error) {
      this.logger.error(`Failed to get book metrics: ${error.message}`);
      throw new Error('Failed to retrieve book metrics');
    }
  }

  /**
   * Update aggregated metrics for a specific book
   */
  async updateBookMetrics(bookId: string): Promise<void> {
    try {
      // Get event counts by type
      const eventCounts = await this.prisma.metricEvent.groupBy({
        by: ['eventType'],
        where: { bookId },
        _count: { eventType: true },
      });

      // Calculate totals
      const totals = eventCounts.reduce(
        (acc, group) => {
          switch (group.eventType) {
            case EventType.TEXT_EDIT:
              acc.totalTextEdits = group._count.eventType;
              break;
            case EventType.AUDIO_GENERATION:
              acc.totalAudioGenerated = group._count.eventType;
              break;
            case EventType.BULK_FIX_APPLIED:
              acc.totalBulkFixes = group._count.eventType;
              break;
            case EventType.CORRECTION_RECORDED:
              acc.totalCorrections = group._count.eventType;
              break;
          }
          return acc;
        },
        {
          totalTextEdits: 0,
          totalAudioGenerated: 0,
          totalBulkFixes: 0,
          totalCorrections: 0,
        }
      );

      // Calculate average processing time
      const processingEvents = await this.prisma.metricEvent.findMany({
        where: {
          bookId,
          duration: { not: null },
        },
        select: { duration: true },
      });

      const avgProcessingTime = processingEvents.length > 0
        ? processingEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / processingEvents.length
        : null;

      // Calculate completion percentage
      const book = await this.prisma.book.findUnique({
        where: { id: bookId },
        include: {
          pages: {
            include: {
              paragraphs: {
                select: { completed: true },
              },
            },
          },
        },
      });

      let completionPercentage = 0;
      if (book && book.pages.length > 0) {
        const totalParagraphs = book.pages.reduce(
          (sum, page) => sum + page.paragraphs.length, 
          0
        );
        const completedParagraphs = book.pages.reduce(
          (sum, page) => sum + page.paragraphs.filter(p => p.completed).length, 
          0
        );
        
        completionPercentage = totalParagraphs > 0 
          ? (completedParagraphs / totalParagraphs) * 100 
          : 0;
      }

      // Upsert book metrics
      await this.prisma.bookMetrics.upsert({
        where: { bookId },
        update: {
          totalTextEdits: totals.totalTextEdits,
          totalAudioGenerated: totals.totalAudioGenerated,
          totalBulkFixes: totals.totalBulkFixes,
          totalCorrections: totals.totalCorrections,
          avgProcessingTime: avgProcessingTime ? Math.round(avgProcessingTime) : null,
          completionPercentage: Math.round(completionPercentage * 100) / 100,
          lastActivity: new Date(),
        },
        create: {
          bookId,
          totalTextEdits: totals.totalTextEdits,
          totalAudioGenerated: totals.totalAudioGenerated,
          totalBulkFixes: totals.totalBulkFixes,
          totalCorrections: totals.totalCorrections,
          avgProcessingTime: avgProcessingTime ? Math.round(avgProcessingTime) : null,
          completionPercentage: Math.round(completionPercentage * 100) / 100,
        },
      });

      this.logger.log(`📊 Updated metrics for book ${bookId}`);
    } catch (error) {
      this.logger.error(`Failed to update book metrics: ${error.message}`);
      throw new Error('Failed to update book metrics');
    }
  }
}
