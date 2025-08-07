import { useEffect } from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: string;
  autoCloseMs?: number;
  showRetryButton?: boolean;
  onRetry?: () => void;
}

export default function ErrorModal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  icon = '❌',
  autoCloseMs = 0, // No auto-close by default for errors
  showRetryButton = false,
  onRetry
}: ErrorModalProps) {
  useEffect(() => {
    if (isOpen && autoCloseMs > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseMs);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-6)',
        maxWidth: '480px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--color-red-200)',
        position: 'relative',
        animation: 'errorModalSlideIn 0.3s ease-out'
      }}>
        {/* Error Animation */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          {/* Icon with animation */}
          <div style={{
            fontSize: '64px',
            marginBottom: 'var(--spacing-4)',
            animation: 'errorIconShake 0.6s ease-out'
          }}>
            {icon}
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            color: 'var(--color-red-800)',
            marginBottom: 'var(--spacing-3)',
            margin: 0
          }}>
            {title}
          </h2>

          {/* Message */}
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-gray-700)',
            lineHeight: '1.6',
            marginBottom: 'var(--spacing-5)',
            margin: '0 0 var(--spacing-5) 0'
          }}>
            {message}
          </p>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-3)',
            justifyContent: 'center'
          }}>
            {showRetryButton && onRetry && (
              <button
                onClick={onRetry}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Try Again
              </button>
            )}
            
            <button
              onClick={onClose}
              style={{
                backgroundColor: showRetryButton ? 'var(--color-gray-500)' : 'var(--color-red-600)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3) var(--spacing-6)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px'
              }}
              onMouseEnter={(e) => {
                const bgColor = showRetryButton ? 'var(--color-gray-600)' : 'var(--color-red-700)';
                e.currentTarget.style.backgroundColor = bgColor;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                const bgColor = showRetryButton ? 'var(--color-gray-500)' : 'var(--color-red-600)';
                e.currentTarget.style.backgroundColor = bgColor;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {showRetryButton ? 'Cancel' : 'Got it'}
            </button>
          </div>
        </div>

        {/* Progress bar for auto-close (if enabled) */}
        {autoCloseMs > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: 'var(--color-gray-200)',
            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: 'var(--color-red-500)',
              animation: `errorProgressBar ${autoCloseMs}ms linear`
            }} />
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes errorModalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes errorIconShake {
          0% {
            transform: scale(0.3) rotate(0deg);
            opacity: 0;
          }
          25% {
            transform: scale(1.1) rotate(-5deg);
          }
          50% {
            transform: scale(0.9) rotate(5deg);
          }
          75% {
            transform: scale(1.05) rotate(-2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes errorProgressBar {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
