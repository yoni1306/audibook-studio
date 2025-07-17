
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '20px', color: '#333' }}>
        Welcome to Audibook Studio
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
        Create and manage Hebrew audiobooks with advanced text processing and audio generation capabilities.
      </p>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <div style={{
          padding: '30px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>📤 Upload EPUB</h3>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Upload your EPUB files to start creating audiobooks
          </p>
          <Link 
            to="/upload" 
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            Get Started
          </Link>
        </div>

        <div style={{
          padding: '30px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>📚 Manage Books</h3>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            View and edit your audiobook collection
          </p>
          <Link 
            to="/books" 
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            View Books
          </Link>
        </div>

        <div style={{
          padding: '30px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>⏳ Monitor Queue</h3>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Track processing status and job queue
          </p>
          <Link 
            to="/queue" 
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#ffc107',
              color: '#333',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            View Queue
          </Link>
        </div>
      </div>
    </div>
  );
}
