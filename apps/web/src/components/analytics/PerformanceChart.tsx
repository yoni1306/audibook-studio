import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { PerformanceMetrics, TimeRange } from '../../pages/AnalyticsPage';

interface PerformanceChartProps {
  data: PerformanceMetrics[];
  timeRange: TimeRange;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, timeRange }) => {
  const chartOptions = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    // Prepare data for success rate chart
    const categories = data.map(item => item.eventType.replace('_', ' '));
    const successRates = data.map(item => item.successRate);
    const avgProcessingTimes = data.map(item => item.avgProcessingTime || 0);

    return {
      chart: {
        type: 'column',
        height: 400,
        backgroundColor: 'transparent',
      },
      title: {
        text: null,
      },
      xAxis: {
        categories: categories,
        title: {
          text: 'Event Types',
        },
      },
      yAxis: [
        {
          // Primary Y axis for success rate
          min: 0,
          max: 100,
          title: {
            text: 'Success Rate (%)',
            style: {
              color: '#10b981',
            },
          },
          labels: {
            style: {
              color: '#10b981',
            },
          },
        },
        {
          // Secondary Y axis for processing time
          title: {
            text: 'Avg Processing Time (ms)',
            style: {
              color: '#f59e0b',
            },
          },
          labels: {
            style: {
              color: '#f59e0b',
            },
          },
          opposite: true,
        },
      ],
      tooltip: {
        shared: true,
        formatter: function() {
          const category = this.x;
          let tooltip = `<b>${category}</b><br/>`;
          
          this.points?.forEach(point => {
            if (point.series.name === 'Success Rate') {
              tooltip += `<span style="color:${point.color}">●</span> ${point.series.name}: <b>${point.y?.toFixed(1)}%</b><br/>`;
            } else {
              tooltip += `<span style="color:${point.color}">●</span> ${point.series.name}: <b>${point.y}ms</b><br/>`;
            }
          });
          
          return tooltip;
        },
      },
      legend: {
        align: 'center',
        verticalAlign: 'bottom',
        layout: 'horizontal',
      },
      plotOptions: {
        column: {
          borderWidth: 0,
          borderRadius: 4,
        },
      },
      series: [
        {
          name: 'Success Rate',
          type: 'column',
          yAxis: 0,
          data: successRates,
          color: '#10b981', // green-500
          dataLabels: {
            enabled: true,
            format: '{y:.1f}%',
            style: {
              fontSize: '12px',
              fontWeight: 'bold',
            },
          },
        },
        {
          name: 'Avg Processing Time',
          type: 'line',
          yAxis: 1,
          data: avgProcessingTimes,
          color: '#f59e0b', // amber-500
          marker: {
            enabled: true,
            radius: 4,
          },
          lineWidth: 3,
          dataLabels: {
            enabled: true,
            format: '{y}ms',
            style: {
              fontSize: '12px',
              fontWeight: 'bold',
            },
          },
        },
      ],
      credits: {
        enabled: false,
      },
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">⚡</div>
          <p>No performance data available for the selected time range</p>
        </div>
      </div>
    );
  }

  if (!chartOptions) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>Unable to generate performance chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
      />
      
      {/* Performance Summary Cards */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.map((metric, index) => (
          <div key={metric.eventType} className="bg-gray-50 rounded-lg p-4 border">
            <h4 className="font-medium text-gray-900 mb-2">
              {metric.eventType.replace('_', ' ')}
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Events:</span>
                <span className="font-medium">{metric.totalEvents}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Success Rate:</span>
                <span className={`font-medium ${metric.successRate >= 95 ? 'text-green-600' : metric.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {metric.successRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Time:</span>
                <span className="font-medium">
                  {metric.avgProcessingTime ? `${metric.avgProcessingTime}ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
