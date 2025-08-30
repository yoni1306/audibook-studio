import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';

export default function UploadPage() {
  // API client
  const apiClient = useApiClient();
  const navigate = useNavigate();
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [parsingMethod, setParsingMethod] = useState<'page-based' | 'xhtml-based'>('xhtml-based');
  const [diacriticsType, setDiacriticsType] = useState<'advanced' | 'simple'>('advanced');
  
  // TTS Model Selection State
  const [ttsVoice, setTtsVoice] = useState('he-IL-AvriNeural');
  const [ttsSettings, setTtsSettings] = useState({
    rate: 0,
    pitch: 0,
    volume: 100
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.epub')) {
        setFile(selectedFile);
        setMessage('');
      } else {
        setMessage('Please select an EPUB file');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setMessage('Uploading file...');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parsingMethod', parsingMethod);
      formData.append('diacriticsType', diacriticsType);
      formData.append('ttsModel', 'azure');
      formData.append('ttsVoice', ttsVoice);
      formData.append('ttsSettings', JSON.stringify(ttsSettings));

      // Upload file through API proxy (eliminates CORS issues)
      const { data, error } = await apiClient.s3.uploadFile(formData);

      if (error || !data) throw new Error('Failed to upload file');

      setMessage('File uploaded and parsing started! Redirecting...');
      setFile(null);

      // Redirect to book detail page using React Router
      setTimeout(() => {
        navigate(`/books/${data.bookId}`);
      }, 2000);
    } catch (error) {
      setMessage(
        `Error: ${error instanceof Error ? error.message : 'Upload failed'}`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-3)',
        marginBottom: 'var(--spacing-8)'
      }}>
        <span style={{ fontSize: 'var(--font-size-2xl)' }}>📤</span>
        <h1 style={{
          margin: 0,
          fontSize: 'var(--font-size-3xl)',
          fontWeight: '700',
          color: 'var(--color-gray-900)'
        }}>
          Upload EPUB File
        </h1>
      </div>

      <div className="card" style={{ padding: 'var(--spacing-8)' }}>
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-3)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: '600',
            color: 'var(--color-gray-900)'
          }}>
            Select EPUB File
          </label>
          <div style={{
            position: 'relative',
            display: 'inline-block',
            width: '100%'
          }}>
            <input
              type="file"
              accept=".epub"
              onChange={handleFileChange}
              disabled={uploading}
              style={{
                width: '100%',
                padding: 'var(--spacing-3)',
                border: '2px dashed var(--color-gray-300)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: uploading ? 'var(--color-gray-50)' : 'white',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-base)',
                transition: 'var(--transition-normal)'
              }}
            />
          </div>
          {file && (
            <div style={{
              marginTop: 'var(--spacing-3)',
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-success-50)',
              border: '1px solid var(--color-success-200)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-success-700)'
            }}>
              <span>✅</span>
              <span>Selected: {file.name}</span>
            </div>
          )}
        </div>

        {file && (
          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: 'var(--color-gray-900)'
            }}>
              Choose Parsing Method:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-3)',
                padding: 'var(--spacing-4)',
                border: `2px solid ${parsingMethod === 'page-based' ? 'var(--color-primary-500)' : 'var(--color-gray-200)'}`,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: parsingMethod === 'page-based' ? 'var(--color-primary-50)' : 'white',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'var(--transition-normal)'
              }}>
                <input
                  type="radio"
                  value="page-based"
                  checked={parsingMethod === 'page-based'}
                  onChange={(e) => setParsingMethod(e.target.value as 'page-based' | 'xhtml-based')}
                  disabled={uploading}
                  style={{ marginTop: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--color-gray-900)',
                    marginBottom: 'var(--spacing-1)'
                  }}>
                    📄 Page-Based Parser
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-gray-600)',
                    lineHeight: '1.5'
                  }}>
                    Optimizes paragraph sizes for consistent audio segments. Rebuilds content structure for uniform playback experience.
                  </div>
                </div>
              </label>
              
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-3)',
                padding: 'var(--spacing-4)',
                border: `2px solid ${parsingMethod === 'xhtml-based' ? 'var(--color-primary-500)' : 'var(--color-gray-200)'}`,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: parsingMethod === 'xhtml-based' ? 'var(--color-primary-50)' : 'white',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'var(--transition-normal)'
              }}>
                <input
                  type="radio"
                  value="xhtml-based"
                  checked={parsingMethod === 'xhtml-based'}
                  onChange={(e) => setParsingMethod(e.target.value as 'page-based' | 'xhtml-based')}
                  disabled={uploading}
                  style={{ marginTop: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--color-gray-900)',
                    marginBottom: 'var(--spacing-1)'
                  }}>
                    📝 XHTML-Based Parser
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-gray-600)',
                    lineHeight: '1.5'
                  }}>
                    Preserves original document structure and formatting. Maintains author's intended paragraph breaks and page divisions.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {file && (
          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: 'var(--color-gray-900)'
            }}>
              ✨ Choose Diacritics Processing:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-3)',
                padding: 'var(--spacing-4)',
                border: `2px solid ${diacriticsType === 'advanced' ? 'var(--color-primary-500)' : 'var(--color-gray-200)'}`,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: diacriticsType === 'advanced' ? 'var(--color-primary-50)' : 'white',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'var(--transition-normal)'
              }}>
                <input
                  type="radio"
                  value="advanced"
                  checked={diacriticsType === 'advanced'}
                  onChange={(e) => setDiacriticsType(e.target.value as 'advanced' | 'simple')}
                  disabled={uploading}
                  style={{ marginTop: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--color-gray-900)',
                    marginBottom: 'var(--spacing-1)'
                  }}>
                    🎯 Advanced Diacritics (Phonikud)
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-gray-600)',
                    lineHeight: '1.5'
                  }}>
                    High-accuracy diacritics with advanced linguistic analysis. Best for precise pronunciation and professional audiobooks.
                  </div>
                </div>
              </label>
              
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-3)',
                padding: 'var(--spacing-4)',
                border: `2px solid ${diacriticsType === 'simple' ? 'var(--color-primary-500)' : 'var(--color-gray-200)'}`,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: diacriticsType === 'simple' ? 'var(--color-primary-50)' : 'white',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'var(--transition-normal)'
              }}>
                <input
                  type="radio"
                  value="simple"
                  checked={diacriticsType === 'simple'}
                  onChange={(e) => setDiacriticsType(e.target.value as 'advanced' | 'simple')}
                  disabled={uploading}
                  style={{ marginTop: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--color-gray-900)',
                    marginBottom: 'var(--spacing-1)'
                  }}>
                    ⚡ Simple Diacritics (Dicta)
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-gray-600)',
                    lineHeight: '1.5'
                  }}>
                    Fast and efficient diacritics processing. Good for quick processing and general use cases.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {file && (
          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: 'var(--color-gray-900)'
            }}>
              🎙️ Choose Narration Model:
            </label>
            
            {/* Voice Selection */}
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-2)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '500',
                color: 'var(--color-gray-700)'
              }}>
                Voice (Azure TTS):
              </label>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-3)',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-base)',
                  backgroundColor: uploading ? 'var(--color-gray-50)' : 'white'
                }}
              >
                <option value="he-IL-AvriNeural">🇮🇱 Avri (Male, Hebrew)</option>
                <option value="he-IL-HilaNeural">🇮🇱 Hila (Female, Hebrew)</option>
              </select>
            </div>

            {/* TTS Settings */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--spacing-3)',
              marginBottom: 'var(--spacing-2)'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-1)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  color: 'var(--color-gray-700)'
                }}>
                  Rate: {ttsSettings.rate}%
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={ttsSettings.rate}
                  onChange={(e) => setTtsSettings(prev => ({ ...prev, rate: parseInt(e.target.value) }))}
                  disabled={uploading}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-1)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  color: 'var(--color-gray-700)'
                }}>
                  Pitch: {ttsSettings.pitch}%
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={ttsSettings.pitch}
                  onChange={(e) => setTtsSettings(prev => ({ ...prev, pitch: parseInt(e.target.value) }))}
                  disabled={uploading}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-1)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  color: 'var(--color-gray-700)'
                }}>
                  Volume: {ttsSettings.volume}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ttsSettings.volume}
                  onChange={(e) => setTtsSettings(prev => ({ ...prev, volume: parseInt(e.target.value) }))}
                  disabled={uploading}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: message ? 'var(--spacing-6)' : 0
        }}>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn btn-primary"
            style={{
              opacity: !file || uploading ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              fontSize: 'var(--font-size-base)',
              padding: 'var(--spacing-3) var(--spacing-6)'
            }}
          >
            {uploading && <span className="spinner" />}
            {uploading ? 'Uploading...' : '🚀 Upload & Process'}
          </button>
        </div>

        {message && (
          <div className={`card ${message.includes('Error') ? 'error' : 'success'}`} style={{
            padding: 'var(--spacing-4)',
            backgroundColor: message.includes('Error') ? 'var(--color-error-50)' : 'var(--color-success-50)',
            border: `1px solid ${message.includes('Error') ? 'var(--color-error-200)' : 'var(--color-success-200)'}`,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            fontSize: 'var(--font-size-sm)',
            color: message.includes('Error') ? 'var(--color-error-700)' : 'var(--color-success-700)'
          }}>
            <span>{message.includes('Error') ? '❌' : '✅'}</span>
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
