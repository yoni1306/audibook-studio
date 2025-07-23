import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Collapse,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Spellcheck as SpellcheckIcon,
  AutoFixHigh as AutoFixHighIcon,
  TextFields as TextFieldsIcon,
  FormatQuote as FormatQuoteIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';
import {
  AggregatedCorrection,
  CorrectionHistoryItem,
} from '@audibook/api-client';

interface AggregatedCorrectionsTableProps {
  bookId: string;
}

type SortField = 'originalWord' | 'correctedWord' | 'fixCount' | 'fixType';
type SortOrder = 'asc' | 'desc';

interface TableFilters {
  originalWord: string;
  fixType: string;
}

interface ExpandedRowData {
  loading: boolean;
  history: CorrectionHistoryItem[] | null;
  error: string | null;
}

// Helper function to get fix type icon
const getFixTypeIcon = (fixType: string) => {
  switch (fixType) {
    case 'vowelization':
      return <SpellcheckIcon />;
    case 'disambiguation':
      return <AutoFixHighIcon />;
    case 'punctuation':
      return <TextFieldsIcon />;
    case 'sentence_break':
      return <FormatQuoteIcon />;
    default:
      return <UnfoldMoreIcon />;
  }
};

export const AggregatedCorrectionsTable: React.FC<AggregatedCorrectionsTableProps> = ({
  bookId,
}) => {
  // Suppress unused variable warning for bookId (will be used when API is integrated)
  void bookId;

  // Mock API client for now
  const apiClient = { 
    books: { 
      getWordCorrections: async () => ({ 
        data: { corrections: [] }, 
        error: null 
      }) 
    } 
  };
  
  const [corrections] = useState<AggregatedCorrection[]>([]);
  const [error] = useState<string | null>(null);
  const [total] = useState(0);
  const [loading] = useState(false);
  
  // Pagination and sorting state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>('fixCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Filter state
  const [filters, setFilters] = useState<TableFilters>({
    originalWord: '',
    fixType: '',
  });
  
  // Expanded rows state with history data
  const [expandedRows, setExpandedRows] = useState<Record<string, ExpandedRowData>>({});

  // Fetch word history for expanded rows
  const fetchWordHistory = useCallback(async (originalWord: string) => {
    // Check if already loading or loaded
    if (expandedRows[originalWord]?.loading || expandedRows[originalWord]?.history) {
      return;
    }

    // Set loading state
    setExpandedRows(prev => ({
      ...prev,
      [originalWord]: {
        loading: true,
        history: null,
        error: null,
      },
    }));

    try {
      const response = await apiClient.books.getWordCorrections();
      
      if (response.error) {
        throw new Error('Failed to load corrections');
      }

      const historyData = response.data.corrections || [];
      
      setExpandedRows(prev => ({
        ...prev,
        [originalWord]: {
          loading: false,
          history: historyData,
          error: null,
        },
      }));
    } catch (err) {
      setExpandedRows(prev => ({
        ...prev,
        [originalWord]: {
          loading: false,
          history: null,
          error: err instanceof Error ? err.message : 'Failed to load history',
        },
      }));
    }
  }, [apiClient, expandedRows]);

  // Handle row expansion
  const handleRowExpand = useCallback((originalWord: string) => {
    const isExpanded = expandedRows[originalWord]?.history !== undefined;
    
    if (isExpanded) {
      // Collapse row
      setExpandedRows(prev => {
        const newState = { ...prev };
        delete newState[originalWord];
        return newState;
      });
    } else {
      // Expand row and fetch history
      fetchWordHistory(originalWord);
    }
  }, [expandedRows, fetchWordHistory]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  // Handle filter changes
  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when filtering
  };

  // Handle pagination
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Render expanded row content
  const renderExpandedContent = (originalWord: string) => {
    const rowData = expandedRows[originalWord];
    
    if (!rowData) return null;

    if (rowData.loading) {
      return (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ ml: 1 }}>Loading correction history...</Typography>
        </Box>
      );
    }

    if (rowData.error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {rowData.error}
        </Alert>
      );
    }

    if (!rowData.history || rowData.history.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          No correction history found for this word.
        </Typography>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Correction History for "{originalWord}"
        </Typography>
        <Grid container spacing={2}>
          {rowData.history.map((item, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="subtitle2" color="primary">
                      {item.originalWord} → {item.correctedWord}
                    </Typography>
                    <Chip
                      size="small"
                      icon={getFixTypeIcon(item.fixType)}
                      label={item.fixType}
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    "{item.sentenceContext}"
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.createdAt).toLocaleDateString('he-IL')} • 
                    Chapter {(item as CorrectionHistoryItem & { paragraph?: { chapterNumber?: number } }).paragraph?.chapterNumber || 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ width: '100%', mb: 2 }}>
      {/* Filters */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="Search original word"
              value={filters.originalWord}
              onChange={(e) => handleFilterChange('originalWord', e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Fix Type</InputLabel>
              <Select
                value={filters.fixType}
                label="Fix Type"
                onChange={(e) => handleFilterChange('fixType', e.target.value)}
                startAdornment={<FilterListIcon sx={{ mr: 1, color: 'action.active' }} />}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="vowelization">Vowelization</MenuItem>
                <MenuItem value="disambiguation">Disambiguation</MenuItem>
                <MenuItem value="punctuation">Punctuation</MenuItem>
                <MenuItem value="sentence_break">Sentence Break</MenuItem>
                <MenuItem value="dialogue_marking">Dialogue Marking</MenuItem>
                <MenuItem value="expansion">Expansion</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Table */}
      <TableContainer>
        <Table stickyHeader>
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
                  active={sortField === 'correctedWord'}
                  direction={sortField === 'correctedWord' ? sortOrder : 'asc'}
                  onClick={() => handleSort('correctedWord')}
                >
                  Corrected Word
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'fixType'}
                  direction={sortField === 'fixType' ? sortOrder : 'asc'}
                  onClick={() => handleSort('fixType')}
                >
                  Fix Type
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === 'fixCount'}
                  direction={sortField === 'fixCount' ? sortOrder : 'asc'}
                  onClick={() => handleSort('fixCount')}
                >
                  Occurrences
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {corrections.map((correction) => {
              const isExpanded = expandedRows[correction.originalWord]?.history !== undefined;
              
              return (
                <React.Fragment key={correction.aggregationKey}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleRowExpand(correction.originalWord)}
                      >
                        {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {correction.originalWord}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary">
                        {correction.correctedWord}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={getFixTypeIcon(correction.fixType)}
                        label={correction.fixType}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {correction.fixCount}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        {renderExpandedContent(correction.originalWord)}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={total}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};
