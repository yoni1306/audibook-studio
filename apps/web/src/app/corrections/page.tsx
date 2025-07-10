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
  paragraph: {
    id: string;
    page: {
      id: string;
      pageNumber: number;
      book: {
        id: string;
        title: string;
        ttsModel?: string;
        ttsVoice?: string;
      };
    };
    orderIndex: number;
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

      if (data) {
        setCorrections(data.corrections || []);
        setTotalCorrections(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Error fetching corrections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch corrections');
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

      if (data) {
        setFixTypes(data.fixTypes || []);
      }
    } catch (err) {
      console.error('Error fetching fix types:', err);
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
      field: 'sentenceContext',
      headerName: 'Context',
      width: 350,
      renderCell: (params) => {
        const context = params.value as string;
        const originalWord = params.row.originalWord;
        const correctedWord = params.row.correctedWord;
        
        // Highlight the original and corrected words in context
        const highlightedContext = context
          .replace(
            new RegExp(`\\b${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
            `<mark style="background-color: #ffeb3b; padding: 2px 4px; border-radius: 3px;">${originalWord}</mark>`
          )
          .replace(
            new RegExp(`\\b${correctedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
            `<mark style="background-color: #c8e6c9; padding: 2px 4px; border-radius: 3px;">${correctedWord}</mark>`
          );

        return (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              height: '100%', 
              width: '100%',
              direction: /[\u0590-\u05FF]/.test(context) ? 'rtl' : 'ltr',
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                lineHeight: 1.4,
              }}
              title={context}
              dangerouslySetInnerHTML={{ __html: highlightedContext }}
            />
          </Box>
        );
      },
    },
    {
      field: 'originalWord',
      headerName: 'Original',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#d32f2f',
              fontWeight: 'medium',
              direction: /[\u0590-\u05FF]/.test(params.value) ? 'rtl' : 'ltr',
            }}
          >
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'correctedWord',
      headerName: 'Corrected',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#2e7d32',
              fontWeight: 'medium',
              direction: /[\u0590-\u05FF]/.test(params.value) ? 'rtl' : 'ltr',
            }}
          >
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'fixType',
      headerName: 'Fix Type',
      width: 130,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Typography variant="body2" color={params.value ? 'text.primary' : 'text.secondary'}>
            {params.value || 'N/A'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 180,
      renderCell: (params) => {
        const pageNumber = params.row.paragraph?.page?.pageNumber;
        const paragraphIndex = params.row.paragraph?.orderIndex;
        const bookId = params.row.paragraph?.page?.book?.id;
        
        if (!pageNumber || paragraphIndex === undefined || !bookId) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
              <Typography variant="body2" color="text.secondary">
                N/A
              </Typography>
            </Box>
          );
        }

        return (
          <Link 
            href={`/books/${bookId}?page=${pageNumber}&paragraph=${paragraphIndex}`}
            style={{ 
              color: '#1976d2', 
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
          >
            Page: {pageNumber}, Paragraph: {paragraphIndex}
          </Link>
        );
      },
    },
    {
      field: 'bookTitle',
      headerName: 'Book',
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          <Link href={`/books/${params.row.bookId}`} style={{ textDecoration: 'none', width: '100%' }}>
            <Typography
              variant="body2"
              color="primary"
              sx={{
                '&:hover': { textDecoration: 'underline' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
              title={params.value}
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
            <Box sx={{ height: 600, width: '100%' }}>
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
                getRowHeight={() => 100}
                sx={{
                  '& .MuiDataGrid-cell': {
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: '52px',
                    borderBottom: '1px solid rgba(224, 224, 224, 1)',
                  },
                  '& .MuiDataGrid-row': {
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.04)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      '&:hover': {
                        backgroundColor: 'rgba(25, 118, 210, 0.12)',
                      },
                    },
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
                  },
                  '& .MuiDataGrid-footerContainer': {
                    borderTop: '2px solid rgba(224, 224, 224, 1)',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  },
                  '& .MuiDataGrid-cell--withRenderer': {
                    padding: 0,
                  },
                  '& .MuiDataGrid-cell--withRenderer > div': {
                    width: '100%',
                    height: '100%',
                    padding: '12px',
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