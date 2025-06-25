import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { EPUBPageBreakDetector } from './main-detector';
import { EPUBChapterContent, EPUBPageBreak, PageBreakOptions } from './types';

const logger = createLogger('EPUBPageBreakDetector');

/**
 * Main function for EPUB page break detection
 * This function maintains backward compatibility with the existing API
 */
export async function detectEPUBPageBreaks(
  chapters: EPUBChapterContent[],
  options: PageBreakOptions = {}
): Promise<EPUBPageBreak[]> {
  const correlationId = process.env.CORRELATION_ID || 'unknown';
  
  logger.info(`🔍 Starting page break detection for ${chapters.length} chapters`, {
    correlationId,
    options: {
      targetPageSizeChars: options.targetPageSizeChars || 2000,
      minConfidence: options.minConfidence || 0.5,
      includeExplicit: options.includeExplicit !== false,
      includeStructural: options.includeStructural !== false,
      includeStylistic: options.includeStylistic !== false,
      includeSemantic: options.includeSemantic !== false,
      includeComputed: options.includeComputed || false
    }
  });

  const detector = new EPUBPageBreakDetector(options);
  const pageBreaks: EPUBPageBreak[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    
    try {
      logger.info(`🔍 Processing chapter ${chapter.chapterNumber}: ${chapter.title || chapter.href}`, {
        chapterIndex: i,
        chapterNumber: chapter.chapterNumber,
        contentLength: chapter.content.length,
        href: chapter.href,
        correlationId
      });

      const $ = cheerio.load(chapter.content);
      
      // Detect all types of page breaks
      const indicators = detector.detectAllPageBreaks(
        chapter.content,
        $,
        options
      );

      logger.info(`Found ${indicators.length} page break indicators in chapter ${chapter.chapterNumber}`, {
        chapterNumber: chapter.chapterNumber,
        indicatorCount: indicators.length,
        indicatorTypes: indicators.map(ind => ind.type),
        correlationId
      });

      // Convert indicators to page breaks
      indicators.forEach((indicator) => {
        const pageBreak: EPUBPageBreak = {
          chapterHref: chapter.href,
          chapterNumber: chapter.chapterNumber,
          position: indicator.position,
          type: indicator.type,
          confidence: indicator.confidence,
          reason: indicator.reason,
          elementTag: indicator.elementTag,
          elementText: indicator.elementText
        };
        
        pageBreaks.push(pageBreak);
        
        logger.debug(`Added page break ${pageBreaks.length}`, {
          type: indicator.type,
          confidence: indicator.confidence,
          reason: indicator.reason,
          chapterNumber: chapter.chapterNumber,
          position: indicator.position,
          correlationId
        });
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`Error detecting page breaks in chapter ${chapter.chapterNumber}: ${errorMessage}`, {
        chapterNumber: chapter.chapterNumber,
        chapterHref: chapter.href,
        error: errorMessage,
        correlationId
      });
    }
  }

  const summary = {
    totalChapters: chapters.length,
    totalPageBreaks: pageBreaks.length,
    averagePerChapter: chapters.length > 0 ? (pageBreaks.length / chapters.length).toFixed(2) : '0',
    breaksByType: pageBreaks.reduce((acc, pb) => {
      acc[pb.type] = (acc[pb.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  logger.info(`🔍 Page break detection completed`, {
    ...summary,
    correlationId
  });

  return pageBreaks;
}
