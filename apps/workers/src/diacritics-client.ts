import { createLogger } from '@audibook/logger';

const logger = createLogger('DiacriticsClient');

export interface DiacriticsRequest {
  text: string;
  mark_matres_lectionis?: string;
}

export interface DiacriticsResponse {
  original_text: string;
  text_with_diacritics: string;
  processing_time_ms: number;
}

export interface BatchDiacriticsRequest {
  texts: string[];
  mark_matres_lectionis?: string;
}

export interface BatchDiacriticsResponse {
  results: DiacriticsResponse[];
  total_processing_time_ms: number;
}

export class DiacriticsClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl = 'http://localhost:8001', timeout = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Check if the diacritics service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`Health check failed with status: ${response.status}`);
        return false;
      }

      const data = await response.json() as { status: string; model_loaded: boolean };
      return data.status === 'healthy' && data.model_loaded === true;
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Add diacritics to a single Hebrew text
   */
  async addDiacritics(request: DiacriticsRequest): Promise<DiacriticsResponse> {
    try {
      logger.debug('Adding diacritics to text', {
        textLength: request.text.length,
        hasMarkMatresLectionis: !!request.mark_matres_lectionis,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/add-diacritics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json() as DiacriticsResponse;
      
      logger.debug('Diacritics added successfully', {
        originalLength: result.original_text.length,
        processedLength: result.text_with_diacritics.length,
        processingTimeMs: result.processing_time_ms,
      });

      return result;
    } catch (error) {
      logger.error('Failed to add diacritics:', error);
      throw new Error(`Failed to add diacritics: ${error.message}`);
    }
  }

  /**
   * Add diacritics to multiple Hebrew texts in batch
   */
  async addDiacriticsBatch(request: BatchDiacriticsRequest): Promise<BatchDiacriticsResponse> {
    try {
      logger.debug('Adding diacritics to batch of texts', {
        textCount: request.texts.length,
        totalLength: request.texts.reduce((sum, text) => sum + text.length, 0),
        hasMarkMatresLectionis: !!request.mark_matres_lectionis,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/add-diacritics-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json() as BatchDiacriticsResponse;
      
      logger.debug('Batch diacritics added successfully', {
        processedCount: result.results.length,
        totalProcessingTimeMs: result.total_processing_time_ms,
      });

      return result;
    } catch (error) {
      logger.error('Failed to add batch diacritics:', error);
      throw new Error(`Failed to add batch diacritics: ${error.message}`);
    }
  }

  /**
   * Wait for the diacritics service to become available
   */
  async waitForService(maxRetries = 30, retryIntervalMs = 1000): Promise<boolean> {
    logger.info('Waiting for diacritics service to become available...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const isHealthy = await this.healthCheck();
        if (isHealthy) {
          logger.info(`Diacritics service is available (attempt ${attempt}/${maxRetries})`);
          return true;
        }
      } catch (error) {
        logger.debug(`Health check attempt ${attempt} failed:`, error);
      }

      if (attempt < maxRetries) {
        logger.debug(`Waiting ${retryIntervalMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
      }
    }

    logger.error(`Diacritics service did not become available after ${maxRetries} attempts`);
    return false;
  }
}

// Create a default instance
export const diacriticsClient = new DiacriticsClient(
  process.env.DIACRITICS_SERVICE_URL || 'http://localhost:8001'
);
