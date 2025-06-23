'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Paper,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp, GridToolbar } from '@mui/x-data-grid';

interface Correction {
  id: string;
  originalWord: string;
  correctedWord: string;
  fixType: string | null;
  sentenceContext: string;
  createdAt: string;
  updatedAt: string;
  bookTitle: string;
  bookId: string;
  paragraph: {
    id: string;
    orderIndex: number;
    chapterNumber: number;
  };
}

interface Book {
  id: string;
  title: string;
}

interface GetAllCorrectionsResponse {
  corrections: Correction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function CorrectionsPage() {
  // State
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [fixTypes, setFixTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCorrections, setTotalCorrections] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Filters
  const [originalWordFilter, setOriginalWordFilter] = useState('');
  const [correctedWordFilter, setCorrectedWordFilter] = useState('');
  const [fixTypeFilter, setFixTypeFilter] = useState('');
  const [bookFilter, setBookFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  const truncateText = (text: string | undefined | null, maxLength = 100): string => {
    // Use a consistent approach that works on both server and client
    const safeText = text?.toString() || '';
    return typeof window !== 'undefined' ? safeText.slice(0, maxLength) + (safeText.length > maxLength ? '...' : '') : '';
  };

  // API Functions
  const fetchCorrections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: (page + 1).toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        ...(originalWordFilter && { originalWord: originalWordFilter }),
        ...(correctedWordFilter && { correctedWord: correctedWordFilter }),
        ...(fixTypeFilter && { fixType: fixTypeFilter }),
        ...(bookFilter && { bookId: bookFilter }),
      });

      const response = await fetch(`http://localhost:3333/api/books/all-corrections?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: page + 1,
          pageSize,
          sortBy,
          sortOrder,
          ...(originalWordFilter && { originalWord: originalWordFilter }),
          ...(correctedWordFilter && { correctedWord: correctedWordFilter }),
          ...(fixTypeFilter && { fixType: fixTypeFilter }),
          ...(bookFilter && { bookId: bookFilter }),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GetAllCorrectionsResponse = await response.json();
      setCorrections(data.corrections);
      setTotalCorrections(data.total);
    } catch (err) {
      console.error('Error fetching corrections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch corrections');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, originalWordFilter, correctedWordFilter, fixTypeFilter, bookFilter]);

  const fetchBooks = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3333/api/books');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Handle new structured response format
      setBooks(data.books || data || []);
    } catch (err) {
      console.error('Error fetching books:', err);
    }
  }, []);

  const fetchFixTypes = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3333/api/books/fix-types');
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
    fetchBooks();      // Load books for filter dropdown
    fetchFixTypes();   // Load fix types for filter dropdown
    setMounted(true);  // Set mounted state to prevent hydration errors
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array since these functions never change (they have empty deps)

  useEffect(() => {
    // Load corrections after filters/pagination changes
    fetchCorrections();
  }, [fetchCorrections]);

  // Only render content when mounted
  if (!mounted) {
    return null;
  }

  const clearFilters = () => {
    setOriginalWordFilter('');
    setCorrectedWordFilter('');
    setFixTypeFilter('');
    setBookFilter('');
    setPage(0);
  };

  const columns: GridColDef[] = [
    {
      field: 'originalWord',
      headerName: 'Original Word',
      width: 150,
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
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
        );
      },
    },
    {
      field: 'fixType',
      headerName: 'Fix Type',
      width: 120,
      renderCell: (params) => (
        params.value ? (
          <Chip
            label={params.value}
            color="primary"
            variant="outlined"
            size="small"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        )
      ),
    },
    {
      field: 'sentenceContext',
      headerName: 'Context',
      width: 350,
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Typography
            variant="body2"
            sx={{
              direction: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              lineHeight: '1.4',
              width: '100%',
              unicodeBidi: 'embed',
            }}
          >
            {params.value}
          </Typography>
        );
      },
    },
    {
      field: 'bookTitle',
      headerName: 'Book',
      width: 200,
      renderCell: (params) => (
        <Link href={`/books/${params.row.bookId}`} style={{ textDecoration: 'none' }}>
          <Typography
            variant="body2"
            color="primary"
            sx={{
              '&:hover': { textDecoration: 'underline' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truncateText(params.value, 25)}
          </Typography>
        </Link>
      ),
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 150,
      renderCell: (params) => (
        <Link
          href={`/books/${params.row.bookId}/chapters/${params.row.paragraph.chapterNumber}#paragraph-${params.row.paragraph.orderIndex}`}
          style={{ textDecoration: 'none' }}
        >
          <Typography
            variant="body2"
            color="primary"
            sx={{ '&:hover': { textDecoration: 'underline' } }}
          >
            Ch.{params.row.paragraph.chapterNumber}, P.{params.row.paragraph.orderIndex}
          </Typography>
        </Link>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {formatDate(params.value)}
        </Typography>
      ),
    },
  ];

  const rows: GridRowsProp = corrections.map((correction) => ({
    id: correction.id,
    originalWord: correction.originalWord,
    correctedWord: correction.correctedWord,
    fixType: correction.fixType,
    sentenceContext: correction.sentenceContext,
    bookTitle: correction.bookTitle,
    bookId: correction.bookId,
    paragraph: correction.paragraph,
    createdAt: correction.createdAt,
  }));

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              📝 Text Corrections
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Manage and review all text corrections made during audiobook processing
            </Typography>
          </Box>
          <Paper sx={{ p: 2, textAlign: 'center', minWidth: 150 }}>
            <Typography variant="body2" color="text.secondary">
              Total Corrections
            </Typography>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
              {totalCorrections.toLocaleString()}
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🔍 Filters & Search
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Original Word"
                value={originalWordFilter}
                onChange={(e) => setOriginalWordFilter(e.target.value)}
                placeholder="Search original word..."
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Corrected Word"
                value={correctedWordFilter}
                onChange={(e) => setCorrectedWordFilter(e.target.value)}
                placeholder="Search corrected word..."
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Fix Type</InputLabel>
                <Select
                  value={fixTypeFilter}
                  label="Fix Type"
                  onChange={(e) => setFixTypeFilter(e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {fixTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Book</InputLabel>
                <Select
                  value={bookFilter}
                  label="Book"
                  onChange={(e) => setBookFilter(e.target.value)}
                >
                  <MenuItem value="">All Books</MenuItem>
                  {Array.isArray(books) && books.map((book) => (
                    <MenuItem key={book.id} value={book.id}>
                      {book.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
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
              {mounted && (
                <DataGrid
                  rows={rows}
                  columns={columns}
                  loading={loading}
                  pagination
                  paginationMode="server"
                  rowCount={totalCorrections}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={(newPage) => setPage(newPage)}
                  onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
                  pageSizeOptions={[10, 25, 50, 100]}
                  sortingMode="server"
                  onSortModelChange={(model) => {
                    if (model.length > 0) {
                      setSortBy(model[0].field);
                      setSortOrder(model[0].sort || 'desc');
                    }
                  }}
                  sortModel={[{ field: sortBy, sort: sortOrder }]}
                  slots={{ toolbar: GridToolbar }}
                  slotProps={{
                    toolbar: {
                      showQuickFilter: true,
                      quickFilterProps: { debounceMs: 500 },
                    },
                  }}
                  rowHeight={100}
                  sx={{
                    '& .MuiDataGrid-cell': {
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      padding: '12px 8px',
                      lineHeight: '1.4',
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: '#f8f9fa',
                    },
                  }}
                  disableRowSelectionOnClick
                  autoHeight={false}
                />
              )}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
