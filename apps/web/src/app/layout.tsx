import './global.css';
import Link from 'next/link';
import Navigation from './components/Navigation';

export const metadata = {
  title: 'Audibook Studio',
  description: 'Hebrew audiobook creation and management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          .nav-link {
            text-decoration: none;
            color: #666;
            padding: 5px 10px;
            border-radius: 4px;
            transition: background-color 0.2s;
          }
          .nav-link:hover {
            background-color: #e0e0e0;
          }
        `}</style>
      </head>
      <body>
        <header style={{
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #ddd',
          padding: '10px 20px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <Link 
              href="/" 
              style={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                color: '#333',
                fontSize: '18px',
                fontWeight: 'bold'
              }}
            >
              🏠 Audibook Studio
            </Link>
            <Navigation />
          </div>
        </header>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
