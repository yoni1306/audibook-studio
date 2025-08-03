import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
} from '@mui/material';
import {
  Speed,
} from '@mui/icons-material';
import { PerformanceMetrics, TimeRange } from '../../pages/AnalyticsPage';

interface PerformanceChartProps {
  data: PerformanceMetrics[];
  timeRange: TimeRange;
}

const formatDuration = (duration: number | null): string => {
  if (!duration) return 'N/A';
  if (duration < 1000) return `${duration.toFixed(0)}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}m`;
};

const getPerformanceColor = (successRate: number): 'success' | 'warning' | 'error' => {
  if (successRate >= 95) return 'success';
  if (successRate >= 80) return 'warning';
  return 'error';
};

const formatEventType = (eventType: string): string => {
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, timeRange }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold' }}>
            Performance Metrics
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Speed sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No performance data available for the selected time range
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold' }}>
          Performance Metrics
        </Typography>
        
        {/* Clean Grid Layout */}
        <Grid container spacing={2}>
          {data.map((metric, index) => (
            <Grid item xs={12} key={metric.eventType}>
              <Box 
                sx={{ 
                  p: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 2,
                  '&:last-child': { mb: 0 }
                }}
              >
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Speed sx={{ color: 'primary.main', mr: 1.5, fontSize: 24 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {formatEventType(metric.eventType)}
                    </Typography>
                  </Box>
                  <Chip 
                    label={`${metric.successRate.toFixed(1)}%`}
                    color={getPerformanceColor(metric.successRate)}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                
                {/* Metrics Row */}
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {metric.totalEvents.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Events
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: getPerformanceColor(metric.successRate) === 'success' ? 'success.main' : getPerformanceColor(metric.successRate) === 'warning' ? 'warning.main' : 'error.main' }}>
                        {metric.successRate.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                        {formatDuration(metric.avgProcessingTime)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Time
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                {/* Progress Bar */}
                <Box sx={{ mt: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={metric.successRate} 
                    sx={{ height: 6, borderRadius: 3 }}
                    color={getPerformanceColor(metric.successRate)}
                  />
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
        
        {/* Overall Performance Summary */}
        {data.length > 1 && (
          <Box sx={{ mt: 4 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                  Overall Performance Summary
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" component="div" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                        {data.reduce((sum, metric) => sum + metric.totalEvents, 0).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Events
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" component="div" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        {(data.reduce((sum, metric) => sum + metric.successRate, 0) / data.length).toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Success Rate
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" component="div" sx={{ color: 'info.main', fontWeight: 'bold' }}>
                        {formatDuration(
                          data.reduce((sum, metric) => sum + (metric.avgProcessingTime || 0), 0) / data.length
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Processing Time
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
