/**
 * Centralized styling utilities for consistent UI across book components
 */

import { CSSProperties } from 'react';

/**
 * Common color palette for book components
 */
export const colors = {
  primary: '#0070f3',
  success: '#4CAF50',
  error: '#f44336',
  warning: '#f57c00',
  info: '#2196F3',
  gray: {
    light: '#f5f5f5',
    medium: '#ccc',
    dark: '#666',
    darker: '#333'
  },
  background: {
    light: '#f9fafb',
    warning: '#fff3e0',
    error: '#ffebee',
    success: '#f0fdf4',
    info: '#e3f2fd'
  },
  border: {
    light: '#e5e7eb',
    medium: '#d1d5db',
    success: '#bbf7d0',
    info: '#2196f3'
  },
  text: {
    primary: '#374151',
    secondary: '#6b7280',
    muted: '#888'
  }
} as const;

/**
 * Common button styles
 */
export const buttonStyles = {
  primary: {
    padding: '8px 16px',
    backgroundColor: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  } as CSSProperties,
  
  success: {
    padding: '8px 16px',
    backgroundColor: colors.success,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  } as CSSProperties,
  
  error: {
    padding: '8px 16px',
    backgroundColor: colors.error,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  } as CSSProperties,
  
  secondary: {
    padding: '8px 16px',
    backgroundColor: colors.gray.medium,
    color: colors.text.primary,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  } as CSSProperties,
  
  outline: {
    padding: '8px 16px',
    backgroundColor: 'white',
    color: colors.text.secondary,
    border: `1px solid ${colors.border.medium}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  } as CSSProperties,
  
  small: {
    padding: '5px 10px',
    fontSize: '12px',
    borderRadius: '3px'
  } as CSSProperties
} as const;

/**
 * Common container styles
 */
export const containerStyles = {
  paragraph: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: colors.gray.light,
    borderRadius: '5px',
    position: 'relative' as const,
    cursor: 'pointer' as const
  } as CSSProperties,
  
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  } as CSSProperties,
  
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  } as CSSProperties,
  
  notification: {
    padding: '15px',
    backgroundColor: colors.background.info,
    borderRadius: '5px',
    marginBottom: '20px',
    border: `1px solid ${colors.border.info}`
  } as CSSProperties
} as const;

/**
 * Common text styles
 */
export const textStyles = {
  metadata: {
    fontSize: '12px',
    color: colors.text.secondary
  } as CSSProperties,
  
  muted: {
    fontSize: '11px',
    color: colors.text.muted
  } as CSSProperties,
  
  heading: {
    margin: '0 0 10px 0',
    color: colors.primary,
    fontSize: '16px',
    fontWeight: '600'
  } as CSSProperties,
  
  label: {
    fontSize: '15px',
    color: colors.text.secondary,
    marginBottom: '4px'
  } as CSSProperties
} as const;

/**
 * Audio status specific styles
 */
export const audioStatusStyles = {
  ready: {
    padding: '10px',
    backgroundColor: colors.background.success,
    borderRadius: '5px'
  } as CSSProperties,
  
  generating: {
    padding: '10px',
    backgroundColor: colors.background.warning,
    borderRadius: '5px',
    color: colors.warning,
    textAlign: 'center' as const
  } as CSSProperties,
  
  error: {
    padding: '10px',
    backgroundColor: colors.background.error,
    borderRadius: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  } as CSSProperties,
  
  pending: {
    padding: '10px',
    backgroundColor: colors.gray.light,
    borderRadius: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  } as CSSProperties
} as const;

/**
 * Helper function to merge styles
 */
export const mergeStyles = (...styles: (CSSProperties | undefined)[]): CSSProperties => {
  return styles.reduce((acc, style) => ({ ...acc, ...style }), {});
};
