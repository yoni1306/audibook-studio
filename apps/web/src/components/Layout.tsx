import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeProvider from './ThemeProvider';

interface LayoutProps {
  children: React.ReactNode;
}

function Navigation() {
  const location = useLocation();

  const navItems = [
    { href: '/books', label: 'Books', icon: '📚' },
    { href: '/corrections', label: 'Corrections', icon: '📝' },
    { href: '/upload', label: 'Upload', icon: '📤' },
    { href: '/queue', label: 'Queue', icon: '⏳' },
  ];

  return (
    <nav style={{ 
      display: 'flex', 
      gap: 'var(--spacing-2)',
      alignItems: 'center'
    }}>
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link 
            key={item.href}
            to={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary-700)' : 'var(--color-gray-600)',
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isActive ? 'var(--color-primary-50)' : 'transparent',
              border: isActive ? '1px solid var(--color-primary-200)' : '1px solid transparent',
              fontSize: 'var(--font-size-sm)',
              fontWeight: isActive ? '600' : '500',
              transition: 'var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                e.currentTarget.style.color = 'var(--color-gray-700)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-gray-600)';
              }
            }}
          >
            <span style={{ fontSize: 'var(--font-size-base)' }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-gray-50)' }}>
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--color-gray-200)',
        padding: 'var(--spacing-4) var(--spacing-6)',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky' as const,
        top: 0,
        zIndex: 1020,
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
              gap: 'var(--spacing-3)',
              textDecoration: 'none',
              color: 'var(--color-gray-900)',
              fontSize: 'var(--font-size-xl)',
              fontWeight: '700',
              transition: 'var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-primary-600)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-gray-900)';
            }}
          >
            <span style={{ fontSize: 'var(--font-size-2xl)' }}>🏠</span>
            <span>Audibook Studio</span>
          </Link>
          <Navigation />
        </div>
      </header>
      <ThemeProvider>
        <main style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: 'var(--spacing-6) var(--spacing-6)',
          minHeight: 'calc(100vh - 80px)'
        }}>
          {children}
        </main>
      </ThemeProvider>
    </div>
  );
}
