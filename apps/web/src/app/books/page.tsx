'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Book {
  id: string;
  title: string;
  author: string | null;
  status: string;
  createdAt: string;
  _count: {
    paragraphs: number;
  };
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3333/api/books')
      .then((res) => res.json())
      .then((data) => {
        setBooks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading books...</div>;

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

      {books.length === 0 ? (
        <p>No books uploaded yet.</p>
      ) : (
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
      )}
    </div>
  );
}
