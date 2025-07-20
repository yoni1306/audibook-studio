import React, { useState } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('DeleteBookConfirmDialog');

interface DeleteBookConfirmDialogProps {
  isOpen: boolean;
  bookTitle: string;
  bookId: string;
  onConfirm: (bookId: string) => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeleteBookConfirmDialog({
  isOpen,
  bookTitle,
  bookId,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteBookConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const requiredText = 'DELETE';

  const handleConfirm = () => {
    if (confirmText === requiredText) {
      logger.log(`User confirmed deletion of book: ${bookTitle}`);
      onConfirm(bookId);
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onCancel();
  };

  const isConfirmEnabled = confirmText === requiredText && !isDeleting;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1040,
        padding: 'var(--spacing-4)',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 'var(--spacing-8)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-gray-200)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--spacing-3)', 
          marginBottom: 'var(--spacing-6)' 
        }}>
          <span style={{ fontSize: 'var(--font-size-2xl)' }}>⚠️</span>
          <h2 style={{ 
            margin: 0, 
            color: 'var(--color-error-600)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700'
          }}>
            Delete Book
          </h2>
        </div>
        
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <p style={{ 
            margin: '0 0 var(--spacing-4) 0',
            color: 'var(--color-gray-700)',
            fontSize: 'var(--font-size-base)'
          }}>
            Are you sure you want to delete the book:
          </p>
          <div style={{ 
            margin: '0 0 var(--spacing-5) 0', 
            fontWeight: '600',
            padding: 'var(--spacing-4)',
            backgroundColor: 'var(--color-gray-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-gray-200)',
            fontSize: 'var(--font-size-base)'
          }}>
            "{bookTitle}"
          </div>
          <p style={{ 
            margin: '0 0 var(--spacing-4) 0', 
            color: 'var(--color-gray-600)', 
            fontSize: 'var(--font-size-sm)',
            fontWeight: '500'
          }}>
            This action will permanently delete:
          </p>
          <ul style={{ 
            margin: '0 0 var(--spacing-5) var(--spacing-6)', 
            color: 'var(--color-gray-600)', 
            fontSize: 'var(--font-size-sm)',
            lineHeight: '1.6'
          }}>
            <li style={{ marginBottom: 'var(--spacing-1)' }}>The book and all its content</li>
            <li style={{ marginBottom: 'var(--spacing-1)' }}>All pages and paragraphs</li>
            <li style={{ marginBottom: 'var(--spacing-1)' }}>All text corrections and learning data</li>
            <li>All generated audio files from S3 storage</li>
          </ul>
          <div style={{ 
            margin: '0 0 var(--spacing-6) 0', 
            padding: 'var(--spacing-4)',
            backgroundColor: 'var(--color-error-50)',
            border: '1px solid var(--color-error-200)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error-700)', 
            fontWeight: '600',
            fontSize: 'var(--font-size-sm)'
          }}>
            ⚠️ This action cannot be undone!
          </div>
        </div>

        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 'var(--spacing-3)', 
            fontWeight: '600',
            color: 'var(--color-gray-900)',
            fontSize: 'var(--font-size-sm)'
          }}>
            To confirm deletion, type "{requiredText}" below:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type "${requiredText}" to confirm`}
            disabled={isDeleting}
            className="input"
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: '500',
              borderColor: confirmText === requiredText ? 'var(--color-success-500)' : 'var(--color-gray-300)',
              backgroundColor: isDeleting ? 'var(--color-gray-100)' : 'white',
            }}
            autoFocus
          />
        </div>

        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-3)', 
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          <button
            onClick={handleCancel}
            disabled={isDeleting}
            className="btn btn-secondary"
            style={{
              opacity: isDeleting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className="btn btn-danger"
            style={{
              opacity: !isConfirmEnabled ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)'
            }}
          >
            {isDeleting && <span className="spinner" />}
            {isDeleting ? 'Deleting...' : '🗑️ Delete Book'}
          </button>
        </div>
      </div>
    </div>
  );
}
