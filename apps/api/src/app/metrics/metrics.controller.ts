import { Controller, Post, Body, Get, Query, Logger } from '@nestjs/common';
import { MetricsService, CreateMetricEventDto } from './metrics.service';

@Controller('api/metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  @Post('events')
  async recordEvent(@Body() eventData: CreateMetricEventDto) {
    this.logger.log('Recording metric event', {
      bookId: eventData.bookId,
      eventType: eventData.eventType,
      success: eventData.success,
    });

    await this.metricsService.recordEvent(eventData);
    return { success: true };
  }

  @Get('books/:bookId')
  async getBookMetrics(@Query('bookId') bookId: string) {
    return this.metricsService.getBookMetrics(bookId);
  }

  @Get('global')
  async getGlobalMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const timeRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : undefined;

    return this.metricsService.getGlobalMetrics(timeRange);
  }
}
