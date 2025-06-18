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
  audioDuration: number | null;
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
  const [generatingAll, setGeneratingAll] = useState(false);

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

  const generateAllAudio = async () => {
    if (!book) return;

    const pendingParagraphs = book.paragraphs.filter(
      (p) => p.audioStatus === 'PENDING' || p.audioStatus === 'ERROR'
    );

    if (pendingParagraphs.length === 0) {
      alert('All paragraphs already have audio or are being processed');
      return;
    }

    setGeneratingAll(true);

    for (const paragraph of pendingParagraphs) {
      await fetch(
        `http://localhost:3333/api/books/paragraphs/${paragraph.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: paragraph.content }),
        }
      );
    }

    alert(`Queued ${pendingParagraphs.length} paragraphs for audio generation`);
    setGeneratingAll(false);

    // Refresh to show updated status
    setTimeout(fetchBook, 1000);
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
          body: JSON.stringify({ content }),
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

  const getAudioStatusIcon = (status: string) => {
    switch (status) {
      case 'READY':
        return '✅';
      case 'GENERATING':
        return '⏳';
      case 'ERROR':
        return '❌';
      case 'PENDING':
        return '⏸️';
      default:
        return '❓';
    }
  };

  if (loading) return <div>Loading book...</div>;
  if (!book) return <div>Book not found</div>;

  const audioStats = {
    ready: book.paragraphs.filter((p) => p.audioStatus === 'READY').length,
    generating: book.paragraphs.filter((p) => p.audioStatus === 'GENERATING')
      .length,
    pending: book.paragraphs.filter((p) => p.audioStatus === 'PENDING').length,
    error: book.paragraphs.filter((p) => p.audioStatus === 'ERROR').length,
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/books">← Back to books</Link>

      <h1>{book.title}</h1>
      {book.author && <p>Author: {book.author}</p>}
      <p>
        Status: <strong>{book.status}</strong>
      </p>
      <p>Total paragraphs: {book.paragraphs.length}</p>

      <div
        style={{
          padding: '15px',
          backgroundColor: '#f0f0f0',
          borderRadius: '5px',
          marginBottom: '20px',
        }}
      >
        <h3>Audio Status</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
          }}
        >
          <div>
            ✅ Ready: <strong>{audioStats.ready}</strong>
          </div>
          <div>
            ⏳ Generating: <strong>{audioStats.generating}</strong>
          </div>
          <div>
            ⏸️ Pending: <strong>{audioStats.pending}</strong>
          </div>
          <div>
            ❌ Error: <strong>{audioStats.error}</strong>
          </div>
        </div>
        {/* <button
          onClick={generateAllAudio}
          disabled={generatingAll || audioStats.pending === 0}
          style={{
            marginTop: '10px',
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor:
              generatingAll || audioStats.pending === 0
                ? 'not-allowed'
                : 'pointer',
            opacity: generatingAll || audioStats.pending === 0 ? 0.6 : 1,
          }}
        >
          {generatingAll
            ? 'Queueing...'
            : `Generate Audio for ${
                audioStats.pending + audioStats.error
              } Paragraphs`}
        </button> */}
      </div>

      <h2>Content</h2>
      <p style={{ fontSize: '14px', color: '#666' }}>
        Click on any paragraph to edit. Changes will queue audio regeneration.
      </p>

      <div style={{ marginTop: '30px' }}>
        {book.paragraphs.map((paragraph) => (
          <div
            key={paragraph.id}
            style={{
              marginBottom: '20px',
              padding: '15px',
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
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span>{getAudioStatusIcon(paragraph.audioStatus)}</span>
              <span>
                Chapter {paragraph.chapterNumber} | #{paragraph.orderIndex + 1}
              </span>
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
                {/* Audio Section */}
                <div style={{ marginTop: '15px' }}>
                  {paragraph.audioStatus === 'READY' && paragraph.audioS3Key ? (
                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#e8f5e9',
                        borderRadius: '5px',
                      }}
                    >
                      <audio controls style={{ width: '100%' }}>
                        <source
                          src={`http://localhost:3333/api/books/paragraphs/${paragraph.id}/audio`}
                          type="audio/mpeg"
                        />
                        Your browser does not support the audio element.
                      </audio>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '5px',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {paragraph.audioDuration &&
                            `Duration: ${Math.round(
                              paragraph.audioDuration
                            )} seconds`}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateAudioForParagraph(
                              paragraph.id,
                              paragraph.content
                            );
                          }}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          🔄 Regenerate
                        </button>
                      </div>
                    </div>
                  ) : paragraph.audioStatus === 'GENERATING' ? (
                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#fff3e0',
                        borderRadius: '5px',
                        color: '#f57c00',
                        textAlign: 'center',
                      }}
                    >
                      <div>🔊 Generating audio...</div>
                      <div style={{ fontSize: '12px', marginTop: '5px' }}>
                        This may take a moment. Page will auto-refresh.
                      </div>
                    </div>
                  ) : paragraph.audioStatus === 'ERROR' ? (
                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#ffebee',
                        borderRadius: '5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#c62828' }}>
                        ❌ Audio generation failed
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAudioForParagraph(
                            paragraph.id,
                            paragraph.content
                          );
                        }}
                        style={{
                          padding: '5px 15px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        🔄 Retry
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#666', fontSize: '14px' }}>
                        ⏸️ No audio generated
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAudioForParagraph(
                            paragraph.id,
                            paragraph.content
                          );
                        }}
                        style={{
                          padding: '5px 15px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        🎵 Generate Audio
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
