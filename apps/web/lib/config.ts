// apps/web/lib/config.ts
// Centralized configuration for the web app

// Configuration constants - single source of truth
// All magic numbers and default values should be defined here
const CONFIG_CONSTANTS = {
  API: {
    DEFAULT_HOST: 'localhost',
    DEFAULT_PORT: 3000,
    DEFAULT_PROTOCOL: 'http',
    DEFAULT_TIMEOUT: 30000,
    ENDPOINTS: {
      BOOKS: '/api/books',
      HEALTH: '/api/health',
    },
  },
  APP: {
    NAME: 'Audibook Studio',
    VERSION: '1.0.0',
  },
} as const;

// Helper to build API URL from components
const buildApiUrl = (protocol = CONFIG_CONSTANTS.API.DEFAULT_PROTOCOL, host = CONFIG_CONSTANTS.API.DEFAULT_HOST, port = CONFIG_CONSTANTS.API.DEFAULT_PORT) => {
  return `${protocol}://${host}:${port}`;
};

// Default API URL using configuration constants
const DEFAULT_API_URL = buildApiUrl();

export const config = {
    api: {
      // Client-side API URL (browser) - using Vite env vars
      clientUrl: import.meta.env.VITE_API_URL || DEFAULT_API_URL,
      
      // Server-side API URL (for production deployment)
      serverUrl: import.meta.env.VITE_INTERNAL_API_URL || import.meta.env.VITE_API_URL || DEFAULT_API_URL,
      
      // Timeout settings
      timeout: CONFIG_CONSTANTS.API.DEFAULT_TIMEOUT,
    },
    
    // Feature flags
    features: {
      enableDebugMode: import.meta.env.DEV,
    },
    
    // Environment
    env: import.meta.env.MODE || 'development',
    isProduction: import.meta.env.PROD,
    isDevelopment: import.meta.env.DEV,
  };
  
  // Helper to get the correct API URL based on context
  export const getApiUrl = (isServer = typeof window === 'undefined'): string => {
    return isServer ? config.api.serverUrl : config.api.clientUrl;
  };