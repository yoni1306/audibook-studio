import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { ActivityTimelineData, TimeRange } from '../../pages/AnalyticsPage';

interface ActivityTimelineChartProps {
  data: ActivityTimelineData[];
  timeRange: TimeRange;
}

export const ActivityTimelineChart: React.FC<ActivityTimelineChartProps> = ({ data, timeRange }) => {
  const chartOptions = useMemo(() => {
    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Prepare series data
    const textEditsData = sortedData.map(item => [
      new Date(item.timestamp).getTime(),
      item.textEdits
    ]);

    const audioGeneratedData = sortedData.map(item => [
      new Date(item.timestamp).getTime(),
      item.audioGenerated
    ]);

    const bulkFixesData = sortedData.map(item => [
      new Date(item.timestamp).getTime(),
      item.bulkFixes
    ]);

    const correctionsData = sortedData.map(item => [
      new Date(item.timestamp).getTime(),
      item.corrections
    ]);

    return {
      chart: {
        type: 'line',
        height: 400,
        backgroundColor: 'transparent',
      },
      title: {
        text: null,
      },
      xAxis: {
        type: 'datetime',
        title: {
          text: 'Date',
        },
        gridLineWidth: 1,
        gridLineColor: '#f0f0f0',
      },
      yAxis: {
        title: {
          text: 'Number of Events',
        },
        min: 0,
        gridLineColor: '#f0f0f0',
      },
      tooltip: {
        shared: true,
        crosshairs: true,
        formatter: function() {
          const date = Highcharts.dateFormat('%Y-%m-%d', this.x);
          let tooltip = `<b>${date}</b><br/>`;
          
          this.points?.forEach(point => {
            tooltip += `<span style="color:${point.color}">●</span> ${point.series.name}: <b>${point.y}</b><br/>`;
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
        line: {
          marker: {
            enabled: true,
            radius: 4,
          },
          lineWidth: 2,
        },
      },
      series: [
        {
          name: 'Text Edits',
          data: textEditsData,
          color: '#10b981', // green-500
        },
        {
          name: 'Audio Generated',
          data: audioGeneratedData,
          color: '#8b5cf6', // purple-500
        },
        {
          name: 'Bulk Fixes',
          data: bulkFixesData,
          color: '#f59e0b', // amber-500
        },
        {
          name: 'Corrections',
          data: correctionsData,
          color: '#3b82f6', // blue-500
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
          <div className="text-4xl mb-2">📊</div>
          <p>No activity data available for the selected time range</p>
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
    </div>
  );
};
