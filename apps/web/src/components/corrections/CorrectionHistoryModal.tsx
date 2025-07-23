import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  History as HistoryIcon,
  AccessTime as TimeIcon,
  VolumeUp as VolumeIcon,
} from '@mui/icons-material';
import { useApiClient } from '../../hooks/useApiClient';
import {
  CorrectionHistoryItem,
  GetWordCorrectionHistoryRequest,
  GetWordCorrectionHistoryResponse,
} from '@audibook/api-client';

interface CorrectionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  originalWord: string;
  bookId?: string;
}

export const CorrectionHistoryModal: React.FC<CorrectionHistoryModalProps> = ({
  open,
  onClose,
  originalWord,
  bookId,
}) => {
  const apiClient = useApiClient();
  const [history, setHistory] = useState<CorrectionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Fetch correction history when modal opens
  useEffect(() => {
    if (open && originalWord) {
      fetchHistory();
    }
  }, [open, originalWord, bookId]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const request: GetWordCorrectionHistoryRequest = {
        originalWord,
        ...(bookId && { bookId }),
      };

      const response = await apiClient.books.getWordCorrectionHistory(request);
      
      if (response.error) {
        throw new Error('Failed to fetch correction history');
      }
      
      const data = response.data as GetWordCorrectionHistoryResponse;
      setHistory(data.history);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching correction history:', err);
      setError('Failed to load correction history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFixTypeColor = (fixType: string | null) => {
    if (!fixType) return 'default';
    
    switch (fixType.toLowerCase()) {
      case 'vowelization':
        return 'primary';
      case 'disambiguation':
        return 'secondary';
      case 'spelling':
        return 'error';
      case 'grammar':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon />
          <Typography variant="h6">
            Correction History for "{originalWord}"
          </Typography>
        </Box>
        {total > 0 && (
          <Typography variant="body2" color="text.secondary">
            {total} correction{total !== 1 ? 's' : ''} found
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && history.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No correction history found for this word.
            </Typography>
          </Box>
        )}

        {!loading && !error && history.length > 0 && (
          <List>
            {history.map((item, index) => (
              <React.Fragment key={item.id}>
                <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                        >
                          {originalWord} → {item.correctedWord}
                        </Typography>
                        {item.fixType && (
                          <Chip
                            label={item.fixType}
                            color={getFixTypeColor(item.fixType) as any}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        {/* Context */}
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Context:</strong> {item.context.sentence}
                        </Typography>
                        
                        {/* TTS Info */}
                        {(item.tts.model || item.tts.voice) && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <VolumeIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {item.tts.model}
                              {item.tts.voice && ` (${item.tts.voice})`}
                            </Typography>
                          </Box>
                        )}
                        
                        {/* Timestamp */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TimeIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(item.createdAt)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < history.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
