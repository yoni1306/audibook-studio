import type { Paragraph, BookWithDetails } from '@audibook/api-client';

interface AudioStatsProps {
  paragraphs: Paragraph[];
  book?: BookWithDetails;
}

export default function AudioStats({ paragraphs, book }: AudioStatsProps) {
  // Calculate audio status statistics
  const audioStats = {
    ready: paragraphs.filter((p) => p.audioStatus === 'READY').length,
    generating: paragraphs.filter((p) => p.audioStatus === 'GENERATING').length,
    pending: paragraphs.filter((p) => p.audioStatus === 'PENDING').length,
    error: paragraphs.filter((p) => p.audioStatus === 'ERROR').length,
  };

  // Calculate book statistics
  const totalCharacters = paragraphs.reduce((sum, p) => sum + (p.content?.length || 0), 0);
  const totalWords = paragraphs.reduce((sum, p) => {
    const wordCount = p.content ? p.content.trim().split(/\s+/).length : 0;
    return sum + wordCount;
  }, 0);
  const totalParagraphs = paragraphs.length;
  const totalPages = book?.pages?.length || 0;

  // Estimate reading time (average 200 words per minute)
  const estimatedReadingTimeMinutes = Math.ceil(totalWords / 200);
  const readingHours = Math.floor(estimatedReadingTimeMinutes / 60);
  const readingMinutes = estimatedReadingTimeMinutes % 60;
  const readingTimeDisplay = readingHours > 0 
    ? `${readingHours}h ${readingMinutes}m`
    : `${readingMinutes}m`;

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        marginBottom: '24px',
        border: '1px solid #e9ecef',
      }}
    >
      {/* Big Numbers - Book Statistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0066cc', marginBottom: '4px' }}>
            {totalPages}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d', fontWeight: '500' }}>
            📄 Pages
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745', marginBottom: '4px' }}>
            {totalParagraphs}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d', fontWeight: '500' }}>
            📝 Paragraphs
          </div>
        </div>



        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6f42c1', marginBottom: '4px' }}>
            {readingTimeDisplay}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d', fontWeight: '500' }}>
            ⏱️ Est. Reading
          </div>
        </div>
      </div>

      {/* Audio Status Statistics */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#495057' }}>Audio Status</h4>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>✅</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
              {audioStats.ready}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Ready</div>
          </div>
        </div>

        <div
          style={{
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>⏳</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffc107' }}>
              {audioStats.generating}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Generating</div>
          </div>
        </div>

        <div
          style={{
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>⏸️</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6c757d' }}>
              {audioStats.pending}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Pending</div>
          </div>
        </div>

        <div
          style={{
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>❌</span>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
              {audioStats.error}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>Error</div>
          </div>
        </div>
      </div>
    </div>
  );
}
