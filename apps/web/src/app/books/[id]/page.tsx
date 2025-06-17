'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Paragraph {
  id: string;
  chapterNumber: number;
  orderIndex: number;
  content: string;
  audioStatus: string;
  audioS3Key: string | null;
}

interface Book {
  id: string;
  title: string;
  author: string | null;
  status: string;
  createdAt: string;
  paragraphs: Paragraph[];
}

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bookId) {
      fetchBook();
    }
  }, [bookId]);

  const fetchBook = async () => {
    try {
      const response = await fetch(`http://localhost:3333/api/books/${bookId}`);
      const data = await response.json();
      setBook(data);
    } catch (error) {
      console.error('Error fetching book:', error);
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
          body: JSON.stringify({ content: editContent }),
        }
      );

      if (response.ok) {
        // Refresh the book data
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

  if (loading) return <div>Loading book...</div>;
  if (!book) return <div>Book not found</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/books">← Back to books</Link>

      <h1>{book.title}</h1>
      {book.author && <p>Author: {book.author}</p>}
      <p>
        Status: <strong>{book.status}</strong>
      </p>
      <p>Total paragraphs: {book.paragraphs.length}</p>

      <h2>Content</h2>
      <p style={{ fontSize: '14px', color: '#666' }}>
        Click on any paragraph to edit. Changes will queue audio regeneration.
      </p>

      <div style={{ marginTop: '30px' }}>
        {book.paragraphs.map((paragraph) => (
          <div
            key={paragraph.id}
            style={{
              direction: 'rtl',
              textAlign: 'right',
              padding: '20px',
              maxWidth: '800px',
              margin: '0 auto',
              marginBottom: '20px',
              backgroundColor: '#f5f5f5',
              borderRadius: '5px',
              position: 'relative',
              cursor: editingId === null ? 'pointer' : 'default',
            }}
            onClick={() => editingId === null && startEdit(paragraph)}
          >
            <div
              style={{
                position: 'absolute',
                top: '5px',
                right: '10px',
                fontSize: '12px',
                color: '#666',
              }}
            >
              Chapter {paragraph.chapterNumber} | #{paragraph.orderIndex + 1}
            </div>

            {editingId === paragraph.id ? (
              <div style={{ marginTop: '20px' }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    resize: 'vertical',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={() => saveEdit(paragraph.id)}
                    disabled={saving}
                    style={{
                      padding: '8px 16px',
                      marginRight: '10px',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ccc',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ marginTop: '20px', marginBottom: '10px' }}>
                  {paragraph.content}
                </p>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Audio: {paragraph.audioStatus}
                  {paragraph.audioS3Key && ' ✓'}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
