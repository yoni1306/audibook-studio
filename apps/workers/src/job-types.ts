/**
 * TypeScript interfaces for NATS job data
 * 
 * These interfaces define the structure of job data passed between
 * the API and workers via NATS JetStream messages.
 */

export interface BaseJobData {
  correlationId?: string;
  timestamp?: number;
}

export interface EpubParsingJobData extends BaseJobData {
  bookId: string;
  s3Key: string;
  parsingMethod?: 'page-based' | 'xhtml-based';
}

export interface AudioGenerationJobData extends BaseJobData {
  paragraphId: string;
  bookId: string;
  content: string;
}

export interface PageAudioCombinationJobData extends BaseJobData {
  pageId: string;
  bookId: string;
}

export interface DiacriticsJobData extends BaseJobData {
  bookId: string;
}

export interface JobResult {
  processed: boolean;
  duration?: number;
  [key: string]: unknown;
}

export interface EpubParsingResult extends JobResult {
  bookId: string;
  paragraphCount: number;
}

export interface AudioGenerationResult extends JobResult {
  paragraphId: string;
  s3Key: string;
  duration: number;
  processingTime: number;
}

export interface PageAudioCombinationResult extends JobResult {
  pageId: string;
  pageNumber: number;
  bookId: string;
  s3Key: string;
  totalDuration: number;
  paragraphCount: number;
}

export interface DiacriticsResult extends JobResult {
  bookId: string;
  paragraphsProcessed: number;
}
