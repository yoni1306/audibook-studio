'use client';

import { useState, useEffect } from 'react';

interface WordFix {
  originalWord: string;
  correctedWord: string;
  fixType: string | null;
  occurrences: number;
}

interface BookFix {
  id: string;
  originalWord: string;
  correctedWord: string;
  fixType: string | null;
  createdAt: string;
  paragraph: {
    chapterNumber: number;
    orderIndex: number;
  };
}

interface Statistics {
  totalFixes: number;
  fixesByType: Array<{
    fixType: string | null;
    _count: { id: number };
  }>;
  mostCorrectedWords: Array<{
    originalWord: string;
    correctedWord: string;
    _count: { id: number };
  }>;
}

export default function TextFixesPage() {
  const [wordFixes, setWordFixes] = useState<WordFix[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [bookFixes, setBookFixes] = useState<BookFix[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [wordsResponse, statsResponse] = await Promise.all([
        fetch('http://localhost:3333/api/text-fixes/words'),
        fetch('http://localhost:3333/api/text-fixes/statistics'),
      ]);

      const words = await wordsResponse.json();
      const stats = await statsResponse.json();

      setWordFixes(words);
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching text fixes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookFixes = async (bookId: string) => {
    if (!bookId) return;
    
    try {
      const response = await fetch(`http://localhost:3333/api/text-fixes/book/${bookId}`);
      const fixes = await response.json();
      setBookFixes(fixes);
    } catch (error) {
      console.error('Error fetching book fixes:', error);
    }
  };

  const filteredWordFixes = wordFixes.filter(fix => {
    const matchesSearch = 
      fix.originalWord.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fix.correctedWord.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === null || fix.fixType === filterType;
    
    return matchesSearch && matchesType;
  });

  const uniqueFixTypes = Array.from(new Set(wordFixes.map(fix => fix.fixType).filter(Boolean)));

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh' 
      }}>
        <div style={{ fontSize: '18px' }}>Loading text fixes...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '24px', 
      display: 'flex',
      flexDirection: 'column',
      gap: '32px'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          color: '#111827',
          margin: 0
        }}>
          Text Fixes Management
        </h1>
        <button
          onClick={fetchData}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '24px' 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '8px', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
          }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Total Fixes
            </h3>
            <p style={{ 
              fontSize: '32px', 
              fontWeight: 'bold', 
              color: '#2563eb',
              margin: 0
            }}>
              {statistics.totalFixes}
            </p>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '8px', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
          }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Fix Types
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {statistics.fixesByType.slice(0, 3).map((type) => (
                <div key={type.fixType || 'unknown'} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '14px' 
                }}>
                  <span style={{ textTransform: 'capitalize' }}>
                    {type.fixType || 'Unknown'}
                  </span>
                  <span style={{ fontWeight: '600' }}>
                    {type._count.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '8px', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
          }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Most Corrected Words
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {statistics.mostCorrectedWords.slice(0, 3).map((word, index) => (
                <div key={index} style={{ fontSize: '14px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between' 
                  }}>
                    <span style={{ color: '#dc2626' }}>
                      {word.originalWord}
                    </span>
                    <span style={{ fontWeight: '600' }}>
                      {word._count.id}
                    </span>
                  </div>
                  <div style={{ 
                    color: '#16a34a', 
                    fontSize: '12px' 
                  }}>
                    → {word.correctedWord}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '8px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
      }}>
        <h2 style={{ 
          fontSize: '20px', 
          fontWeight: '600', 
          marginBottom: '16px' 
        }}>
          Filters
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '16px' 
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Search Words
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search original or corrected words..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Fix Type
            </label>
            <select
              value={filterType || 'all'}
              onChange={(e) => setFilterType(e.target.value === 'all' ? null : e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Types</option>
              {uniqueFixTypes.filter(type => type !== null).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Book Analysis
            </label>
            <input
              type="text"
              value={selectedBookId}
              onChange={(e) => {
                setSelectedBookId(e.target.value);
                if (e.target.value) {
                  fetchBookFixes(e.target.value);
                }
              }}
              placeholder="Enter Book ID for detailed analysis..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Word Fixes Table */}
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
            All Word Fixes ({filteredWordFixes.length})
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
              {filteredWordFixes.map((fix, index) => (
                <tr
                  key={index}
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
      {bookFixes.length > 0 && (
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
              Book Fixes Analysis ({bookFixes.length} fixes)
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
                {bookFixes.map((fix) => (
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