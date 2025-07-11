'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Grid,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridSortModel, GridToolbar } from '@mui/x-data-grid';
import Link from 'next/link';
import { useApiClient } from '@hooks/useApiClient';

// Force dynamic rendering to prevent build-time pre-rendering
export const dynamic = 'force-dynamic';

interface TextCorrection {
  id: string;
  originalWord: string;
  correctedWord: string;
  sentenceContext: string;
  fixType: string | null;
  createdAt: string;
  bookId: string;
  bookTitle: string;
  book: {
    id: string;
    title: string;
    author: string | null;
  };
  location: {
    pageId: string;
    pageNumber: number;
    paragraphId: string;
    paragraphIndex: number;
  };
}

interface PaginationModel {
  page: number;
  pageSize: number;
}

export default function CorrectionsPage() {
  const apiClient = useApiClient();
  const [corrections, setCorrections] = useState<TextCorrection[]>([]);
  const [totalCorrections, setTotalCorrections] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixTypes, setFixTypes] = useState<string[]>([]);

  // Filters
  const [originalWordFilter, setOriginalWordFilter] = useState('');
  const [correctedWordFilter, setCorrectedWordFilter] = useState('');
  const [fixTypeFilter, setFixTypeFilter] = useState('');
  const [bookTitleFilter, setBookTitleFilter] = useState('');

  // Pagination and sorting
  const [paginationModel, setPaginationModel] = useState<PaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([{
    field: 'createdAt',
    sort: 'desc',
  }]);

  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: apiError } = await apiClient.books.getAllCorrections({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        sortBy: (sortModel[0]?.field as 'createdAt' | 'originalWord' | 'correctedWord') || 'createdAt',
        sortOrder: sortModel[0]?.sort || 'desc',
        filters: {
          originalWord: originalWordFilter || undefined,
          correctedWord: correctedWordFilter || undefined,
          fixType: fixTypeFilter || undefined,
          bookTitle: bookTitleFilter || undefined,
        },
      });

      if (apiError) {
        throw new Error(`API Error: ${apiError}`);
      }

      // Enhanced response validation
      if (data && typeof data === 'object') {
        // Handle both old and new API response structures
        const corrections = Array.isArray(data.corrections) ? data.corrections : 
                          Array.isArray(data) ? data : [];
        const totalCount = typeof data.totalCount === 'number' ? data.totalCount : 
                          corrections.length;
        
        setCorrections(corrections);
        setTotalCorrections(totalCount);
      } else {
        // Fallback for unexpected response format
        setCorrections([]);
        setTotalCorrections(0);
      }
    } catch (err) {
      console.error('Error fetching corrections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch corrections');
      // Set empty state on error
      setCorrections([]);
      setTotalCorrections(0);
    } finally {
      setLoading(false);
    }
  }, [
    apiClient,
    originalWordFilter,
    correctedWordFilter,
    fixTypeFilter,
    bookTitleFilter,
    paginationModel,
    sortModel,
  ]);

  const fetchFixTypes = useCallback(async () => {
    try {
      const { data, error: apiError } = await apiClient.client.GET('/books/fix-types');

      if (apiError) {
        console.error('Error fetching fix types:', apiError);
        return;
      }

      if (data && Array.isArray(data.fixTypes)) {
        setFixTypes(data.fixTypes);
      } else {
        // Fallback to empty array if response is unexpected
        setFixTypes([]);
      }
    } catch (err) {
      console.error('Error fetching fix types:', err);
      setFixTypes([]); // Ensure we have a fallback
    }
  }, [apiClient]);

  useEffect(() => {
    fetchFixTypes();
  }, [fetchFixTypes]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  const clearFilters = () => {
    setOriginalWordFilter('');
    setCorrectedWordFilter('');
    setFixTypeFilter('');
    setBookTitleFilter('');
    // Clear previous errors on retry
    setError(null);
  };

  // Helper functions
  const detectTextDirection = (text: string): 'ltr' | 'rtl' => {
    // Check for Hebrew characters using Unicode range
    const hebrewPattern = /[\u0590-\u05FF]/;
    const arabicPattern = /[\u0600-\u06FF]/;
    
    // If text contains Hebrew or Arabic characters, it's RTL
    if (hebrewPattern.test(text) || arabicPattern.test(text)) {
      return 'rtl';
    }
    
    return 'ltr';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'originalWord',
      headerName: 'Original Word',
      width: 150,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Chip
              label={params.value}
              color="error"
              variant="outlined"
              size="small"
              sx={{
                direction: isRTL ? 'rtl' : 'ltr',
                fontFamily: 'monospace',
                '& .MuiChip-label': {
                  direction: isRTL ? 'rtl' : 'ltr',
                  textAlign: isRTL ? 'right' : 'left',
                  unicodeBidi: 'embed',
                },
              }}
            />
          </Box>
        );
      },
    },
    {
      field: 'correctedWord',
      headerName: 'Corrected Word',
      width: 150,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Chip
              label={params.value}
              color="success"
              variant="outlined"
              size="small"
              sx={{
                direction: isRTL ? 'rtl' : 'ltr',
                fontFamily: 'monospace',
                '& .MuiChip-label': {
                  direction: isRTL ? 'rtl' : 'ltr',
                  textAlign: isRTL ? 'right' : 'left',
                  unicodeBidi: 'embed',
                },
              }}
            />
          </Box>
        );
      },
    },
    {
      field: 'sentenceContext',
      headerName: 'Context',
      width: 350,
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              height: '100%', 
              width: '100%', 
              py: 1,
              px: 0.5,
              minHeight: '80px'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                direction: isRTL ? 'rtl' : 'ltr',
                textAlign: isRTL ? 'right' : 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                lineHeight: '1.6',
                width: '100%',
                unicodeBidi: 'embed',
                fontSize: '0.875rem',
                color: 'text.primary',
                maxHeight: 'none',
                overflow: 'visible',
              }}
            >
              {params.value}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'fixType',
      headerName: 'Fix Type',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const fixType = params.value || 'unknown';
        
        // Color mapping for different fix types
        const getChipColor = (type: string) => {
          if (type.includes('niqqud')) return 'secondary';
          if (type.includes('hebrew')) return 'primary';
          if (type.includes('punctuation')) return 'info';
          if (type.includes('spelling')) return 'warning';
          if (type === 'manual') return 'default';
          return 'default';
        };
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Chip
              label={fixType.replace(/_/g, ' ')}
              color={getChipColor(fixType)}
              variant="outlined"
              size="small"
              sx={{
                textTransform: 'capitalize',
                fontWeight: 500,
              }}
            />
          </Box>
        );
      },
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 180,
      renderCell: (params) => {
        const correction = params.row;
        const pageNumber = correction.location.pageNumber;
        const paragraphIndex = correction.location.paragraphIndex;

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Typography variant="body2" color="text.primary">
              Page {pageNumber}, Paragraph {paragraphIndex + 1}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'bookTitle',
      headerName: 'Book',
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Link
            href={`/books/${params.row.book.id}`}
            style={{
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                '&:hover': {
                  textDecoration: 'underline',
                  color: 'primary.main',
                },
              }}
            >
              {params.value}
            </Typography>
          </Link>
        </Box>
      ),
    },
    {
      field: 'ttsModel',
      headerName: 'TTS Model',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Typography variant="body2" color={params.value ? 'text.primary' : 'text.secondary'}>
            {params.value || 'N/A'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'ttsVoice',
      headerName: 'TTS Voice',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Typography variant="body2" color={params.value ? 'text.primary' : 'text.secondary'}>
            {params.value || 'N/A'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Typography variant="body2">
            {formatDate(params.value)}
          </Typography>
        </Box>
      ),
    },
  ];

  const transformedCorrections = corrections.map((correction) => ({
    ...correction,
    id: correction.id,
  }));

  return (
    <Box sx={{ maxWidth: '1800px', mx: 'auto', p: 3 }}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Text Corrections
      </Typography>

      {/* Stats */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Paper elevation={1} sx={{ p: 2, textAlign: 'center', minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Total Corrections
            </Typography>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
              {totalCorrections.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🔍 Filters & Search
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
              <TextField
                fullWidth
                label="Original Word"
                value={originalWordFilter}
                onChange={(e) => setOriginalWordFilter(e.target.value)}
                size="small"
              />
            </Box>
            <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
              <TextField
                fullWidth
                label="Corrected Word"
                value={correctedWordFilter}
                onChange={(e) => setCorrectedWordFilter(e.target.value)}
                size="small"
              />
            </Box>
            <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Fix Type</InputLabel>
                <Select
                  value={fixTypeFilter}
                  label="Fix Type"
                  onChange={(e) => setFixTypeFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {fixTypes.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
              <TextField
                fullWidth
                label="Book Title"
                value={bookTitleFilter}
                onChange={(e) => setBookTitleFilter(e.target.value)}
                size="small"
              />
            </Box>
          </Box>
          <Button
            variant="outlined"
            onClick={clearFilters}
            startIcon={<span>🗑️</span>}
          >
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ height: 'auto', minHeight: 600, width: '100%', overflow: 'auto' }}>
              <DataGrid
                rows={transformedCorrections}
                columns={columns}
                loading={loading}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                rowCount={totalCorrections}
                paginationMode="server"
                sortingMode="server"
                sortModel={sortModel}
                onSortModelChange={setSortModel}
                pageSizeOptions={[10, 25, 50, 100]}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
                  },
                }}
                getRowHeight={() => 'auto'}
                sx={{
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    padding: '16px 12px',
                    lineHeight: '1.5',
                    minHeight: '80px',
                    maxHeight: 'none',
                    overflow: 'visible',
                  },
                  '& .MuiDataGrid-row': {
                    maxHeight: 'none !important',
                  },
                  '& .MuiDataGrid-cell--textLeft': {
                    justifyContent: 'flex-start',
                  },
                  '& .MuiDataGrid-cell--textCenter': {
                    justifyContent: 'center',
                  },
                  '& .MuiDataGrid-row:hover': {
                    backgroundColor: '#f8f9fa',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    borderBottom: '2px solid rgba(224, 224, 224, 1)',
                  },
                  '& .MuiDataGrid-columnHeader': {
                    fontWeight: 600,
                  },
                  '& .MuiDataGrid-virtualScroller': {
                    backgroundColor: 'white',
                    overflow: 'visible',
                  },
                  '& .MuiDataGrid-main': {
                    overflow: 'visible',
                  },
                  '& .MuiDataGrid-footerContainer': {
                    borderTop: '2px solid rgba(224, 224, 224, 1)',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}