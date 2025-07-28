import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { MetricsService, BookMetricsDto } from './metrics.service';
import { 
  GlobalMetricsDto, 
  ActivityTimelineDto, 
  PerformanceMetricsDto 
} from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Get global metrics across all books
   * @param timeRange - Time range filter (1d, 7d, 30d, 90d, 1y)
   */
  @Get('global')
  async getGlobalMetrics(
    @Query('timeRange') timeRange?: string
  ): Promise<GlobalMetricsDto> {
    this.logger.log(`📊 Getting global metrics with time range: ${timeRange || 'all'}`);
    
    try {
      const timeRangeObj = timeRange ? this.getTimeRangeFromString(timeRange) : undefined;
      return await this.metricsService.getGlobalMetrics(timeRangeObj);
    } catch (error) {
      this.logger.error(`Failed to get global metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get metrics for all books
   * @param timeRange - Time range filter (1d, 7d, 30d, 90d, 1y)
   */
  @Get('books')
  async getAllBookMetrics(
    @Query('timeRange') timeRange?: string
  ): Promise<BookMetricsDto[]> {
    this.logger.log(`📊 Getting metrics for all books with time range: ${timeRange || 'all'}`);
    
    try {
      const timeRangeObj = timeRange ? this.getTimeRangeFromString(timeRange) : undefined;
      return await this.metricsService.getAllBookMetrics(timeRangeObj);
    } catch (error) {
      this.logger.error(`Failed to get all book metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get metrics for a specific book
   * @param bookId - Book ID
   */
  @Get('books/:bookId')
  async getBookMetrics(@Param('bookId') bookId: string): Promise<BookMetricsDto> {
    this.logger.log(`📊 Getting metrics for book: ${bookId}`);
    
    try {
      return await this.metricsService.getBookMetrics(bookId);
    } catch (error) {
      this.logger.error(`Failed to get book metrics for ${bookId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get activity timeline data
   * @param bookId - Optional book ID to filter by specific book
   * @param timeRange - Time range filter (1d, 7d, 30d, 90d, 1y)
   */
  @Get('timeline')
  async getActivityTimeline(
    @Query('bookId') bookId?: string,
    @Query('timeRange') timeRange?: string
  ): Promise<ActivityTimelineDto[]> {
    this.logger.log(`📊 Getting activity timeline - Book: ${bookId || 'all'}, Range: ${timeRange || '30d'}`);
    
    try {
      const timeRangeObj = this.getTimeRangeFromString(timeRange || '30d');
      return await this.metricsService.getActivityTimeline(bookId, timeRangeObj);
    } catch (error) {
      this.logger.error(`Failed to get activity timeline: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get performance metrics for a specific event type
   * @param eventType - Event type to analyze
   * @param timeRange - Time range filter (1d, 7d, 30d, 90d, 1y)
   */
  @Get('performance/:eventType')
  async getPerformanceMetrics(
    @Param('eventType') eventType: string,
    @Query('timeRange') timeRange?: string
  ): Promise<PerformanceMetricsDto> {
    this.logger.log(`📊 Getting performance metrics for ${eventType} with range: ${timeRange || '30d'}`);
    
    try {
      const timeRangeObj = this.getTimeRangeFromString(timeRange || '30d');
      return await this.metricsService.getPerformanceMetrics(eventType as any, timeRangeObj);
    } catch (error) {
      this.logger.error(`Failed to get performance metrics for ${eventType}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get dashboard summary data
   * Combines key metrics for dashboard overview
   */
  @Get('dashboard')
  async getDashboardSummary(@Query('timeRange') timeRange?: string) {
    this.logger.log(`📊 Getting dashboard summary with range: ${timeRange || '30d'}`);
    
    try {
      const timeRangeObj = timeRange ? this.getTimeRangeFromString(timeRange) : undefined;
      
      // Get global metrics and recent activity in parallel
      const [globalMetrics, activityTimeline] = await Promise.all([
        this.metricsService.getGlobalMetrics(timeRangeObj),
        this.metricsService.getActivityTimeline(undefined, this.getTimeRangeFromString('7d'))
      ]);

      return {
        globalMetrics,
        recentActivity: activityTimeline,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Utility method to convert time range string to date range
   */
  private getTimeRangeFromString(rangeStr: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date();

    switch (rangeStr) {
      case '1d':
        start.setDate(now.getDate() - 1);
        break;
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30); // Default to 30 days
    }

    return { start, end: now };
  }
}
