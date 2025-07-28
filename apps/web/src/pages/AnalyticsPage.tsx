import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Fade,
  Skeleton,
  Alert,
  Button,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Analytics,
  TrendingUp,
  Refresh,
} from '@mui/icons-material';
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
  const theme = useTheme();
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
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Fade in={loading}>
          <Box>
            {/* Header Skeleton */}
            <Box sx={{ mb: 4 }}>
              <Skeleton variant="text" width={300} height={48} />
              <Skeleton variant="text" width={500} height={24} sx={{ mt: 1 }} />
            </Box>
            
            {/* Metrics Cards Skeleton */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Paper sx={{ p: 3, height: 140 }}>
                    <Skeleton variant="rectangular" width="100%" height={80} />
                    <Skeleton variant="text" width="60%" sx={{ mt: 2 }} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
            
            {/* Charts Skeleton */}
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 3, height: 400 }}>
                  <Skeleton variant="text" width={200} height={32} />
                  <Skeleton variant="rectangular" width="100%" height={300} sx={{ mt: 2 }} />
                </Paper>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 3, height: 400 }}>
                  <Skeleton variant="text" width={200} height={32} />
                  <Skeleton variant="rectangular" width="100%" height={300} sx={{ mt: 2 }} />
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Fade in={!!error}>
          <Alert 
            severity="error" 
            sx={{ 
              borderRadius: 2,
              boxShadow: theme.shadows[1]
            }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={fetchAnalyticsData}
                startIcon={<Refresh />}
                sx={{ fontWeight: 600 }}
              >
                Retry
              </Button>
            }
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Error Loading Analytics
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
          </Alert>
        </Fade>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Fade in={!loading && !error} timeout={800}>
        <Box>
          {/* Header with Gradient Background */}
          <Box 
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
              borderRadius: 3,
              p: 4,
              mb: 4,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.02)} 25%, transparent 25%), linear-gradient(-45deg, ${alpha(theme.palette.primary.main, 0.02)} 25%, transparent 25%)`,
                backgroundSize: '20px 20px',
                pointerEvents: 'none',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box 
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: theme.shadows[3]
                  }}
                >
                  <Analytics sx={{ color: 'white', fontSize: 32 }} />
                </Box>
                <Box>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 1
                    }}
                  >
                    Analytics Dashboard
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: theme.palette.text.secondary,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <TrendingUp sx={{ fontSize: 20 }} />
                    Monitor your audiobook production metrics and performance
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip 
                  label="Live Data" 
                  color="success" 
                  variant="filled"
                  sx={{ 
                    fontWeight: 600,
                    boxShadow: theme.shadows[2]
                  }}
                />
                <TimeRangeSelector
                  value={timeRange}
                  onChange={setTimeRange}
                />
              </Box>
            </Box>
          </Box>

          {/* Global Metrics Cards */}
          {globalMetrics && (
            <Fade in={!!globalMetrics} timeout={1000}>
              <Box sx={{ mb: 4 }}>
                <GlobalMetricsCard metrics={globalMetrics} />
              </Box>
            </Fade>
          )}

          {/* Charts Section */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Activity Timeline Chart */}
            <Grid item xs={12} lg={6}>
              <Fade in timeout={1200}>
                <Box 
                  sx={{ 
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    background: `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                    transition: 'all 0.3s ease-in-out',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[8],
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                    },
                    '& .MuiCard-root': {
                      boxShadow: 'none',
                      border: 'none',
                      background: 'transparent'
                    }
                  }}
                >
                  <ActivityTimelineChart
                    data={activityData}
                    timeRange={timeRange}
                  />
                </Box>
              </Fade>
            </Grid>

            {/* Performance Chart */}
            <Grid item xs={12} lg={6}>
              <Fade in timeout={1400}>
                <Box 
                  sx={{ 
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    background: `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
                    transition: 'all 0.3s ease-in-out',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[8],
                      border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`
                    },
                    '& .MuiCard-root': {
                      boxShadow: 'none',
                      border: 'none',
                      background: 'transparent'
                    }
                  }}
                >
                  <PerformanceChart
                    data={performanceData}
                    timeRange={timeRange}
                  />
                </Box>
              </Fade>
            </Grid>
          </Grid>

          {/* Book Metrics Table */}
          <Fade in timeout={1600}>
            <Box 
              sx={{ 
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                background: `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease-in-out',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: theme.shadows[4],
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                },
                '& .MuiPaper-root': {
                  boxShadow: 'none',
                  border: 'none',
                  background: 'transparent'
                }
              }}
            >
              <Box sx={{ p: 3 }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 700,
                    mb: 3,
                    color: theme.palette.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <Box 
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.success.main} 100%)`,
                      mr: 1
                    }}
                  />
                  Book Performance
                </Typography>
                <BookMetricsTable timeRange={timeRange} />
              </Box>
            </Box>
          </Fade>
        </Box>
      </Fade>
    </Container>
  );
};
