import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import type { BookWithCounts } from '@audibook/api-client';
import { createLogger } from '../utils/logger';
import DeleteBookConfirmDialog from '../components/DeleteBookConfirmDialog';

const logger = createLogger('BooksPage');

export default function BooksPage() {
  const [books, setBooks] = useState<BookWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    bookId: string;
    bookTitle: string;
  }>({ isOpen: false, bookId: '', bookTitle: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const apiClient = useApiClient();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        setError(null);
        

        
        // Test direct fetch first

        
        const { data, error } = await apiClient.books.getAll();
        

        
        if (error) {
          logger.error('API error:', error);
          throw new Error(`API error: ${error}`);
        }
        
        if (!data) {
          setBooks([]);
          return;
        }
        
        // Handle API response structure
        const booksArray = data.books || [];
        setBooks(Array.isArray(booksArray) ? booksArray : []);
        setError(null);
      } catch (err) {
        logger.error('Error fetching books:', err);
        let errorMessage = 'Failed to load books';
        
        if (err instanceof TypeError && err.message.includes('fetch')) {
          // Network error - server is likely down
          errorMessage = 'Cannot connect to server. Please check if the API server is running.';
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        setBooks([]); // Clear any existing books
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [apiClient]);

  const handleDeleteClick = (book: BookWithCounts) => {
    logger.log(`User initiated delete for book: ${book.title}`);
    setDeleteDialog({
      isOpen: true,
      bookId: book.id,
      bookTitle: book.title,
    });
  };

  const handleDeleteConfirm = async (bookId: string) => {
    try {
      setIsDeleting(true);
      logger.log(`Deleting book: ${bookId}`);
      
      const { error } = await apiClient.books.deleteBook(bookId);
      
      if (error) {
        logger.error('Failed to delete book:', error);
        throw new Error(`Failed to delete book: ${error}`);
      }
      
      logger.log(`Book deleted successfully: ${bookId}`);
      
      // Remove the book from the local state
      setBooks(prevBooks => prevBooks.filter(book => book.id !== bookId));
      
      // Close the dialog
      setDeleteDialog({ isOpen: false, bookId: '', bookTitle: '' });
      
    } catch (err) {
      logger.error('Error deleting book:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete book';
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    logger.log('User cancelled book deletion');
    setDeleteDialog({ isOpen: false, bookId: '', bookTitle: '' });
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '200px',
        gap: 'var(--spacing-3)'
      }}>
        <span className="spinner" />
        <span style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-base)' }}>
          Loading books...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-8)'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 'var(--font-size-3xl)',
            fontWeight: '700',
            color: 'var(--color-gray-900)'
          }}>
            📚 Books
          </h1>
        </div>
        
        <div className="card" style={{
          padding: 'var(--spacing-8)',
          textAlign: 'center' as const,
          backgroundColor: 'var(--color-error-50)',
          border: '1px solid var(--color-error-200)'
        }}>
          <div style={{
            fontSize: 'var(--font-size-4xl)',
            marginBottom: 'var(--spacing-4)'
          }}>
            ⚠️
          </div>
          <h2 style={{
            margin: '0 0 var(--spacing-3) 0',
            fontSize: 'var(--font-size-xl)',
            fontWeight: '600',
            color: 'var(--color-error-700)'
          }}>
            Server Error
          </h2>
          <p style={{
            margin: '0 0 var(--spacing-6) 0',
            color: 'var(--color-error-600)',
            fontSize: 'var(--font-size-base)'
          }}>
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-8)'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 'var(--font-size-3xl)',
            fontWeight: '700',
            color: 'var(--color-gray-900)'
          }}>
            📚 Books
          </h1>
        </div>
        
        <div className="card" style={{
          padding: 'var(--spacing-8)',
          textAlign: 'center' as const
        }}>
          <div style={{
            fontSize: 'var(--font-size-4xl)',
            marginBottom: 'var(--spacing-4)'
          }}>
            📖
          </div>
          <h2 style={{
            margin: '0 0 var(--spacing-3) 0',
            fontSize: 'var(--font-size-xl)',
            fontWeight: '600',
            color: 'var(--color-gray-700)'
          }}>
            No books found
          </h2>
          <p style={{
            margin: '0 0 var(--spacing-6) 0',
            color: 'var(--color-gray-600)',
            fontSize: 'var(--font-size-base)'
          }}>
            Upload your first book to get started!
          </p>
          <Link to="/upload">
            <button className="btn btn-primary">
              📤 Upload New Book
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-8)'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 'var(--font-size-3xl)',
          fontWeight: '700',
          color: 'var(--color-gray-900)'
        }}>
          📚 Books
        </h1>
        <Link to="/upload">
          <button className="btn btn-primary">
            📤 Upload New Book
          </button>
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gap: 'var(--spacing-4)',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))'
      }}>
        {books.map((book) => {
          const getStatusColor = (status: string) => {
            switch (status) {
              case 'READY': return 'var(--color-success-600)';
              case 'PROCESSING': return 'var(--color-warning-600)';
              case 'FAILED': return 'var(--color-error-600)';
              default: return 'var(--color-gray-600)';
            }
          };

          const getStatusIcon = (status: string) => {
            switch (status) {
              case 'READY': return '✅';
              case 'PROCESSING': return '⏳';
              case 'FAILED': return '❌';
              default: return '📄';
            }
          };

          return (
            <div key={book.id} className="card" style={{
              padding: 'var(--spacing-6)',
              transition: 'var(--transition-normal)',
              cursor: 'pointer'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--spacing-4)'
              }}>
                <h3 style={{ 
                  margin: 0,
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: '600',
                  lineHeight: '1.4',
                  flex: 1
                }}>
                  <Link
                    to={`/books/${book.id}`}
                    style={{
                      color: 'var(--color-primary-600)',
                      textDecoration: 'none',
                      transition: 'var(--transition-normal)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary-700)';
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary-600)';
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    {book.title}
                  </Link>
                </h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  padding: 'var(--spacing-1) var(--spacing-3)',
                  backgroundColor: 'var(--color-gray-100)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  color: getStatusColor(book.status)
                }}>
                  <span>{getStatusIcon(book.status)}</span>
                  <span>{book.status}</span>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-6)',
                marginBottom: 'var(--spacing-4)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-gray-600)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <span>📄</span>
                  <span>{book._count.paragraphs} paragraphs</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <span>📅</span>
                  <span>{new Date(book.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 'var(--spacing-4)',
                borderTop: '1px solid var(--color-gray-200)'
              }}>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-gray-500)'
                }}>
                  Uploaded {new Date(book.createdAt).toLocaleString()}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteClick(book);
                  }}
                  className="btn btn-danger btn-sm"
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    padding: 'var(--spacing-2) var(--spacing-3)'
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <DeleteBookConfirmDialog
        isOpen={deleteDialog.isOpen}
        bookTitle={deleteDialog.bookTitle}
        bookId={deleteDialog.bookId}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting}
      />
    </div>
  );
}
