'use client';

import { useState } from 'react';

interface ChapterTitle {
  id: string;
  title: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [chapterTitles, setChapterTitles] = useState<ChapterTitle[]>([]);
  const [showChapterTitles, setShowChapterTitles] = useState(false);

  const addChapterTitle = () => {
    const newChapter: ChapterTitle = {
      id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: ''
    };
    setChapterTitles([...chapterTitles, newChapter]);
  };

  const removeChapterTitle = (id: string) => {
    setChapterTitles(chapterTitles.filter(chapter => chapter.id !== id));
  };

  const updateChapterTitle = (id: string, title: string) => {
    setChapterTitles(chapterTitles.map(chapter => 
      chapter.id === id ? { ...chapter, title } : chapter
    ));
  };

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
    setMessage('Getting upload URL...');

    try {
      // Parse chapter titles from the dynamic list
      const chapterTitlesArray = chapterTitles
        .map(chapter => chapter.title.trim())
        .filter(title => title.length > 0);

      // Get presigned URL from API
      const response = await fetch(
        'http://localhost:3333/api/s3/presigned-upload',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: 'application/epub+zip',
            chapterTitles: chapterTitlesArray.length > 0 ? chapterTitlesArray : undefined,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to get upload URL');

      const data = await response.json();
      setMessage('Uploading file...');

      // Upload file directly to S3
      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/epub+zip',
        },
      });

      if (!uploadResponse.ok) throw new Error('Failed to upload file');

      setMessage('File uploaded successfully! Redirecting...');
      setFile(null);

      // Redirect to book detail page
      setTimeout(() => {
        window.location.href = `/books/${data.bookId}`;
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
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Upload EPUB File</h1>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="file"
          accept=".epub"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setShowChapterTitles(!showChapterTitles)}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          {showChapterTitles ? 'Hide Chapter Titles (Optional)' : 'Add Custom Chapter Titles (Optional)'}
        </button>
      </div>

      {showChapterTitles && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
            Add custom chapter titles. Each chapter can have a single-line or multiline title. 
            If left empty, chapter titles will be detected automatically from the EPUB file.
          </p>

          {chapterTitles.length === 0 && (
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#f8f9fa', 
              border: '1px dashed #ccc', 
              borderRadius: '4px',
              textAlign: 'center',
              marginBottom: '15px'
            }}>
              <p style={{ margin: '0', color: '#666' }}>No chapter titles added yet</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>
                Click Add Chapter to start adding custom chapter titles
              </p>
            </div>
          )}

          {chapterTitles.map((chapter, index) => (
            <div key={chapter.id} style={{ 
              marginBottom: '15px', 
              padding: '15px', 
              border: '1px solid #e0e0e0', 
              borderRadius: '6px',
              backgroundColor: '#fafafa'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '10px' 
              }}>
                <label style={{ 
                  fontWeight: 'bold', 
                  fontSize: '14px', 
                  color: '#333' 
                }}>
                  Chapter {index + 1}
                </label>
                <button
                  type="button"
                  onClick={() => removeChapterTitle(chapter.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
              <textarea
                value={chapter.title}
                onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                placeholder={`Enter chapter title...
Examples:
• Single line: 'Chapter ${index + 1}: Introduction'
• Multiline: 'Chapter ${index + 1}:
  Getting Started
  with Advanced Features'`}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button
              type="button"
              onClick={addChapterTitle}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              + Add Chapter
            </button>
            
            {chapterTitles.length > 0 && (
              <button
                type="button"
                onClick={() => setChapterTitles([])}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Clear All
              </button>
            )}
          </div>

          {chapterTitles.length > 0 && (
            <div style={{ 
              marginTop: '15px', 
              padding: '10px', 
              backgroundColor: '#e8f4fd', 
              borderRadius: '4px',
              fontSize: '12px',
              color: '#0c5460'
            }}>
              <strong>Preview:</strong> {chapterTitles.length} chapter{chapterTitles.length !== 1 ? 's' : ''} defined
              {chapterTitles.some(ch => ch.title.includes('\n')) && ' (including multiline titles)'}
            </div>
          )}
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
