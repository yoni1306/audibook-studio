'use client';

import { useEffect, useState } from 'react';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showBulkFixModal, setShowBulkFixModal] = useState(false);
  const [pendingBulkFix, setPendingBulkFix] = useState<{
    paragraphId: string;
    content: string;
    suggestions: BulkFixSuggestion[];
  } | null>(null);

  // Create a logger instance for this component
  const logger = createLogger('BookDetailPage');

  useEffect(() => {
    if (bookId) {
      fetchBook();
    }
  }, [bookId]);

  // Refresh every 5 seconds to check audio status
  useEffect(() => {
    const interval = setInterval(() => {
      if (book?.paragraphs.some((p) => p.audioStatus === 'GENERATING')) {
        fetchBook();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [book]);

  // Add correlation ID generator for frontend
  function generateCorrelationId() {
    return `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const fetchBook = async () => {
    const correlationId = generateCorrelationId();
    try {
      const response = await fetch(
        `http://localhost:3333/api/books/${bookId}`,
        {
          headers: {
            'x-correlation-id': correlationId,
          },
        }
      );
      const data = await response.json();
      setBook(data);
    } catch (error) {
      console.error('Error fetching book:', error, { correlationId });
    } finally {
      setLoading(false);
    }
  };

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
        // Refresh to show updated status
        setTimeout(fetchBook, 1000);
      }
    } catch (error) {
      console.error('Error generating audio:', error);
    }
  };

  const handleBulkFixComplete = (result: any) => {
    console.log('Bulk fix completed:', result);

    // Show success message
    const message = `Successfully applied text fixes to ${result.totalParagraphsUpdated} paragraphs, fixing ${result.totalWordsFixed} words total.\n\nAudio will only be regenerated for the paragraph you originally edited.`;
    alert(message);

    // Refresh the book data
    fetchBook();

    // Clear pending state
    setPendingBulkFix(null);
  };

  const handleSkipBulkFix = () => {
    setShowBulkFixModal(false);
    setPendingBulkFix(null);
  };

  if (loading) return <div>Loading book...</div>;
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
          onApplyFixes={handleBulkFixComplete}
        />
      )}
    </div>
  );
}