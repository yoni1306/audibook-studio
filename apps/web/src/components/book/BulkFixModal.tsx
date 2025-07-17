import { useEffect, useState } from 'react';
import { useApiClient } from '../../../hooks/useApiClient';
import { BulkFixSuggestion } from '@audibook/api-client';
import { getTextDirection, getTextAlign } from '../../utils/text';

interface BulkFixModalProps {
  onClose: () => void;
  suggestions: BulkFixSuggestion[];
  bookId: string;
  onFixesApplied: () => void;
}

const logger = {
  debug: (message: string, ...args: unknown[]) => console.log(message, ...args)
};

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
      logger.debug('Received bulk fix suggestions:', suggestions);
      
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
      return { ...prev, [wordKey]: updated };
    });
  };

  const handleToggleAll = (wordKey: string, allParagraphIds: string[]) => {
    setSelectedFixes(prev => {
      const current = prev[wordKey] || [];
      const allSelected = allParagraphIds.every(id => current.includes(id));
      return {
        ...prev,
        [wordKey]: allSelected ? [] : [...allParagraphIds]
      };
    });
  };

  const getTotalSelected = () => {
    return Object.values(selectedFixes).reduce((total, ids) => total + ids.length, 0);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      // Convert selected fixes to the format expected by the API
      const fixesToApply = Object.entries(selectedFixes)
        .filter(([_, paragraphIds]) => paragraphIds.length > 0)
        .map(([wordKey, paragraphIds]) => {
          const [originalWord, correctedWord] = wordKey.split(':');
          return {
            originalWord,
            correctedWord,
            paragraphIds
          };
        });

      if (fixesToApply.length === 0) {
        onClose();
        return;
      }

      logger.debug('Applying bulk fixes:', fixesToApply);
      
      // Apply the fixes via API
      await apiClient.books.applyBulkFixes({ bookId, fixes: fixesToApply });
      
      logger.debug('Bulk fixes applied successfully');
      onFixesApplied();
      onClose();
    } catch (error) {
      logger.debug('Error applying bulk fixes:', error);
      // Handle error - could show a toast or error message
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#111827'
          }}>
            Review Bulk Fix Suggestions
          </h2>
          <p style={{
            margin: '8px 0 0 0',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Select which paragraphs you&apos;d like to apply the suggested fixes to.
          </p>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0'
        }}>
          {suggestions.map((suggestion, idx) => {
            const wordKey = `${suggestion.originalWord}:${suggestion.correctedWord}`;
            const isExpanded = expandedWord === wordKey;
            const allParagraphIds = suggestion.paragraphIds || [];
            const selectedCount = selectedFixes[wordKey]?.length || 0;
            const allSelected = allParagraphIds.length > 0 && selectedCount === allParagraphIds.length;
            const paragraphsToRender = suggestion.paragraphs || [];

            return (
              <div key={idx} style={{
                borderBottom: idx < suggestions.length - 1 ? '1px solid #e5e7eb' : 'none'
              }}>
                <div style={{
                  padding: '20px 24px',
                  backgroundColor: '#fff'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                  }}>
                    <div>
                      <h3 style={{
                        margin: '0 0 4px 0',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#111827'
                      }}>
                        Replace &quot;{suggestion.originalWord}&quot; with &quot;{suggestion.correctedWord}&quot;
                      </h3>
                      <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        Found in {allParagraphIds.length} paragraph{allParagraphIds.length !== 1 ? 's' : ''} • {selectedCount} selected
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#374151'
                      }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => handleToggleAll(wordKey, allParagraphIds)}
                          style={{ borderRadius: '4px' }}
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
                </div>

                <div style={{ padding: '16px' }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {paragraphsToRender.map((paragraph) => (
                      <li key={paragraph.id} style={{ marginBottom: '12px' }}>
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
                              fontSize: '15px',
                              color: '#6b7280',
                              marginBottom: '4px'
                            }}>
                              <span>Page {paragraph.pageNumber}</span>
                              <span>Paragraph #{paragraph.orderIndex + 1}</span>
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
                                <div style={{ fontSize: '15px', marginBottom: '8px' }}>
                                  <div style={{ color: '#6b7280', marginBottom: '4px' }}>Before:</div>
                                  <div style={{
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    color: '#374151',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '15px'
                                  }}>
                                    {paragraph.previewBefore.split('.').map((sentence, idx) => (
                                      <div key={idx} style={{
                                        padding: '2px 0',
                                        direction: getTextDirection(sentence),
                                        textAlign: getTextAlign(sentence)
                                      }}>
                                        {sentence.trim()}{idx < paragraph.previewBefore.split('.').length - 1 ? '.' : ''}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ fontSize: '15px' }}>
                                  <div style={{ color: '#6b7280', marginBottom: '4px' }}>After:</div>
                                  <div style={{
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    color: '#374151',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '15px'
                                  }}>
                                    {paragraph.previewAfter.split('.').map((sentence, idx) => (
                                      <div key={idx} style={{
                                        padding: '2px 0',
                                        direction: getTextDirection(sentence),
                                        textAlign: getTextAlign(sentence)
                                      }}>
                                        {sentence.trim()}{idx < paragraph.previewAfter.split('.').length - 1 ? '.' : ''}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
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
          <div style={{ fontSize: '15px', color: '#6b7280' }}>
            {getTotalSelected()} paragraphs selected for fixing
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              disabled={applying}
              style={{
                padding: '10px 20px',
                color: '#6b7280',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: applying ? 'not-allowed' : 'pointer',
                opacity: applying ? 0.5 : 1,
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Skip All Suggestions
            </button>
            <button
              onClick={handleApply}
              disabled={applying || getTotalSelected() === 0}
              style={{
                padding: '10px 20px',
                backgroundColor: getTotalSelected() === 0 ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (applying || getTotalSelected() === 0) ? 'not-allowed' : 'pointer',
                opacity: (applying || getTotalSelected() === 0) ? 0.7 : 1,
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {applying ? 'Applying Fixes...' : `Apply Selected Fixes (${getTotalSelected()})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
