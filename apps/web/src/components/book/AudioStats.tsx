import type { Paragraph, BookWithDetails } from '@audibook/api-client';

interface AudioStatsProps {
  paragraphs: Paragraph[];
  book?: BookWithDetails;
}

export default function AudioStats({ paragraphs, book }: AudioStatsProps) {
  // Safety check for paragraphs
  const safeParagraphs = paragraphs || [];
  
  // Calculate book statistics
  const totalParagraphs = paragraphs.length;
  // Note: pages property may not exist on BookWithDetails type - using fallback
  const totalPages = book && 'pages' in book ? (book as { pages?: unknown[] }).pages?.length || 0 : 0;

  // Calculate total listening time for all paragraphs
  const totalListeningDurationSeconds = safeParagraphs.reduce((sum, p) => {
    return sum + (p.audioDuration || 0);
  }, 0);
  const totalListeningMinutes = Math.floor(totalListeningDurationSeconds / 60);
  const totalListeningHours = Math.floor(totalListeningMinutes / 60);
  const remainingListeningMinutes = totalListeningMinutes % 60;
  const totalListeningTimeDisplay = totalListeningHours > 0 
    ? `${totalListeningHours}h ${remainingListeningMinutes}m`
    : `${totalListeningMinutes}m`;

  // Calculate completed paragraphs listening time
  const completedParagraphs = safeParagraphs.filter(p => p.completed);
  const totalCompletedDurationSeconds = completedParagraphs.reduce((sum, p) => {
    return sum + (p.audioDuration || 0);
  }, 0);
  const completedDurationMinutes = Math.floor(totalCompletedDurationSeconds / 60);
  const completedDurationHours = Math.floor(completedDurationMinutes / 60);
  const remainingMinutes = completedDurationMinutes % 60;
  const completedListeningTimeDisplay = completedDurationHours > 0 
    ? `${completedDurationHours}h ${remainingMinutes}m`
    : `${completedDurationMinutes}m`;

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
      {/* First Row: Book Metadata */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
          marginBottom: '20px',
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
      </div>

      {/* Second Row: Audio Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
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
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6f42c1', marginBottom: '4px' }}>
            {totalListeningTimeDisplay}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d', fontWeight: '500' }}>
            🎵 Est. Total Listening
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
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#17a2b8', marginBottom: '4px' }}>
            {completedListeningTimeDisplay}
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d', fontWeight: '500' }}>
            🎧 Completed Audio
          </div>
        </div>
      </div>


    </div>
  );
}
