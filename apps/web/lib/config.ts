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

// Runtime API URL resolution - best practice for production deployments
const getProductionApiUrl = (): string => {
  // If we're in browser context, try to determine API URL from current domain
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    
    // Railway production pattern: if web is on railway.app, API should be too
    if (currentHost.includes('railway.app')) {
      // Extract the project pattern and construct API URL
      const railwayApiUrl = currentHost.replace('web-production-', 'api-production-');
      return `https://${railwayApiUrl}`;
    }
    
    // For other production domains, try common patterns
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      // Try subdomain pattern
      return `https://api.${currentHost}`;
    }
  }
  
  return DEFAULT_API_URL;
};

export const config = {
    api: {
      // Client-side API URL (browser) - runtime resolution with fallbacks
      clientUrl: import.meta.env.VITE_API_URL || getProductionApiUrl(),
      
      // Server-side API URL - prefer env var, fallback to production resolution
      serverUrl: import.meta.env.VITE_API_URL || getProductionApiUrl(),
      
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