import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Alert,
  Button,
  Fade,
  Skeleton,
  alpha,
  useTheme
} from '@mui/material';
import { TrendingUp, Refresh, Analytics } from '@mui/icons-material';
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

interface KeyMetrics {
  // Paragraph edit statistics
  avgParagraphEdits: number;
  minParagraphEdits: number;
  maxParagraphEdits: number;
  
  // Audio generation metrics
  totalAudioTime: number; // in seconds
  totalAudioGenerated: number; // count of audio files
  
  // Bulk edits metrics
  totalBulkEditsApplied: number;
  totalWordsFixed: number;
  
  // General activity metrics
  totalBooks: number;
  totalTextEdits: number;
  totalCorrections: number;
  activeBooks: number;
}

interface RecentActivity {
  id: string;
  eventType: string;
  bookId: string;
  bookTitle?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  eventData?: Record<string, unknown>;
}

const AnalyticsPage: React.FC = () => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [keyMetrics, setKeyMetrics] = useState<KeyMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch global metrics data
      const globalResponse = await fetch(`/api/metrics/global?timeRange=${timeRange}`);
      if (!globalResponse.ok) {
        throw new Error('Failed to fetch global metrics');
      }
      const globalData = await globalResponse.json();

      // Calculate paragraph edit statistics from real data
      let avgParagraphEdits = 0;
      let minParagraphEdits = 0;
      let maxParagraphEdits = 0;
      
      try {
        const paragraphStatsResponse = await fetch(`/api/metrics/paragraph-stats`);
        if (paragraphStatsResponse.ok) {
          const paragraphStats = await paragraphStatsResponse.json();
          avgParagraphEdits = paragraphStats.avgEdits || 0;
          minParagraphEdits = paragraphStats.minEdits || 0;
          maxParagraphEdits = paragraphStats.maxEdits || 0;
        }
      } catch (error) {
        console.warn('Failed to fetch paragraph statistics:', error);
      }
      
      // Transform the data to match our key metrics structure - using only real data
      const transformedMetrics: KeyMetrics = {
        // Paragraph edit statistics from real data
        avgParagraphEdits,
        minParagraphEdits,
        maxParagraphEdits,
        
        // Audio generation metrics from real data
        totalAudioTime: globalData.totalAudioGenerated || 0,
        totalAudioGenerated: globalData.totalAudioGenerated || 0,
        
        // Bulk edits metrics from real data
        totalBulkEditsApplied: globalData.totalBulkFixes || 0,
        totalWordsFixed: globalData.totalBulkFixes || 0,
        
        // General activity metrics from real data
        totalBooks: globalData.totalBooks || 0,
        totalTextEdits: globalData.totalTextEdits || 0,
        totalCorrections: globalData.totalCorrections || 0,
        activeBooks: globalData.activeBooks || 0,
      };

      setKeyMetrics(transformedMetrics);

      // Fetch recent activity events - only use real data
      try {
        const activityResponse = await fetch(`/api/metrics/events/recent?limit=10`);
        if (activityResponse.ok) {
          const activityData = await activityResponse.json();
          setRecentActivity(activityData);
        } else {
          console.warn('Recent events API not available:', activityResponse.status);
          setRecentActivity([]);
        }
      } catch (activityError) {
        console.warn('Failed to fetch recent activity:', activityError);
        setRecentActivity([]);
      }

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

          {/* Key Metrics Dashboard */}
          {keyMetrics && (
            <Fade in={!!keyMetrics} timeout={1000}>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Paragraph Edits Statistics */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      height: '100%'
                    }}
                  >
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                      📝 Paragraph Edits
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                        {keyMetrics.avgParagraphEdits.toFixed(1)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Average edits per paragraph
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Min: {keyMetrics.minParagraphEdits}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Max: {keyMetrics.maxParagraphEdits}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                {/* Total Audio Time */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                      height: '100%'
                    }}
                  >
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                      🎵 Audio Generated
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                        {Math.floor(keyMetrics.totalAudioTime / 3600)}h {Math.floor((keyMetrics.totalAudioTime % 3600) / 60)}m
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Total audio time generated
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 2 }}>
                        {keyMetrics.totalAudioGenerated} audio files
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* Bulk Edits Applied */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                      height: '100%'
                    }}
                  >
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: theme.palette.warning.main }}>
                      🔧 Bulk Edits
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                        {keyMetrics.totalBulkEditsApplied.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Bulk edits applied
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 2 }}>
                        {keyMetrics.totalWordsFixed.toLocaleString()} words fixed
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* General Activity - Recent Actions Feed */}
                <Grid item xs={12} md={6} lg={6}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                      height: '400px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: theme.palette.info.main }}>
                      📊 Recent Activity
                    </Typography>
                    <Box sx={{ flex: 1, overflow: 'auto', mt: 2 }}>
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity) => {
                          const getActivityIcon = (eventType: string) => {
                            switch (eventType) {
                              case 'AUDIO_GENERATION_SUCCESS': return '🎵';
                              case 'BULK_FIX_APPLIED': return '🔧';
                              case 'EPUB_PARSING_SUCCESS': return '📚';
                              case 'TEXT_EDIT': return '✏️';
                              case 'CORRECTION_APPLIED': return '📝';
                              default: return '⚡';
                            }
                          };
                          
                          const getActivityLabel = (eventType: string) => {
                            switch (eventType) {
                              case 'AUDIO_GENERATION_SUCCESS': return 'Audio Generated';
                              case 'BULK_FIX_APPLIED': return 'Bulk Fix Applied';
                              case 'EPUB_PARSING_SUCCESS': return 'EPUB Parsed';
                              case 'TEXT_EDIT': return 'Text Edited';
                              case 'CORRECTION_APPLIED': return 'Correction Applied';
                              default: return eventType.replace(/_/g, ' ');
                            }
                          };
                          
                          const getActivityContext = (activity: RecentActivity) => {
                            const eventData = activity.eventData || {};
                            
                            if (activity.eventType === 'TEXT_EDIT') {
                              return eventData.editedContent ? `"${eventData.editedContent}"` : null;
                            }
                            
                            // For other paragraph-based activities, show page and paragraph info
                            if (eventData.pageNumber && eventData.paragraphId) {
                              const paragraphId = typeof eventData.paragraphId === 'string' ? eventData.paragraphId : String(eventData.paragraphId);
                              return `Page ${eventData.pageNumber}, Paragraph ${paragraphId.substring(0, 8)}...`;
                            }
                            
                            if (eventData.pageNumber) {
                              return `Page ${eventData.pageNumber}`;
                            }
                            
                            return null;
                          };
                          
                          const formatTimestamp = (timestamp: string) => {
                            const date = new Date(timestamp);
                            const now = new Date();
                            const diffMs = now.getTime() - date.getTime();
                            const diffMins = Math.floor(diffMs / (1000 * 60));
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            
                            if (diffMins < 1) return 'Just now';
                            if (diffMins < 60) return `${diffMins}m ago`;
                            if (diffHours < 24) return `${diffHours}h ago`;
                            return date.toLocaleDateString();
                          };
                          
                          return (
                            <Box
                              key={activity.id}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: 2,
                                mb: 1,
                                borderRadius: 2,
                                background: alpha(theme.palette.background.paper, 0.7),
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                '&:hover': {
                                  background: alpha(theme.palette.background.paper, 0.9)
                                }
                              }}
                            >
                              <Typography sx={{ fontSize: '1.2em', mr: 2 }}>
                                {getActivityIcon(activity.eventType)}
                              </Typography>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                  {getActivityLabel(activity.eventType)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  {activity.bookTitle || `Book ${activity.bookId}`}
                                </Typography>
                                {getActivityContext(activity) && (
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary" 
                                    sx={{ 
                                      display: 'block',
                                      fontStyle: activity.eventType === 'TEXT_EDIT' ? 'italic' : 'normal',
                                      opacity: 0.8
                                    }}
                                  >
                                    {getActivityContext(activity)}
                                  </Typography>
                                )}
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                {formatTimestamp(activity.timestamp)}
                              </Typography>
                            </Box>
                          );
                        })
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No recent activity
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Fade>
          )}

          {/* Summary Section */}
          {keyMetrics && (
            <Fade in timeout={1200}>
              <Paper
                elevation={2}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  mb: 4
                }}
              >
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                  📈 Key Performance Insights
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      <strong>Editing Efficiency:</strong> On average, paragraphs require {keyMetrics.avgParagraphEdits.toFixed(1)} edits before completion, 
                      with a range from {keyMetrics.minParagraphEdits} to {keyMetrics.maxParagraphEdits} edits.
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      <strong>Audio Production:</strong> Generated {Math.floor(keyMetrics.totalAudioTime / 3600)}h {Math.floor((keyMetrics.totalAudioTime % 3600) / 60)}m 
                      of audio content across {keyMetrics.totalAudioGenerated} files.
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      <strong>Bulk Processing:</strong> Applied {keyMetrics.totalBulkEditsApplied.toLocaleString()} bulk edits, 
                      fixing approximately {keyMetrics.totalWordsFixed.toLocaleString()} words across all books.
                    </Typography>
                    <Typography variant="body1">
                      <strong>Overall Activity:</strong> Processed {keyMetrics.totalBooks} books with {keyMetrics.totalTextEdits.toLocaleString()} text edits 
                      and {keyMetrics.totalCorrections.toLocaleString()} corrections. Currently {keyMetrics.activeBooks} books are active.
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Fade>
          )}

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

export default AnalyticsPage;
