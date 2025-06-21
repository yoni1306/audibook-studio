'use client';

import { Paragraph } from './ParagraphComponent';

interface AudioStatsProps {
  paragraphs: Paragraph[];
}

export default function AudioStats({ paragraphs }: AudioStatsProps) {
  const audioStats = {
    ready: paragraphs.filter((p) => p.audioStatus === 'READY').length,
    generating: paragraphs.filter((p) => p.audioStatus === 'GENERATING').length,
    pending: paragraphs.filter((p) => p.audioStatus === 'PENDING').length,
    error: paragraphs.filter((p) => p.audioStatus === 'ERROR').length,
  };

  return (
    <div
      style={{
        padding: '15px',
        backgroundColor: '#f0f0f0',
        borderRadius: '5px',
        marginBottom: '20px',
      }}
    >
      <h3>Audio Status</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
        }}
      >
        <div>
          ✅ Ready: <strong>{audioStats.ready}</strong>
        </div>
        <div>
          ⏳ Generating: <strong>{audioStats.generating}</strong>
        </div>
        <div>
          ⏸️ Pending: <strong>{audioStats.pending}</strong>
        </div>
        <div>
          ❌ Error: <strong>{audioStats.error}</strong>
        </div>
      </div>
    </div>
  );
}