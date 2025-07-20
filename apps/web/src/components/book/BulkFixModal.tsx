import { useEffect, useState } from 'react';
import { useApiClient } from '../../../hooks/useApiClient';
import { BulkFixSuggestion } from '../../types/api';
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
      // Always log when modal opens, regardless of suggestions length
  
      
      // Initialize with all paragraphs selected by default
      const initialSelection: {[key: string]: string[]} = {};
      suggestions.forEach(suggestion => {
        const key = `${suggestion.originalWord}:${suggestion.correctedWord}`;
        // Handle both old and new formats
        if (suggestion.paragraphIds) {
          // API client format with paragraphIds
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
          logger.warn('Available suggestions:', suggestions.map(s => `${s.originalWord}:${s.correctedWord}`));
          return null;
        }
        
        const fix = {
          originalWord: suggestion.originalWord,
          correctedWord: suggestion.correctedWord,
          paragraphIds: paragraphIds
        };
        

        return fix;
      })
      .filter((fix): fix is { originalWord: string; correctedWord: string; paragraphIds: string[] } => fix !== null);

    logger.info(`Total fixes to apply: ${fixesToApply.length}`);


    if (fixesToApply.length === 0) {
      logger.warn('No fixes to apply - exiting early');
      return;
    }

    setApplying(true);
    
    try {
      logger.info('Making API call to /books/bulk-fixes...');
      const { data: result, error } = await apiClient.books.applyBulkFixes({
        bookId,
        fixes: fixesToApply,
      });

      if (error) {
        logger.error('API Error response:', error);
        throw new Error(`Failed to apply fixes: ${error}`);
      }

      if (!result) {
        logger.error('API returned no result');
        throw new Error('Failed to apply fixes: No result returned from API');
      }

      logger.info('API Success response:', result);
      logger.info(`Results: ${result.totalParagraphsUpdated} paragraphs updated, ${result.totalWordsFixed} words fixed`);

      if (result.totalParagraphsUpdated > 0) {
        logger.info('Fixes applied successfully! Calling onFixesApplied callback...');
        onFixesApplied?.();
        onClose();
      } else {
        logger.warn('No paragraphs were updated - this might indicate an issue');
      }
    } catch (error) {
      logger.error('Error applying bulk fixes:', error);
      logger.error('Error details:', (error as Error).message);
      logger.error('Error stack:', (error as Error).stack);
      alert(`Error applying fixes: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      logger.info('Bulk fix application completed');
      setApplying(false);
    }
  };

  const getTotalSelected = () => {
    return Object.values(selectedFixes).reduce((total, paragraphIds) => total + paragraphIds.length, 0);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{
        width: '90%',
        maxWidth: '900px',
        maxHeight: '80vh'
      }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">📝 Apply Text Corrections</h2>
            <p className="modal-subtitle">
              Review and apply suggested text corrections to your book
            </p>
          </div>
          <button 
            onClick={onClose}
            className="modal-close-button"
            disabled={applying}
          >
            ✕
          </button>
        </div>
        <div className="modal-content" style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-6)'
        }}>
          {suggestions.map((suggestion, index) => {
            const wordKey = `${suggestion.originalWord}:${suggestion.correctedWord}`;
            const paragraphIds = suggestion.paragraphIds || [];
            const selectedCount = (selectedFixes[wordKey] || []).length;
            const totalCount = paragraphIds.length;
            const isExpanded = expandedWord === wordKey;

            return (
              <div key={index} className="card" style={{
                marginBottom: 'var(--spacing-6)',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}>
                <div style={{
                  padding: 'var(--spacing-4) var(--spacing-5)',
                  backgroundColor: 'var(--color-gray-50)',
                  borderBottom: '1px solid var(--color-gray-200)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-3)'
                }}>
                  <div style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '600',
                    color: 'var(--color-gray-900)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-2)'
                    }}>
                      <span style={{
                        color: 'var(--color-error-600)',
                        textDecoration: 'line-through'
                      }}>"{suggestion.originalWord}"</span>
                      <span style={{ color: 'var(--color-gray-400)' }}>→</span>
                      <span style={{
                        color: 'var(--color-green-600)',
                        fontWeight: '700'
                      }}>"{suggestion.correctedWord}"</span>
                    </div>
                    <div className="badge" style={{
                      backgroundColor: selectedCount === totalCount 
                        ? 'var(--color-green-100)' 
                        : selectedCount > 0 
                        ? 'var(--color-yellow-100)' 
                        : 'var(--color-gray-100)',
                      color: selectedCount === totalCount 
                        ? 'var(--color-green-700)' 
                        : selectedCount > 0 
                        ? 'var(--color-yellow-700)' 
                        : 'var(--color-gray-700)'
                    }}>
                      {selectedCount}/{totalCount} selected
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedCount === totalCount}
                        onChange={() => handleToggleAll(wordKey, paragraphIds)}
                        style={{ borderRadius: 'var(--radius-sm)' }}
                      />
                      <span style={{ fontSize: '15px', color: '#374151' }}>Select all</span>
                    </label>
                    <button
                      onClick={() => setExpandedWord(isExpanded ? null : wordKey)}
                      style={{
                        color: '#2563eb',
                        fontSize: '15px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {isExpanded ? 'Show less' : 'Show details'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: 'var(--spacing-4) var(--spacing-5)' }}>
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-gray-600)',
                      marginBottom: 'var(--spacing-3)',
                      fontWeight: '500'
                    }}>
                      📄 Found in {suggestion.paragraphs?.length || 0} paragraphs:
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--spacing-3)',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      {suggestion.paragraphs?.map((paragraph, pIdx) => (
                        <div key={paragraph.id} className="card" style={{
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
                                <span>📖 Page {paragraph.pageNumber}</span>
                                <span>•</span>
                                <span>¶ {paragraph.orderIndex}</span>
                                <span>•</span>
                                <span>{paragraph.occurrences} occurrence{paragraph.occurrences !== 1 ? 's' : ''}</span>
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
                                        padding: 'var(--spacing-2)',
                                        color: 'var(--color-gray-700)',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        fontSize: 'var(--font-size-xs)',
                                        lineHeight: '1.4'
                                      }}>
                                        {paragraph.previewBefore.split('.').map((sentence, idx) => (
                                          <div key={idx} style={{
                                            padding: '1px 0',
                                            direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'rtl' : 'ltr',
                                            textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'right' : 'left'
                                          }}>
                                            {sentence.trim()}{idx < paragraph.previewBefore.split('.').length - 1 ? '.' : ''}
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
                                        padding: 'var(--spacing-2)',
                                        color: 'var(--color-gray-700)',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        fontSize: 'var(--font-size-xs)',
                                        lineHeight: '1.4'
                                      }}>
                                        {paragraph.previewAfter.split('.').map((sentence, idx) => (
                                          <div key={idx} style={{
                                            padding: '1px 0',
                                            direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'rtl' : 'ltr',
                                            textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'right' : 'left'
                                          }}>
                                            {sentence.trim()}{idx < paragraph.previewAfter.split('.').length - 1 ? '.' : ''}
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

        <div className="modal-footer">
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
                opacity: applying ? 0.5 : 1,
                cursor: applying ? 'not-allowed' : 'pointer'
              }}
            >
              ❌ Skip All Suggestions
            </button>
            <button
              onClick={handleApply}
              disabled={applying || getTotalSelected() === 0}
              className="button button-primary"
              style={{
                opacity: (applying || getTotalSelected() === 0) ? 0.7 : 1,
                cursor: (applying || getTotalSelected() === 0) ? 'not-allowed' : 'pointer',
                backgroundColor: getTotalSelected() === 0 
                  ? 'var(--color-gray-400)' 
                  : 'var(--color-primary-600)'
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