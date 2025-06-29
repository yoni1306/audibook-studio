// apps/web/lib/config.ts
// Centralized configuration for the web app

export const config = {
    api: {
      // Client-side API URL (browser)
      clientUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      
      // Server-side API URL (SSR/API routes)
      serverUrl: process.env.INTERNAL_API_URL || process.env.API_URL || 'http://localhost:3000',
      
      // Timeout settings
      timeout: 30000,
    },
    
    // Feature flags
    features: {
      enableDebugMode: process.env.NODE_ENV === 'development',
    },
    
    // Environment
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
  };
  
  // Helper to get the correct API URL based on context
  export const getApiUrl = (isServer = typeof window === 'undefined'): string => {
    return isServer ? config.api.serverUrl : config.api.clientUrl;
  };