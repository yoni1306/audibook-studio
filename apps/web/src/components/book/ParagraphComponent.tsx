import type { Paragraph } from '@audibook/api-client';
import { getApiUrl } from '../../utils/api';
import { countWords, countCharacters, getTextDirection, getTextAlign } from '../../utils/text';
import { formatParagraphNumber } from '../../utils/paragraphUtils';

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
  onSaveAndGenerateAudio: () => void;
  onToggleCompleted: (paragraphId: string, completed: boolean) => void;
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
  onSaveAndGenerateAudio,
  onToggleCompleted,
}: ParagraphComponentProps) {
  const getAudioStatusIcon = (status: string) => {
    switch (status) {
      case 'READY':
        return '✅';
      case 'GENERATING':
        return '🔄';
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
      className="card"
      style={{
        marginBottom: 'var(--spacing-5)',
        padding: 'var(--spacing-4)',
        position: 'relative',
        cursor: !isEditing && !paragraph.completed ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        border: isEditing ? '2px solid var(--color-primary-300)' : 
                paragraph.completed ? '1px solid var(--color-success-200)' : '1px solid var(--color-gray-200)',
        backgroundColor: isEditing ? 'var(--color-primary-50)' : 
                        paragraph.completed ? 'var(--color-gray-50)' : 'white',
        opacity: paragraph.completed ? 0.85 : 1
      }}
      onClick={() => !isEditing && !paragraph.completed && onStartEdit()}
    >
      <div
        style={{
          position: 'absolute',
          top: 'var(--spacing-3)',
          right: 'var(--spacing-4)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-gray-500)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-2)',
          backgroundColor: 'var(--color-gray-100)',
          padding: 'var(--spacing-1) var(--spacing-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-gray-200)'
        }}
      >
        <span style={{ fontSize: 'var(--font-size-sm)' }}>{getAudioStatusIcon(paragraph.audioStatus)}</span>
        <span style={{ fontWeight: '500' }}>
          📖 Page {paragraph.pageNumber} | Paragraph {formatParagraphNumber(paragraph.orderIndex, true)}
        </span>
        <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--font-size-xs)' }}>•</span>
        <span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-xs)' }}>
          {countWords(paragraph.content)} words | {countCharacters(paragraph.content)} chars
        </span>
      </div>

      {/* Completed Status Toggle */}
      <div
        style={{
          position: 'absolute',
          top: 'var(--spacing-3)',
          left: 'var(--spacing-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-2)'
        }}
      >
        {(() => {
          const hasAudio = paragraph.audioStatus === 'READY' && paragraph.audioS3Key;
          const isDisabled = !hasAudio && !paragraph.completed;
          
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled) {
                  onToggleCompleted(paragraph.id, !paragraph.completed);
                }
              }}
              disabled={isDisabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-1)',
                padding: 'var(--spacing-1) var(--spacing-2)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: '500',
                border: '1px solid',
                borderRadius: 'var(--radius-sm)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: isDisabled ? 'var(--color-gray-50)' : 
                                paragraph.completed ? 'var(--color-success-100)' : 'var(--color-gray-100)',
                borderColor: isDisabled ? 'var(--color-gray-200)' : 
                            paragraph.completed ? 'var(--color-success-300)' : 'var(--color-gray-300)',
                color: isDisabled ? 'var(--color-gray-400)' : 
                      paragraph.completed ? 'var(--color-success-700)' : 'var(--color-gray-600)',
                opacity: isDisabled ? 0.6 : 1
              }}
              title={isDisabled ? 'Audio must be generated before marking as completed' : 
                    paragraph.completed ? 'Mark as incomplete' : 'Mark as completed'}
            >
              <span style={{ fontSize: 'var(--font-size-sm)' }}>
                {paragraph.completed ? '✅' : '⭕'}
              </span>
              <span>
                {paragraph.completed ? 'Completed' : 'Mark Complete'}
              </span>
            </button>
          );
        })()
        }
      </div>

      {isEditing ? (
        <div style={{ marginTop: 'var(--spacing-5)' }}>
          <div style={{
            marginBottom: 'var(--spacing-3)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-gray-600)',
            fontWeight: '500'
          }}>
            ✏️ Editing Paragraph Content
          </div>
          <textarea
            value={editContent}
            onChange={(e) => onContentChange(e.target.value)}
            className="textarea"
            style={{
              width: '100%',
              minHeight: '120px',
              resize: 'vertical',
              direction: getTextDirection(editContent),
              textAlign: getTextAlign(editContent),
              fontSize: 'var(--font-size-base)',
              lineHeight: '1.6'
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Enter paragraph content..."
          />
          <div 
            style={{ 
              marginTop: 'var(--spacing-4)',
              display: 'flex',
              gap: 'var(--spacing-3)',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              alignItems: 'center',
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-gray-200)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onSaveEdit}
              disabled={saving}
              className="btn btn-primary"
              style={{
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
                minWidth: '120px',
                height: '44px',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '600',
                color: 'white',
                backgroundColor: 'var(--color-primary-500)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-2)',
                transition: 'all 0.2s ease',
                boxShadow: saving ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              {saving ? (
                <>
                  <span className="spinner" style={{
                    width: '14px',
                    height: '14px',
                    marginRight: 'var(--spacing-1)'
                  }}></span>
                  Saving...
                </>
              ) : (
                '💾 Save Text'
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSaveAndGenerateAudio();
              }}
              disabled={saving}
              className="btn btn-primary"
              style={{
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
                minWidth: '180px',
                height: '44px',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '600',
                color: 'white',
                backgroundColor: 'var(--color-primary-500)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-2)',
                transition: 'all 0.2s ease',
                boxShadow: saving ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              💾🎵 Save & Generate Audio
            </button>
            <button
              onClick={onCancelEdit}
              disabled={saving}
              className="button button-secondary"
              style={{
                cursor: saving ? 'not-allowed' : 'pointer',
                minWidth: '100px',
                height: '44px',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '600',
                color: 'var(--color-gray-700)',
                backgroundColor: 'white',
                border: '1px solid var(--color-gray-300)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-2)',
                transition: 'all 0.2s ease',
                opacity: saving ? 0.7 : 1,
                boxShadow: saving ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              marginTop: 'var(--spacing-8)',
              fontSize: 'var(--font-size-base)',
              lineHeight: '1.7',
              color: 'var(--color-gray-800)',
              direction: getTextDirection(paragraph.content),
              textAlign: getTextAlign(paragraph.content),
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-gray-200)',
              minHeight: '60px'
            }}
          >
            {paragraph.content || (
              <span style={{ 
                color: 'var(--color-gray-400)', 
                fontStyle: 'italic' 
              }}>
                No content available
              </span>
            )}
          </div>
          
          {/* Audio Section */}
          <div style={{ marginTop: 'var(--spacing-4)' }}>
            {paragraph.audioStatus === 'READY' ? (
              <div className="card" style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'var(--color-green-50)',
                border: '1px solid var(--color-green-200)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  marginBottom: 'var(--spacing-3)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-green-700)',
                  fontWeight: '500'
                }}>
                  <span>🎵</span>
                  <span>Audio Available</span>
                </div>
                <audio
                  controls
                  style={{ 
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-3)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <source
                    src={`${getApiUrl()}/api/books/paragraphs/${paragraph.id}/audio`}
                    type="audio/mpeg"
                  />
                  Your browser does not support the audio element.
                </audio>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ 
                    fontSize: 'var(--font-size-xs)', 
                    color: 'var(--color-gray-600)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-1)'
                  }}>
                    <span>⏱️</span>
                    {paragraph.audioDuration
                      ? `Duration: ${Math.round(paragraph.audioDuration)} seconds`
                      : 'Duration: Unknown'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateAudio();
                    }}
                    className="button button-sm"
                    style={{
                      backgroundColor: 'var(--color-green-600)',
                      color: 'white',
                      border: 'none',
                      fontSize: 'var(--font-size-xs)'
                    }}
                  >
                    🔄 Regenerate
                  </button>
                </div>
              </div>
            ) : paragraph.audioStatus === 'GENERATING' ? (
              <div className="card" style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'var(--color-yellow-50)',
                border: '1px solid var(--color-yellow-200)',
                textAlign: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-2)',
                  color: 'var(--color-yellow-700)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: '500',
                  marginBottom: 'var(--spacing-2)'
                }}>
                  <span className="spinner" style={{
                    width: '20px',
                    height: '20px'
                  }}></span>
                  <span>Generating audio...</span>
                </div>
                <div style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--color-yellow-600)'
                }}>
                  This may take a moment. Page will auto-refresh.
                </div>
              </div>
            ) : paragraph.audioStatus === 'ERROR' ? (
              <div className="card" style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'var(--color-error-50)',
                border: '1px solid var(--color-error-200)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  color: 'var(--color-error-700)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500'
                }}>
                  <span>❌</span>
                  <span>Audio generation failed</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateAudio();
                  }}
                  className="button button-sm"
                  style={{
                    backgroundColor: 'var(--color-error-600)',
                    color: 'white',
                    border: 'none',
                    fontSize: 'var(--font-size-xs)'
                  }}
                >
                  🔄 Retry
                </button>
              </div>
            ) : (
              <div className="card" style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'var(--color-gray-50)',
                border: '1px solid var(--color-gray-200)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  color: 'var(--color-gray-600)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <span>⏸️</span>
                  <span>No audio generated</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateAudio();
                  }}
                  className="button button-primary button-sm"
                  style={{
                    fontSize: 'var(--font-size-xs)'
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
