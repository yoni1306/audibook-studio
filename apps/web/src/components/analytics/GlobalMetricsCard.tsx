import React from 'react';
import { GlobalMetrics } from '../../pages/AnalyticsPage';

interface GlobalMetricsCardProps {
  metrics: GlobalMetrics;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, trend, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    stable: '→',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="text-2xl mr-3">{icon}</div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {trend && (
          <div className="text-lg">
            {trendIcons[trend]}
          </div>
        )}
      </div>
    </div>
  );
};

export const GlobalMetricsCard: React.FC<GlobalMetricsCardProps> = ({ metrics }) => {
  const formatProcessingTime = (time: number | null): string => {
    if (time === null) return 'N/A';
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Books"
        value={metrics.totalBooks}
        subtitle={`${metrics.activeBooks} active`}
        icon="📚"
        color="blue"
        trend="stable"
      />
      
      <MetricCard
        title="Text Edits"
        value={formatNumber(metrics.totalTextEdits)}
        subtitle="Total modifications"
        icon="✏️"
        color="green"
        trend="up"
      />
      
      <MetricCard
        title="Audio Generated"
        value={formatNumber(metrics.totalAudioGenerated)}
        subtitle="Paragraphs processed"
        icon="🎵"
        color="purple"
        trend="up"
      />
      
      <MetricCard
        title="Avg Processing Time"
        value={formatProcessingTime(metrics.avgProcessingTime)}
        subtitle="Per operation"
        icon="⚡"
        color="orange"
        trend="stable"
      />
      
      <MetricCard
        title="Bulk Fixes"
        value={formatNumber(metrics.totalBulkFixes)}
        subtitle="Applied corrections"
        icon="🔧"
        color="red"
        trend="up"
      />
      
      <MetricCard
        title="Total Corrections"
        value={formatNumber(metrics.totalCorrections)}
        subtitle="Text improvements"
        icon="✅"
        color="green"
        trend="up"
      />
    </div>
  );
};
