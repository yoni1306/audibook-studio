import React from 'react';
import { BookWithDetails } from '@audibook/api-client';

interface BookHeaderProps {
  book: BookWithDetails;
}

export default function BookHeader({ book }: BookHeaderProps) {
  return (
    <div style={{ 
      padding: '20px', 
      borderBottom: '1px solid #eee', 
      marginBottom: '20px' 
    }}>
      <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
        {book.title}
      </h1>
      {book.author && (
        <p style={{ margin: '0 0 10px 0', color: '#666' }}>
          by {book.author}
        </p>
      )}
      <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#888' }}>
        <span>Status: {book.status}</span>
        {book.createdAt && (
          <span>Created: {new Date(book.createdAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}
