'use client';

export interface Paragraph {
  id: string;
  pageNumber: number;
  pageId: string;
  orderIndex: number;
  content: string;
  audioStatus: string;
  audioS3Key: string | null;
  audioDuration: number | null;
}

// Utility functions for text statistics
const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

const countCharacters = (text: string): number => {
  return text.length;
};

interface ParagraphComponentProps {
  paragraph: Paragraph;
  isEditing: boolean;
  editContent: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onContentChange: (content: string) => void;
  onGenerateAudio: () => void;
}

export default function ParagraphComponent({
  paragraph,
  isEditing,
  editContent,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onContentChange,
  onGenerateAudio,
}: ParagraphComponentProps) {
  const getAudioStatusIcon = (status: string) => {
    switch (status) {
      case 'READY':
        return '✅';
      case 'GENERATING':
        return '⏳';
      case 'ERROR':
        return '❌';
      case 'PENDING':
        return '⏸️';
      default:
        return '❓';
    }
  };

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '5px',
        position: 'relative',
        cursor: !isEditing ? 'pointer' : 'default',
      }}
      onClick={() => !isEditing && onStartEdit()}
    >
      <div
        style={{
          position: 'absolute',
          top: '5px',
          right: '10px',
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span>{getAudioStatusIcon(paragraph.audioStatus)}</span>
        <span>
          Page {paragraph.pageNumber} | Paragraph #{paragraph.orderIndex + 1}
        </span>
        <span style={{ color: '#888', fontSize: '11px' }}>
          {countWords(paragraph.content)} words | {countCharacters(paragraph.content)} chars
        </span>
      </div>

      {isEditing ? (
        <div style={{ marginTop: '20px' }}>
          <textarea
            value={editContent}
            onChange={(e) => onContentChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              resize: 'vertical',
              direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(editContent) ? 'rtl' : 'ltr',
              textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(editContent) ? 'right' : 'left'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={onSaveEdit}
              disabled={saving}
              style={{
                padding: '8px 16px',
                marginRight: '10px',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Text'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSaveEdit();
                onGenerateAudio();
              }}
              disabled={saving}
              style={{
                padding: '8px 16px',
                marginRight: '10px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Save & Generate Audio
            </button>
            <button
              onClick={onCancelEdit}
              disabled={saving}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ccc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={{
            marginTop: '20px',
            marginBottom: '10px',
            direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(paragraph.content) ? 'rtl' : 'ltr',
            textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(paragraph.content) ? 'right' : 'left'
          }}>
            {paragraph.content}
          </p>
          
          {/* Audio Section */}
          <div style={{ marginTop: '15px' }}>
            {paragraph.audioStatus === 'READY' && paragraph.audioS3Key ? (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: '5px',
                }}
              >
                <audio controls style={{ width: '100%' }}>
                  <source
                    src={`http://localhost:3333/api/books/paragraphs/${paragraph.id}/audio`}
                    type="audio/mpeg"
                  />
                  Your browser does not support the audio element.
                </audio>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '5px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {paragraph.audioDuration &&
                      `Duration: ${Math.round(paragraph.audioDuration)} seconds`}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateAudio();
                    }}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Regenerate
                  </button>
                </div>
              </div>
            ) : paragraph.audioStatus === 'GENERATING' ? (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#fff3e0',
                  borderRadius: '5px',
                  color: '#f57c00',
                  textAlign: 'center',
                }}
              >
                <div>🔊 Generating audio...</div>
                <div style={{ fontSize: '12px', marginTop: '5px' }}>
                  This may take a moment. Page will auto-refresh.
                </div>
              </div>
            ) : paragraph.audioStatus === 'ERROR' ? (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#ffebee',
                  borderRadius: '5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#c62828' }}>
                  ❌ Audio generation failed
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateAudio();
                  }}
                  style={{
                    padding: '5px 15px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Retry
                </button>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#666', fontSize: '14px' }}>
                  ⏸️ No audio generated
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateAudio();
                  }}
                  style={{
                    padding: '5px 15px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  🎵 Generate Audio
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}