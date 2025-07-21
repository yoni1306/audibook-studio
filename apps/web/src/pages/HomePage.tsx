
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto',
      textAlign: 'center'
    }}>
      {/* Hero Section */}
      <div style={{
        marginBottom: 'var(--spacing-12)',
        padding: 'var(--spacing-8) 0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)'
        }}>
          <span style={{ fontSize: '4rem' }}>🎧</span>
          <h1 style={{ 
            margin: 0,
            fontSize: 'var(--font-size-4xl)', 
            fontWeight: '800',
            color: 'var(--color-gray-900)',
            background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-secondary-600))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Audibook Studio
          </h1>
        </div>
        
        <p style={{ 
          fontSize: 'var(--font-size-xl)', 
          color: 'var(--color-gray-600)', 
          maxWidth: '700px', 
          margin: '0 auto',
          lineHeight: '1.6'
        }}>
          Create and manage Hebrew audiobooks with advanced text processing and intelligent audio generation capabilities.
        </p>
      </div>
      
      {/* Feature Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 'var(--spacing-6)',
        marginBottom: 'var(--spacing-8)'
      }}>
        <div className="card" style={{
          padding: 'var(--spacing-8)',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden',
          transition: 'var(--transition-normal)',
          cursor: 'pointer'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: 'linear-gradient(180deg, var(--color-primary-500), var(--color-primary-600))'
          }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-3)',
            marginBottom: 'var(--spacing-4)'
          }}>
            <span style={{ fontSize: 'var(--font-size-2xl)' }}>📤</span>
            <h3 style={{ 
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: '700',
              color: 'var(--color-gray-900)'
            }}>
              Upload EPUB
            </h3>
          </div>
          <p style={{ 
            color: 'var(--color-gray-600)', 
            marginBottom: 'var(--spacing-6)',
            lineHeight: '1.5'
          }}>
            Upload your EPUB files and choose between page-based or XHTML-based parsing for optimal audio generation.
          </p>
          <Link 
            to="/upload" 
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              textDecoration: 'none'
            }}
          >
            🚀 Get Started
          </Link>
        </div>

        <div className="card" style={{
          padding: 'var(--spacing-8)',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden',
          transition: 'var(--transition-normal)',
          cursor: 'pointer'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: 'linear-gradient(180deg, var(--color-success-500), var(--color-success-600))'
          }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-3)',
            marginBottom: 'var(--spacing-4)'
          }}>
            <span style={{ fontSize: 'var(--font-size-2xl)' }}>📚</span>
            <h3 style={{ 
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: '700',
              color: 'var(--color-gray-900)'
            }}>
              Manage Books
            </h3>
          </div>
          <p style={{ 
            color: 'var(--color-gray-600)', 
            marginBottom: 'var(--spacing-6)',
            lineHeight: '1.5'
          }}>
            View, edit, and manage your audiobook collection with advanced text correction and audio playback features.
          </p>
          <Link 
            to="/books" 
            className="btn btn-success"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              textDecoration: 'none'
            }}
          >
            📖 View Books
          </Link>
        </div>

        <div className="card" style={{
          padding: 'var(--spacing-8)',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden',
          transition: 'var(--transition-normal)',
          cursor: 'pointer'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: 'linear-gradient(180deg, var(--color-warning-500), var(--color-warning-600))'
          }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-3)',
            marginBottom: 'var(--spacing-4)'
          }}>
            <span style={{ fontSize: 'var(--font-size-2xl)' }}>⏳</span>
            <h3 style={{ 
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: '700',
              color: 'var(--color-gray-900)'
            }}>
              Monitor Queue
            </h3>
          </div>
          <p style={{ 
            color: 'var(--color-gray-600)', 
            marginBottom: 'var(--spacing-6)',
            lineHeight: '1.5'
          }}>
            Track processing status, monitor job queue, and view real-time progress of your audiobook generation.
          </p>
          <Link 
            to="/queue" 
            className="btn btn-warning"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              textDecoration: 'none',
              color: 'var(--color-gray-900)'
            }}
          >
            📊 View Queue
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="card" style={{
        padding: 'var(--spacing-8)',
        textAlign: 'left',
        backgroundColor: 'var(--color-gray-50)',
        border: '1px solid var(--color-gray-200)'
      }}>
        <h2 style={{
          margin: '0 0 var(--spacing-6) 0',
          fontSize: 'var(--font-size-2xl)',
          fontWeight: '700',
          color: 'var(--color-gray-900)',
          textAlign: 'center'
        }}>
          ✨ Key Features
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--spacing-6)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 'var(--font-size-3xl)',
              marginBottom: 'var(--spacing-3)'
            }}>🎯</div>
            <h4 style={{
              margin: '0 0 var(--spacing-2) 0',
              fontSize: 'var(--font-size-lg)',
              fontWeight: '600',
              color: 'var(--color-gray-900)'
            }}>Smart Text Processing</h4>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray-600)',
              lineHeight: '1.5'
            }}>Advanced Hebrew text correction with learning algorithms</p>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 'var(--font-size-3xl)',
              marginBottom: 'var(--spacing-3)'
            }}>🔊</div>
            <h4 style={{
              margin: '0 0 var(--spacing-2) 0',
              fontSize: 'var(--font-size-lg)',
              fontWeight: '600',
              color: 'var(--color-gray-900)'
            }}>High-Quality Audio</h4>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray-600)',
              lineHeight: '1.5'
            }}>Azure Speech Services for natural-sounding Hebrew audio</p>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 'var(--font-size-3xl)',
              marginBottom: 'var(--spacing-3)'
            }}>⚡</div>
            <h4 style={{
              margin: '0 0 var(--spacing-2) 0',
              fontSize: 'var(--font-size-lg)',
              fontWeight: '600',
              color: 'var(--color-gray-900)'
            }}>Fast Processing</h4>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray-600)',
              lineHeight: '1.5'
            }}>Efficient queue-based processing with real-time monitoring</p>
          </div>
        </div>
      </div>
    </div>
  );
}
