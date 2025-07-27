// apps/web/hooks/useApiClient.ts
// React hook for using the API client

import { useMemo } from 'react';
import { createApiClient } from '@audibook/api-client';
import { getApiUrl } from '../lib/config';
// import { useAuth } from './useAuth'; // Your auth hook when implemented

export const useApiClient = () => {
  // const { token } = useAuth(); // Uncomment when auth is implemented

  // Create API client instance with correct URL for browser context
  const apiClient = useMemo(() => {
    const baseUrl = getApiUrl(); // Uses environment-aware API URL
    return createApiClient(baseUrl);
  }, []);

  // TODO: Add auth token handling when authentication is implemented
  // useEffect(() => {
  //   if (token) {
  //     apiClient.setAuthToken(token);
  //   } else {
  //     apiClient.clearAuthToken();
  //   }
  // }, [token, apiClient]);

  return apiClient;
};