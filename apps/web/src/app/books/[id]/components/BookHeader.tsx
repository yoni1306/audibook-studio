'use client';

import Link from 'next/link';

export interface Book {
  id: string;
  title: string;
  author: string | null;
  status: string;
  createdAt: string;
  paragraphs: any[];
}

interface BookHeaderProps {
  book: Book;
}

export default function BookHeader({ book }: BookHeaderProps) {
  return (
    <>
      <Link href="/books">← Back to books</Link>

      <h1>{book.title}</h1>
      {book.author && <p>Author: {book.author}</p>}
      <p>
        Status: <strong>{book.status}</strong>
      </p>
      <p>Total paragraphs: {book.paragraphs.length}</p>
    </>
  );
}