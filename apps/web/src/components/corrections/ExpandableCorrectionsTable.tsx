import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Link,
  Paper,
  Divider,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridSortModel,
  GridToolbar,
  GridRowParams,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { ExpandMore, ChevronRight } from '@mui/icons-material';
import { useApiClient } from '../../../hooks/useApiClient';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ExpandableCorrectionsTable');

interface AggregatedCorrection {
  originalWord: string;
  latestCorrection: string;
  fixCount: number;
  latestFixType: string | null;
  latestCreatedAt: string;
  bookInfo: {
    id: string;
    title: string;
    author: string | null;
  };
  latestLocation: {
    pageId: string;
    pageNumber: number;
    paragraphId: string;
    paragraphIndex: number;
  };
  ttsInfo: {
    modelName: string | null;
    voiceName: string | null;
  };
}

interface CorrectionHistoryItem {
  id: string;
  correctedWord: string;
  sentenceContext: string;
  fixType: string | null;
  createdAt: string;
  bookInfo: {
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
  ttsInfo: {
    modelName: string | null;
    voiceName: string | null;
  };
}

interface PaginationModel {
  page: number;
  pageSize: number;
}

interface ExpandableCorrectionsTableProps {
  bookIdFilter?: string;
  originalWordFilter?: string;
  fixTypeFilter?: string;
}

interface ExpandedRowData {
  originalWord: string;
  history: CorrectionHistoryItem[];
  loading: boolean;
}

export default function ExpandableCorrectionsTable({
  bookIdFilter,
  originalWordFilter,
  fixTypeFilter,
}: ExpandableCorrectionsTableProps) {
  const apiClient = useApiClient();
  const [corrections, setCorrections] = useState<AggregatedCorrection[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, ExpandedRowData>>({});

  // Pagination and sorting
  const [paginationModel, setPaginationModel] = useState<PaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([{
    field: 'latestCreatedAt',
    sort: 'desc',
  }]);

  const fetchAggregatedCorrections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: apiError } = await apiClient.books.getAggregatedCorrections({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        sortBy: (sortModel[0]?.field as 'originalWord' | 'latestCorrection' | 'fixCount' | 'latestCreatedAt') || 'latestCreatedAt',
        sortOrder: sortModel[0]?.sort || 'desc',
        filters: {
          bookId: bookIdFilter || undefined,
          originalWord: originalWordFilter || undefined,
          fixType: fixTypeFilter || undefined,
        },
      });

      if (apiError) {
        throw new Error(`API Error: ${apiError}`);
      }

      if (data && typeof data === 'object') {
        const corrections = Array.isArray(data.corrections) ? data.corrections : [];
        const totalCount = typeof data.totalCount === 'number' ? data.totalCount : corrections.length;
        
        setCorrections(corrections);
        setTotalCount(totalCount);
      } else {
        setCorrections([]);
        setTotalCount(0);
      }
    } catch (err) {
      logger.error('Error fetching aggregated corrections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch aggregated corrections');
      setCorrections([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    apiClient,
    bookIdFilter,
    originalWordFilter,
    fixTypeFilter,
    paginationModel,
    sortModel,
  ]);

  const fetchWordHistory = useCallback(async (originalWord: string) => {
    // Check if already loading or loaded
    if (expandedRows[originalWord]?.loading || expandedRows[originalWord]?.history) {
      return;
    }

    // Set loading state
    setExpandedRows(prev => ({
      ...prev,
      [originalWord]: { originalWord, history: [], loading: true }
    }));

    try {
      const { data, error: apiError } = await apiClient.books.getWordCorrectionHistory({
        originalWord,
        bookId: bookIdFilter || undefined,
      });

      if (apiError) {
        throw new Error(`API Error: ${apiError}`);
      }

      const history = data?.history || [];
      
      setExpandedRows(prev => ({
        ...prev,
        [originalWord]: { originalWord, history, loading: false }
      }));
    } catch (err) {
      logger.error('Error fetching word history:', err);
      setExpandedRows(prev => ({
        ...prev,
        [originalWord]: { originalWord, history: [], loading: false }
      }));
    }
  }, [apiClient, bookIdFilter]);

  useEffect(() => {
    fetchAggregatedCorrections();
  }, [fetchAggregatedCorrections]);

  const handleRowClick = (params: GridRowParams) => {
    const originalWord = params.row.originalWord;
    
    if (expandedRows[originalWord]) {
      // Collapse row
      const newExpandedRows = { ...expandedRows };
      delete newExpandedRows[originalWord];
      setExpandedRows(newExpandedRows);
    } else {
      // Expand row and fetch history
      fetchWordHistory(originalWord);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChipColor = (type: string | null) => {
    if (!type) return 'default';
    switch (type.toLowerCase()) {
      case 'grammar': return 'primary';
      case 'spelling': return 'secondary';
      case 'punctuation': return 'success';
      case 'style': return 'warning';
      case 'vocabulary': return 'info';
      default: return 'default';
    }
  };

  const detectTextDirection = (text: string): 'ltr' | 'rtl' => {
    const rtlChars = /[\u0590-\u083F]|[\u08A0-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/;
    return rtlChars.test(text) ? 'rtl' : 'ltr';
  };

  const columns: GridColDef[] = [
    {
      field: 'expand',
      headerName: '',
      width: 50,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton size="small" onClick={() => handleRowClick(params)}>
          {expandedRows[params.row.originalWord] ? 
            <KeyboardArrowDown /> : 
            <KeyboardArrowRight />
          }
        </IconButton>
      ),
    },
    {
      field: 'originalWord',
      headerName: 'Original Word',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box
          sx={{
            direction: detectTextDirection(params.value),
            textAlign: detectTextDirection(params.value) === 'rtl' ? 'right' : 'left',
            fontWeight: 600,
            color: 'primary.main',
          }}
        >
          {params.value}
        </Box>
      ),
    },
    {
      field: 'latestCorrection',
      headerName: 'Latest Correction',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box
          sx={{
            direction: detectTextDirection(params.value),
            textAlign: detectTextDirection(params.value) === 'rtl' ? 'right' : 'left',
            color: 'success.main',
            fontWeight: 500,
          }}
        >
          {params.value}
        </Box>
      ),
    },
    {
      field: 'fixCount',
      headerName: 'Fix Count',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      field: 'latestFixType',
      headerName: 'Latest Fix Type',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Chip
            label={params.value}
            size="small"
            color={getChipColor(params.value)}
            variant="filled"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            N/A
          </Typography>
        )
      ),
    },
    {
      field: 'bookTitle',
      headerName: 'Book',
      flex: 1,
      minWidth: 200,
      valueGetter: (params) => params.row.bookInfo?.title || 'Unknown',
      renderCell: (params: GridRenderCellParams) => (
        <Link
          component="button"
          variant="body2"
          onClick={(e) => {
            e.stopPropagation();
            // Navigate to book details if needed
          }}
          sx={{ textAlign: 'left', textDecoration: 'none' }}
        >
          {params.row.bookInfo?.title || 'Unknown'}
          {params.row.bookInfo?.author && (
            <Typography variant="caption" display="block" color="text.secondary">
              by {params.row.bookInfo.author}
            </Typography>
          )}
        </Link>
      ),
    },
    {
      field: 'latestCreatedAt',
      headerName: 'Latest Fix Date',
      width: 160,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {formatDate(params.value)}
        </Typography>
      ),
    },
  ];

  const renderExpandedRow = (originalWord: string) => {
    const expandedData = expandedRows[originalWord];
    
    if (!expandedData) return null;

    if (expandedData.loading) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography>Loading correction history...</Typography>
        </Box>
      );
    }

    if (expandedData.history.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">No correction history found.</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Correction History for "{originalWord}"
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Correction</TableCell>
              <TableCell>Context</TableCell>
              <TableCell>Fix Type</TableCell>
              <TableCell>Book</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expandedData.history.map((item, index) => (
              <TableRow key={`${item.id}-${index}`}>
                <TableCell>
                  <Box
                    sx={{
                      direction: detectTextDirection(item.correctedWord),
                      textAlign: detectTextDirection(item.correctedWord) === 'rtl' ? 'right' : 'left',
                      color: 'success.main',
                      fontWeight: 500,
                    }}
                  >
                    {item.correctedWord}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      direction: detectTextDirection(item.sentenceContext),
                      textAlign: detectTextDirection(item.sentenceContext) === 'rtl' ? 'right' : 'left',
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.sentenceContext}
                  >
                    {item.sentenceContext}
                  </Box>
                </TableCell>
                <TableCell>
                  {item.fixType ? (
                    <Chip
                      label={item.fixType}
                      size="small"
                      color={getChipColor(item.fixType)}
                      variant="filled"
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      N/A
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {item.bookInfo?.title || 'Unknown'}
                  </Typography>
                  {item.bookInfo?.author && (
                    <Typography variant="caption" color="text.secondary">
                      by {item.bookInfo.author}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    Page {item.location?.pageNumber || 'N/A'}
                    <br />
                    Para {item.location?.paragraphIndex || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(item.createdAt)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };

  // Transform corrections data to include expanded rows
  const transformedCorrections = corrections.flatMap((correction) => {
    const mainRow = { ...correction, id: correction.originalWord };
    const expandedData = expandedRows[correction.originalWord];
    
    if (expandedData) {
      return [
        mainRow,
        {
          id: `${correction.originalWord}-expanded`,
          originalWord: correction.originalWord,
          isExpandedRow: true,
        },
      ];
    }
    
    return [mainRow];
  });

  return (
    <Box sx={{ height: 'auto', minHeight: 600, width: '100%' }}>
      <DataGrid
        rows={transformedCorrections}
        columns={columns}
        loading={loading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        rowCount={totalCount}
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
        getRowHeight={(params) => {
          if (params.model.isExpandedRow) {
            const expandedData = expandedRows[params.model.originalWord];
            if (expandedData?.loading) return 80;
            if (expandedData?.history?.length === 0) return 80;
            return Math.min(400, 120 + (expandedData?.history?.length || 0) * 60);
          }
          return 80;
        }}
        onRowClick={handleRowClick}
        sx={{
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: '#f8f9fa',
            },
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            padding: '12px',
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            borderBottom: '2px solid rgba(224, 224, 224, 1)',
          },
          '& .MuiDataGrid-columnHeader': {
            fontWeight: 600,
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '2px solid rgba(224, 224, 224, 1)',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          },
        }}
        renderRow={(props) => {
          if (props.row.isExpandedRow) {
            return (
              <div key={props.row.id} style={{ gridColumn: '1 / -1' }}>
                <Paper elevation={0} sx={{ bgcolor: 'grey.50' }}>
                  {renderExpandedRow(props.row.originalWord)}
                </Paper>
              </div>
            );
          }
          return <div {...props} />;
        }}
      />
    </Box>
  );
}
