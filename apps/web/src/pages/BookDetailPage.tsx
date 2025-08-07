'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { createLogger } from '../utils/logger';
import { useApiClient } from '../../hooks/useApiClient';

// Components
import BookHeader from '../components/book/BookHeader';
import { BookWithDetails, BulkFixSuggestion, Paragraph } from '@audibook/api-client';
import AudioStats from '../components/book/AudioStats';
import BulkFixNotification from '../components/book/BulkFixNotification';
import ParagraphComponent from '../components/book/ParagraphComponent';
import BulkFixModal from '../components/book/BulkFixModal';
import SuccessModal from '../components/ui/SuccessModal';
import ErrorModal from '../components/ui/ErrorModal';
import RevertParagraphConfirmDialog from '../components/RevertParagraphConfirmDialog';

export default function BookDetailPage() {
  const { id: bookId } = useParams<{ id: string }>();
  
  // API client
  const apiClient = useApiClient();
  const [book, setBook] = useState<BookWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showBulkFixModal, setShowBulkFixModal] = useState(false);
  const [pendingBulkFix, setPendingBulkFix] = useState<{
    paragraphId: string;
    content: string;
    suggestions: BulkFixSuggestion[];
    audioRequested: boolean;
  } | null>(null);
  const [completedFilter, setCompletedFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [pageNumberFilter, setPageNumberFilter] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState({ title: '', message: '', showRetry: false, onRetry: undefined as (() => void) | undefined });
  const [showRevertConfirmModal, setShowRevertConfirmModal] = useState(false);
  const [pendingRevert, setPendingRevert] = useState<{ paragraphId: string; generateAudio: boolean } | null>(null);

  const isInitialLoad = useRef(true);

  // Create a logger instance for this component
  const logger = useMemo(() => createLogger('BookDetailPage'), []);

  // Helper function to show error modal
  const showError = useCallback((title: string, message: string, showRetry = false, onRetry?: () => void) => {
    setErrorMessage({ title, message, showRetry, onRetry });
    setShowErrorModal(true);
  }, []);

  const showSuccess = useCallback((title: string, message: string) => {
    setSuccessMessage({ title, message });
    setShowSuccessModal(true);
  }, []);

  // Filter paragraphs based on completion status and page number
  const filteredParagraphs = useMemo(() => {
    if (!book) return [];
    
    let paragraphs = book.paragraphs;
    
    // Filter by completion status
    switch (completedFilter) {
      case 'completed':
        paragraphs = paragraphs.filter(p => p.completed);
        break;
      case 'incomplete':
        paragraphs = paragraphs.filter(p => !p.completed);
        break;
      case 'all':
      default:
        // No filtering needed
        break;
    }
    
    // Filter by page number if specified
    if (pageNumberFilter.trim()) {
      const pageNum = parseInt(pageNumberFilter.trim(), 10);
      if (!isNaN(pageNum)) {
        paragraphs = paragraphs.filter(p => p.pageNumber === pageNum);
      }
    }
    
    return paragraphs;
  }, [book, completedFilter, pageNumberFilter]);

  // Add correlation ID generator for frontend
  function generateCorrelationId() {
    return `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const fetchBook = useCallback(async () => {
    if (!bookId) return; // Guard against undefined bookId
    
    const correlationId = generateCorrelationId();
    try {
      setError(null); // Clear any previous errors
      const { data, error } = await apiClient.books.getById(bookId);
      
      if (error) {
        // This is an actual error (500, network issues, etc.)
        setError(`Server error: ${error || 'An unexpected error occurred'}`);
        logger.error('Server error from API:', { error, correlationId });
        setBook(null);
        return;
      }
      
      if (!data) {
        setError('No data received from server');
        setBook(null);
        return;
      }
      
      // Handle API response structure
      if (data.found === false) {
        // Valid response but no data found
        setBook(null);
        setError(`Book not found: No book exists with ID "${bookId}"`);
      } else if (data.book) {
        // Book found
        setBook(data.book);
        setError(null); // Clear any previous errors
      } else {
        // Unexpected response structure
        setError('Unexpected response format from server');
        setBook(null);
      }
    } catch (error) {
      const errorMessage = 'Failed to connect to the server. Please check if the API server is running.';
      setError(errorMessage);
      setBook(null);
      logger.error('Error fetching book:', { error, correlationId });
      logger.error('Network error fetching book:', { error: error instanceof Error ? error.message : String(error), correlationId });
    } finally {
      if (isInitialLoad.current) {
        setLoading(false); // Only clear loading if it's the initial load
        isInitialLoad.current = false;
      }
    }
  }, [bookId, logger, apiClient]);

  useEffect(() => {
    if (bookId) {
      fetchBook(); // Initial fetch - loading will be cleared by isInitialLoad ref
    }
  }, [bookId, fetchBook]);

  // Refresh every 5 seconds to check audio status or if book is not ready
  useEffect(() => {
    const interval = setInterval(() => {
      if (book?.paragraphs.some((p) => p.audioStatus === 'GENERATING') || book?.status !== 'READY') {
        fetchBook(); // Don't show loading state for periodic refreshes
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [book, fetchBook]);

  // Early return if bookId is not available (after all hooks)
  if (!bookId) {
    return <div>Invalid book ID</div>;
  }

  const startEdit = (paragraph: Paragraph) => {
    setEditingId(paragraph.id);
    setEditContent(paragraph.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (paragraphId: string) => {
    setSaving(true);
    try {
      const { data: result, error } = await apiClient.books.updateParagraph(paragraphId, {
        content: editContent,
        generateAudio: false, // Don't generate audio when just saving text
      });

      if (!error && result) {
        // Check if there are bulk fix suggestions with actual counts > 0
        const hasSuggestions = result.bulkSuggestions && 
          Array.isArray(result.bulkSuggestions) && 
          result.bulkSuggestions.length > 0 &&
          result.bulkSuggestions.some(suggestion => suggestion.count > 0);
        logger.info(`Bulk suggestions check: ${hasSuggestions ? 'has suggestions' : 'no suggestions'}`, {
          bulkSuggestions: result.bulkSuggestions,
          length: result.bulkSuggestions?.length || 0,
          totalCount: result.bulkSuggestions?.reduce((sum, s) => sum + s.count, 0) || 0
        });
        
        if (hasSuggestions && result.bulkSuggestions) {
          setPendingBulkFix({
            paragraphId,
            content: editContent,
            suggestions: result.bulkSuggestions,
            audioRequested: false,
          });
          setShowBulkFixModal(true);
        } else {
          // No suggestions - proceed with normal cleanup
          await fetchBook();
          setEditingId(null);
          setEditContent('');
        }
      } else {
        // Check if it's a "Paragraph not found" error
        if (error && typeof error === 'object' && 'message' in error && 
            typeof (error as any).message === 'string' && (error as any).message.includes('Paragraph not found')) {
          logger.warn('Paragraph not found - likely due to database reset. Refreshing book data...');
          showError(
            'Paragraph No Longer Exists',
            'This paragraph was removed (possibly due to a database reset). The page will refresh to show current data.',
            true,
            async () => {
              await fetchBook();
              setEditingId(null);
              setEditContent('');
            }
          );
        } else {
          showError(
            'Failed to Save Changes',
            'There was an issue saving your paragraph changes. Please try again.',
            true,
            () => saveEdit(paragraphId)
          );
        }
      }
    } catch (error) {
      logger.error('Error saving paragraph:', error);
      
      // Check if it's a "Paragraph not found" error in the catch block too
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Paragraph not found')) {
        logger.warn('Paragraph not found in catch block - likely due to database reset. Refreshing book data...');
        showError(
          'Paragraph No Longer Exists',
          'This paragraph was removed (possibly due to a database reset). The page will refresh to show the current data.',
          true,
          async () => {
            try {
              await fetchBook();
              setEditingId(null);
              setEditContent('');
            } catch (refreshError) {
              logger.error('Error refreshing book data:', refreshError);
              showError(
                'Refresh Failed',
                'Unable to refresh the book data. Please reload the page manually.',
                false
              );
            }
          }
        );
      } else {
        showError(
          'Error Saving Changes',
          'An unexpected error occurred while saving your changes. Please try again.',
          true,
          async () => {
            try {
              await saveEdit(paragraphId);
              // Close the error modal on successful retry
              setShowErrorModal(false);
            } catch (retryError) {
              // If retry fails, the error will be handled by saveEdit's own error handling
              logger.error('Retry failed:', retryError);
            }
          }
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const generateAudioForParagraph = async (
    paragraphId: string,
    content: string
  ) => {
    try {
      // Immediately update the paragraph status to 'GENERATING' for visual feedback
      if (book) {
        const updatedBook = {
          ...book,
          paragraphs: book.paragraphs.map(p => 
            p.id === paragraphId 
              ? { ...p, audioStatus: 'GENERATING' as const }
              : p
          )
        };
        setBook(updatedBook);
      }

      const { data: result, error } = await apiClient.books.updateParagraph(paragraphId, {
        content,
        generateAudio: true, // Explicitly request audio generation
      });

      if (!error && result) {
        
        // Check if there are bulk fix suggestions with actual counts > 0
        const hasSuggestions = result.bulkSuggestions && 
          Array.isArray(result.bulkSuggestions) && 
          result.bulkSuggestions.length > 0 &&
          result.bulkSuggestions.some(suggestion => suggestion.count > 0);
        
        if (hasSuggestions && result.bulkSuggestions) {
          setPendingBulkFix({
            paragraphId,
            content,
            suggestions: result.bulkSuggestions,
            audioRequested: true, // Audio was requested in this case
          });
          setShowBulkFixModal(true);
        } else {
          // No suggestions - start audio polling to track generation progress
          logger.info('No bulk suggestions, starting audio polling for paragraph:', paragraphId);
          startAudioPolling(paragraphId);
        }
      } else {
        // If there was an error, revert the status back
        if (book) {
          const revertedBook = {
            ...book,
            paragraphs: book.paragraphs.map(p => 
              p.id === paragraphId 
                ? { ...p, audioStatus: 'ERROR' as const }
                : p
            )
          };
          setBook(revertedBook);
        }
      }
    } catch (error) {
      logger.error('Error generating audio:', error);
      
      // If there was an error, revert the status back
      if (book) {
        const revertedBook = {
          ...book,
          paragraphs: book.paragraphs.map(p => 
            p.id === paragraphId 
              ? { ...p, audioStatus: 'ERROR' as const }
              : p
          )
        };
        setBook(revertedBook);
      }
    }
  };

  const saveAndGenerateAudio = async (paragraphId: string) => {
    setSaving(true);
    try {
      // Immediately update the paragraph status to 'GENERATING' for visual feedback
      if (book) {
        const updatedBook = {
          ...book,
          paragraphs: book.paragraphs.map(p => 
            p.id === paragraphId 
              ? { ...p, audioStatus: 'GENERATING' as const }
              : p
          )
        };
        setBook(updatedBook);
      }

      const { data: result, error } = await apiClient.books.updateParagraph(paragraphId, {
        content: editContent,
        generateAudio: false, // Save content first, generate audio after bulk fix decision
      });

      if (!error && result) {
        // Check if there are bulk fix suggestions with actual counts > 0
        const hasSuggestions = result.bulkSuggestions && 
          Array.isArray(result.bulkSuggestions) && 
          result.bulkSuggestions.length > 0 &&
          result.bulkSuggestions.some(suggestion => suggestion.count > 0);
        
        if (hasSuggestions && result.bulkSuggestions) {
          setPendingBulkFix({
            paragraphId,
            content: editContent,
            suggestions: result.bulkSuggestions,
            audioRequested: true, // Audio was requested in this case
          });
          setShowBulkFixModal(true);
        } else {
          // No suggestions - generate audio immediately since no bulk fix decision needed
          logger.info('No bulk suggestions, generating audio immediately for paragraph', paragraphId);
          
          const { error: audioError } = await apiClient.books.updateParagraph(paragraphId, {
            content: editContent,
            generateAudio: true, // Generate audio since no bulk fixes to consider
          });
          
          if (audioError) {
            logger.error('Error generating audio:', audioError);
          }
          
          // Proceed with normal cleanup
          setEditingId(null);
          setEditContent('');
          
          // Refresh to show updated status
          setTimeout(fetchBook, 1000);
        }
      } else {
        // Check if it's a "Paragraph not found" error
        if (error && typeof error === 'object' && 'message' in error && 
            typeof (error as any).message === 'string' && (error as any).message.includes('Paragraph not found')) {
          logger.warn('Paragraph not found - likely due to database reset. Refreshing book data...');
          showError(
            'Paragraph No Longer Exists',
            'This paragraph was removed (possibly due to a database reset). The page will refresh to show current data.',
            true,
            async () => {
              await fetchBook();
              setEditingId(null);
              setEditContent('');
            }
          );
        } else {
          showError(
            'Failed to Save and Generate Audio',
            'There was an issue saving your changes and generating audio. Please try again.',
            true,
            () => saveAndGenerateAudio(paragraphId)
          );
          
          // If there was an error, revert the status back
          if (book) {
            const revertedBook = {
              ...book,
              paragraphs: book.paragraphs.map(p => 
                p.id === paragraphId 
                  ? { ...p, audioStatus: 'ERROR' as const }
                  : p
              )
            };
            setBook(revertedBook);
          }
        }
      }
    } catch (error) {
      logger.error('Error saving and generating audio:', error);
      
      // Check if it's a "Paragraph not found" error in the catch block too
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Paragraph not found')) {
        logger.warn('Paragraph not found in catch block - likely due to database reset. Refreshing book data...');
        showError(
          'Paragraph No Longer Exists',
          'This paragraph was removed (possibly due to a database reset). The page will refresh to show current data.',
          true,
          async () => {
            try {
              await fetchBook();
              setEditingId(null);
              setEditContent('');
            } catch (refreshError) {
              logger.error('Error refreshing book data:', refreshError);
              showError(
                'Refresh Failed',
                'Unable to refresh the book data. Please reload the page manually.',
                false
              );
            }
          }
        );
      } else {
        showError(
          'Error Saving and Generating Audio',
          'An unexpected error occurred while saving your changes and generating audio. Please try again.',
          true,
          async () => {
            try {
              await saveAndGenerateAudio(paragraphId);
              // Close the error modal on successful retry
              setShowErrorModal(false);
            } catch (retryError) {
              // If retry fails, the error will be handled by saveAndGenerateAudio's own error handling
              logger.error('Retry failed:', retryError);
            }
          }
        );
        
        // If there was an error, revert the status back
        if (book) {
          const revertedBook = {
            ...book,
            paragraphs: book.paragraphs.map(p => 
              p.id === paragraphId 
                ? { ...p, audioStatus: 'ERROR' as const }
                : p
          )
          };
          setBook(revertedBook);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleParagraphCompleted = async (paragraphId: string, completed: boolean) => {
    try {
      logger.info(`Toggling paragraph ${paragraphId} completed status to ${completed}`);
      
      // Use API client to ensure correct URL is used
      const { error } = await apiClient.books.setParagraphCompleted(bookId || '', paragraphId, { completed });
      
      if (!error) {
        // Update the local state immediately
        if (book) {
          const updatedBook = {
            ...book,
            paragraphs: book.paragraphs.map(p => 
              p.id === paragraphId 
                ? { ...p, completed }
                : p
            )
          };
          setBook(updatedBook);
        }
        
        logger.info(`Successfully updated paragraph ${paragraphId} completed status to ${completed}`);
      } else {
        logger.error('Error updating paragraph completed status:', error);
        showError(
          'Failed to Update Status',
          'There was an issue updating the paragraph completion status. Please try again.',
          true,
          () => toggleParagraphCompleted(paragraphId, completed)
        );
      }
    } catch (error) {
      logger.error('Error updating paragraph completed status:', error);
      showError(
        'Error Updating Status',
        'An unexpected error occurred while updating the paragraph status. Please try again.',
        true,
        () => toggleParagraphCompleted(paragraphId, completed)
      );
    }
  };

  const revertToOriginal = (paragraphId: string, generateAudio = false) => {
    // Show confirmation modal instead of directly reverting
    setPendingRevert({ paragraphId, generateAudio });
    setShowRevertConfirmModal(true);
  };

  const confirmRevert = async () => {
    if (!pendingRevert) return;
    
    const { paragraphId, generateAudio } = pendingRevert;
    
    try {
      logger.info(`Reverting paragraph ${paragraphId} to original content`);
      setSaving(true);
      
      // Use API client to revert paragraph
      const { data, error } = await apiClient.books.revertParagraph(paragraphId, { generateAudio });
      
      if (!error && data) {
        // Update the local state with the reverted content
        if (book) {
          const updatedBook = {
            ...book,
            paragraphs: book.paragraphs.map(p => 
              p.id === paragraphId 
                ? { ...p, content: data.content }
                : p
            )
          };
          setBook(updatedBook);
        }
        
        // Clear editing state
        setEditingId(null);
        setEditContent('');
        
        // Show success message
        showSuccess(
          'Paragraph Reverted',
          'The paragraph has been successfully reverted to its original content.'
        );
        
        // If audio was requested, start polling for completion
        if (generateAudio) {
          startAudioPolling(paragraphId);
        }
        
        logger.info(`Successfully reverted paragraph ${paragraphId} to original content`);
      } else {
        logger.error('Error reverting paragraph:', error);
        showError(
          'Failed to Revert',
          error || 'There was an issue reverting the paragraph to its original content. Please try again.',
          true,
          () => confirmRevert()
        );
      }
    } catch (error) {
      logger.error('Error reverting paragraph:', error);
      showError(
        'Error Reverting Paragraph',
        'An unexpected error occurred while reverting the paragraph. Please try again.',
        true,
        () => confirmRevert()
      );
    } finally {
      setSaving(false);
      // Close confirmation modal
      setShowRevertConfirmModal(false);
      setPendingRevert(null);
    }
  };

  const cancelRevert = () => {
    setShowRevertConfirmModal(false);
    setPendingRevert(null);
  };

  const handleBulkFixComplete = async () => {
    logger.info('Bulk fix completed');

    // If audio was requested, generate it for the originally edited paragraph
    if (pendingBulkFix?.audioRequested) {
      logger.info('Generating audio for originally edited paragraph', pendingBulkFix.paragraphId);
      
      // Update audio status to GENERATING for visual feedback
      if (book) {
        const updatedBook = {
          ...book,
          paragraphs: book.paragraphs.map(p => 
            p.id === pendingBulkFix.paragraphId 
              ? { ...p, audioStatus: 'GENERATING' as const }
              : p
          )
        };
        setBook(updatedBook);
      }
      
      // Generate audio for the originally edited paragraph
      const { error: audioError } = await apiClient.books.updateParagraph(pendingBulkFix.paragraphId, {
        content: pendingBulkFix.content,
        generateAudio: true,
      });
      
      if (audioError) {
        logger.error('Error generating audio after bulk fix:', audioError);
      }
    }

    // Show success message based on whether audio was requested
    const title = 'Text Fixes Applied Successfully! ✨';
    const message = pendingBulkFix?.audioRequested 
      ? 'All text corrections have been applied throughout your book. Audio will only be regenerated for the paragraph you originally edited.'
      : 'All text corrections have been applied throughout your book.';
    
    setSuccessMessage({ title, message });
    setShowSuccessModal(true);

    // Refresh the book data
    fetchBook();

    // Clear pending state and close modal
    setPendingBulkFix(null);
    setShowBulkFixModal(false);
    setEditingId(null); // Hide save buttons bar so audio player is visible
  };

  // Track active polling instances to prevent duplicates
  const activePollingRef = useRef<Set<string>>(new Set());

  // Poll for audio generation completion
  const startAudioPolling = (paragraphId: string) => {
    // Prevent multiple polling instances for the same paragraph
    if (activePollingRef.current.has(paragraphId)) {
      console.log(`⚠️ Polling already active for paragraph ${paragraphId}, skipping`);
      return;
    }
    
    activePollingRef.current.add(paragraphId);
    const pollInterval = 2000; // Poll every 2 seconds
    const maxPolls = 30; // Max 1 minute of polling
    let pollCount = 0;
    
    const poll = async () => {
      try {
        pollCount++;
        console.log(`🔄 Polling attempt ${pollCount}/${maxPolls} for paragraph ${paragraphId}`);
        
        // Get fresh book data directly from API to avoid React state race condition
        const { data: freshBookData, error } = await apiClient.books.getById(bookId || '');
        
        if (!error && freshBookData && freshBookData.book) {
          const paragraph = freshBookData.book.paragraphs.find(p => p.id === paragraphId);
          
          if (paragraph) {
            console.log(`📊 Paragraph ${paragraphId} audio status:`, paragraph.audioStatus);
            
            // Check if audio generation is complete
            if (paragraph.audioStatus === 'READY') {
              console.log('✅ Audio generation completed! Updating UI.');
              // Update the React state with fresh data
              setBook(freshBookData.book);
              activePollingRef.current.delete(paragraphId);
              return; // Stop polling
            } else if (paragraph.audioStatus === 'ERROR') {
              console.log('❌ Audio generation failed.');
              // Update the React state with fresh data
              setBook(freshBookData.book);
              activePollingRef.current.delete(paragraphId);
              return; // Stop polling
            }
          }
        }
        
        // Continue polling if not complete and haven't exceeded max attempts
        if (pollCount < maxPolls) {
          setTimeout(poll, pollInterval);
        } else {
          console.log('⏰ Polling timeout reached.');
          activePollingRef.current.delete(paragraphId);
        }
      } catch (error) {
        console.error('Error during audio polling:', error);
        // Continue polling on error unless max attempts reached
        if (pollCount < maxPolls) {
          setTimeout(poll, pollInterval);
        } else {
          activePollingRef.current.delete(paragraphId);
        }
      }
    };
    
    // Start polling
    setTimeout(poll, pollInterval);
  };

  const handleSkipBulkFix = () => {
    logger.info('handleSkipBulkFix called - applying only original edit and generating audio if requested', {
      pendingBulkFix: pendingBulkFix ? {
        paragraphId: pendingBulkFix.paragraphId,
        audioRequested: pendingBulkFix.audioRequested,
        content: pendingBulkFix.content.substring(0, 50) + '...'
      } : null
    });
    
    if (!pendingBulkFix) {
      logger.warn('handleSkipBulkFix called but pendingBulkFix is null');
      setShowBulkFixModal(false);
      return;
    }
    
    // IMPROVED FLOW: When user clicks "Skip All", we call updateParagraph with:
    // 1. Only the original edit content (no bulk suggestions applied)
    // 2. Audio generation if requested
    // Since the content is already saved in the database from the initial edit,
    // this won't trigger new text correction recording but will generate audio if needed.
    
    logger.info('Skipping bulk suggestions - applying only original edit with audio generation if requested');
    
    // If audio was requested, update UI to show generating status
    if (pendingBulkFix.audioRequested && book) {
      logger.info('Setting audio status to GENERATING for paragraph', pendingBulkFix.paragraphId);
      const updatedBook = {
        ...book,
        paragraphs: book.paragraphs.map(p => 
          p.id === pendingBulkFix.paragraphId 
            ? { ...p, audioStatus: 'GENERATING' as const }
            : p
        )
      };
      setBook(updatedBook);
    }
    
    // Call updateParagraph with the original edit content and audio generation if requested
    // IMPORTANT: Set recordTextCorrections to false to prevent recording unwanted corrections
    const apiParams = {
      content: pendingBulkFix.content, // Original edit content (no bulk suggestions)
      generateAudio: pendingBulkFix.audioRequested, // Generate audio if requested
      recordTextCorrections: false, // Don't record text corrections when skipping all suggestions
    };
    
    logger.info('Making API call to updateParagraph with original edit only', {
      paragraphId: pendingBulkFix.paragraphId,
      generateAudio: pendingBulkFix.audioRequested
    });
    
    apiClient.books.updateParagraph(pendingBulkFix.paragraphId, apiParams)
    .then(({ error }: { error?: string }) => {
      logger.info('Skip all API call completed', { error });
      if (!error) {
        // If audio was requested, start polling for completion
        if (pendingBulkFix.audioRequested) {
          startAudioPolling(pendingBulkFix.paragraphId);
        } else {
          // No audio requested, just refresh to show the updated content
          fetchBook();
        }
      }
    })
    .catch((error: Error) => {
      logger.error('Error in skip all operation:', error);
    });
    
    // Clean up state
    setShowBulkFixModal(false);
    setPendingBulkFix(null);
    setEditingId(null); // Hide save buttons bar so audio player is visible
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '400px',
        gap: 'var(--spacing-3)'
      }}>
        <span className="spinner" />
        <span style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-base)' }}>
          Loading book details...
        </span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="card error" style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: 'var(--spacing-6)',
        backgroundColor: 'var(--color-error-50)',
        border: '1px solid var(--color-error-200)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 'var(--font-size-3xl)',
          marginBottom: 'var(--spacing-4)'
        }}>❌</div>
        <h2 style={{
          margin: '0 0 var(--spacing-3) 0',
          fontSize: 'var(--font-size-xl)',
          fontWeight: '600',
          color: 'var(--color-error-700)'
        }}>Error Loading Book</h2>
        <p style={{
          margin: 0,
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-error-600)',
          lineHeight: '1.5'
        }}>{error}</p>
      </div>
    );
  }
  
  if (!book) {
    return (
      <div className="card" style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: 'var(--spacing-6)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 'var(--font-size-3xl)',
          marginBottom: 'var(--spacing-4)'
        }}>📚</div>
        <h2 style={{
          margin: '0 0 var(--spacing-3) 0',
          fontSize: 'var(--font-size-xl)',
          fontWeight: '600',
          color: 'var(--color-gray-700)'
        }}>Book Not Found</h2>
        <p style={{
          margin: 0,
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-gray-600)'
        }}>The requested book could not be found.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <BookHeader book={book} />
      
      <AudioStats paragraphs={book.paragraphs} book={book} />

      {/* Bulk Fix Notification */}
      {pendingBulkFix && (
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <BulkFixNotification
            suggestions={pendingBulkFix.suggestions}
            onReviewFixes={() => setShowBulkFixModal(true)}
            onSkip={handleSkipBulkFix}
          />
        </div>
      )}

      {/* Content Section */}
      <div className="card" style={{ padding: 'var(--spacing-6)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-3)',
          marginBottom: 'var(--spacing-4)',
          paddingBottom: 'var(--spacing-4)',
          borderBottom: '1px solid var(--color-gray-200)'
        }}>
          <span style={{ fontSize: 'var(--font-size-xl)' }}>📝</span>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--font-size-2xl)',
            fontWeight: '700',
            color: 'var(--color-gray-900)'
          }}>Content</h2>
        </div>

        {/* Filter Controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--spacing-3)', 
          marginBottom: 'var(--spacing-4)',
          padding: 'var(--spacing-3)',
          backgroundColor: 'var(--color-surface-secondary)',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid var(--color-border-subtle)'
        }}>
          <label style={{ 
            fontSize: 'var(--font-size-sm)', 
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-secondary)'
          }}>
            Filter paragraphs:
          </label>
          <select 
            value={completedFilter} 
            onChange={(e) => setCompletedFilter(e.target.value as 'all' | 'completed' | 'incomplete')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-3)',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer'
            }}
          >
            <option value="all">All paragraphs ({book.paragraphs.length})</option>
            <option value="completed">Completed ({book.paragraphs.filter(p => p.completed).length})</option>
            <option value="incomplete">Incomplete ({book.paragraphs.filter(p => !p.completed).length})</option>
          </select>
          
          {/* Page Number Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <label style={{ 
              fontSize: 'var(--font-size-sm)', 
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap'
            }}>
              Page:
            </label>
            <input
              type="number"
              value={pageNumberFilter}
              onChange={(e) => setPageNumberFilter(e.target.value)}
              placeholder="All pages"
              min="1"
              style={{
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-surface-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                width: '100px'
              }}
            />
            {pageNumberFilter && (
              <button
                onClick={() => setPageNumberFilter('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  padding: '2px'
                }}
                title="Clear page filter"
              >
                ✕
              </button>
            )}
          </div>
          
          <span style={{ 
            fontSize: 'var(--font-size-xs)', 
            color: 'var(--color-text-tertiary)'
          }}>
            Showing {filteredParagraphs.length} paragraph{filteredParagraphs.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="card" style={{
          padding: 'var(--spacing-4)',
          backgroundColor: 'var(--color-blue-50)',
          border: '1px solid var(--color-blue-200)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-6)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-blue-700)'
          }}>
            <span>💡</span>
            <span>
              Click on any paragraph to edit. Changes will queue audio regeneration and suggest bulk fixes.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {filteredParagraphs.map((paragraph) => (
            <ParagraphComponent
              key={paragraph.id}
              paragraph={paragraph}
              isEditing={editingId === paragraph.id}
              editContent={editContent}
              saving={saving}
              onStartEdit={() => startEdit(paragraph)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(paragraph.id)}
              onContentChange={setEditContent}
              onGenerateAudio={() => generateAudioForParagraph(paragraph.id, paragraph.content)}
              onSaveAndGenerateAudio={() => saveAndGenerateAudio(paragraph.id)}
              onToggleCompleted={toggleParagraphCompleted}
              onRevertToOriginal={revertToOriginal}
            />
          ))}
        </div>
      </div>

      {/* Bulk Fix Modal */}
      {showBulkFixModal && pendingBulkFix && (
        <BulkFixModal
          onClose={() => setShowBulkFixModal(false)}
          suggestions={pendingBulkFix.suggestions}
          bookId={bookId}
          onFixesApplied={handleBulkFixComplete}
          onSkipAll={handleSkipBulkFix}
        />
      )}

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successMessage.title}
        message={successMessage.message}
        icon="🎉"
        autoCloseMs={4000}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorMessage.title}
        message={errorMessage.message}
        icon="⚠️"
        showRetryButton={errorMessage.showRetry}
        onRetry={errorMessage.onRetry}
      />

      {/* Revert Confirmation Dialog */}
      {showRevertConfirmModal && pendingRevert && (() => {
        const paragraph = book?.paragraphs?.find(p => p.id === pendingRevert.paragraphId);
        return (
          <RevertParagraphConfirmDialog
            isOpen={showRevertConfirmModal}
            paragraphContent={paragraph?.content || ''}
            originalContent={paragraph?.originalContent || ''}
            onConfirm={confirmRevert}
            onCancel={cancelRevert}
            isReverting={saving}
          />
        );
      })()}
    </div>
  );
}
