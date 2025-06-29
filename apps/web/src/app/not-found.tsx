import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '4rem', margin: '0', color: '#666' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '1rem 0', color: '#333' }}>Page Not Found</h2>
      <p style={{ fontSize: '1rem', color: '#666', marginBottom: '2rem' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link 
        href="/" 
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#007bff',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '0.375rem',
          fontSize: '1rem'
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
