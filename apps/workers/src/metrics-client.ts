import { createLogger } from '@audibook/logger';

const logger = createLogger('MetricsClient');

export interface MetricEventData {
  bookId: string;
  eventType: 'TEXT_EDIT' | 'AUDIO_GENERATION' | 'BULK_FIX_APPLIED' | 'BULK_FIX_SUGGESTED' | 'PARAGRAPH_COMPLETED' | 'BOOK_UPLOADED' | 'EPUB_PARSED' | 'CORRECTION_RECORDED';
  eventData?: Record<string, unknown>;
  duration?: number;
  success?: boolean;
  errorMessage?: string;
}

export class MetricsClient {
  private readonly apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env['API_BASE_URL'] || 'http://localhost:3000';
  }

  /**
   * Record a metric event by sending it to the API metrics service
   */
  async recordEvent(eventData: MetricEventData): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/metrics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.debug('Metric event recorded', {
        bookId: eventData.bookId,
        eventType: eventData.eventType,
        success: eventData.success,
      });
    } catch (error) {
      logger.error('Failed to record metric event', {
        bookId: eventData.bookId,
        eventType: eventData.eventType,
        error: error.message,
      });
      // Don't throw - metrics recording should not break the main workflow
    }
  }

  /**
   * Record text edit event
   */
  async recordTextEdit(bookId: string, editData?: Record<string, unknown>): Promise<void> {
    await this.recordEvent({
      bookId,
      eventType: 'TEXT_EDIT',
      eventData: editData,
      success: true,
    });
  }

  /**
   * Record audio generation event
   */
  async recordAudioGeneration(
    bookId: string, 
    duration: number, 
    success = true, 
    errorMessage?: string,
    audioData?: Record<string, unknown>
  ): Promise<void> {
    await this.recordEvent({
      bookId,
      eventType: 'AUDIO_GENERATION',
      eventData: audioData,
      duration,
      success,
      errorMessage,
    });
  }

  /**
   * Record bulk fix applied event
   */
  async recordBulkFixApplied(
    bookId: string, 
    fixCount: number, 
    fixData?: Record<string, unknown>
  ): Promise<void> {
    await this.recordEvent({
      bookId,
      eventType: 'BULK_FIX_APPLIED',
      eventData: { fixCount, ...fixData },
      success: true,
    });
  }

  /**
   * Record paragraph completion event
   */
  async recordParagraphCompleted(
    bookId: string, 
    paragraphData?: Record<string, unknown>
  ): Promise<void> {
    await this.recordEvent({
      bookId,
      eventType: 'PARAGRAPH_COMPLETED',
      eventData: paragraphData,
      success: true,
    });
  }

  /**
   * Record EPUB parsing event
   */
  async recordEpubParsed(
    bookId: string, 
    duration: number, 
    success = true, 
    errorMessage?: string,
    parseData?: Record<string, unknown>
  ): Promise<void> {
    await this.recordEvent({
      bookId,
      eventType: 'EPUB_PARSED',
      eventData: parseData,
      duration,
      success,
      errorMessage,
    });
  }

  /**
   * Record correction event
   */
  async recordCorrection(
    bookId: string, 
    correctionData?: Record<string, unknown>
  ): Promise<void> {
    await this.recordEvent({
      bookId,
      eventType: 'CORRECTION_RECORDED',
      eventData: correctionData,
      success: true,
    });
  }
}

// Singleton instance
export const metricsClient = new MetricsClient();
