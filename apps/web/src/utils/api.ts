import { config } from '../../lib/config';

export const getApiUrl = () => {
  return config.api.clientUrl;
};

export const apiUrl = getApiUrl();
