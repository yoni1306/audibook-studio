import { useEffect, useState } from 'react';
import { useApiClient } from '../../../hooks/useApiClient';
import { BulkFixSuggestion } from '@audibook/api-client';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BulkFixModal');

interface BulkFixModalProps {
  onClose: () => void;
  suggestions: BulkFixSuggestion[];
  bookId: string;
  onFixesApplied: () => void;
}

export default function BulkFixModal({ 
  onClose, 
  suggestions, 
  bookId, 
  onFixesApplied 
}: BulkFixModalProps) {
  const apiClient = useApiClient();
  const [selectedFixes, setSelectedFixes] = useState<{[key: string]: string[]}>({});
  const [applying, setApplying] = useState(false);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  
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
      alert(`Error applying fixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setApplying(false);
    }
  };

  const getTotalSelected = () => {
    return Object.values(selectedFixes).reduce((total, paragraphIds) => total + paragraphIds.length, 0);
  };

  if (suggestions.length === 0) {
    return null;
  }

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
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '500'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedCount === allParagraphIds.length && selectedCount > 0}
                          onChange={() => handleToggleAll(wordKey, allParagraphIds)}
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
                        color: 'var(--color-gray-500)',
                        backgroundColor: 'var(--color-gray-100)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        {selectedCount}/{allParagraphIds.length} selected
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
                                  <span>📖 Page {paragraph.pageNumber ?? 'N/A'}</span>
                                  <span>•</span>
                                  <span>Paragraph {paragraph.orderIndex + 1}</span>
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
                                        }}>Before:</div>
                                        <div style={{
                                          backgroundColor: 'var(--color-error-50)',
                                          border: '1px solid var(--color-error-200)',
                                          borderRadius: 'var(--radius-md)',
                                          padding: 'var(--spacing-3)',
                                          color: 'var(--color-gray-700)',
                                          maxHeight: '150px',
                                          overflowY: 'auto',
                                          whiteSpace: 'pre-wrap',
                                          fontSize: 'var(--font-size-sm)',
                                          lineHeight: '1.5'
                                        }}>
                                          {paragraph.previewBefore.split('.').map((sentence: string, idx: number) => (
                                            <div key={idx} style={{
                                              padding: '2px 0',
                                              direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'rtl' : 'ltr',
                                              textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'right' : 'left'
                                            }}>
                                              {sentence.trim() + (idx < paragraph.previewBefore.split('.').length - 1 ? '.' : '')}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{
                                          color: 'var(--color-gray-600)',
                                          marginBottom: 'var(--spacing-1)',
                                          fontSize: 'var(--font-size-xs)',
                                          fontWeight: '500'
                                        }}>After:</div>
                                        <div style={{
                                          backgroundColor: 'var(--color-green-50)',
                                          border: '1px solid var(--color-green-200)',
                                          borderRadius: 'var(--radius-md)',
                                          padding: 'var(--spacing-3)',
                                          color: 'var(--color-gray-700)',
                                          maxHeight: '150px',
                                          overflowY: 'auto',
                                          whiteSpace: 'pre-wrap',
                                          fontSize: 'var(--font-size-sm)',
                                          lineHeight: '1.5'
                                        }}>
                                          {paragraph.previewAfter.split('.').map((sentence: string, idx: number) => (
                                            <div key={idx} style={{
                                              padding: '2px 0',
                                              direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'rtl' : 'ltr',
                                              textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'right' : 'left'
                                            }}>
                                              {sentence.trim() + (idx < paragraph.previewAfter.split('.').length - 1 ? '.' : '')}
                                            </div>
                                          ))}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
            <span>📊</span>
            <span>{getTotalSelected()} paragraphs selected for fixing</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
            <button
              onClick={onClose}
              disabled={applying}
              className="button button-secondary"
              style={{
                cursor: applying ? 'not-allowed' : 'pointer',
                minWidth: '140px',
                height: '44px',
                padding: 'var(--spacing-2) var(--spacing-4)',
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
                opacity: applying ? 0.7 : 1,
                boxShadow: applying ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              ❌ Skip All Suggestions
            </button>
            <button
              onClick={handleApply}
              disabled={applying || getTotalSelected() === 0}
              className="button button-primary"
              style={{
                cursor: (applying || getTotalSelected() === 0) ? 'not-allowed' : 'pointer',
                minWidth: '140px',
                height: '44px',
                padding: 'var(--spacing-2) var(--spacing-4)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '600',
                color: 'white',
                backgroundColor: getTotalSelected() === 0 
                  ? 'var(--color-gray-400)' 
                  : 'var(--color-primary-600)',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-2)',
                transition: 'all 0.2s ease',
                opacity: (applying || getTotalSelected() === 0) ? 0.7 : 1,
                boxShadow: (applying || getTotalSelected() === 0) ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)'
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
    </div>
  );
}
