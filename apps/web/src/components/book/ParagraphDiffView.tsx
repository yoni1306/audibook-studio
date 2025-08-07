import { useState, useEffect } from 'react';
import { getApiUrl } from '../../utils/api';

interface ParagraphDiffViewProps {
  paragraphId: string;
  onClose: () => void;
}

interface WordChange {
  originalWord: string;
  correctedWord: string;
  position: number;
  fixType: string;
}

interface TokenDiffItem {
  type: 'added' | 'modified' | 'removed' | 'unchanged';
  text: string;
  startPos: number;
  endPos: number;
  originalText?: string;
  fixType?: string;
  changeId?: string;
}

interface DiffResponse {
  changes: WordChange[];
  originalContent: string;
  currentContent: string;
  tokenDiff: TokenDiffItem[]; // New: precise token-level diff
}

// Simple function to create word-level diff display
function createSimpleDiff(originalContent: string, currentContent: string, changes: WordChange[], tokenDiff?: TokenDiffItem[]) {
  // If no changes, show current content
  if (changes.length === 0) {
    return {
      hasChanges: false,
      originalText: originalContent,
      currentText: currentContent,
      changesSummary: 'No changes detected',
      tokenDiff: tokenDiff || [{ type: 'unchanged' as const, text: currentContent, startPos: 0, endPos: currentContent.length }]
    };
  }

  // Create a summary of changes
  const changesSummary = `${changes.length} change${changes.length > 1 ? 's' : ''} detected`;
  
  return {
    hasChanges: true,
    originalText: originalContent,
    currentText: currentContent,
    changesSummary,
    changes,
    tokenDiff: tokenDiff || [] // Use backend-provided token diff for precise rendering
  };
}

export default function ParagraphDiffView({ paragraphId, onClose }: ParagraphDiffViewProps) {
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiff = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${getApiUrl()}/api/books/paragraphs/${paragraphId}/diff`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch diff: ${response.statusText}`);
        }
        
        const data: DiffResponse = await response.json();
        setDiffData(data);
      } catch (err) {
        console.error('Error fetching paragraph diff:', err);
        setError(err instanceof Error ? err.message : 'Failed to load diff');
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [paragraphId]);

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1040,
          padding: 'var(--spacing-4)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--spacing-8)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--color-gray-200)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-2)' }}>🔄</div>
            <div>Loading diff...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !diffData) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1040,
          padding: 'var(--spacing-4)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--spacing-8)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--color-gray-200)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-2)' }}>❌</div>
            <div>Error: {error || 'Failed to load diff'}</div>
            <button
              onClick={onClose}
              style={{
                marginTop: 'var(--spacing-4)',
                padding: 'var(--spacing-2) var(--spacing-4)',
                backgroundColor: 'var(--color-blue-600)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const diffInfo = createSimpleDiff(diffData.originalContent, diffData.currentContent, diffData.changes, diffData.tokenDiff);
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1040,
        padding: 'var(--spacing-4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--spacing-8)',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-gray-200)',
          minWidth: '700px',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-6)',
            borderBottom: '1px solid var(--color-gray-200)',
            paddingBottom: 'var(--spacing-4)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--font-size-lg)',
              fontWeight: '600',
              color: 'var(--color-gray-900)',
            }}
          >
            📝 Paragraph Changes
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--font-size-xl)',
              cursor: 'pointer',
              color: 'var(--color-gray-500)',
              padding: 'var(--spacing-2)',
              borderRadius: 'var(--radius-md)',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-gray-700)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-gray-500)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Summary */}
        <div
          style={{
            marginBottom: 'var(--spacing-6)',
            padding: 'var(--spacing-3)',
            backgroundColor: diffInfo.hasChanges ? 'var(--color-blue-50)' : 'var(--color-gray-50)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${diffInfo.hasChanges ? 'var(--color-blue-200)' : 'var(--color-gray-200)'}`,
          }}
        >
          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: 'var(--color-gray-700)' }}>
            Unified Diff View (Based on Original Content):
          </h4>
        </div>

        {/* Unified diff view */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <h4
            style={{
              margin: '0 0 var(--spacing-3) 0',
              fontSize: 'var(--font-size-base)',
              fontWeight: '600',
              color: 'var(--color-gray-700)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
            }}
          >
            📝 Text with Changes Highlighted
          </h4>
          <div
            style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '1px solid var(--color-gray-200)',
              borderRadius: 'var(--radius-md)',
              fontSize: '16px',
              lineHeight: '1.8',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              color: 'var(--color-gray-900)',
              minHeight: '120px',
              maxHeight: '400px',
              overflowY: 'auto',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              wordWrap: 'break-word',
              textAlign: 'left',
            }}
          >
            {(diffInfo.tokenDiff || []).map((token, index) => {
              if (token.type === 'modified') {
                // Modified words - simple blue highlighting
                return (
                  <span
                    key={index}
                    style={{
                      backgroundColor: '#dbeafe', // blue-100
                      color: '#1e40af', // blue-700
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontWeight: '500',
                      cursor: 'help',
                    }}
                    title={`Modified from "${token.originalText || 'unknown'}"`}
                  >
                    {token.text}
                  </span>
                );
              } else if (token.type === 'added') {
                // Added words - green highlighting
                return (
                  <span
                    key={index}
                    style={{
                      backgroundColor: '#dcfce7', // green-50
                      color: '#166534', // green-800
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontWeight: '500',
                      cursor: 'help',
                      border: '1px solid #bbf7d0', // green-200
                    }}
                    title="Added word"
                  >
                    {token.text}
                  </span>
                );
              } else if (token.type === 'removed') {
                // Removed words - red highlighting with strikethrough
                return (
                  <span
                    key={index}
                    style={{
                      backgroundColor: '#fef2f2', // red-50
                      color: '#991b1b', // red-800
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontWeight: '500',
                      cursor: 'help',
                      textDecoration: 'line-through',
                      border: '1px solid #fecaca', // red-200
                      opacity: 0.8,
                    }}
                    title="Removed from original"
                  >
                    {token.text}
                  </span>
                );
              } else {
                // Unchanged words - preserve whitespace and formatting
                return (
                  <span key={index} style={{ color: 'var(--color-gray-800)', whiteSpace: 'pre-wrap' }}>
                    {token.text}
                  </span>
                );
              }
            })}
          </div>
          
          {/* Color Legend */}
          {diffInfo.hasChanges && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: 'var(--color-gray-50)',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--color-gray-700)' }}>Change Types:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '3px', fontSize: '12px', border: '1px solid #bbf7d0', fontWeight: '500' }}>Added</span>
                  <span style={{ color: 'var(--color-gray-600)' }}>New words</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '3px', fontSize: '12px', fontWeight: '500' }}>Modified</span>
                  <span style={{ color: 'var(--color-gray-600)' }}>Changed words</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '2px 6px', borderRadius: '3px', fontSize: '12px', textDecoration: 'line-through', border: '1px solid #fecaca', fontWeight: '500' }}>Removed</span>
                  <span style={{ color: 'var(--color-gray-600)' }}>Deleted words</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Changes List */}
        {diffInfo.hasChanges && diffInfo.changes && (
          <div>
            <h4
              style={{
                margin: '0 0 var(--spacing-3) 0',
                fontSize: 'var(--font-size-base)',
                fontWeight: '600',
                color: 'var(--color-gray-700)',
              }}
            >
              🔍 Detected Changes
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              {diffInfo.changes.map((change, index) => (
                <div
                  key={index}
                  style={{
                    padding: 'var(--spacing-3)',
                    backgroundColor: 'var(--color-white)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-gray-200)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        backgroundColor: 'var(--color-blue-100)',
                        color: 'var(--color-blue-800)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '500',
                      }}
                    >
                      {change.fixType}
                    </span>
                    <span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-xs)' }}>
                      Position {change.position}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        backgroundColor: 'var(--color-red-100)',
                        color: 'var(--color-red-800)',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'line-through',
                        fontFamily: 'var(--font-family-mono)',
                      }}
                    >
                      {change.originalWord}
                    </span>
                    <span style={{ color: 'var(--color-gray-400)' }}>→</span>
                    <span
                      style={{
                        padding: '2px 6px',
                        backgroundColor: 'var(--color-green-100)',
                        color: 'var(--color-green-800)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-family-mono)',
                      }}
                    >
                      {change.correctedWord}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
