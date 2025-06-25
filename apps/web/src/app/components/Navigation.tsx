'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

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
          href={item.href} 
          prefetch={true}
          className={`nav-link ${pathname === item.href ? 'active' : ''}`}
          style={{
            textDecoration: 'none',
            color: pathname === item.href ? '#007acc' : '#666',
            padding: '5px 10px',
            borderRadius: '4px',
            backgroundColor: pathname === item.href ? '#e6f3ff' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
