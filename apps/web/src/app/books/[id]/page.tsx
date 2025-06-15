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
      <div style={{ marginTop: '30px' }}>
        {book.paragraphs.map((paragraph, index) => (
          <div
            key={paragraph.id}
            style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f5f5f5',
              borderRadius: '5px',
              position: 'relative',
            }}
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

            <p style={{ marginTop: '20px', marginBottom: '10px' }}>
              {paragraph.content}
            </p>

            <div style={{ fontSize: '12px', color: '#666' }}>
              Audio: {paragraph.audioStatus}
              {paragraph.audioS3Key && ' ✓'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
