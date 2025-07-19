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
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Upload EPUB File</h1>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="file"
          accept=".epub"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      {file && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            Choose Parsing Method:
          </label>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <input
                type="radio"
                value="page-based"
                checked={parsingMethod === 'page-based'}
                onChange={(e) => setParsingMethod(e.target.value as 'page-based' | 'xhtml-based')}
                disabled={uploading}
                style={{ marginRight: '8px' }}
              />
              <div>
                <strong>Page-Based Parser</strong>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                  Optimizes paragraph sizes for consistent audio segments. Rebuilds content structure for uniform playback experience.
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="radio"
                value="xhtml-based"
                checked={parsingMethod === 'xhtml-based'}
                onChange={(e) => setParsingMethod(e.target.value as 'page-based' | 'xhtml-based')}
                disabled={uploading}
                style={{ marginRight: '8px' }}
              />
              <div>
                <strong>XHTML-Based Parser</strong>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                  Preserves original document structure and formatting. Maintains author's intended paragraph breaks and page divisions.
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: file && !uploading ? 'pointer' : 'not-allowed',
          opacity: !file || uploading ? 0.6 : 1,
        }}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>

      {message && (
        <p
          style={{
            marginTop: '20px',
            color: message.includes('Error') ? 'red' : 'green',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
