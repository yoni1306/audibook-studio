'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createLogger } from '../../../utils/logger';

// Components
import BookHeader, { Book } from './components/BookHeader';
import AudioStats from './components/AudioStats';
import BulkFixNotification from './components/BulkFixNotification';
import ParagraphComponent, { Paragraph } from './components/ParagraphComponent';
import BulkFixModal, { BulkFixSuggestion } from './components/BulkFixModal';

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<Book | null>(null);
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

  // Create a logger instance for this component
  const logger = createLogger('BookDetailPage');

  // Add correlation ID generator for frontend
  function generateCorrelationId() {
    return `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const fetchBook = useCallback(async () => {
    const correlationId = generateCorrelationId();
    try {
      setLoading(true); // Set loading at the start
      setError(null); // Clear any previous errors
      const response = await fetch(
        `http://localhost:3333/api/books/${bookId}`,
        {
          headers: {
            'x-correlation-id': correlationId,
          },
        }
      );
      
      if (!response.ok) {
        // This is an actual error (500, network issues, etc.)
        const errorData = await response.json();
        setError(`Server error: ${errorData.message || 'An unexpected error occurred'}`);
        logger.error('Server error from API:', { ...errorData, correlationId });
        setBook(null);
        return;
      }
      
      const data = await response.json();
      
      // Handle new API response structure
      if (data.found === false) {
        // Valid response but no data found
        setBook(null);
        setError(`Book not found: No book exists with ID "${bookId}"`);
      } else if (data.book) {
        // Book found
        setBook(data.book);
        setError(null); // Clear any previous errors
      } else {
        // Handle legacy response format (direct book object)
        setBook(data);
        setError(null); // Clear any previous errors
      }
    } catch (error) {
      const errorMessage = 'Failed to connect to the server. Please check if the API server is running.';
      setError(errorMessage);
      setBook(null);
      console.error('Error fetching book:', error, { correlationId });
      logger.error('Network error fetching book:', { error: error instanceof Error ? error.message : String(error), correlationId });
    } finally {
      setLoading(false);
    }
  }, [bookId, logger]);

  useEffect(() => {
    if (bookId) {
      fetchBook();
    }
  }, [bookId, fetchBook]);

  // Refresh every 5 seconds to check audio status or if book is not ready
  useEffect(() => {
    const interval = setInterval(() => {
      if (book?.paragraphs.some((p) => p.audioStatus === 'GENERATING') || book?.status !== 'READY') {
        fetchBook();
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
      const response = await fetch(
        `http://localhost:3333/api/books/paragraphs/${paragraphId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: editContent,
            generateAudio: false, // Don't generate audio when just saving text
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
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
      const response = await fetch(
        `http://localhost:3333/api/books/paragraphs/${paragraphId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            generateAudio: true, // Explicitly request audio generation
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        
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
      }
    } catch (error) {
      console.error('Error generating audio:', error);
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
      fetch(`http://localhost:3333/api/books/paragraphs/${pendingBulkFix.paragraphId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: pendingBulkFix.content,
          generateAudio: pendingBulkFix.audioRequested,
        }),
      })
      .then(response => {
        if (response.ok) {
          // Refresh the book data to show the updated content
          fetchBook();
        }
      })
      .catch(error => {
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
      
      <AudioStats paragraphs={book.paragraphs} />

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