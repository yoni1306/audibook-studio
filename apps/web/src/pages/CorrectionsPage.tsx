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
import { Link } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';

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
  ttsModel?: string;
  ttsVoice?: string;
}

interface PaginationModel {
  page: number;
  pageSize: number;
}



interface CorrectionsResponse {
  corrections: TextCorrection[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Helper function to detect text direction
function detectTextDirection(text: string): 'ltr' | 'rtl' {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return rtlChars.test(text) ? 'rtl' : 'ltr';
}

export default function CorrectionsPage() {
  const [corrections, setCorrections] = useState<TextCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<PaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedFixType, setSelectedFixType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [books, setBooks] = useState<Array<{ id: string; title: string }>>([]);
  const [fixTypes, setFixTypes] = useState<string[]>([]);

  const { apiClient } = useApiClient();

  const fetchCorrections = useCallback(async () => {
    if (!apiClient) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: (paginationModel.page + 1).toString(),
        limit: paginationModel.pageSize.toString(),
      });
      
      if (selectedBookId) params.append('bookId', selectedBookId);
      if (selectedFixType) params.append('fixType', selectedFixType);
      if (searchTerm) params.append('search', searchTerm);
      if (sortModel.length > 0) {
        params.append('sortBy', sortModel[0].field);
        params.append('sortOrder', sortModel[0].sort || 'asc');
      }
      
      const response = await apiClient.get<CorrectionsResponse>(`/api/corrections?${params}`);
      
      setCorrections(response.corrections || []);
      setTotalRows(response.total || 0);
    } catch (err) {
      console.error('Error fetching corrections:', err);
      setError('Failed to load corrections. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [apiClient, paginationModel, sortModel, selectedBookId, selectedFixType, searchTerm]);

  const fetchBooks = useCallback(async () => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient.get('/api/books');
      setBooks(response.books || []);
    } catch (err) {
      console.error('Error fetching books:', err);
    }
  }, [apiClient]);

  const fetchFixTypes = useCallback(async () => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient.get('/api/corrections/fix-types');
      setFixTypes(response.fixTypes || []);
    } catch (err) {
      console.error('Error fetching fix types:', err);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchBooks();
    fetchFixTypes();
  }, [fetchBooks, fetchFixTypes]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  const handlePaginationModelChange = (newModel: PaginationModel) => {
    setPaginationModel(newModel);
  };

  const handleSortModelChange = (newModel: GridSortModel) => {
    setSortModel(newModel);
  };

  const handleSearch = () => {
    setPaginationModel({ ...paginationModel, page: 0 });
  };

  const handleReset = () => {
    setSelectedBookId('');
    setSelectedFixType('');
    setSearchTerm('');
    setPaginationModel({ ...paginationModel, page: 0 });
  };

  const transformedCorrections = corrections.map((correction) => ({
    ...correction,
    id: correction.id,
    bookTitle: correction.book?.title || 'Unknown Book',
    bookAuthor: correction.book?.author || 'Unknown Author',
    pageNumber: correction.location?.pageNumber || 0,
    paragraphIndex: correction.location?.paragraphIndex || 0,
    createdAtFormatted: new Date(correction.createdAt).toLocaleDateString(),
  }));

  const columns: GridColDef[] = [
    {
      field: 'originalWord',
      headerName: 'Original Word',
      width: 150,
      renderCell: (params) => {
        const isRTL = detectTextDirection(params.value) === 'rtl';
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            height: '100%', 
            width: '100%', 
            direction: isRTL ? 'rtl' : 'ltr',
            textAlign: isRTL ? 'right' : 'left'
          }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'bold',
                color: 'error.main',
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
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            height: '100%', 
            width: '100%', 
            direction: isRTL ? 'rtl' : 'ltr',
            textAlign: isRTL ? 'right' : 'left'
          }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'bold',
                color: 'success.main',
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
          </Box>
        );
      },
    },
    {
      field: 'sentenceContext',
      headerName: 'Context',
      width: 400,
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
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value || 'Unknown'}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.75rem' }}
        />
      ),
    },
    {
      field: 'bookTitle',
      headerName: 'Book',
      width: 200,
      renderCell: (params) => {
        const row = params.row as TextCorrection & { bookTitle: string };
        return (
          <Link
            to={`/books/${row.bookId}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'primary.main',
                '&:hover': { textDecoration: 'underline' },
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              {params.value}
            </Typography>
          </Link>
        );
      },
    },
    {
      field: 'pageNumber',
      headerName: 'Page',
      width: 80,
      type: 'number',
    },
    {
      field: 'paragraphIndex',
      headerName: 'Paragraph',
      width: 100,
      type: 'number',
    },
    {
      field: 'createdAtFormatted',
      headerName: 'Date',
      width: 120,
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Text Corrections
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Review and manage text corrections across all books
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search corrections..."
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Book</InputLabel>
              <Select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                label="Book"
              >
                <MenuItem value="">All Books</MenuItem>
                {books.map((book) => (
                  <MenuItem key={book.id} value={book.id}>
                    {book.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Fix Type</InputLabel>
              <Select
                value={selectedFixType}
                onChange={(e) => setSelectedFixType(e.target.value)}
                label="Fix Type"
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
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleSearch}
                size="small"
                sx={{ minWidth: '80px' }}
              >
                Search
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
                size="small"
                sx={{ minWidth: '80px' }}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && corrections.length === 0 ? (
        <Card>
          <CardContent>
            <Typography>Loading corrections...</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ height: 'auto', minHeight: 600, width: '100%', overflow: 'auto' }}>
              <DataGrid
                rows={transformedCorrections}
                columns={columns}
                paginationModel={paginationModel}
                onPaginationModelChange={handlePaginationModelChange}
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                rowCount={totalRows}
                loading={loading}
                paginationMode="server"
                sortingMode="server"
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                }}
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
                    backgroundColor: '#f5f5f5',
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
                    backgroundColor: '#f5f5f5',
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
