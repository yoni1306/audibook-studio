import React from 'react';
import { BulkFixSuggestion } from '@audibook/api-client';

interface BulkFixNotificationProps {
  suggestions: BulkFixSuggestion[];
  onReviewFixes: () => void;
  onSkip: () => void;
}

export default function BulkFixNotification({ 
  suggestions, 
  onReviewFixes, 
  onSkip 
}: BulkFixNotificationProps) {
  // Add null check to prevent 'Cannot read properties of undefined' error
  const totalParagraphs = suggestions?.reduce((total, s) => total + (s?.paragraphs?.length || 0), 0) || 0;

  return (
    <div
      style={{
        padding: '15px',
        backgroundColor: '#e3f2fd',
        borderRadius: '5px',
        marginBottom: '20px',
        border: '1px solid #2196f3',
      }}
    >
      <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
        🔍 Similar Text Found
      </h4>
      <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
        Found {totalParagraphs} more paragraphs with similar text that could benefit from the same fixes.
        <br />
        <small style={{ color: '#666' }}>
          Click &quot;Show Previews&quot; to review all sentences containing these words without applying any changes.
        </small>
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onReviewFixes}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Show Previews
        </button>
        <button
          onClick={onSkip}
          style={{
            padding: '8px 16px',
            backgroundColor: '#fff',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Skip for Now
        </button>
      </div>
    </div>
  );
}
