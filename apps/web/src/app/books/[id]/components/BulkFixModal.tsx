'use client';

import { useEffect, useState } from 'react';
import { createLogger } from '../../../../utils/logger';

export interface BulkFixSuggestion {
  originalWord: string;
  fixedWord: string;
  fixType: string;
  paragraphIds: string[];
  count: number;
  // For backward compatibility with existing UI
  paragraphs?: Array<{
    id: string;
    chapterNumber: number;
    orderIndex: number;
    content: string;
    occurrences: number;
    previewBefore: string;
    previewAfter: string;
  }>;
}

interface BulkFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: BulkFixSuggestion[];
  bookId: string;
  onApplyFixes: (result: any) => void;
}

// Create a logger instance for this component
const logger = createLogger('BulkFixModal');

export default function BulkFixModal({ 
  isOpen, 
  onClose, 
  suggestions, 
  bookId, 
  onApplyFixes 
}: BulkFixModalProps) {
  const [selectedFixes, setSelectedFixes] = useState<{[key: string]: string[]}>({});
  const [applying, setApplying] = useState(false);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [loadingPreviews, setLoadingPreviews] = useState(true);
  const [showPreviews, setShowPreviews] = useState(true);
  
  // Function to handle loading previews
  const handleLoadPreviews = () => {
    setLoadingPreviews(true);
    // Simulate loading delay for better UX
    setTimeout(() => {
      setLoadingPreviews(false);
    }, 800);
  };
  
  // Log the suggestions we received when they change
  useEffect(() => {
    if (isOpen && suggestions?.length > 0) {
      logger.debug('Received bulk fix suggestions:', suggestions);
      // Set loading state when modal opens
      setLoadingPreviews(true);
      
      // Simulate loading delay for better UX
      const timer = setTimeout(() => {
        setLoadingPreviews(false);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, suggestions]);

  useEffect(() => {
    if (isOpen) {
      // Initialize with all paragraphs selected by default and automatically show previews
      const initialSelection: {[key: string]: string[]} = {};
      suggestions.forEach(suggestion => {
        const key = `${suggestion.originalWord}:${suggestion.fixedWord}`;
        // Handle both old and new formats
        if (suggestion.paragraphIds) {
          // New format from DTO
          initialSelection[key] = [...suggestion.paragraphIds];
        } else if (suggestion.paragraphs) {
          // Old format
          initialSelection[key] = suggestion.paragraphs.map(p => p.id);
        }
      });
      setSelectedFixes(initialSelection);
      
      // Automatically show previews when modal opens
      setShowPreviews(true);
      handleLoadPreviews();
    }
  }, [isOpen, suggestions]);

  const handleToggleParagraph = (wordKey: string, paragraphId: string) => {
    setSelectedFixes(prev => {
      const current = prev[wordKey] || [];
      const updated = current.includes(paragraphId)
        ? current.filter(id => id !== paragraphId)
        : [...current, paragraphId];
      
      return {
        ...prev,
        [wordKey]: updated
      };
    });
  };

  const handleToggleAll = (wordKey: string, allParagraphIds: string[]) => {
    setSelectedFixes(prev => {
      const current = prev[wordKey] || [];
      const allSelected = allParagraphIds.every(id => current.includes(id));
      
      return {
        ...prev,
        [wordKey]: allSelected ? [] : allParagraphIds
      };
    });
  };

  const handleApply = async () => {
    setApplying(true);
    
    try {
      const fixes = Object.entries(selectedFixes)
        .filter(([_, paragraphIds]) => paragraphIds.length > 0)
        .map(([wordKey, paragraphIds]) => {
          const [originalWord, fixedWord] = wordKey.split(':');
          return {
            originalWord,
            fixedWord,
            paragraphIds
          };
        });

      const response = await fetch('http://localhost:3333/api/books/bulk-fixes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId,
          fixes
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply bulk fixes');
      }

      const result = await response.json();
      onApplyFixes(result);
      onClose();
    } catch (error) {
      console.error('Error applying bulk fixes:', error);
      alert('Failed to apply bulk fixes. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const getTotalSelected = () => {
    return Object.values(selectedFixes).reduce((total, paragraphIds) => total + paragraphIds.length, 0);
  };

  if (!isOpen) return null;



  return (
    <div style={{
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '1152px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              margin: 0
            }}>
              Preview Fixes in Context
            </h2>
            <p style={{ margin: '4px 0 0 0' }}>
              Found similar words in other paragraphs. Select which ones to fix.
              <br />
              <small style={{ color: '#9ca3af' }}>
                Note: Audio will only be regenerated for the current paragraph you're editing.
              </small>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '24px',
          overflowY: 'auto',
          maxHeight: '60vh'
        }}>
          {suggestions.map(suggestion => {
            const wordKey = `${suggestion.originalWord}:${suggestion.fixedWord}`;
            const selectedParagraphs = selectedFixes[wordKey] || [];
            
            // Handle both old and new formats
            let allParagraphIds: string[] = [];
            let paragraphsToRender: Array<{
              id: string;
              chapterNumber: number;
              orderIndex: number;
              content: string;
              occurrences: number;
              previewBefore: string;
              previewAfter: string;
            }> = [];
            
            if (suggestion.paragraphIds) {
              // New DTO format
              allParagraphIds = suggestion.paragraphIds;
              // We don't have paragraph details in the new format
              // This is a limitation until we update the backend to include paragraph details
              logger.debug(`Using paragraphIds for ${suggestion.originalWord}->${suggestion.fixedWord}`);
            } else if (suggestion.paragraphs) {
              // Old format with paragraph details
              allParagraphIds = suggestion.paragraphs.map(p => p.id);
              paragraphsToRender = suggestion.paragraphs;
              logger.debug(`Using paragraphs for ${suggestion.originalWord}->${suggestion.fixedWord}`);
            }
            
            const allSelected = allParagraphIds.length === selectedParagraphs.length;
            const isExpanded = expandedWord === wordKey;

            return (
              <div key={wordKey} style={{
                marginBottom: '24px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#dc2626', fontWeight: '500' }}>"{suggestion.originalWord}"</span>
                        <span style={{ color: '#9ca3af' }}>→</span>
                        <span style={{ color: '#16a34a', fontWeight: '500' }}>"{suggestion.fixedWord}"</span>
                      </div>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        Found in {suggestion.paragraphs?.length || suggestion.paragraphIds?.length} paragraphs
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => handleToggleAll(wordKey, allParagraphIds)}
                          style={{ borderRadius: '4px' }}
                        />
                        <span style={{ fontSize: '14px', color: '#374151' }}>Select all</span>
                      </label>
                      <button
                        onClick={() => setExpandedWord(isExpanded ? null : wordKey)}
                        style={{
                          color: '#2563eb',
                          fontSize: '14px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Show details'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '12px'
                  }}>
                    {paragraphsToRender.length === 0 && (
                      <div style={{ padding: '12px', color: '#6b7280', fontSize: '14px' }}>
                        {suggestion.count} occurrences in {suggestion.paragraphIds?.length || 0} paragraphs
                      </div>
                    )}
                    {showPreviews ? (
                      loadingPreviews ? (
                        <div style={{
                          padding: '40px',
                          textAlign: 'center'
                        }}>
                          <div style={{
                            border: '4px solid #f3f3f3',
                            borderTop: '4px solid #3498db',
                            borderRadius: '50%',
                            width: '30px',
                            height: '30px',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 15px auto'
                          }}></div>
                          <p style={{ color: '#6b7280' }}>Loading previews...</p>
                          <style jsx>{`
                            @keyframes spin {
                              0% { transform: rotate(0deg); }
                              100% { transform: rotate(360deg); }
                            }
                          `}</style>
                        </div>
                      ) : (
                        suggestion.paragraphs?.map((paragraph, pIdx) => {
                          const isExpanded = expandedWord === wordKey;
                          const allParagraphIds = suggestion.paragraphs?.map(p => p.id) || [];
                          return (
                            <div
                              key={paragraph.id}
                              style={{
                                padding: '12px',
                                borderBottom: pIdx < (suggestion.paragraphs?.length || 0) - 1 ? '1px solid #e5e7eb' : 'none'
                              }}
                            >
                              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedFixes[wordKey]?.includes(paragraph.id) || false}
                                  onChange={() => handleToggleParagraph(wordKey, paragraph.id)}
                                  style={{ marginTop: '4px' }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '14px',
                                    color: '#6b7280',
                                    marginBottom: '4px'
                                  }}>
                                    <span>Ch. {paragraph.chapterNumber}</span>
                                    <span>Para. {paragraph.orderIndex + 1}</span>
                                    <span style={{
                                      backgroundColor: '#fef3c7',
                                      color: '#d97706',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '12px'
                                    }}>
                                      {paragraph.occurrences} occurrence{paragraph.occurrences > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div style={{ marginTop: '8px' }}>
                                      <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                                        <div style={{ color: '#6b7280', marginBottom: '4px' }}>Before:</div>
                                        <div style={{
                                          backgroundColor: '#fef2f2',
                                          border: '1px solid #fecaca',
                                          borderRadius: '4px',
                                          padding: '8px',
                                          color: '#374151',
                                          maxHeight: '200px',
                                          overflowY: 'auto',
                                          whiteSpace: 'pre-wrap'
                                        }}>
                                          {paragraph.previewBefore.split('.').map((sentence, idx) => {
                                            // Skip empty sentences
                                            if (!sentence.trim()) return null;
                                            
                                            // Check if this sentence contains the original word
                                            const hasWord = new RegExp(`(^|\\s|[\\p{P}])(${suggestion.originalWord})($|\\s|[\\p{P}])`, 'ui').test(sentence);
                                            
                                            // Check if text contains Hebrew characters
                                            const containsHebrew = /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence);
                                            
                                            return (
                                              <div key={idx} style={{
                                                padding: '2px 0',
                                                backgroundColor: hasWord ? '#ffedd5' : 'transparent',
                                                margin: '2px 0',
                                                direction: containsHebrew ? 'rtl' : 'ltr',
                                                textAlign: containsHebrew ? 'right' : 'left'
                                              }}>
                                                {sentence.trim()}{idx < paragraph.previewBefore.split('.').length - 1 ? '.' : ''}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div style={{ fontSize: '12px' }}>
                                        <div style={{ color: '#6b7280', marginBottom: '4px' }}>After:</div>
                                        <div style={{
                                          backgroundColor: '#f0fdf4',
                                          border: '1px solid #bbf7d0',
                                          borderRadius: '4px',
                                          padding: '8px',
                                          color: '#374151',
                                          maxHeight: '200px',
                                          overflowY: 'auto',
                                          whiteSpace: 'pre-wrap'
                                        }}>
                                          {paragraph.previewAfter.split('.').map((sentence, idx) => {
                                            // Skip empty sentences
                                            if (!sentence.trim()) return null;
                                            
                                            // Check if this sentence contains the fixed word
                                            const hasWord = new RegExp(`(^|\\s|[\\p{P}])(${suggestion.fixedWord})($|\\s|[\\p{P}])`, 'ui').test(sentence);
                                            
                                            // Check if text contains Hebrew characters
                                            const containsHebrew = /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence);
                                            
                                            return (
                                              <div key={idx} style={{
                                                padding: '2px 0',
                                                backgroundColor: hasWord ? '#dcfce7' : 'transparent',
                                                margin: '2px 0',
                                                direction: containsHebrew ? 'rtl' : 'ltr',
                                                textAlign: containsHebrew ? 'right' : 'left'
                                              }}>
                                                {sentence.trim()}{idx < paragraph.previewAfter.split('.').length - 1 ? '.' : ''}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })
                      )
                    ) : (
                      <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#6b7280'
                      }}>
                          <p>No preview content available.</p>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {getTotalSelected()} paragraphs selected for fixing
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              disabled={applying}
              style={{
                padding: '8px 16px',
                color: '#374151',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: applying ? 'not-allowed' : 'pointer',
                opacity: applying ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying || getTotalSelected() === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (applying || getTotalSelected() === 0) ? 'not-allowed' : 'pointer',
                opacity: (applying || getTotalSelected() === 0) ? 0.5 : 1
              }}
            >
              {applying ? 'Applying...' : `Apply Selected Fixes (${getTotalSelected()})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}