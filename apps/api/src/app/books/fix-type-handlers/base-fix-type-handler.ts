import { Logger } from '@nestjs/common';

/**
 * Interface representing a match result from a fix type handler.
 * Contains all information needed to classify and understand a text correction.
 */
export interface FixTypeMatch {
  /** The fix type identifier (matches FixType enum values) */
  fixType: string;
  /** Confidence score from 0-1, indicating how certain this handler is about the match */
  confidence: number;
  /** Human-readable explanation of why this fix type was chosen */
  reason: string;
  /** Additional debug information for analysis and troubleshooting */
  debugInfo?: Record<string, unknown>;
}

/**
 * Abstract base class for all fix type handlers in the Hebrew AI narration text correction system.
 * 
 * Each fix type handler is responsible for:
 * - Detecting whether a text change matches its specific correction pattern
 * - Providing confidence scores and detailed reasoning for matches
 * - Logging debug information for analysis and troubleshooting
 * 
 * The modular design allows for:
 * - Easy addition of new fix types
 * - Independent testing and debugging of each correction category
 * - Consistent logging and error handling across all handlers
 * - Clear separation of concerns for different correction types
 * 
 * @abstract
 */
export abstract class BaseFixTypeHandler {
  /**
   * Logger instance for this handler, named after the handler's class name.
   */
  protected readonly logger = new Logger(this.constructor.name);
  
  abstract readonly fixType: string;
  abstract readonly description: string;
  
  /**
   * Check if this handler can classify the given text change
   * @param originalWord The original word/text
   * @param correctedWord The corrected word/text
   * @returns FixTypeMatch if this handler matches, null otherwise
   */
  abstract canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null;
  
  /**
   * Log debug information for this handler's analysis
   */
  protected logDebug(originalWord: string, correctedWord: string, message: string, debugInfo?: Record<string, unknown>) {
    this.logger.debug(`[${this.fixType}] "${originalWord}" → "${correctedWord}": ${message}`, debugInfo);
  }
  
  /**
   * Log when this handler matches
   */
  protected logMatch(originalWord: string, correctedWord: string, reason: string, confidence: number, debugInfo?: Record<string, unknown>): void {
    this.logger.debug(`[${this.fixType}] MATCH (${confidence}): "${originalWord}" → "${correctedWord}" - ${reason}`, debugInfo);
  }
  
  /**
   * Log when this handler doesn't match
   */
  protected logNoMatch(originalWord: string, correctedWord: string, reason: string) {
    this.logger.debug(`[${this.fixType}] NO MATCH: "${originalWord}" → "${correctedWord}" - ${reason}`);
  }
}
