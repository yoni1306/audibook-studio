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

export default function BookDetailPage() {
  const { id: bookId } = useParams<{ id: string }>();
  
  // Early return if bookId is not available
  if (!bookId) {
    return <div>Invalid book ID</div>;
  }
  
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

  const isInitialLoad = useRef(true);

  // Create a logger instance for this component
  const logger = useMemo(() => createLogger('BookDetailPage'), []);

  // Add correlation ID generator for frontend
  function generateCorrelationId() {
    return `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const fetchBook = useCallback(async () => {
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
      console.error('Error fetching book:', error, { correlationId });
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
        logger.debug('Paragraph update response:', result);

        // Check if there are bulk fix suggestions
        if (result.bulkSuggestions && result.bulkSuggestions.length > 0) {
          logger.debug('Bulk suggestions found:', result.bulkSuggestions);
          setPendingBulkFix({
            paragraphId,
            content: editContent,
            suggestions: result.bulkSuggestions,
            audioRequested: false,
          });
          setShowBulkFixModal(true);
        } else {
          logger.debug('No bulk suggestions found in response');
        }

        await fetchBook();
        setEditingId(null);
        setEditContent('');
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving paragraph:', error);
      alert('Error saving changes');
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
        
        // Check if there are bulk fix suggestions
        if (result.bulkSuggestions && result.bulkSuggestions.length > 0) {
          logger.debug('Bulk suggestions found from audio generation:', result.bulkSuggestions);
          setPendingBulkFix({
            paragraphId,
            content,
            suggestions: result.bulkSuggestions,
            audioRequested: true, // Audio was requested in this case
          });
          setShowBulkFixModal(true);
        }
        
        // Refresh to show updated status
        setTimeout(fetchBook, 1000);
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
      console.error('Error generating audio:', error);
      
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

  const handleBulkFixComplete = () => {
    console.log('Bulk fix completed');

    // Show success message based on whether audio was requested
    const message = pendingBulkFix?.audioRequested 
      ? 'Successfully applied text fixes. Audio will only be regenerated for the paragraph you originally edited.'
      : 'Successfully applied text fixes.';
    alert(message);

    // Refresh the book data
    fetchBook();

    // Clear pending state and close modal
    setPendingBulkFix(null);
    setShowBulkFixModal(false);
  };

  const handleSkipBulkFix = () => {
    // Apply the original edit when skipping bulk fixes
    if (pendingBulkFix) {
      // Make the API call to save the original content
      apiClient.books.updateParagraph(pendingBulkFix.paragraphId, {
        content: pendingBulkFix.content,
        generateAudio: pendingBulkFix.audioRequested,
      })
      .then(({ error }: { error?: string }) => {
        if (!error) {
          // Refresh the book data to show the updated content
          fetchBook();
        }
      })
      .catch((error: Error) => {
        console.error('Error applying original edit:', error);
      });
    }
    
    setShowBulkFixModal(false);
    setPendingBulkFix(null);
  };

  if (loading) return <div>Loading book...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!book) return <div>Book not found</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <BookHeader book={book} />
      
      <AudioStats book={book} />

      {/* Bulk Fix Notification */}
      {pendingBulkFix && (
        <BulkFixNotification
          suggestions={pendingBulkFix.suggestions}
          onReviewFixes={() => setShowBulkFixModal(true)}
          onSkip={handleSkipBulkFix}
        />
      )}

      <h2>Content</h2>
      <p style={{ fontSize: '14px', color: '#666' }}>
        Click on any paragraph to edit. Changes will queue audio regeneration and suggest bulk fixes.
      </p>

      <div style={{ marginTop: '30px' }}>
        {book.paragraphs.map((paragraph) => (
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
          />
        ))}
      </div>

      {/* Bulk Fix Modal */}
      {showBulkFixModal && pendingBulkFix && (
        <BulkFixModal
          onClose={() => setShowBulkFixModal(false)}
          suggestions={pendingBulkFix.suggestions}
          bookId={bookId}
          onFixesApplied={handleBulkFixComplete}
        />
      )}
    </div>
  );
}
