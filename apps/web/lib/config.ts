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

/**
 * Get the API URL following industry best practices
 * 
 * BEST PRACTICE: Always use explicit environment variables for API URLs
 * - Production: Set VITE_API_URL during build process
 * - Development: Falls back to local development URL
 * 
 * This approach is:
 * - Reliable and explicit
 * - Environment-agnostic
 * - Easy to debug and maintain
 * - Secure and predictable
 */
const getApiUrl = (): string => {
  // PRODUCTION: Use explicit environment variable (set during build)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // DEVELOPMENT: Use local development API URL
  // This is the only acceptable fallback
  return DEFAULT_API_URL;
};

export const config = {
  api: {
    // API URL - uses environment-aware resolution following best practices
    url: getApiUrl(),
    
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

// Export the API URL getter for external use
export { getApiUrl };