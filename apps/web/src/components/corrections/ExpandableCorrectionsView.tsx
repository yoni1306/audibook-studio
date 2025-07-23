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
  TableContainer,
  TablePagination,
  TableSortLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ExpandMore, ChevronRight } from '@mui/icons-material';
import { useApiClient } from '../../../hooks/useApiClient';
import { createLogger } from '../../utils/logger';
import type {
  AggregatedCorrection,
  CorrectionHistoryItem,
} from '@audibook/api-client';

const logger = createLogger('ExpandableCorrectionsView');

interface ExpandableCorrectionsViewProps {
  bookIdFilter?: string;
  originalWordFilter?: string;
  fixTypeFilter?: string;
}

interface ExpandedRowData {
  originalWord: string;
  history: CorrectionHistoryItem[];
  loading: boolean;
}

type SortField = 'originalWord' | 'latestCorrection' | 'fixCount' | 'lastCorrectedAt';
type SortOrder = 'asc' | 'desc';

export default function ExpandableCorrectionsView({
  bookIdFilter,
  originalWordFilter,
  fixTypeFilter,
}: ExpandableCorrectionsViewProps) {
  const apiClient = useApiClient();
  const [corrections, setCorrections] = useState<AggregatedCorrection[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, ExpandedRowData>>({});

  // Pagination and sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>('lastCorrectedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchAggregatedCorrections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: apiError } = await apiClient.books.getAggregatedCorrections({
        page: page + 1,
        limit: rowsPerPage,
        sortBy: sortField,
        sortOrder: sortOrder,
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
    page,
    rowsPerPage,
    sortField,
    sortOrder,
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

  const handleRowClick = (originalWord: string) => {
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

  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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

  const renderExpandedRow = (originalWord: string) => {
    const expandedData = expandedRows[originalWord];
    
    if (!expandedData) return null;

    if (expandedData.loading) {
      return (
        <TableRow>
          <TableCell colSpan={7} sx={{ p: 0 }}>
            <Collapse in={true} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                <CircularProgress size={24} />
                <Typography sx={{ mt: 1 }}>Loading correction history...</Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      );
    }

    if (expandedData.history.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} sx={{ p: 0 }}>
            <Collapse in={true} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Typography color="text.secondary">No correction history found.</Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      );
    }

    return (
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0 }}>
          <Collapse in={true} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
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
                          {'Unknown'} {/* bookInfo is Record<string, never> in generated types */}
                        </Typography>
                        {/* Author info not available in current API response structure */}
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
          </Collapse>
        </TableCell>
      </TableRow>
    );
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50} />
              <TableCell>
                <TableSortLabel
                  active={sortField === 'originalWord'}
                  direction={sortField === 'originalWord' ? sortOrder : 'asc'}
                  onClick={() => handleSort('originalWord')}
                >
                  Original Word
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'latestCorrection'}
                  direction={sortField === 'latestCorrection' ? sortOrder : 'asc'}
                  onClick={() => handleSort('latestCorrection')}
                >
                  Latest Correction
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'fixCount'}
                  direction={sortField === 'fixCount' ? sortOrder : 'asc'}
                  onClick={() => handleSort('fixCount')}
                >
                  Fix Count
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Latest Fix Type</TableCell>
              <TableCell>Book</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'lastCorrectedAt'}
                  direction={sortField === 'lastCorrectedAt' ? sortOrder : 'asc'}
                  onClick={() => handleSort('lastCorrectedAt')}
                >
                  Latest Fix Date
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', p: 4 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>Loading corrections...</Typography>
                </TableCell>
              </TableRow>
            ) : corrections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', p: 4 }}>
                  <Typography color="text.secondary">No corrections found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              corrections.flatMap((correction) => {
                const isExpanded = !!expandedRows[correction.originalWord];
                return [
                  <TableRow
                    key={correction.originalWord}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(correction.originalWord)}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {isExpanded ? <ExpandMore /> : <ChevronRight />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          direction: detectTextDirection(correction.originalWord),
                          textAlign: detectTextDirection(correction.originalWord) === 'rtl' ? 'right' : 'left',
                          fontWeight: 600,
                          color: 'primary.main',
                        }}
                      >
                        {correction.originalWord}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          direction: detectTextDirection(correction.latestCorrection),
                          textAlign: detectTextDirection(correction.latestCorrection) === 'rtl' ? 'right' : 'left',
                          color: 'success.main',
                          fontWeight: 500,
                        }}
                      >
                        {correction.latestCorrection}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={correction.fixCount}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {correction.latestFixType ? (
                        <Chip
                          label={correction.latestFixType}
                          size="small"
                          color={getChipColor(correction.latestFixType)}
                          variant="filled"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Navigate to book details if needed
                        }}
                        sx={{ textAlign: 'left', textDecoration: 'none' }}
                      >
                        {'Unknown'} {/* bookInfo is Record<string, never> in generated types */}
                        {/* Author info not available in current API response structure */}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(correction.lastCorrectedAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>,
                  ...(isExpanded ? [renderExpandedRow(correction.originalWord)] : [])
                ];
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={totalCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}
