import React, { useState } from 'react';
import type { Paragraph } from '@audibook/api-client';
import { getApiUrl } from '../../utils/api';
import { countWords, countCharacters, getTextDirection, getTextAlign } from '../../utils/text';
import { formatParagraphNumber } from '../../utils/paragraphUtils';
import ParagraphDiffView from './ParagraphDiffView';

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
  onRevertToOriginal: (paragraphId: string, generateAudio?: boolean) => void;
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
  onRevertToOriginal,
}: ParagraphComponentProps) {
  const [showDiff, setShowDiff] = useState(false);

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

  // Check if audio is out of sync based on timestamps
  const isAudioOutOfSync = () => {
    if (!paragraph.audioS3Key || !paragraph.audioGeneratedAt) {
      return false; // No audio or no timestamp, can't be out of sync
    }
    
    const audioGenerated = new Date(paragraph.audioGeneratedAt);
    const lastUpdated = new Date(paragraph.updatedAt);
    
    // Calculate time difference in seconds
    const timeDifferenceSeconds = Math.abs(lastUpdated.getTime() - audioGenerated.getTime()) / 1000;
    
    // If timestamps are very close (within 15 seconds), they're likely part of the same operation
    // This handles "Save & Generate Audio" and manual edit + immediate generation
    if (timeDifferenceSeconds <= 15) {
      return false; // Consider them in sync
    }
    
    // Only show warning if text was modified significantly after audio generation
    return lastUpdated > audioGenerated;
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
        <span style={{ fontSize: 'var(--font-size-sm)' }}>
          {getAudioStatusIcon(paragraph.audioStatus)}
          {isAudioOutOfSync() && (
            <span 
              style={{ 
                marginLeft: '4px',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-warning-600)'
              }}
              title="Audio was generated before the last text update"
            >
              ⚠️
            </span>
          )}
        </span>
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
          gap: 'var(--spacing-2)',
          zIndex: 10 // Ensure it stays above other content
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
        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <div style={{
            marginBottom: 'var(--spacing-4)',
            paddingTop: 'var(--spacing-2)', // Better vertical padding
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
            
            {/* Show Diff Button */}
            {(paragraph as any).originalContent && !isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDiff(true);
                }}
                disabled={saving}
                className="button button-secondary"
                style={{
                  cursor: saving ? 'not-allowed' : 'pointer',
                  minWidth: '120px',
                  height: '44px',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  color: 'var(--color-blue-700)',
                  backgroundColor: 'var(--color-blue-50)',
                  border: '1px solid var(--color-blue-300)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-2)',
                  transition: 'all 0.2s ease',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: saving ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
                title="Show differences between current and original content"
              >
                📝 Show Diff
              </button>
            )}
            
            {/* Revert to Original Button */}
            {(paragraph as any).originalContent && (paragraph as any).originalContent !== editContent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRevertToOriginal(paragraph.id, false);
                }}
                disabled={saving}
                className="button button-secondary"
                style={{
                  cursor: saving ? 'not-allowed' : 'pointer',
                  minWidth: '140px',
                  height: '44px',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  color: 'var(--color-orange-700)',
                  backgroundColor: 'var(--color-orange-50)',
                  border: '1px solid var(--color-orange-300)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-2)',
                  transition: 'all 0.2s ease',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: saving ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
                title="Revert to original content from the source book"
              >
                ↩️ Revert to Original
              </button>
            )}
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
          
          {/* Diff and Revert Buttons - show for modified paragraphs */}
          {(paragraph as any).originalContent && (paragraph as any).originalContent !== paragraph.content && (
            <div style={{ 
              marginTop: 'var(--spacing-3)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--spacing-2)'
            }}>
              {/* Show Diff Button - TEMPORARILY HIDDEN DUE TO BUGGY BEHAVIOR */}
              {/* {!isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDiff(true);
                  }}
                disabled={saving}
                style={{
                  cursor: saving ? 'not-allowed' : 'pointer',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  color: 'var(--color-blue-700)',
                  backgroundColor: 'var(--color-blue-50)',
                  border: '1px solid var(--color-blue-300)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  transition: 'all 0.2s ease',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.backgroundColor = 'var(--color-blue-100)';
                    e.currentTarget.style.borderColor = 'var(--color-blue-400)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    e.currentTarget.style.backgroundColor = 'var(--color-blue-50)';
                    e.currentTarget.style.borderColor = 'var(--color-blue-300)';
                  }
                }}
                title="Show differences between current and original content"
                >
                  📝 Show Diff
                </button>
              )} */}
              
              {/* Revert Button - TEMPORARILY HIDDEN DUE TO BUGGY BEHAVIOR */}
              {/* <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRevertToOriginal(paragraph.id, false);
                }}
                disabled={saving}
                style={{
                  cursor: saving ? 'not-allowed' : 'pointer',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  color: 'var(--color-orange-700)',
                  backgroundColor: 'var(--color-orange-50)',
                  border: '1px solid var(--color-orange-300)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  transition: 'all 0.2s ease',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.backgroundColor = 'var(--color-orange-100)';
                    e.currentTarget.style.borderColor = 'var(--color-orange-400)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    e.currentTarget.style.backgroundColor = 'var(--color-orange-50)';
                    e.currentTarget.style.borderColor = 'var(--color-orange-300)';
                  }
                }}
                title="Revert to original content from the source book"
              >
                ↩️ Revert to Original
              </button> */}
            </div>
          )}
          
          {/* Audio Section */}
          <div style={{ marginTop: 'var(--spacing-4)' }}>
            {paragraph.audioStatus === 'READY' ? (
              <div className="card" style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'var(--color-green-50)',
                border: '1px solid var(--color-green-200)'
              }}>
                <div style={{
                  marginBottom: 'var(--spacing-3)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-green-700)',
                    fontWeight: '500'
                  }}>
                    <span>🎵</span>
                    <span>Audio Available</span>
                  </div>
                  
                  {/* Sync Warning Subtitle */}
                  {isAudioOutOfSync() && (
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-warning-600)',
                      fontWeight: '500',
                      marginTop: 'var(--spacing-1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-1)'
                    }}>
                      <span>⚠️</span>
                      <span>Audio might be out of sync - text was modified after generation</span>
                    </div>
                  )}
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
                    src={`${getApiUrl()}/api/books/paragraphs/${paragraph.id}/audio?v=${paragraph.audioS3Key ? btoa(paragraph.audioS3Key).slice(-8) : 'none'}`}
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
                    className="btn"
                    style={{
                      backgroundColor: 'var(--color-green-600)',
                      color: 'white',
                      border: 'none',
                      fontSize: 'var(--font-size-xs)',
                      padding: 'var(--spacing-2) var(--spacing-3)'
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
                  style={{
                    cursor: 'pointer',
                    minWidth: '140px',
                    height: '36px',
                    padding: '0 var(--spacing-3)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600',
                    color: 'white',
                    backgroundColor: 'var(--color-primary-500)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--spacing-1)',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  🎵 Generate Audio
                </button>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Diff Modal */}
      {showDiff && (paragraph as any).originalContent && (
        <ParagraphDiffView
          paragraphId={paragraph.id}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  );
}
