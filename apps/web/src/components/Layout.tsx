import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeProvider from './ThemeProvider';

interface LayoutProps {
  children: React.ReactNode;
}

function Navigation() {
  const location = useLocation();

  const navItems = [
    { href: '/books', label: '📚 Books' },
    { href: '/corrections', label: '📝 Corrections' },
    { href: '/upload', label: '📤 Upload' },
    { href: '/queue', label: '⏳ Queue' },
  ];

  return (
    <nav style={{ display: 'flex', gap: '15px' }}>
      {navItems.map((item) => (
        <Link 
          key={item.href}
          to={item.href} 
          className={`nav-link ${location.pathname === item.href ? 'active' : ''}`}
          style={{
            textDecoration: 'none',
            color: location.pathname === item.href ? '#007acc' : '#666',
            padding: '5px 10px',
            borderRadius: '4px',
            backgroundColor: location.pathname === item.href ? '#e6f3ff' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div>
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
            to="/" 
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
      <ThemeProvider>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          {children}
        </main>
      </ThemeProvider>
    </div>
  );
}
