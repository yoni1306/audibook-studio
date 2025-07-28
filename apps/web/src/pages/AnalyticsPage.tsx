import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { GlobalMetricsCard } from '../components/analytics/GlobalMetricsCard';
import { ActivityTimelineChart } from '../components/analytics/ActivityTimelineChart';
import { PerformanceChart } from '../components/analytics/PerformanceChart';
import { TimeRangeSelector } from '../components/analytics/TimeRangeSelector';
import { BookMetricsTable } from '../components/analytics/BookMetricsTable';

export interface GlobalMetrics {
  totalBooks: number;
  totalTextEdits: number;
  totalAudioGenerated: number;
  totalBulkFixes: number;
  totalCorrections: number;
  avgProcessingTime: number | null;
  activeBooks: number;
}

export interface ActivityTimelineData {
  timestamp: Date;
  textEdits: number;
  audioGenerated: number;
  bulkFixes: number;
  corrections: number;
}

export interface PerformanceMetrics {
  eventType: string;
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number;
  avgProcessingTime: number | null;
  minProcessingTime: number | null;
  maxProcessingTime: number | null;
}

export type TimeRange = '1d' | '7d' | '30d' | '90d' | '1y';

export const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null);
  const [activityData, setActivityData] = useState<ActivityTimelineData[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard summary data
      const dashboardResponse = await fetch(`/api/analytics/dashboard?timeRange=${timeRange}`);
      if (!dashboardResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const dashboardData = await dashboardResponse.json();

      setGlobalMetrics(dashboardData.globalMetrics);
      setActivityData(dashboardData.recentActivity);

      // Fetch performance metrics for key event types
      const eventTypes = ['TEXT_EDIT', 'AUDIO_GENERATION', 'BULK_FIX_APPLIED'];
      const performancePromises = eventTypes.map(async (eventType) => {
        const response = await fetch(`/api/analytics/performance/${eventType}?timeRange=${timeRange}`);
        if (response.ok) {
          return await response.json();
        }
        return null;
      });

      const performanceResults = await Promise.all(performancePromises);
      setPerformanceData(performanceResults.filter(Boolean));

    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading analytics...</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Analytics</h3>
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchAnalyticsData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-gray-600 mt-2">
                  Monitor your audiobook production metrics and performance
                </p>
              </div>
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
              />
            </div>
          </div>

          {/* Global Metrics Cards */}
          {globalMetrics && (
            <div className="mb-8">
              <GlobalMetricsCard metrics={globalMetrics} />
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Activity Timeline Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Timeline</h2>
              <ActivityTimelineChart
                data={activityData}
                timeRange={timeRange}
              />
            </div>

            {/* Performance Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Metrics</h2>
              <PerformanceChart
                data={performanceData}
                timeRange={timeRange}
              />
            </div>
          </div>

          {/* Book Metrics Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Book Performance</h2>
            <BookMetricsTable timeRange={timeRange} />
          </div>
        </div>
      </div>
    </Layout>
  );
};
