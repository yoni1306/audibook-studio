import React, { useEffect, useState } from 'react';
import { useApiClient } from '../../../hooks/useApiClient';
import { formatParagraphNumber } from '../../utils/paragraphUtils';
import { BulkFixSuggestion } from '@audibook/api-client';
import { createLogger } from '../../utils/logger';
import ErrorModal from '../ui/ErrorModal';

const logger = createLogger('BulkFixModal');

// Helper function to highlight words in text
const highlightWordsInText = (text: string, originalWord: string, correctedWord: string, isAfterText: boolean) => {
  const wordToHighlight = isAfterText ? correctedWord : originalWord;
  const highlightColor = '#b45309'; // Yellow-600 equivalent
  const backgroundColor = '#fef3c7'; // Yellow-100 equivalent
  
  console.log('Highlighting:', { 
    textLength: text.length, 
    text: text.substring(0, 200), 
    wordToHighlight, 
    originalWord, 
    correctedWord, 
    isAfterText,
    textContainsWord: text.includes(wordToHighlight)
  });
  
  // Create a case-insensitive regex to find the word
  const regex = new RegExp(`\\b${wordToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  
  const parts = text.split(regex);
  const matches = text.match(regex) || [];
  
  console.log('Regex matches:', { regex: regex.toString(), matches, parts });
  
  // If no matches with word boundaries, try without word boundaries for Hebrew text
  if (matches.length === 0 && /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(wordToHighlight)) {
    console.log('Trying Hebrew fallback without word boundaries');
    const simpleRegex = new RegExp(wordToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const simpleParts = text.split(simpleRegex);
    const simpleMatches = text.match(simpleRegex) || [];
    
    console.log('Hebrew fallback matches:', { simpleMatches, simpleParts });
    
    if (simpleMatches.length > 0) {
      const result: (string | React.ReactNode)[] = [];
      for (let i = 0; i < simpleParts.length; i++) {
        if (simpleParts[i]) {
          result.push(simpleParts[i]);
        }
        if (i < simpleMatches.length) {
          result.push(
            <span
              key={`highlight-${i}`}
              style={{
                backgroundColor,
                color: highlightColor,
                fontWeight: '600',
                padding: '1px 3px',
                borderRadius: '3px',
                border: `1px solid ${highlightColor}30`
              }}
            >
              {simpleMatches[i]}
            </span>
          );
        }
      }
      return result;
    }
  }
  
  const result: (string | React.ReactNode)[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      result.push(parts[i]);
    }
    if (i < matches.length) {
      result.push(
        <span
          key={`highlight-${i}`}
          style={{
            backgroundColor,
            color: highlightColor,
            fontWeight: '600',
            padding: '1px 3px',
            borderRadius: '3px',
            border: `1px solid ${highlightColor}30`
          }}
        >
          {matches[i]}
        </span>
      );
    }
  }
  
  return result;
};

interface BulkFixModalProps {
  onClose: () => void;
  suggestions: BulkFixSuggestion[];
  bookId: string;
  onFixesApplied: () => void;
  onSkipAll?: () => void;
}

export default function BulkFixModal({ 
  onClose, 
  suggestions, 
  bookId, 
  onFixesApplied,
  onSkipAll 
}: BulkFixModalProps) {
  const apiClient = useApiClient();
  const [selectedFixes, setSelectedFixes] = useState<{[key: string]: string[]}>({});
  const [applying, setApplying] = useState(false);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState({ title: '', message: '' });
  
  // Handle modal opening and initialization
  useEffect(() => {
    if (suggestions.length > 0) {
      // Initialize with all paragraphs selected by default
      const initialSelection: {[key: string]: string[]} = {};
      suggestions.forEach(suggestion => {
        const key = `${suggestion.originalWord}:${suggestion.correctedWord}`;
        if (suggestion.paragraphIds) {
          initialSelection[key] = [...suggestion.paragraphIds];
        }
      });
      setSelectedFixes(initialSelection);
    }
  }, [suggestions]);

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
      const allSelected = allParagraphIds.length === current.length;
      
      return {
        ...prev,
        [wordKey]: allSelected ? [] : allParagraphIds
      };
    });
  };

  const handleApply = async () => {
    logger.info('Starting bulk fix application...');
    
    const fixesToApply = Object.entries(selectedFixes)
      .map(([wordKey, paragraphIds]) => {
        const suggestion = suggestions.find(s => `${s.originalWord}:${s.correctedWord}` === wordKey);
        if (!suggestion) {
          logger.warn(`No suggestion found for wordKey: ${wordKey}`);
          return null;
        }
        
        return {
          originalWord: suggestion.originalWord,
          correctedWord: suggestion.correctedWord,
          paragraphIds: paragraphIds
        };
      })
      .filter((fix): fix is { originalWord: string; correctedWord: string; paragraphIds: string[] } => fix !== null);

    if (fixesToApply.length === 0) {
      logger.warn('No fixes to apply - exiting early');
      return;
    }

    setApplying(true);
    
    try {
      const { data: result, error } = await apiClient.books.applyBulkFixes({
        bookId,
        fixes: fixesToApply,
      });

      if (error) {
        throw new Error(`Failed to apply fixes: ${error}`);
      }

      if (!result) {
        throw new Error('Failed to apply fixes: No result returned from API');
      }

      if (result.totalParagraphsUpdated > 0) {
        onFixesApplied();
      }
      
      onClose();
    } catch (error) {
      logger.error('Error applying bulk fixes:', error);
      setErrorMessage({
        title: 'Error Applying Fixes',
        message: `There was an issue applying the bulk fixes: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      });
      setShowErrorModal(true);
    } finally {
      setApplying(false);
    }
  };

  const getTotalSelected = () => {
    return Object.values(selectedFixes).reduce((total, paragraphIds) => total + paragraphIds.length, 0);
  };

  const hasNoSuggestions = suggestions.length === 0;

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: 0,
        maxWidth: '90vw',
        maxHeight: '90vh',
        width: '800px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div className="modal-header" style={{
          padding: 'var(--spacing-5)',
          borderBottom: '1px solid var(--color-gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: '600',
              color: 'var(--color-gray-900)',
              margin: 0,
              marginBottom: 'var(--spacing-1)'
            }}>✨ Bulk Text Corrections</h2>
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray-600)',
              margin: 0
            }}>Apply similar corrections across multiple paragraphs</p>
          </div>
          <button
            onClick={onClose}
            disabled={applying}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--font-size-xl)',
              cursor: applying ? 'not-allowed' : 'pointer',
              color: 'var(--color-gray-400)',
              opacity: applying ? 0.5 : 1,
              padding: 'var(--spacing-2)'
            }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{
          padding: 'var(--spacing-4) var(--spacing-5)',
          overflowY: 'auto',
          flex: 1
        }}>
          {hasNoSuggestions ? (
            <div style={{
              textAlign: 'center',
              padding: 'var(--spacing-8) var(--spacing-4)',
              color: 'var(--color-gray-600)'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: 'var(--spacing-4)'
              }}>🔍</div>
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '600',
                color: 'var(--color-gray-900)',
                marginBottom: 'var(--spacing-2)'
              }}>No Bulk Suggestions Found</h3>
              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-gray-600)',
                maxWidth: '400px',
                margin: '0 auto',
                lineHeight: '1.5'
              }}>
                The corrections you made don't appear elsewhere in this book, 
                or they may be too context-specific for bulk application.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-gray-600)',
                marginBottom: 'var(--spacing-3)',
                fontWeight: '500'
              }}>📄 Found in {suggestions.reduce((total, s) => total + (s.paragraphIds?.length || 0), 0)} paragraphs:</div>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-3)',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {suggestions.map((suggestion, index) => {
              const wordKey = `${suggestion.originalWord}:${suggestion.correctedWord}`;
              const isExpanded = expandedWord === wordKey;
              const allParagraphIds = suggestion.paragraphIds || [];
              const selectedCount = (selectedFixes[wordKey] || []).length;
              
              return (
                <div key={index} className="card" style={{
                  padding: 'var(--spacing-3)',
                  backgroundColor: 'var(--color-blue-50)',
                  border: '1px solid var(--color-blue-200)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--spacing-2)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-3)',
                      flex: 1
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-2)',
                        cursor: allParagraphIds.length > 0 ? 'pointer' : 'default',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '500',
                        opacity: allParagraphIds.length > 0 ? 1 : 0.6
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedCount === allParagraphIds.length && selectedCount > 0}
                          onChange={() => handleToggleAll(wordKey, allParagraphIds)}
                          disabled={allParagraphIds.length === 0}
                          style={{
                            transform: 'scale(1.1)'
                          }}
                        />
                        <span style={{ 
                          color: '#dc2626', 
                          textDecoration: 'line-through',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '500'
                        }}>"{suggestion.originalWord}"</span>
                        <span style={{ 
                          color: 'var(--color-gray-600)', 
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: '700',
                          margin: '0 8px'
                        }}>→</span>
                        <span style={{ 
                          color: '#16a34a', 
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '600'
                        }}>"{suggestion.correctedWord}"</span>
                      </label>
                      <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: allParagraphIds.length === 0 ? 'var(--color-orange-600)' : 'var(--color-gray-500)',
                        backgroundColor: allParagraphIds.length === 0 ? 'var(--color-orange-100)' : 'var(--color-gray-100)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        {allParagraphIds.length === 0 
                          ? 'No bulk suggestions' 
                          : `${selectedCount}/${allParagraphIds.length} selected`
                        }
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedWord(isExpanded ? null : wordKey)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-gray-500)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{
                      marginTop: 'var(--spacing-3)',
                      paddingTop: 'var(--spacing-3)',
                      borderTop: '1px solid var(--color-blue-200)'
                    }}>
                      {allParagraphIds.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          padding: 'var(--spacing-4)',
                          color: 'var(--color-gray-500)',
                          fontSize: 'var(--font-size-sm)',
                          fontStyle: 'italic'
                        }}>
                          <div style={{ marginBottom: 'var(--spacing-2)' }}>🔍</div>
                          <div>This fix appears to be unique to the original paragraph.</div>
                          <div>No similar instances were found elsewhere in the book.</div>
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--spacing-2)'
                        }}>
                          {suggestion.paragraphs?.map((paragraph, pIdx) => (
                          <div key={pIdx} className="card" style={{
                            padding: 'var(--spacing-3)',
                            backgroundColor: (selectedFixes[wordKey] || []).includes(paragraph.id) 
                              ? 'var(--color-blue-50)' 
                              : 'var(--color-gray-50)',
                            border: `1px solid ${(selectedFixes[wordKey] || []).includes(paragraph.id) 
                              ? 'var(--color-blue-200)' 
                              : 'var(--color-gray-200)'}`,
                            transition: 'all 0.2s ease'
                          }}>
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'flex-start', 
                              gap: 'var(--spacing-3)', 
                              cursor: 'pointer',
                              width: '100%'
                            }}>
                              <input
                                type="checkbox"
                                checked={(selectedFixes[wordKey] || []).includes(paragraph.id)}
                                onChange={() => handleToggleParagraph(wordKey, paragraph.id)}
                                style={{ 
                                  marginTop: '2px', 
                                  borderRadius: 'var(--radius-sm)',
                                  transform: 'scale(1.1)'
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: 'var(--font-size-xs)',
                                  color: 'var(--color-gray-500)',
                                  marginBottom: 'var(--spacing-2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--spacing-2)'
                                }}>
                                  <span>📖 Page {paragraph.pageNumber ?? 1}</span>
                                  <span>•</span>
                                  <span>Paragraph {formatParagraphNumber(paragraph.orderIndex, true)}</span>
                                  <span>•</span>
                                  <span>{paragraph.occurrences || 1} occurrence{(paragraph.occurrences || 1) > 1 ? 's' : ''}</span>
                                </div>
                                {paragraph.previewBefore && paragraph.previewAfter && (
                                  <div style={{ fontSize: 'var(--font-size-sm)' }}>
                                    <div style={{
                                      display: 'grid',
                                      gap: 'var(--spacing-3)',
                                      gridTemplateColumns: '1fr 1fr'
                                    }}>
                                      <div>
                                        <div style={{
                                          color: 'var(--color-gray-600)',
                                          marginBottom: 'var(--spacing-1)',
                                          fontSize: 'var(--font-size-xs)',
                                          fontWeight: '500'
                                        }}>After:</div>
                                        <div style={{
                                          backgroundColor: 'white',
                                          border: '2px solid rgba(34, 197, 94, 0.4)', // green-500 with 40% opacity
                                          borderRadius: 'var(--radius-md)',
                                          padding: 'var(--spacing-3)',
                                          color: 'var(--color-gray-700)',
                                          maxHeight: '150px',
                                          overflowY: 'auto',
                                          whiteSpace: 'pre-wrap',
                                          fontSize: 'var(--font-size-sm)',
                                          lineHeight: '1.5'
                                        }}>
                                          <div style={{
                                            padding: '2px 0',
                                            direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(paragraph.previewAfter) ? 'rtl' : 'ltr',
                                            textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(paragraph.previewAfter) ? 'right' : 'left'
                                          }}>
                                            {highlightWordsInText(paragraph.previewAfter, suggestion.originalWord, suggestion.correctedWord, true)}
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{
                                          color: 'var(--color-gray-600)',
                                          marginBottom: 'var(--spacing-1)',
                                          fontSize: 'var(--font-size-xs)',
                                          fontWeight: '500'
                                        }}>Before:</div>
                                        <div style={{
                                          backgroundColor: 'white',
                                          border: '2px solid rgba(239, 68, 68, 0.4)', // red-500 with 40% opacity
                                          borderRadius: 'var(--radius-md)',
                                          padding: 'var(--spacing-3)',
                                          color: 'var(--color-gray-700)',
                                          maxHeight: '150px',
                                          overflowY: 'auto',
                                          whiteSpace: 'pre-wrap',
                                          fontSize: 'var(--font-size-sm)',
                                          lineHeight: '1.5'
                                        }}>
                                          <div style={{
                                            padding: '2px 0',
                                            direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(paragraph.previewBefore) ? 'rtl' : 'ltr',
                                            textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(paragraph.previewBefore) ? 'right' : 'left'
                                          }}>
                                            {highlightWordsInText(paragraph.previewBefore, suggestion.originalWord, suggestion.correctedWord, false)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                         ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </>
          )}
        </div>

        <div className="modal-footer" style={{
          padding: 'var(--spacing-4) var(--spacing-5)',
          borderTop: '1px solid var(--color-gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-gray-50)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-gray-600)'
          }}>
            {hasNoSuggestions ? (
              <span>No suggestions to apply</span>
            ) : (
              <>
                <span>📊</span>
                <span>{getTotalSelected()} paragraphs selected for fixing</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
            <button
              onClick={onSkipAll || onClose}
              disabled={applying}
              className="btn btn-secondary"
              style={{
                position: 'relative',
                zIndex: 1001
              }}
            >
              ❌ Skip All Suggestions
            </button>
            <button
              onClick={handleApply}
              disabled={applying || getTotalSelected() === 0}
              className="btn btn-primary"
              style={{
                position: 'relative',
                zIndex: 1001
              }}
            >
              {applying ? (
                <>
                  <span className="spinner" style={{
                    width: '16px',
                    height: '16px',
                    marginRight: 'var(--spacing-2)'
                  }}></span>
                  Applying Fixes...
                </>
              ) : (
                <>
                  ✨ Apply Selected Fixes ({getTotalSelected()})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorMessage.title}
        message={errorMessage.message}
        icon="⚠️"
      />
    </div>
  );
}
