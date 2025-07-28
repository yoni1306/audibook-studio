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
          eventData: eventData.eventData as any || {},
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
   * Get global metrics across all books
   */
  async getGlobalMetrics(timeRange?: { start: Date; end: Date }): Promise<{
    totalBooks: number;
    totalTextEdits: number;
    totalAudioGenerated: number;
    totalBulkFixes: number;
    totalCorrections: number;
    avgProcessingTime: number | null;
    activeBooks: number;
  }> {
    try {
      const whereClause: any = {};
      
      if (timeRange) {
        whereClause.lastActivity = {
          gte: timeRange.start,
          lte: timeRange.end,
        };
      }

      const bookMetrics = await this.prisma.bookMetrics.findMany({
        where: whereClause,
      });

      const totalBooks = bookMetrics.length;
      const activeBooks = bookMetrics.filter(
        metrics => metrics.lastActivity > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;

      const totals = bookMetrics.reduce(
        (acc, metrics) => ({
          totalTextEdits: acc.totalTextEdits + metrics.totalTextEdits,
          totalAudioGenerated: acc.totalAudioGenerated + metrics.totalAudioGenerated,
          totalBulkFixes: acc.totalBulkFixes + metrics.totalBulkFixes,
          totalCorrections: acc.totalCorrections + metrics.totalCorrections,
          avgProcessingTimeSum: acc.avgProcessingTimeSum + (metrics.avgProcessingTime || 0),
          avgProcessingTimeCount: acc.avgProcessingTimeCount + (metrics.avgProcessingTime ? 1 : 0),
        }),
        {
          totalTextEdits: 0,
          totalAudioGenerated: 0,
          totalBulkFixes: 0,
          totalCorrections: 0,
          avgProcessingTimeSum: 0,
          avgProcessingTimeCount: 0,
        }
      );

      return {
        totalBooks,
        totalTextEdits: totals.totalTextEdits,
        totalAudioGenerated: totals.totalAudioGenerated,
        totalBulkFixes: totals.totalBulkFixes,
        totalCorrections: totals.totalCorrections,
        avgProcessingTime: totals.avgProcessingTimeCount > 0 
          ? totals.avgProcessingTimeSum / totals.avgProcessingTimeCount 
          : null,
        activeBooks,
      };
    } catch (error) {
      this.logger.error(`Failed to get global metrics: ${error.message}`);
      throw new Error('Failed to retrieve global metrics');
    }
  }

  /**
   * Get activity timeline data
   */
  async getActivityTimeline(
    bookId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<Array<{
    timestamp: Date;
    textEdits: number;
    audioGenerated: number;
    bulkFixes: number;
    corrections: number;
  }>> {
    try {
      const whereClause: any = {};
      
      if (bookId) {
        whereClause.bookId = bookId;
      }
      
      if (timeRange) {
        whereClause.timestamp = {
          gte: timeRange.start,
          lte: timeRange.end,
        };
      } else {
        // Default to last 30 days
        whereClause.timestamp = {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        };
      }

      const events = await this.prisma.metricEvent.findMany({
        where: whereClause,
        orderBy: { timestamp: 'asc' },
      });

      // Group events by day
      const dailyGroups = new Map<string, {
        timestamp: Date;
        textEdits: number;
        audioGenerated: number;
        bulkFixes: number;
        corrections: number;
      }>();

      events.forEach(event => {
        const dayKey = event.timestamp.toISOString().split('T')[0];
        
        if (!dailyGroups.has(dayKey)) {
          dailyGroups.set(dayKey, {
            timestamp: new Date(dayKey),
            textEdits: 0,
            audioGenerated: 0,
            bulkFixes: 0,
            corrections: 0,
          });
        }

        const dayData = dailyGroups.get(dayKey)!;
        switch (event.eventType) {
          case 'TEXT_EDIT':
            dayData.textEdits++;
            break;
          case 'AUDIO_GENERATION':
            dayData.audioGenerated++;
            break;
          case 'BULK_FIX_APPLIED':
            dayData.bulkFixes++;
            break;
          case 'CORRECTION_RECORDED':
            dayData.corrections++;
            break;
        }
      });

      return Array.from(dailyGroups.values()).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    } catch (error) {
      this.logger.error(`Failed to get activity timeline: ${error.message}`);
      throw new Error('Failed to retrieve activity timeline');
    }
  }

  /**
   * Get performance metrics for a specific event type
   */
  async getPerformanceMetrics(
    eventType: EventType,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    eventType: EventType;
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    avgProcessingTime: number | null;
    minProcessingTime: number | null;
    maxProcessingTime: number | null;
  }> {
    try {
      const whereClause: any = {
        eventType,
      };
      
      if (timeRange) {
        whereClause.timestamp = {
          gte: timeRange.start,
          lte: timeRange.end,
        };
      }

      const events = await this.prisma.metricEvent.findMany({
        where: whereClause,
      });

      const totalEvents = events.length;
      const successfulEvents = events.filter(e => e.success).length;
      const failedEvents = totalEvents - successfulEvents;
      const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

      const durations = events
        .filter(e => e.duration !== null)
        .map(e => e.duration as number);

      const avgProcessingTime = durations.length > 0 
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
        : null;
      
      const minProcessingTime = durations.length > 0 ? Math.min(...durations) : null;
      const maxProcessingTime = durations.length > 0 ? Math.max(...durations) : null;

      return {
        eventType,
        totalEvents,
        successfulEvents,
        failedEvents,
        successRate: Math.round(successRate * 100) / 100,
        avgProcessingTime: avgProcessingTime ? Math.round(avgProcessingTime) : null,
        minProcessingTime,
        maxProcessingTime,
      };
    } catch (error) {
      this.logger.error(`Failed to get performance metrics: ${error.message}`);
      throw new Error('Failed to retrieve performance metrics');
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
