'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../../utils/api';

// Force dynamic rendering to prevent build-time pre-rendering
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Paper,
  Alert,
  Grid,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar, GridSortModel } from '@mui/x-data-grid';

interface Correction {
  id: string;
  paragraphId: string;
  bookId: string;
  originalWord: string;
  correctedWord: string;
  sentenceContext: string;
  fixType: string;
  ttsModel: string | null;
  ttsVoice: string | null;
  createdAt: string;
  updatedAt: string;
  bookTitle: string;
  location: {
    pageId: string;
    pageNumber: number;
    paragraphId: string;
    paragraphIndex: number;
  };
}

export default function CorrectionsPage() {
  // State
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [fixTypes, setFixTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCorrections, setTotalCorrections] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'createdAt', sort: 'desc' }]);

  // Filter states
  const [originalWordFilter, setOriginalWordFilter] = useState('');
  const [correctedWordFilter, setCorrectedWordFilter] = useState('');
  const [fixTypeFilter, setFixTypeFilter] = useState('');
  const [bookTitleFilter, setBookTitleFilter] = useState('');

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
    // Use a static format that won't differ between server and client
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // API Functions
  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/books/all-corrections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: paginationModel.page + 1, // API expects 1-based page numbers
          pageSize: paginationModel.pageSize,
          sortBy: sortModel[0]?.field || 'createdAt',
          sortOrder: sortModel[0]?.sort || 'desc',
          filters: {
            originalWord: originalWordFilter || undefined,
            correctedWord: correctedWordFilter || undefined,
            fixType: fixTypeFilter || undefined,
            bookTitle: bookTitleFilter || undefined,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && Array.isArray(data.corrections)) {
        setCorrections(data.corrections);
        setTotalCorrections(data.total || 0);
      } else {
        setCorrections([]);
        setTotalCorrections(0);
      }
    } catch (err) {
      console.error('Error fetching corrections:', err);
      setError('Failed to load corrections. Please try again.');
      setCorrections([]);
      setTotalCorrections(0);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, sortModel, originalWordFilter, correctedWordFilter, fixTypeFilter, bookTitleFilter]);

  const fetchFixTypes = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/books/fix-types`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      // The backend returns { fixTypes: [...] }, so we need to access the fixTypes property
      setFixTypes(data.fixTypes || []);
    } catch (err) {
      console.error('Error fetching fix types:', err);
      // Set an empty array as fallback
      setFixTypes([]);
    }
  }, []);

  // Effects
  useEffect(() => {
    // Initialize component: load static data and set mounted state - runs once on mount
    fetchFixTypes();   // Load fix types for filter dropdown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array since these functions never change (they have empty deps)

  useEffect(() => {
    // Load corrections after filters/pagination changes
    fetchCorrections();
  }, [fetchCorrections]);

  const clearFilters = () => {
    setOriginalWordFilter('');
    setCorrectedWordFilter('');
    setFixTypeFilter('');
    setBookTitleFilter('');
    setPaginationModel({ page: 0, pageSize: 25 });
  };

  const columns: GridColDef[] = [
    {
      field: 'originalWord',
      headerName: 'Original Word',
      width: 150,
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
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
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
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
      field: 'fixType',
      headerName: 'Fix Type',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
          {params.value ? (
            <Chip
              label={params.value}
              color="primary"
              variant="outlined"
              size="small"
            />
          ) : (
            <Typography variant="body2" color="text.secondary">—</Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'sentenceContext',
      headerName: 'Context',
      width: 300,
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Box
            sx={{
              width: '100%',
              maxHeight: '80px',
              overflowY: 'auto',
              padding: '8px',
              direction: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
              fontSize: '0.875rem',
              lineHeight: 1.4,
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #e0e0e0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '2px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#c1c1c1',
                borderRadius: '2px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: '#a8a8a8',
              },
            }}
          >
            {params.value || 'No context available'}
          </Box>
        );
      },
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 180,
      renderCell: (params) => {
        const { pageId, pageNumber, paragraphId, paragraphIndex } = params.row.location;
        
        if (!pageId || !paragraphId || pageNumber === undefined || paragraphIndex === undefined) {
          return (
            <Typography variant="body2" color="text.secondary">
              N/A
            </Typography>
          );
        }
        
        return (
          <Link
            href={`/books/${params.row.bookId}/pages/${pageId}#paragraph-${paragraphIndex}`}
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
