'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

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
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to get upload URL');

      const data = await response.json(); // This was missing!
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

      setMessage(`File uploaded successfully! Redirecting...`);
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
