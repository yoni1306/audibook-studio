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


        // Check if there are bulk fix suggestions
        if (result.bulkSuggestions && result.bulkSuggestions.length > 0) {

          setPendingBulkFix({
            paragraphId,
            content: editContent,
            suggestions: result.bulkSuggestions,
            audioRequested: false,
          });
          setShowBulkFixModal(true);
        }
        // No action needed for other cases

        await fetchBook();
        setEditingId(null);
        setEditContent('');
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      logger.error('Error saving paragraph:', error);
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

  const handleBulkFixComplete = () => {
    logger.info('Bulk fix completed');

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
        logger.error('Error applying original edit:', error);
      });
    }
    
    setShowBulkFixModal(false);
    setPendingBulkFix(null);
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
