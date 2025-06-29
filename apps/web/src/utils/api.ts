export const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
};

export const apiUrl = getApiUrl();
