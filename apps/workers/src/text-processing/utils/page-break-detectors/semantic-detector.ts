import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { PageBreakIndicator, ElementWithTag } from './types';

const logger = createLogger('SemanticPageBreakDetector');

/**
 * Detects semantic page breaks based on content patterns and text analysis
 * These indicate page boundaries based on meaning and content structure
 */
export class SemanticPageBreakDetector {
  /**
   * Detect semantic page breaks from content patterns
   */
  detect($: cheerio.CheerioAPI): PageBreakIndicator[] {
    const indicators: PageBreakIndicator[] = [];

    logger.debug('Starting semantic page break detection');

    // Chapter/section keywords
    this.detectChapterKeywords($, indicators);
    
    // Time/date transitions
    this.detectTimeTransitions($, indicators);
    
    // Scene breaks (common in fiction)
    this.detectSceneBreaks($, indicators);

    logger.debug(`Found ${indicators.length} semantic page breaks`);
    return indicators;
  }

  private detectChapterKeywords(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    const chapterPatterns = [
      /^(chapter|part|section|book)\s+\d+/i,
      /^(epilogue|prologue|introduction|conclusion)/i,
      /^(appendix|bibliography|index)/i
    ];

    $('p, div, h1, h2, h3, h4, h5, h6').each((index, elem) => {
      const text = $(elem).text().trim();
      
      chapterPatterns.forEach(pattern => {
        if (pattern.test(text)) {
          indicators.push({
            type: 'semantic',
            confidence: 0.8,
            position: $(elem).index(),
            reason: 'Chapter/section keyword detected',
            elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
            elementText: text.substring(0, 100)
          });
        }
      });
    });
  }

  private detectTimeTransitions(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    const timePatterns = [
      /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /^(january|february|march|april|may|june|july|august|september|october|november|december)/i,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/, // Date formats
      /^(morning|afternoon|evening|night|dawn|dusk)/i,
      /^(years? later|months? later|weeks? later|days? later)/i
    ];

    $('p, div').each((index, elem) => {
      const text = $(elem).text().trim();
      
      timePatterns.forEach(pattern => {
        if (pattern.test(text) && text.length < 200) {
          indicators.push({
            type: 'semantic',
            confidence: 0.6,
            position: $(elem).index(),
            reason: 'Time/date transition detected',
            elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
            elementText: text.substring(0, 100)
          });
        }
      });
    });
  }

  private detectSceneBreaks(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    // Look for common scene break indicators
    $('p, div').each((index, elem) => {
      const text = $(elem).text().trim();
      
      // Asterisks or other symbols used for scene breaks
      if (/^[*\-~#]{3,}$/.test(text)) {
        indicators.push({
          type: 'semantic',
          confidence: 0.7,
          position: $(elem).index(),
          reason: 'Scene break symbols',
          elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
          elementText: text
        });
      }
      
      // Empty paragraphs between content might indicate breaks
      if (text.length === 0) {
        const prev = $(elem).prev();
        const next = $(elem).next();
        
        if (prev.length && next.length && 
            prev.text().trim().length > 50 && 
            next.text().trim().length > 50) {
          indicators.push({
            type: 'semantic',
            confidence: 0.5,
            position: $(elem).index(),
            reason: 'Empty paragraph between content',
            elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
            elementText: ''
          });
        }
      }
    });
  }
}
