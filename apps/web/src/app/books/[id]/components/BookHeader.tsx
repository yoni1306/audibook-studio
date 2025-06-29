'use client';

import Link from 'next/link';
import { BookWithDetails } from '@audibook/api-client';

interface BookHeaderProps {
  book: BookWithDetails;
}

export default function BookHeader({ book }: BookHeaderProps) {
  // Calculate stats
  const paragraphs = book.paragraphs;
  const pageCount = paragraphs.length > 0 
    ? Math.max(...paragraphs.map(p => p.pageNumber || 0))
    : 0;
  
  const paragraphCount = paragraphs.length;
  
  // Calculate estimated listening time from audio durations
  const totalDurationSeconds = paragraphs
    .filter(p => p.audioDuration && p.audioDuration > 0)
    .reduce((sum, p) => sum + (p.audioDuration || 0), 0);
  
  // If no audio duration available, estimate based on text length
  // Average reading speed: ~200 words per minute, speaking speed: ~150 words per minute
  let estimatedSeconds = totalDurationSeconds;
  if (estimatedSeconds === 0) {
    const totalWords = paragraphs
      .reduce((sum, p) => sum + (p.content?.split(/\s+/).length || 0), 0);
    estimatedSeconds = Math.round((totalWords / 150) * 60); // 150 words per minute speaking
  }
  
  const estimatedHours = Math.floor(estimatedSeconds / 3600);
  const estimatedMinutes = Math.floor((estimatedSeconds % 3600) / 60);
  
  const formatTime = () => {
    if (estimatedSeconds === 0) return 'Not available';
    if (estimatedHours > 0) {
      return `${estimatedHours}h ${estimatedMinutes}m`;
    }
    return `${estimatedMinutes}m`;
  };

  return (
    <>
      <Link href="/books" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '14px' }}>
        ← Back to books
      </Link>

      <div style={{ marginTop: '20px', marginBottom: '30px' }}>
        <h1 style={{ 
          margin: '0 0 10px 0', 
          fontSize: '2.5rem', 
          fontWeight: 'bold',
          direction: 'rtl',
          textAlign: 'right',
          unicodeBidi: 'plaintext'
        }}>
          {book.title}
        </h1>
        {book.author && (
          <p style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#666' }}>
            by {book.author}
          </p>
        )}
        
        {/* Big Numbers Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          margin: '25px 0',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#0070f3', margin: '0' }}>
              {pageCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
              Pages
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#28a745', margin: '0' }}>
              {paragraphCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
              Paragraphs
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#6f42c1', margin: '0' }}>
              {formatTime()}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
              Estimated Length {totalDurationSeconds > 0 ? '(Audio)' : '(Text-based)'}
            </div>
          </div>
        </div>

        <p style={{ margin: '10px 0', fontSize: '1rem' }}>
          Status: <strong style={{ 
            color: book.status === 'READY' ? '#28a745' : book.status === 'PROCESSING' ? '#ffc107' : '#6c757d',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: book.status === 'READY' ? '#d4edda' : book.status === 'PROCESSING' ? '#fff3cd' : '#f8f9fa'
          }}>
            {book.status}
          </strong>
        </p>
      </div>
    </>
  );
}