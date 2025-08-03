import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Book,
  Edit,
  VolumeUp,
  AutoFixHigh,
  CheckCircle,
  Schedule,
  MenuBook,
} from '@mui/icons-material';
import { GlobalMetrics } from '../../pages/AnalyticsPage';

interface GlobalMetricsCardProps {
  metrics: GlobalMetrics;
}

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  trend?: 'up' | 'down' | 'flat';
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color, trend, subtitle }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'down':
        return <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />;
      case 'flat':
        return <TrendingFlat sx={{ fontSize: 16, color: 'grey.500' }} />;
      default:
        return null;
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color: `${color}.main`, mr: 1 }}>
            {icon}
          </Box>
          <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          {getTrendIcon()}
        </Box>
        
        <Typography variant="h4" component="div" sx={{ color: `${color}.main`, fontWeight: 'bold', mb: 1 }}>
          {value}
        </Typography>
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export const GlobalMetricsCard: React.FC<GlobalMetricsCardProps> = ({ metrics }) => {
  const formatProcessingTime = (time: number | null) => {
    if (!time) return 'N/A';
    return time < 1000 ? `${time.toFixed(1)}ms` : `${(time / 1000).toFixed(2)}s`;
  };

  const getEfficiencyScore = () => {
    const totalOperations = metrics.totalTextEdits + metrics.totalAudioGenerated + metrics.totalBulkFixes;
    return totalOperations > 0 ? Math.min(100, (totalOperations / metrics.totalBooks) * 10) : 0;
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold' }}>
        Global Metrics Overview
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Books"
            value={metrics.totalBooks}
            icon={<Book />}
            color="primary"
            subtitle="Books in system"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Text Edits"
            value={metrics.totalTextEdits}
            icon={<Edit />}
            color="secondary"
            subtitle="Total modifications"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Audio Generated"
            value={metrics.totalAudioGenerated}
            icon={<VolumeUp />}
            color="success"
            subtitle="Audio files created"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Bulk Fixes"
            value={metrics.totalBulkFixes}
            icon={<AutoFixHigh />}
            color="warning"
            subtitle="Automated corrections"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Corrections"
            value={metrics.totalCorrections}
            icon={<CheckCircle />}
            color="success"
            subtitle="All corrections made"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Books"
            value={metrics.activeBooks}
            icon={<MenuBook />}
            color="primary"
            subtitle="Currently being processed"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Processing Time"
            value={formatProcessingTime(metrics.avgProcessingTime)}
            icon={<Schedule />}
            color="secondary"
            subtitle="Per operation"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ color: 'success.main', mr: 1 }} />
                <Typography variant="h6" component="h3">
                  Efficiency Score
                </Typography>
              </Box>
              
              <Typography variant="h4" component="div" sx={{ color: 'success.main', fontWeight: 'bold', mb: 1 }}>
                {getEfficiencyScore().toFixed(0)}%
              </Typography>
              
              <LinearProgress 
                variant="determinate" 
                value={getEfficiencyScore()} 
                sx={{ mb: 1, height: 8, borderRadius: 4 }}
                color="success"
              />
              
              <Typography variant="body2" color="text.secondary">
                Operations per book ratio
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
