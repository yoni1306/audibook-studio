import { useEffect } from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: string;
  autoCloseMs?: number;
}

export default function SuccessModal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  icon = '✅',
  autoCloseMs = 3000 
}: SuccessModalProps) {
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
        border: '1px solid var(--color-green-200)',
        position: 'relative',
        animation: 'successModalSlideIn 0.3s ease-out'
      }}>
        {/* Success Animation */}
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
            animation: 'successIconBounce 0.6s ease-out'
          }}>
            {icon}
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            color: 'var(--color-green-800)',
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

          {/* Action Button */}
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#16a34a',
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
              e.currentTarget.style.backgroundColor = '#15803d';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#16a34a';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Got it!
          </button>
        </div>

        {/* Progress bar for auto-close */}
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
              backgroundColor: 'var(--color-green-500)',
              animation: `successProgressBar ${autoCloseMs}ms linear`
            }} />
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes successModalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes successIconBounce {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes successProgressBar {
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
