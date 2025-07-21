// Modern Design System for Audibook Studio
export const designSystem = {
  // Color Palette
  colors: {
    // Primary brand colors
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9', // Main brand color
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    
    // Neutral grays
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    
    // Semantic colors
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
    },
    
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
    
    // Background colors
    background: {
      primary: '#ffffff',
      secondary: '#f9fafb',
      tertiary: '#f3f4f6',
    },
    
    // Text colors
    text: {
      primary: '#111827',
      secondary: '#6b7280',
      tertiary: '#9ca3af',
      inverse: '#ffffff',
    },
    
    // Border colors
    border: {
      light: '#e5e7eb',
      medium: '#d1d5db',
      dark: '#9ca3af',
    }
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
    
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    }
  },
  
  // Spacing (using 4px base unit)
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    base: '0.25rem',  // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',
  },
  
  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  
  // Transitions
  transition: {
    fast: '150ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
  
  // Z-index scale
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  }
};

// Helper functions for common style patterns
export const styleHelpers = {
  // Button variants
  button: {
    primary: {
      backgroundColor: designSystem.colors.primary[500],
      color: designSystem.colors.text.inverse,
      border: 'none',
      padding: `${designSystem.spacing[3]} ${designSystem.spacing[6]}`,
      borderRadius: designSystem.borderRadius.md,
      fontSize: designSystem.typography.fontSize.sm,
      fontWeight: designSystem.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: designSystem.transition.normal,
      boxShadow: designSystem.boxShadow.sm,
    },
    
    secondary: {
      backgroundColor: designSystem.colors.background.primary,
      color: designSystem.colors.text.primary,
      border: `1px solid ${designSystem.colors.border.medium}`,
      padding: `${designSystem.spacing[3]} ${designSystem.spacing[6]}`,
      borderRadius: designSystem.borderRadius.md,
      fontSize: designSystem.typography.fontSize.sm,
      fontWeight: designSystem.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: designSystem.transition.normal,
      boxShadow: designSystem.boxShadow.sm,
    },
    
    danger: {
      backgroundColor: designSystem.colors.error[500],
      color: designSystem.colors.text.inverse,
      border: 'none',
      padding: `${designSystem.spacing[3]} ${designSystem.spacing[6]}`,
      borderRadius: designSystem.borderRadius.md,
      fontSize: designSystem.typography.fontSize.sm,
      fontWeight: designSystem.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: designSystem.transition.normal,
      boxShadow: designSystem.boxShadow.sm,
    }
  },
  
  // Card styles
  card: {
    backgroundColor: designSystem.colors.background.primary,
    border: `1px solid ${designSystem.colors.border.light}`,
    borderRadius: designSystem.borderRadius.lg,
    padding: designSystem.spacing[6],
    boxShadow: designSystem.boxShadow.sm,
  },
  
  // Input styles
  input: {
    backgroundColor: designSystem.colors.background.primary,
    border: `1px solid ${designSystem.colors.border.medium}`,
    borderRadius: designSystem.borderRadius.md,
    padding: `${designSystem.spacing[3]} ${designSystem.spacing[4]}`,
    fontSize: designSystem.typography.fontSize.sm,
    transition: designSystem.transition.normal,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  
  // Modal overlay
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: designSystem.zIndex.modal,
  },
  
  // Modal content
  modalContent: {
    backgroundColor: designSystem.colors.background.primary,
    borderRadius: designSystem.borderRadius.xl,
    padding: designSystem.spacing[8],
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: designSystem.boxShadow.xl,
  }
};

export default designSystem;
