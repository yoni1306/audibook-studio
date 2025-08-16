import { createLogger } from '../utils/logger';

const logger = createLogger('RevertParagraphConfirmDialog');

interface RevertParagraphConfirmDialogProps {
  isOpen: boolean;
  paragraphContent: string;
  originalContent: string;
  onConfirm: () => void;
  onCancel: () => void;
  isReverting?: boolean;
}

export default function RevertParagraphConfirmDialog({
  isOpen,
  paragraphContent,
  originalContent,
  onConfirm,
  onCancel,
  isReverting = false,
}: RevertParagraphConfirmDialogProps) {
  const handleConfirm = () => {
    logger.info('User confirmed paragraph revert', { action: 'revert_confirm' });
    onConfirm();
  };

  const handleCancel = () => {
    logger.info('User cancelled paragraph revert', { action: 'revert_cancel' });
    onCancel();
  };

  if (!isOpen) return null;

  // Show more content for better comparison
  const truncateText = (text: string, maxLength = 500) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Enhanced diff preview - show what's different
  const getDiffPreview = () => {
    const current = paragraphContent.trim();
    const original = originalContent.trim();
    
    if (current === original) {
      return { hasChanges: false, preview: 'No changes detected' };
    }
    
    // Calculate differences
    const lengthDiff = current.length - original.length;
    const currentWords = current.split(/\s+/).length;
    const originalWords = original.split(/\s+/).length;
    const wordDiff = currentWords - originalWords;
    
    // Build informative preview
    const parts = [];
    
    if (lengthDiff !== 0) {
      const lengthInfo = lengthDiff > 0 
        ? `+${lengthDiff} characters` 
        : `${Math.abs(lengthDiff)} characters removed`;
      parts.push(lengthInfo);
    }
    
    if (wordDiff !== 0) {
      const wordInfo = wordDiff > 0 
        ? `+${wordDiff} words` 
        : `${Math.abs(wordDiff)} words removed`;
      parts.push(wordInfo);
    }
    
    // Simple change detection
    const changeTypes = [];
    if (current.length > original.length) changeTypes.push('additions');
    if (current.length < original.length) changeTypes.push('deletions');
    if (current.length === original.length) changeTypes.push('modifications');
    
    const summary = parts.length > 0 
      ? `Content modified: ${parts.join(', ')}` 
      : `Content modified (${changeTypes.join(' and ')})`;
    
    return {
      hasChanges: true,
      preview: summary
    };
  };

  const diffInfo = getDiffPreview();

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
          maxWidth: '600px',
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
          <span style={{ fontSize: 'var(--font-size-2xl)' }}>↩️</span>
          <h2 style={{ 
            margin: 0, 
            color: 'var(--color-warning-600)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700'
          }}>
            Revert to Original Content
          </h2>
        </div>
        
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <p style={{ 
            margin: '0 0 var(--spacing-4) 0',
            color: 'var(--color-gray-700)',
            fontSize: 'var(--font-size-base)'
          }}>
            Are you sure you want to revert this paragraph to its original content?
          </p>
          
          {/* Diff Summary */}
          {diffInfo.hasChanges && (
            <div style={{
              margin: '0 0 var(--spacing-4) 0',
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-blue-50)',
              border: '1px solid var(--color-blue-200)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-blue-700)',
              fontWeight: '500'
            }}>
              📊 {diffInfo.preview}
            </div>
          )}
          
          <div style={{ marginBottom: 'var(--spacing-5)' }}>
            <div style={{ 
              marginBottom: 'var(--spacing-3)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: 'var(--color-gray-800)'
            }}>
              Current content:
            </div>
            <div style={{ 
              padding: 'var(--spacing-4)',
              backgroundColor: 'var(--color-red-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-red-200)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray-700)',
              fontStyle: 'italic',
              lineHeight: '1.5',
              maxHeight: '200px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              "{truncateText(paragraphContent)}"
            </div>
          </div>

          <div style={{ marginBottom: 'var(--spacing-5)' }}>
            <div style={{ 
              marginBottom: 'var(--spacing-3)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: 'var(--color-gray-800)'
            }}>
              Will be reverted to:
            </div>
            <div style={{ 
              padding: 'var(--spacing-4)',
              backgroundColor: 'var(--color-green-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-green-200)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-gray-700)',
              fontStyle: 'italic',
              lineHeight: '1.5',
              maxHeight: '200px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              "{truncateText(originalContent)}"
            </div>
          </div>

          <div style={{ 
            margin: '0 0 var(--spacing-6) 0', 
            padding: 'var(--spacing-4)',
            backgroundColor: 'var(--color-warning-50)',
            border: '1px solid var(--color-warning-200)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-warning-700)', 
            fontWeight: '600',
            fontSize: 'var(--font-size-sm)'
          }}>
            ⚠️ This action cannot be undone! Any changes you've made to this paragraph will be lost.
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-3)', 
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          <button
            onClick={handleCancel}
            disabled={isReverting}
            className="btn btn-secondary"
            style={{
              opacity: isReverting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isReverting}
            className="btn btn-warning"
            style={{
              opacity: isReverting ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)'
            }}
          >
            {isReverting && <span className="spinner" />}
            {isReverting ? 'Reverting...' : '↩️ Revert to Original'}
          </button>
        </div>
      </div>
    </div>
  );
}
