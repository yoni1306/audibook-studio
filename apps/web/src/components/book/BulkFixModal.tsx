import { useEffect, useState } from 'react';
import { useApiClient } from '../../../hooks/useApiClient';
import { BulkFixSuggestion, BulkFixRequest } from '../../types/api';
import { ApiClient } from '../../utils/api';
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
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              Apply Bulk Fixes ({suggestions.length} suggestions)
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              Select which text corrections you&apos;d like to apply. All paragraphs are selected by default.
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
            const wordKey = `${suggestion.originalWord}:${suggestion.correctedWord}`;
            const selectedParagraphs = selectedFixes[wordKey] || [];
            
            // Use the new API format with full paragraph details
            const allParagraphIds = suggestion.paragraphIds || [];
            
            // Use the paragraphs field which contains full paragraph details
            const paragraphsToRender = suggestion.paragraphs?.map(paragraph => ({
              id: paragraph.id || '',
              pageId: paragraph.pageId || '',
              pageNumber: paragraph.pageNumber || 0,
              orderIndex: paragraph.orderIndex || 0,
              content: paragraph.content || '',
              occurrences: paragraph.occurrences || 1,
              previewBefore: paragraph.previewBefore || '',
              previewAfter: paragraph.previewAfter || ''
            })) || [];
            
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
                        <span style={{ color: '#dc2626', fontWeight: '500', fontSize: '15px' }}>&quot;{suggestion.originalWord}&quot;</span>
                        <span style={{ color: '#9ca3af', fontSize: '15px' }}>→</span>
                        <span style={{ color: '#16a34a', fontWeight: '500', fontSize: '15px' }}>&quot;{suggestion.correctedWord}&quot;</span>
                      </div>
                      <span style={{ fontSize: '15px', color: '#6b7280' }}>
                        Found in {suggestion.paragraphIds?.length || 0} paragraphs
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
                    {paragraphsToRender.map((paragraph, pIdx) => (
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
                                        direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'rtl' : 'ltr',
                                        textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'right' : 'left'
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
                                        direction: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'rtl' : 'ltr',
                                        textAlign: /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(sentence) ? 'right' : 'left'
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