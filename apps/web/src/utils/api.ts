// Re-export API URL utilities from config for backward compatibility
export { getApiUrl, config } from '../../lib/config';

// Import config for local use
import { config } from '../../lib/config';

// Convenience export for direct API URL access
export const apiUrl = config.api.url;
