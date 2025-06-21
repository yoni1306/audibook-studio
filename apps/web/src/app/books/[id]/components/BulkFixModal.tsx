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
  onClose: () => void;
  suggestions: BulkFixSuggestion[];
  bookId: string;
  onApplyFixes: (result: any) => void;
}

// Create a logger instance for this component
const logger = createLogger('BulkFixModal');

export default function BulkFixModal({ 
  onClose, 
  suggestions, 
  bookId, 
  onApplyFixes 
}: BulkFixModalProps) {
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
      const allSelected = allParagraphIds.every(id => current.includes(id));
      
      return {
        ...prev,
        [wordKey]: allSelected ? [] : allParagraphIds
      };
    });
  };

  const handleApply = async () => {
    console.log('🔧 Starting bulk fix application...');
    console.log('📊 Selected fixes:', selectedFixes);
    
    const fixesToApply = Object.entries(selectedFixes).map(([wordKey, paragraphIds]) => {
      const suggestion = suggestions.find(s => `${s.originalWord}:${s.fixedWord}` === wordKey);
      if (!suggestion) {
        console.warn(`⚠️ No suggestion found for wordKey: ${wordKey}`);
        console.warn(`🔍 Available suggestions:`, suggestions.map(s => `${s.originalWord}:${s.fixedWord}`));
        return null;
      }
      
      const fix = {
        originalWord: suggestion.originalWord,
        fixedWord: suggestion.fixedWord,
        paragraphIds: paragraphIds
      };
      
      console.log(`📝 Prepared fix: "${fix.originalWord}" → "${fix.fixedWord}" for ${fix.paragraphIds.length} paragraphs:`, fix.paragraphIds);
      return fix;
    }).filter(Boolean);

    console.log(`🎯 Total fixes to apply: ${fixesToApply.length}`);
    console.log('📋 Complete fixes payload:', fixesToApply);

    if (fixesToApply.length === 0) {
      console.warn('⚠️ No fixes to apply - exiting early');
      return;
    }

    setApplying(true);
    
    try {
      console.log('🚀 Making API call to http://localhost:3333/api/books/bulk-fixes...');
      const response = await fetch('http://localhost:3333/api/books/bulk-fixes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId,
          fixes: fixesToApply,
        }),
      });

      console.log(`📡 API Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error response:', errorText);
        throw new Error(`Failed to apply fixes: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ API Success response:', result);
      console.log(`📈 Results: ${result.totalParagraphsUpdated} paragraphs updated, ${result.totalWordsFixed} words fixed`);

      if (result.totalParagraphsUpdated > 0) {
        console.log('🎉 Fixes applied successfully! Calling onApplyFixes callback...');
        onApplyFixes?.(result);
        onClose();
      } else {
        console.warn('⚠️ No paragraphs were updated - this might indicate an issue');
      }
    } catch (error) {
      console.error('💥 Error applying bulk fixes:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        bookId,
        fixesCount: fixesToApply.length
      });
    } finally {
      console.log('🏁 Bulk fix application completed');
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
            
            if (suggestion.paragraphs) {
              // New format with paragraph details (preferred)
              allParagraphIds = suggestion.paragraphs.map(p => p.id);
              paragraphsToRender = suggestion.paragraphs;
              logger.debug(`Using paragraphs for ${suggestion.originalWord}->${suggestion.fixedWord}`);
            } else if (suggestion.paragraphIds) {
              // Fallback to just IDs if no paragraph details
              allParagraphIds = suggestion.paragraphIds;
              logger.debug(`Using paragraphIds only for ${suggestion.originalWord}->${suggestion.fixedWord}`);
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
                        <span style={{ color: '#dc2626', fontWeight: '500', fontSize: '15px' }}>"{suggestion.originalWord}"</span>
                        <span style={{ color: '#9ca3af', fontSize: '15px' }}>→</span>
                        <span style={{ color: '#16a34a', fontWeight: '500', fontSize: '15px' }}>"{suggestion.fixedWord}"</span>
                      </div>
                      <span style={{ fontSize: '15px', color: '#6b7280' }}>
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