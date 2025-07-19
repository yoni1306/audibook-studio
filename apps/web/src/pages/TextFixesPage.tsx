import { useState, useEffect } from 'react';
import { useApiClient } from '../../hooks/useApiClient';
import { useSearchParams } from 'react-router-dom';
import { createLogger } from '../utils/logger';

const logger = createLogger('TextFixesPage');

interface WordFix {
  id: string;
  originalWord: string;
  correctedWord: string;
  fixType: string;
  occurrences: number;
  createdAt: string;
}

interface BookFix {
  id: string;
  originalWord: string;
  correctedWord: string;
  fixType: string;
  createdAt: string;
  paragraph: {
    chapterNumber: number;
    orderIndex: number;
  };
}

interface TextFixesData {
  wordFixes: WordFix[];
  bookFixes: BookFix[];
  totalWordFixes: number;
  totalBookFixes: number;
}

export default function TextFixesPage() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('bookId');
  
  const [data, setData] = useState<TextFixesData>({
    wordFixes: [],
    bookFixes: [],
    totalWordFixes: 0,
    totalBookFixes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFixType, setSelectedFixType] = useState('all');

  const { apiClient } = useApiClient();

  useEffect(() => {
    const fetchTextFixes = async () => {
      if (!apiClient) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const endpoint = bookId ? `/api/text-fixes?bookId=${bookId}` : '/api/text-fixes';
        const { data } = await apiClient.textFixes.getAll({ endpoint });
        setData(data);
      } catch (err) {
        logger.error('Error fetching text fixes:', err);
        setError('Failed to load text fixes data');
      } finally {
        setLoading(false);
      }
    };

    fetchTextFixes();
  }, [apiClient, bookId]);

  const filteredWordFixes = data.wordFixes.filter((fix) => {
    const matchesSearch = 
      fix.originalWord.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fix.correctedWord.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedFixType === 'all' || fix.fixType === selectedFixType;
    return matchesSearch && matchesType;
  });

  const filteredBookFixes = data.bookFixes.filter((fix) => {
    const matchesSearch = 
      fix.originalWord.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fix.correctedWord.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedFixType === 'all' || fix.fixType === selectedFixType;
    return matchesSearch && matchesType;
  });

  const uniqueFixTypes = Array.from(
    new Set([...data.wordFixes, ...data.bookFixes].map(fix => fix.fixType))
  ).filter(Boolean);

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          Text Fixes Analysis
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>Loading text fixes data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          Text Fixes Analysis
        </h1>
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '16px',
          color: '#dc2626'
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          Text Fixes Analysis
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          {bookId ? 'Book-specific text corrections and improvements' : 'Comprehensive text corrections and improvements across all books'}
        </p>

        {/* Summary Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: '0 0 8px 0' }}>
              Total Word Fixes
            </h3>
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
              {data.totalWordFixes.toLocaleString()}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: '0 0 8px 0' }}>
              Total Book Fixes
            </h3>
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
              {data.totalBookFixes.toLocaleString()}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: '0 0 8px 0' }}>
              Unique Fix Types
            </h3>
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
              {uniqueFixTypes.length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '32px',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="Search fixes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              minWidth: '200px'
            }}
          />
          <select
            value={selectedFixType}
            onChange={(e) => setSelectedFixType(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            <option value="all">All Fix Types</option>
            {uniqueFixTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Word fixes table */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        marginBottom: '32px'
      }}>
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid #e5e7eb' 
        }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#111827',
            margin: 0
          }}>
            Word Fixes Summary ({filteredWordFixes.length} fixes)
          </h2>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse' 
          }}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={{ 
                  padding: '12px 24px', 
                  textAlign: 'left', 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em' 
                }}>
                  Original Word
                </th>
                <th style={{ 
                  padding: '12px 24px', 
                  textAlign: 'left', 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em' 
                }}>
                  Corrected Word
                </th>
                <th style={{ 
                  padding: '12px 24px', 
                  textAlign: 'left', 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em' 
                }}>
                  Fix Type
                </th>
                <th style={{ 
                  padding: '12px 24px', 
                  textAlign: 'left', 
                  fontSize: '12px', 
                  fontWeight: '500', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em' 
                }}>
                  Occurrences
                </th>
              </tr>
            </thead>
            <tbody style={{ backgroundColor: 'white' }}>
              {filteredWordFixes.map((fix) => (
                <tr
                  key={fix.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderBottom: '1px solid #f3f4f6'
                  }}
                >
                  <td style={{ 
                    padding: '16px 24px', 
                    whiteSpace: 'nowrap' 
                  }}>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#dc2626' 
                    }}>
                      {fix.originalWord}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '16px 24px', 
                    whiteSpace: 'nowrap' 
                  }}>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#16a34a' 
                    }}>
                      {fix.correctedWord}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '16px 24px', 
                    whiteSpace: 'nowrap' 
                  }}>
                    <span style={{ 
                      fontSize: '14px', 
                      color: '#111827', 
                      textTransform: 'capitalize' 
                    }}>
                      {fix.fixType || 'Unknown'}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '16px 24px', 
                    whiteSpace: 'nowrap' 
                  }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      padding: '4px 8px', 
                      borderRadius: '9999px', 
                      fontSize: '12px', 
                      fontWeight: '500', 
                      backgroundColor: '#dbeafe', 
                      color: '#1e40af' 
                    }}>
                      {fix.occurrences}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredWordFixes.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '48px' 
            }}>
              <p style={{ color: '#6b7280' }}>
                No word fixes found matching your criteria.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Book-specific fixes */}
      {filteredBookFixes.length > 0 && (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '24px', 
            borderBottom: '1px solid #e5e7eb' 
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: '#111827',
              margin: 0
            }}>
              Book Fixes Analysis ({filteredBookFixes.length} fixes)
            </h2>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse' 
            }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ 
                    padding: '12px 24px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    Chapter
                  </th>
                  <th style={{ 
                    padding: '12px 24px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    Paragraph
                  </th>
                  <th style={{ 
                    padding: '12px 24px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    Original Word
                  </th>
                  <th style={{ 
                    padding: '12px 24px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    Corrected Word
                  </th>
                  <th style={{ 
                    padding: '12px 24px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    Fix Type
                  </th>
                  <th style={{ 
                    padding: '12px 24px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em' 
                  }}>
                    Date
                  </th>
                </tr>
              </thead>
              <tbody style={{ backgroundColor: 'white' }}>
                {filteredBookFixes.map((fix) => (
                  <tr
                    key={fix.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderBottom: '1px solid #f3f4f6'
                    }}
                  >
                    <td style={{ 
                      padding: '16px 24px', 
                      whiteSpace: 'nowrap', 
                      fontSize: '14px', 
                      color: '#111827' 
                    }}>
                      {fix.paragraph.chapterNumber}
                    </td>
                    <td style={{ 
                      padding: '16px 24px', 
                      whiteSpace: 'nowrap', 
                      fontSize: '14px', 
                      color: '#111827' 
                    }}>
                      {fix.paragraph.orderIndex + 1}
                    </td>
                    <td style={{ 
                      padding: '16px 24px', 
                      whiteSpace: 'nowrap' 
                    }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#dc2626' 
                      }}>
                        {fix.originalWord}
                      </span>
                    </td>
                    <td style={{ 
                      padding: '16px 24px', 
                      whiteSpace: 'nowrap' 
                    }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#16a34a' 
                      }}>
                        {fix.correctedWord}
                      </span>
                    </td>
                    <td style={{ 
                      padding: '16px 24px', 
                      whiteSpace: 'nowrap' 
                    }}>
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#111827', 
                        textTransform: 'capitalize' 
                      }}>
                        {fix.fixType || 'Unknown'}
                      </span>
                    </td>
                    <td style={{ 
                      padding: '16px 24px', 
                      whiteSpace: 'nowrap', 
                      fontSize: '14px', 
                      color: '#6b7280' 
                    }}>
                      {new Date(fix.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
