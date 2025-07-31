import { EventType } from '@prisma/client';

/**
 * Global metrics across all books
 */
export interface GlobalMetricsDto {
  totalBooks: number;
  totalTextEdits: number;
  totalAudioGenerated: number;
  totalBulkFixes: number;
  totalCorrections: number;
  avgProcessingTime: number | null;
  activeBooks: number;
}



/**
 * Activity timeline point for charts
 */
export interface ActivityTimelineDto {
  timestamp: Date;
  textEdits: number;
  audioGenerated: number;
  bulkFixes: number;
  corrections: number;
}

/**
 * Performance metrics for specific event types
 */
export interface PerformanceMetricsDto {
  eventType: EventType;
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number;
  avgProcessingTime: number | null;
  minProcessingTime: number | null;
  maxProcessingTime: number | null;
}

/**
 * Dashboard summary combining key metrics
 */
export interface DashboardSummaryDto {
  globalMetrics: GlobalMetricsDto;
  recentActivity: ActivityTimelineDto[];
  timestamp: string;
}

/**
 * Time range filter for analytics queries
 */
export interface TimeRangeDto {
  start: Date;
  end: Date;
}

/**
 * Book analytics with additional details
 */
export interface BookAnalyticsDto {
  bookId: string;
  totalTextEdits: number;
  totalAudioGenerated: number;
  totalBulkFixes: number;
  totalCorrections: number;
  avgProcessingTime: number | null;
  completionPercentage: number;
  lastActivity: Date;
  bookTitle?: string;
  bookAuthor?: string;
  totalParagraphs?: number;
  completedParagraphs?: number;
  recentActivity?: ActivityTimelineDto[];
  performanceMetrics?: PerformanceMetricsDto[];
}

/**
 * Analytics filter options
 */
export interface AnalyticsFiltersDto {
  timeRange?: '1d' | '7d' | '30d' | '90d' | '1y';
  bookId?: string;
  eventType?: EventType;
}

/**
 * KPI (Key Performance Indicator) for dashboard
 */
export interface KpiDto {
  label: string;
  value: number | string;
  change?: number; // Percentage change from previous period
  trend?: 'up' | 'down' | 'stable';
  format?: 'number' | 'percentage' | 'duration' | 'currency';
}

/**
 * Chart data point for frontend visualization
 */
export interface ChartDataPointDto {
  x: string | number | Date;
  y: number;
  label?: string;
  color?: string;
}

/**
 * Chart series for multi-line charts
 */
export interface ChartSeriesDto {
  name: string;
  data: ChartDataPointDto[];
  color?: string;
  type?: 'line' | 'bar' | 'area';
}
