import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import { useApiClient } from '../../hooks/useApiClient';
import { createLogger } from '../utils/logger';
import ExpandableCorrectionsView from '../components/corrections/ExpandableCorrectionsView';

const logger = createLogger('CorrectionsPage');



export default function CorrectionsPage() {
  const apiClient = useApiClient();
  const [fixTypes, setFixTypes] = useState<string[]>([]);
  const [originalWordFilter, setOriginalWordFilter] = useState('');
  const [fixTypeFilter, setFixTypeFilter] = useState('');
  const [bookTitleFilter, setBookTitleFilter] = useState('');

  const fetchFixTypes = useCallback(async () => {
    try {
      const { data, error: apiError } = await apiClient.client.GET('/books/fix-types');

      if (apiError) {
        logger.error('Error fetching fix types:', apiError);
        return;
      }

      if (data && Array.isArray(data.fixTypes)) {
        setFixTypes(data.fixTypes);
      } else {
        // Fallback to empty array if response is unexpected
        setFixTypes([]);
      }
    } catch (err) {
      logger.error('Error fetching fix types:', err);
      setFixTypes([]); // Ensure we have a fallback
    }
  }, [apiClient]);

  useEffect(() => {
    fetchFixTypes();
  }, [fetchFixTypes]);









  return (
    <Box sx={{ maxWidth: '1800px', mx: 'auto', p: 3 }}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Text Corrections
      </Typography>



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

        </CardContent>
      </Card>

      {/* Results */}
      <ExpandableCorrectionsView
        originalWordFilter={originalWordFilter}
        fixTypeFilter={fixTypeFilter}
        bookIdFilter={bookTitleFilter}
      />
    </Box>
  );
}