'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Paper,
} from '@mui/material';
import { createLogger } from '../../../../utils/logger';

const logger = createLogger('ParagraphDelimiterModal');

export interface ParagraphPreview {
  chapterNumber: number;
  orderIndex: number;
  content: string;
  characterCount: number;
  wordCount: number;
  isNew: boolean;
  originalParagraphId?: string;
}

export interface ParagraphDelimiterModalProps {
  open: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  currentParagraphCount: number;
  onDelimiterApplied: () => void;
}

export default function ParagraphDelimiterModal({
  open,
  onClose,
  bookId,
  bookTitle,
  currentParagraphCount,
  onDelimiterApplied,
}: ParagraphDelimiterModalProps) {
  const [delimiter, setDelimiter] = useState('');
  const [previewData, setPreviewData] = useState<{
    originalParagraphCount: number;
    newParagraphCount: number;
    previewParagraphs: ParagraphPreview[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handlePreview = async () => {
    if (!delimiter.trim()) {
      setError('Please enter a delimiter');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      logger.info('Previewing paragraph delimiter', { bookId, delimiter });
      
      const response = await fetch('http://localhost:3333/api/books/paragraph-delimiter/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId,
          delimiter: delimiter.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to preview delimiter');
      }

      const data = await response.json();
      setPreviewData(data);
      setCurrentPage(1); // Reset to first page when new preview data is loaded
      
      logger.info('Preview successful', {
        originalCount: data.originalParagraphCount,
        newCount: data.newParagraphCount,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to preview delimiter';
      setError(errorMessage);
      logger.error('Preview failed', { error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!previewData) return;

    setApplying(true);
    setError(null);

    try {
      logger.info('Applying paragraph delimiter', { bookId, delimiter });
      
      const response = await fetch('http://localhost:3333/api/books/paragraph-delimiter/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId,
          delimiter: delimiter.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to apply delimiter');
      }

      const data = await response.json();
      
      logger.info('Delimiter applied successfully', {
        originalCount: data.originalParagraphCount,
        newCount: data.newParagraphCount,
      });

      // Close modal and notify parent
      onDelimiterApplied();
      onClose();
      
      // Reset state
      setDelimiter('');
      setPreviewData(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply delimiter';
      setError(errorMessage);
      logger.error('Apply failed', { error: errorMessage });
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    if (!applying) {
      setDelimiter('');
      setPreviewData(null);
      setError(null);
      onClose();
    }
  };

  const renderPreviewParagraphs = () => {
    if (!previewData) return null;

    // Show all paragraphs with pagination for better performance
    const paragraphsPerPage = 20;
    const totalPages = Math.ceil(previewData.previewParagraphs.length / paragraphsPerPage);
    
    const startIndex = (currentPage - 1) * paragraphsPerPage;
    const endIndex = startIndex + paragraphsPerPage;
    const currentParagraphs = previewData.previewParagraphs.slice(startIndex, endIndex);

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h3">
            Preview Results
          </Typography>
          <Chip 
            label={`${previewData.originalParagraphCount} → ${previewData.newParagraphCount} paragraphs`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ ml: 1 }}
          />
        </Box>

        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Showing all {previewData.previewParagraphs.length} paragraphs that will be created 
          (Page {currentPage} of {totalPages})
        </Typography>

        {/* Legend for color coding */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" color="textSecondary" sx={{ mr: 1 }}>
            Length indicators:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, backgroundColor: '#4caf50', borderRadius: '50%' }} />
            <Typography variant="caption">Within limits</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, backgroundColor: '#ff9800', borderRadius: '50%' }} />
            <Typography variant="caption">Below minimum</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, backgroundColor: '#d32f2f', borderRadius: '50%' }} />
            <Typography variant="caption">Exceeds maximum</Typography>
          </Box>
        </Box>

        {currentParagraphs.map((paragraph, index) => {
          // Color coding based on paragraph limits
          const getCountColor = (charCount: number, wordCount: number) => {
            // These should match the limits from paragraph-limits.json
            const minChars = 1700;
            const maxChars = 8000;
            const minWords = 300;
            const maxWords = 1800;
            
            if (charCount > maxChars || wordCount > maxWords) {
              return '#d32f2f'; // Red for exceeding limits
            } else if (charCount < minChars && wordCount < minWords) {
              return '#ff9800'; // Orange for below minimum
            } else {
              return '#4caf50'; // Green for within limits
            }
          };
          
          const countColor = getCountColor(paragraph.characterCount, paragraph.wordCount);
          
          return (
            <Paper 
              key={startIndex + index} 
              elevation={1} 
              sx={{ 
                p: 2, 
                mb: 1, 
                backgroundColor: '#f8f8f8',
                border: '1px solid #e0e0e0'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="textSecondary">
                  Paragraph {paragraph.orderIndex} (Chapter {paragraph.chapterNumber})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={`${paragraph.characterCount} chars`}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      fontSize: '0.7rem',
                      height: '20px',
                      color: countColor,
                      borderColor: countColor
                    }}
                  />
                  <Chip
                    label={`${paragraph.wordCount} words`}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      fontSize: '0.7rem',
                      height: '20px',
                      color: countColor,
                      borderColor: countColor
                    }}
                  />
                </Box>
              </Box>
              <Typography variant="body2" sx={{ 
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
                direction: 'rtl',
                textAlign: 'right',
              }}>
                {paragraph.content}
              </Typography>
            </Paper>
          );
        })}

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 1 }}>
            <Button
              size="small"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Typography variant="body2" sx={{ mx: 2 }}>
              Page {currentPage} of {totalPages}
            </Typography>
            <Button
              size="small"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        Paragraph Delimiter Configuration
        <div style={{ fontSize: '0.875rem', color: '#666', fontWeight: 'normal' }}>
          {bookTitle} • Current: {currentParagraphCount} paragraphs
        </div>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="textSecondary" paragraph>
            Enter a delimiter to re-divide all paragraphs in the book. This will merge all existing paragraphs into one text, 
            then split it by your delimiter to create new paragraphs.
          </Typography>
          
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Warning:</strong> This action will completely restructure your book&apos;s paragraphs. 
            All existing paragraph divisions will be lost, and all audio will be reset and need to be regenerated.
          </Alert>
        </Box>

        <TextField
          fullWidth
          label="Delimiter"
          placeholder="Enter delimiter (e.g., \\n for newline, *** for three asterisks)"
          value={delimiter}
          onChange={(e) => setDelimiter(e.target.value)}
          disabled={loading || applying}
          helperText="Examples: \\n (newline), \\t (tab), *** (literal text), /\\d+\\./g (regex). The book will be split wherever this delimiter appears."
          sx={{ mb: 2 }}
        />

        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            onClick={handlePreview}
            disabled={!delimiter.trim() || loading || applying}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Previewing...' : 'Preview Changes'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {previewData && (
          <>
            <Divider sx={{ my: 2 }} />
            {renderPreviewParagraphs()}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleClose} 
          disabled={applying}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={!previewData || applying}
          startIcon={applying ? <CircularProgress size={16} /> : null}
        >
          {applying ? 'Applying...' : `Apply Changes (${previewData?.newParagraphCount || 0} paragraphs)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
