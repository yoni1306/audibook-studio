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

      // Fetch real book metrics from the API
      const response = await fetch(`/api/analytics/books?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch book metrics');
      }

      const bookMetricsData = await response.json();
      
      // Convert API response to BookMetrics format
      const books: BookMetrics[] = bookMetricsData.map((book: any) => ({
        bookId: book.bookId,
        totalTextEdits: book.totalTextEdits,
        totalAudioGenerated: book.totalAudioGenerated,
        totalBulkFixes: book.totalBulkFixes,
        totalCorrections: book.totalCorrections,
        avgProcessingTime: book.avgProcessingTime,
        completionPercentage: book.completionPercentage,
        lastActivity: new Date(book.lastActivity),
      }));

      setBookMetrics(books);
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
