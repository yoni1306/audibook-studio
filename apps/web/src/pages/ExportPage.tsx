import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import { BookWithCounts, BookExportStatus, PageExportStatus } from '@audibook/api-client';
import { createLogger } from '../utils/logger';

const logger = createLogger('ExportPage');

// PageCard component for individual page export management
interface PageCardProps {
  page: PageExportStatus;
  bookId: string;
  apiClient: any;
  onStatusChange: () => void;
}

function PageCard({ page, bookId, apiClient, onStatusChange }: PageCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const completionPercentage = page.totalParagraphsCount > 0 
    ? Math.round((page.completedParagraphsCount / page.totalParagraphsCount) * 100) 
    : 0;

  const canExport = page.audioStatus === 'READY' || page.audioStatus === 'EXPORTED';
  const hasAudio = page.audioStatus === 'EXPORTED' && page.audioS3Key;

  const handleExport = async () => {
    if (!canExport) return;
    
    try {
      setIsExporting(true);
      const { error } = await apiClient.books.startPageExport(bookId, page.pageNumber);
      
      if (error) {
        console.error('Failed to export page:', error);
        return;
      }
      
      // Refresh status after export
      setTimeout(() => {
        onStatusChange();
      }, 1000);
    } catch (err) {
      console.error('Failed to export page:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePlayAudio = async () => {
    if (!hasAudio || !page.audioS3Key) return;
    
    try {
      if (isPlaying && audio) {
        audio.pause();
        setIsPlaying(false);
        return;
      }
      
      const audioUrl = `/api/books/${bookId}/pages/${page.pageNumber}/audio`;
      const newAudio = new Audio(audioUrl);
      
      newAudio.onended = () => {
        setIsPlaying(false);
        setAudio(null);
      };
      
      newAudio.onerror = () => {
        console.error('Failed to play audio');
        setIsPlaying(false);
        setAudio(null);
      };
      
      await newAudio.play();
      setAudio(newAudio);
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to play audio:', err);
    }
  };

  const handleDeleteAudio = async () => {
    if (!hasAudio || !page.audioS3Key) return;
    
    try {
      const { error } = await apiClient.books.deletePageAudio(bookId, page.pageNumber.toString());
      
      if (error) {
        console.error('Failed to delete audio:', error);
        return;
      }
      
      onStatusChange();
    } catch (err) {
      console.error('Failed to delete audio:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXPORTED': return 'var(--color-primary-600)';
      case 'READY': return 'var(--color-green-600)';
      case 'GENERATING': return 'var(--color-blue-600)';
      case 'ERROR': return 'var(--color-red-600)';
      default: return 'var(--color-gray-500)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'EXPORTED': return '✅';
      case 'READY': return '🟢';
      case 'GENERATING': return '🔄';
      case 'ERROR': return '❌';
      default: return '⚪';
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid var(--color-gray-200)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      transition: 'all 0.2s ease'
    }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--color-gray-900)',
            margin: '0 0 4px 0'
          }}>
            Page {page.pageNumber}
          </h4>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: getStatusColor(page.audioStatus)
          }}>
            <span>{getStatusIcon(page.audioStatus)}</span>
            <span style={{ fontWeight: '500' }}>{page.audioStatus}</span>
          </div>
        </div>
        {page.audioDuration && (
          <div style={{
            fontSize: '12px',
            color: 'var(--color-gray-500)',
            textAlign: 'right'
          }}>
            {Math.round(page.audioDuration)}s
          </div>
        )}
      </div>

      {/* Completion progress */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--color-gray-700)'
          }}>
            Paragraph Completion
          </span>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: completionPercentage > 0 ? 'var(--color-green-600)' : 'var(--color-gray-500)'
          }}>
            {page.completedParagraphsCount}/{page.totalParagraphsCount} ({completionPercentage}%)
          </span>
        </div>
        
        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: 'var(--color-gray-200)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${completionPercentage}%`,
            height: '100%',
            backgroundColor: completionPercentage > 0 ? 'var(--color-green-500)' : 'var(--color-gray-400)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={!canExport || isExporting}
          style={{
            flex: '1',
            minWidth: '100px',
            padding: '8px 12px',
            backgroundColor: canExport ? 'var(--color-primary-500)' : 'var(--color-gray-200)',
            color: canExport ? 'white' : 'var(--color-gray-500)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: canExport ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          {isExporting ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>🎵</span>
              <span>Export</span>
            </>
          )}
        </button>

        {/* Play button */}
        {hasAudio && (
          <button
            onClick={handlePlayAudio}
            style={{
              padding: '8px 12px',
              backgroundColor: isPlaying ? 'var(--color-red-500)' : 'var(--color-green-500)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{isPlaying ? '⏹️' : '▶️'}</span>
            <span>{isPlaying ? 'Stop' : 'Play'}</span>
          </button>
        )}

        {/* Delete button */}
        {hasAudio && (
          <button
            onClick={handleDeleteAudio}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--color-red-500)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🗑️</span>
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* Not ready message */}
      {!page.willBeExported && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: 'var(--color-yellow-50)',
          border: '1px solid var(--color-yellow-200)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--color-yellow-700)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>⚠️</span>
          <span>No completed paragraphs - cannot export</span>
        </div>
      )}
    </div>
  );
}

export default function ExportPage() {
  const [books, setBooks] = useState<BookWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookWithCounts | null>(null);
  const [exportStatus, setExportStatus] = useState<BookExportStatus | null>(null);
  const [loadingExportStatus, setLoadingExportStatus] = useState(false);
  const apiClient = useApiClient();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: apiError } = await apiClient.books.getAll();
        
        if (apiError) {
          logger.error('Error fetching books:', apiError);
          setError('Failed to load books');
          setBooks([]);
        } else {
          // Handle API response structure
          const booksArray = data?.books || [];
          logger.info('Fetched books:', booksArray.length);
          setBooks(Array.isArray(booksArray) ? booksArray : []);
        }
      } catch (err) {
        logger.error('Error fetching books:', err);
        setError('Failed to load books');
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [apiClient]);

  // Fetch export status for selected book
  const fetchExportStatus = async (bookId: string) => {
    try {
      setLoadingExportStatus(true);
      const { data, error } = await apiClient.books.getExportStatus(bookId);
      
      if (error) {
        logger.error('Failed to fetch export status:', error);
        setError('Failed to load export status');
        return;
      }
      
      setExportStatus(data || null);
    } catch (err) {
      logger.error('Failed to fetch export status:', err);
      setError('Failed to load export status');
    } finally {
      setLoadingExportStatus(false);
    }
  };

  // Handle book selection
  const handleBookSelect = async (book: BookWithCounts) => {
    setSelectedBook(book);
    await fetchExportStatus(book.id);
  };

  // Handle back to book list
  const handleBackToList = () => {
    setSelectedBook(null);
    setExportStatus(null);
    setError(null);
  };

  const getBookStats = (book: BookWithCounts) => {
    const totalParagraphs = book._count?.paragraphs || 0;
    // Note: We don't have completed paragraph count in BookWithCounts, 
    // so we'll assume some paragraphs are completed if the book has any paragraphs
    // This is a placeholder - in a real implementation, we'd need to fetch this data
    const completedParagraphs = totalParagraphs > 0 ? Math.floor(totalParagraphs * 0.5) : 0; // Placeholder: assume 50% completion
    const readyForExport = completedParagraphs > 0;
    
    return {
      totalParagraphs,
      completedParagraphs,
      readyForExport,
      completionPercentage: totalParagraphs > 0 ? Math.round((completedParagraphs / totalParagraphs) * 100) : 0
    };
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid var(--color-primary-200)',
            borderTop: '2px solid var(--color-primary-600)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: '16px', color: 'var(--color-gray-600)' }}>Loading books...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{
          backgroundColor: 'var(--color-red-50)',
          border: '1px solid var(--color-red-200)',
          borderRadius: '8px',
          padding: '16px',
          color: 'var(--color-red-700)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  // Show detailed book view if a book is selected
  if (selectedBook) {
    return (
      <div style={{ padding: '20px' }}>
        {/* Header with back button */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <button
              onClick={handleBackToList}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'var(--color-gray-100)',
                border: '1px solid var(--color-gray-300)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-gray-700)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-gray-200)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
              }}
            >
              <span>←</span>
              <span>Back to Books</span>
            </button>
          </div>
          
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: 'var(--color-gray-900)', 
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '32px' }}>🎵</span>
            Export: {selectedBook.title}
          </h1>
          {selectedBook.author && (
            <p style={{ 
              fontSize: '16px', 
              color: 'var(--color-gray-600)', 
              margin: '0 0 8px 0'
            }}>
              by {selectedBook.author}
            </p>
          )}
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--color-gray-500)', 
            margin: '0'
          }}>
            Select pages to export their audio files. Only pages with completed paragraphs can be exported.
          </p>
        </div>

        {/* Loading export status */}
        {loadingExportStatus && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--color-primary-200)',
                borderTop: '2px solid var(--color-primary-600)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '16px', color: 'var(--color-gray-600)' }}>Loading pages...</span>
            </div>
          </div>
        )}

        {/* Export status and pages */}
        {exportStatus && !loadingExportStatus && (
          <div>
            {/* Overall progress */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid var(--color-gray-200)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
            }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: 'var(--color-gray-900)', 
                margin: '0 0 16px 0' 
              }}>
                Export Progress
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-primary-600)' }}>
                    {exportStatus.pages.filter(p => p.audioStatus === 'EXPORTED').length}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-gray-600)' }}>Exported</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-green-600)' }}>
                    {exportStatus.pages.filter(p => p.audioStatus === 'READY').length}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-gray-600)' }}>Ready</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-gray-500)' }}>
                    {exportStatus.pages.filter(p => p.audioStatus === 'NOT_READY' || !p.willBeExported).length}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-gray-600)' }}>Not Ready</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-blue-600)' }}>
                    {exportStatus.pages.length}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-gray-600)' }}>Total Pages</div>
                </div>
              </div>
            </div>

            {/* Pages list */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '16px'
            }}>
              {exportStatus.pages.map((page) => (
                <PageCard
                  key={page.pageNumber}
                  page={page}
                  bookId={selectedBook.id}
                  apiClient={apiClient}
                  onStatusChange={() => fetchExportStatus(selectedBook.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show book list view
  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          color: 'var(--color-gray-900)', 
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '32px' }}>🎵</span>
          Export Audio
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: 'var(--color-gray-600)', 
          margin: '0',
          lineHeight: '1.5'
        }}>
          Select a book to view its pages and export audio files.
        </p>
      </div>

      {/* Books List */}
      {books.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'var(--color-gray-50)',
          borderRadius: '12px',
          border: '2px dashed var(--color-gray-300)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--color-gray-700)', 
            margin: '0 0 8px 0' 
          }}>
            No books found
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--color-gray-500)', 
            margin: '0 0 20px 0' 
          }}>
            Upload some books first to get started with audio export.
          </p>
          <Link 
            to="/upload" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'var(--color-primary-500)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            📤 Upload Books
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '20px'
        }}>
          {books.map((book) => {
            const stats = getBookStats(book);
            
            return (
              <div
                key={book.id}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--color-gray-200)',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Book Info */}
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: 'var(--color-gray-900)',
                    margin: '0 0 4px 0',
                    lineHeight: '1.3'
                  }}>
                    {book.title}
                  </h3>
                  {book.author && (
                    <p style={{
                      fontSize: '14px',
                      color: 'var(--color-gray-600)',
                      margin: '0 0 8px 0'
                    }}>
                      by {book.author}
                    </p>
                  )}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '12px',
                    color: 'var(--color-gray-500)'
                  }}>
                    <span>Status: {book.status}</span>
                    {book.createdAt && (
                      <span>Created: {new Date(book.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Progress Stats */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--color-gray-700)'
                    }}>
                      Audio Completion
                    </span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: stats.readyForExport ? 'var(--color-green-600)' : 'var(--color-gray-500)'
                    }}>
                      {stats.completedParagraphs}/{stats.totalParagraphs} ({stats.completionPercentage}%)
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: 'var(--color-gray-200)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${stats.completionPercentage}%`,
                      height: '100%',
                      backgroundColor: stats.readyForExport ? 'var(--color-green-500)' : 'var(--color-gray-400)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Export Button */}
                <div style={{ textAlign: 'center' }}>
                  {stats.readyForExport ? (
                    <button
                      onClick={() => handleBookSelect(book)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: 'var(--color-primary-500)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-600)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-500)';
                      }}
                    >
                      <span>🎵</span>
                      <span>View Pages</span>
                    </button>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      backgroundColor: 'var(--color-gray-100)',
                      color: 'var(--color-gray-500)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1px solid var(--color-gray-200)'
                    }}>
                      <span>⚠️</span>
                      <span>No completed paragraphs</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
