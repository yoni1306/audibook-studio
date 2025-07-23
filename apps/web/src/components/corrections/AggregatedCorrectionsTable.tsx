import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Collapse,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridSortModel,
  GridRowParams,
  GridActionsCellItem,
} from '@mui/x-data-grid';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  Book as BookIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useApiClient } from '../../hooks/useApiClient';
import {
  AggregatedCorrection,
  GetAggregatedCorrectionsRequest,
  GetAggregatedCorrectionsResponse,
} from '@audibook/api-client';
import { CorrectionHistoryModal } from './CorrectionHistoryModal';

interface AggregatedCorrectionsTableProps {
  bookId?: string;
}

interface TableFilters {
  originalWord: string;
  fixType: string;
}

export const AggregatedCorrectionsTable: React.FC<AggregatedCorrectionsTableProps> = ({
  bookId,
}) => {
  const apiClient = useApiClient();
  const [corrections, setCorrections] = useState<AggregatedCorrection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  // Pagination and sorting state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'fixCount', sort: 'desc' },
  ]);
  
  // Filter state
  const [filters, setFilters] = useState<TableFilters>({
    originalWord: '',
    fixType: '',
  });
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedOriginalWord, setSelectedOriginalWord] = useState<string>('');

  // Fetch corrections data
  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const request: GetAggregatedCorrectionsRequest = {
        page: paginationModel.page + 1, // API uses 1-based pagination
        limit: paginationModel.pageSize,
        sortBy: sortModel[0]?.field as any || 'fixCount',
        sortOrder: sortModel[0]?.sort || 'desc',
        filters: {
          ...(bookId && { bookId }),
          ...(filters.originalWord && { originalWord: filters.originalWord }),
          ...(filters.fixType && { fixType: filters.fixType }),
        },
      };

      const response = await apiClient.books.getAggregatedCorrections(request);
      
      if (response.error) {
        throw new Error('Failed to fetch aggregated corrections');
      }
      
      const data = response.data as GetAggregatedCorrectionsResponse;
      setCorrections(data.corrections);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching aggregated corrections:', err);
      setError('Failed to load corrections data');
    } finally {
      setLoading(false);
    }
  }, [apiClient, paginationModel, sortModel, filters, bookId]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  // Handle row expansion
  const handleRowToggle = (originalWord: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(originalWord)) {
      newExpanded.delete(originalWord);
    } else {
      newExpanded.add(originalWord);
    }
    setExpandedRows(newExpanded);
  };

  // Handle history modal
  const handleShowHistory = (originalWord: string) => {
    setSelectedOriginalWord(originalWord);
    setHistoryModalOpen(true);
  };

  // Handle filter changes
  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPaginationModel(prev => ({ ...prev, page: 0 })); // Reset to first page
  };

  // Define columns
  const columns: GridColDef[] = [
    {
      field: 'expand',
      headerName: '',
      width: 50,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => handleRowToggle(params.row.originalWord)}
        >
          {expandedRows.has(params.row.originalWord) ? (
            <ExpandLessIcon />
          ) : (
            <ExpandMoreIcon />
          )}
        </IconButton>
      ),
    },
    {
      field: 'originalWord',
      headerName: 'Original Word',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
          {params.value}
        </Box>
      ),
    },
    {
      field: 'latestCorrection',
      headerName: 'Latest Correction',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box sx={{ fontFamily: 'monospace', color: 'success.main' }}>
          {params.value}
        </Box>
      ),
    },
    {
      field: 'fixCount',
      headerName: 'Fix Count',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          color="primary"
          variant="outlined"
          size="small"
        />
      ),
    },
    {
      field: 'latestFixType',
      headerName: 'Fix Type',
      width: 120,
      renderCell: (params) => (
        params.value ? (
          <Chip
            label={params.value}
            color="secondary"
            variant="filled"
            size="small"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            N/A
          </Typography>
        )
      ),
    },
    {
      field: 'book',
      headerName: 'Book',
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BookIcon fontSize="small" color="action" />
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {params.value.title}
            </Typography>
            {params.value.author && (
              <Typography variant="caption" color="text.secondary">
                by {params.value.author}
              </Typography>
            )}
          </Box>
        </Box>
      ),
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title={`Paragraph ${params.value.paragraphIndex + 1}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LocationIcon fontSize="small" color="action" />
            <Typography variant="body2">
              p.{params.value.pageNumber}
            </Typography>
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'lastCorrectedAt',
      headerName: 'Last Corrected',
      width: 140,
      type: 'dateTime',
      valueGetter: (params) => new Date(params.value),
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.row.lastCorrectedAt).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 80,
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          key="history"
          icon={<HistoryIcon />}
          label="View History"
          onClick={() => handleShowHistory(params.row.originalWord)}
        />,
      ],
    },
  ];

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Aggregated Text Corrections
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Search Original Word"
            value={filters.originalWord}
            onChange={(e) => handleFilterChange('originalWord', e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Fix Type</InputLabel>
            <Select
              value={filters.fixType}
              label="Fix Type"
              onChange={(e) => handleFilterChange('fixType', e.target.value)}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="vowelization">Vowelization</MenuItem>
              <MenuItem value="disambiguation">Disambiguation</MenuItem>
              <MenuItem value="spelling">Spelling</MenuItem>
              <MenuItem value="grammar">Grammar</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Data Grid */}
      <Paper>
        <DataGrid
          rows={corrections}
          columns={columns}
          getRowId={(row) => row.originalWord}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          pageSizeOptions={[10, 25, 50, 100]}
          rowCount={total}
          paginationMode="server"
          sortingMode="server"
          disableRowSelectionOnClick
          autoHeight
          sx={{
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
            },
          }}
        />
      </Paper>

      {/* Expanded Row Content */}
      {corrections.map((correction) => (
        <Collapse
          key={`expand-${correction.originalWord}`}
          in={expandedRows.has(correction.originalWord)}
        >
          <Paper sx={{ mt: 1, p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Context & Details
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2">
                <strong>Sentence Context:</strong> {correction.context.sentence}
              </Typography>
              {correction.tts.model && (
                <Typography variant="body2">
                  <strong>TTS Model:</strong> {correction.tts.model}
                  {correction.tts.voice && ` (${correction.tts.voice})`}
                </Typography>
              )}
            </Box>
          </Paper>
        </Collapse>
      ))}

      {/* History Modal */}
      <CorrectionHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        originalWord={selectedOriginalWord}
        bookId={bookId}
      />
    </Box>
  );
};
