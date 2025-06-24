import { HebrewTTSSplitter } from '../core/HebrewTTSSplitter';
import { EPUBPageDetector } from '../plugins/detectors/EPUBPageDetector';
import { ChunkSizeOptimizer } from '../plugins/processors/ChunkSizeOptimizer';
import { EPUBProcessor } from '../utils/EPUBProcessor';
import { EPUBPage } from '../types';
import { createLogger } from '@audibook/logger';

const logger = createLogger('EPUBSplitterFactory');

export interface EPUBSplitterOptions {
  usePageStructure?: boolean;
  optimizeChunks?: boolean;
  targetChunkSize?: number;
  chapterTitles?: string[];
}

export async function createEPUBSplitter(
  epubPath: string,
  options: EPUBSplitterOptions = {}
): Promise<{ splitter: HebrewTTSSplitter; pages: EPUBPage[] }> {
  logger.info('Creating simplified EPUB splitter for audio narration', { epubPath, options });

  const splitter = new HebrewTTSSplitter({
    processChaptersSeparately: true,
    targetChunkSize: options.targetChunkSize || 400,
  });

  let pages: EPUBPage[] = [];

  // Process EPUB to extract pages and use EPUBPageDetector for intelligent splitting
  if (options.usePageStructure !== false) {
    try {
      const epubProcessor = new EPUBProcessor(epubPath, {
        targetPageSize: options.targetChunkSize || 800
      });
      
      pages = await epubProcessor.extractPages();
      logger.info('Extracted EPUB pages for intelligent splitting', { pageCount: pages.length });
      
      // Add EPUB page detector - this handles all the intelligent split detection
      const pageDetector = new EPUBPageDetector();
      pageDetector.setEPUBContent(pages);
      splitter.addSplitDetector(pageDetector);
    } catch (error) {
      logger.warn('Failed to extract EPUB pages, will use basic text splitting', {
        error: error.message
      });
    }
  }

  // Add single chunk optimizer for consistent audio narration
  if (options.optimizeChunks !== false) {
    splitter.addProcessor(new ChunkSizeOptimizer({
      minSize: 200,
      maxSize: 600,
      targetSize: options.targetChunkSize || 400
    }));
  }

  // Set chapter titles if provided
  if (options.chapterTitles && options.chapterTitles.length > 0) {
    splitter.setChapterTitles(options.chapterTitles);
  }

  logger.info('Simplified EPUB splitter created', {
    detector: 'EPUBPageDetector',
    processor: options.optimizeChunks !== false ? 'ChunkSizeOptimizer' : 'none',
    targetChunkSize: options.targetChunkSize || 400,
  });

  return { splitter, pages };
}

export async function extractTextFromEPUB(epubPath: string): Promise<string> {
  logger.info('Extracting text from EPUB', { epubPath });

  try {
    const epubProcessor = new EPUBProcessor(epubPath);
    const chapters = await epubProcessor.extractChapters();
    
    const fullText = chapters
      .map(chapter => chapter.content || '')
      .join('\n\n');

    logger.info('Text extraction completed', {
      chapters: chapters.length,
      textLength: fullText.length,
    });

    return fullText;
  } catch (error) {
    logger.error('Failed to extract text from EPUB', { error: error.message });
    throw error;
  }
}
