'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiClient } from '../../../hooks/useApiClient';
import type { BookWithCounts } from '@audibook/api-client';

// Force dynamic rendering to prevent build-time pre-rendering
export const dynamic = 'force-dynamic';

export default function BooksPage() {
  const [books, setBooks] = useState<BookWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await apiClient.books.getAll();
        
        if (error) {
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
        console.error('Error fetching books:', err);
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
  }, [apiClient.books]);

  if (loading) return <div style={{ padding: '20px' }}>Loading books...</div>;

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Books</h1>
        <div style={{ color: 'red', marginBottom: '20px' }}>
          Server Error: {error}
        </div>
        <button 
          onClick={() => window.location.reload()} 
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Books</h1>
        <div style={{ marginBottom: '20px' }}>
          <p>No books found. Upload your first book to get started!</p>
        </div>
        <Link href="/upload">
          <button
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Upload New Book
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Books</h1>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/upload">
          <button
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Upload New Book
          </button>
        </Link>
      </div>

      <div>
        {books.map((book) => (
          <div
            key={book.id}
            style={{
              border: '1px solid #ccc',
              padding: '15px',
              marginBottom: '10px',
              borderRadius: '5px',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0' }}>
              <Link
                href={`/books/${book.id}`}
                style={{
                  color: '#0070f3',
                  textDecoration: 'none',
                }}
              >
                {book.title}
              </Link>
            </h3>
            <p style={{ margin: '5px 0' }}>
              Status: <strong>{book.status}</strong>
            </p>
            <p style={{ margin: '5px 0' }}>
              Paragraphs: {book._count.paragraphs}
            </p>
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
              Uploaded: {new Date(book.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
