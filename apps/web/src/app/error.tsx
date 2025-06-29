'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', margin: '0', color: '#dc3545' }}>500</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '1rem 0', color: '#333' }}>Something went wrong!</h2>
      <p style={{ fontSize: '1rem', color: '#666', marginBottom: '2rem' }}>
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          fontSize: '1rem',
          cursor: 'pointer'
        }}
      >
        Try again
      </button>
    </div>
  );
}
