import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  Refresh,
  Book,
} from '@mui/icons-material';
import { TimeRange } from '../../pages/AnalyticsPage';

interface BookMetrics {
  bookId: string;
  totalTextEdits: number;
  totalAudioGenerated: number;
  totalBulkFixes: number;
  totalCorrections: number;
  avgProcessingTime: number | null;
  completionPercentage: number;
  lastActivity: Date;
}

interface BookMetricsTableProps {
  timeRange: TimeRange;
}

export const BookMetricsTable: React.FC<BookMetricsTableProps> = ({ timeRange }) => {
  const [bookMetrics, setBookMetrics] = useState<BookMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, we'll fetch global metrics and simulate book-specific data
      // In a real implementation, you'd have an endpoint that returns all book metrics
      const response = await fetch(`/api/analytics/global?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch book metrics');
      }

      // This is a placeholder - in reality you'd have a dedicated endpoint
      // that returns individual book metrics
      const globalData = await response.json();
      
      // Simulate some book data for demonstration
      const simulatedBooks: BookMetrics[] = [
        {
          bookId: 'book-1',
          totalTextEdits: Math.floor(globalData.totalTextEdits * 0.4),
          totalAudioGenerated: Math.floor(globalData.totalAudioGenerated * 0.4),
          totalBulkFixes: Math.floor(globalData.totalBulkFixes * 0.3),
          totalCorrections: Math.floor(globalData.totalCorrections * 0.5),
          avgProcessingTime: globalData.avgProcessingTime,
          completionPercentage: 85.5,
          lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          bookId: 'book-2',
          totalTextEdits: Math.floor(globalData.totalTextEdits * 0.3),
          totalAudioGenerated: Math.floor(globalData.totalAudioGenerated * 0.3),
          totalBulkFixes: Math.floor(globalData.totalBulkFixes * 0.4),
          totalCorrections: Math.floor(globalData.totalCorrections * 0.3),
          avgProcessingTime: globalData.avgProcessingTime ? globalData.avgProcessingTime * 1.2 : null,
          completionPercentage: 62.3,
          lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          bookId: 'book-3',
          totalTextEdits: Math.floor(globalData.totalTextEdits * 0.3),
          totalAudioGenerated: Math.floor(globalData.totalAudioGenerated * 0.3),
          totalBulkFixes: Math.floor(globalData.totalBulkFixes * 0.3),
          totalCorrections: Math.floor(globalData.totalCorrections * 0.2),
          avgProcessingTime: globalData.avgProcessingTime ? globalData.avgProcessingTime * 0.8 : null,
          completionPercentage: 94.7,
          lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ];

      setBookMetrics(simulatedBooks);
    } catch (err) {
      console.error('Failed to fetch book metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load book metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookMetrics();
  }, [timeRange]);

  const formatProcessingTime = (time: number | null): string => {
    if (time === null) return 'N/A';
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getCompletionColor = (percentage: number): 'success' | 'warning' | 'error' => {
    if (percentage >= 90) return 'success';
    if (percentage >= 70) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} sx={{ mr: 2 }} />
        <Typography color="text.secondary">Loading book metrics...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={fetchBookMetrics}
            startIcon={<Refresh />}
          >
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (bookMetrics.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Book sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          No book metrics available for the selected time range
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Book ID</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Text Edits</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Audio Generated</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Bulk Fixes</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Corrections</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Avg Time</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>Completion</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Last Activity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {bookMetrics.map((book) => (
            <TableRow 
              key={book.bookId} 
              sx={{ 
                '&:hover': { backgroundColor: 'action.hover' },
                '&:last-child td, &:last-child th': { border: 0 }
              }}
            >
              <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                {book.bookId}
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {book.totalTextEdits.toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {book.totalAudioGenerated.toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {book.totalBulkFixes.toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {book.totalCorrections.toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {formatProcessingTime(book.avgProcessingTime)}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Chip 
                  label={`${book.completionPercentage.toFixed(1)}%`}
                  color={getCompletionColor(book.completionPercentage)}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" color="text.secondary">
                  {formatDate(book.lastActivity)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
