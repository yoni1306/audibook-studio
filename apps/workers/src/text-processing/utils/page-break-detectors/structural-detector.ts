import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { PageBreakIndicator, ElementWithTag } from './types';

const logger = createLogger('StructuralPageBreakDetector');

/**
 * Detects structural page breaks based on HTML structure
 * These indicate natural page boundaries based on document organization
 */
export class StructuralPageBreakDetector {
  /**
   * Detect structural page breaks from HTML elements
   */
  detect($: cheerio.CheerioAPI): PageBreakIndicator[] {
    const indicators: PageBreakIndicator[] = [];

    logger.debug('Starting structural page break detection');

    // New chapters/sections typically start new pages
    this.detectChapterBreaks($, indicators);
    
    // Horizontal rules often indicate page breaks
    this.detectHorizontalRules($, indicators);
    
    // Large gaps in content
    this.detectContentGaps($, indicators);

    logger.debug(`Found ${indicators.length} structural page breaks`);
    return indicators;
  }

  private detectChapterBreaks(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    const chapterSelectors = [
      'section[class*="chapter"]',
      'div[class*="chapter"]',
      'article[class*="chapter"]',
      'section[epub\\:type="chapter"]',
      'section[role="doc-chapter"]',
      'h1', // Chapter titles often use h1
      'h2:first-child', // Section headers at beginning
    ];

    chapterSelectors.forEach(selector => {
      $(selector).each((index, elem) => {
        const $elem = $(elem);
        const text = $elem.text().trim();
        
        // Higher confidence for elements that look like chapter titles
        let confidence = 0.8;
        if (/^(chapter|part|section|book)\s+\d+/i.test(text)) {
          confidence = 0.9;
        }

        indicators.push({
          type: 'structural',
          confidence,
          position: $elem.index(),
          reason: `Chapter/section element: ${selector}`,
          elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
          elementText: text.substring(0, 100)
        });
      });
    });
  }

  private detectHorizontalRules(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    $('hr').each((index, elem) => {
      indicators.push({
        type: 'structural',
        confidence: 0.7,
        position: $(elem).index(),
        reason: 'Horizontal rule separator',
        elementTag: 'hr',
        elementText: ''
      });
    });
  }

  private detectContentGaps(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    // Look for elements with significant margin/padding that might indicate page breaks
    $('[style*="margin"], [style*="padding"]').each((index, elem) => {
      const style = $(elem).attr('style') || '';
      const hasLargeMargin = /margin[^:]*:\s*[5-9]\d+px|margin[^:]*:\s*\d{3,}px/i.test(style);
      const hasLargePadding = /padding[^:]*:\s*[5-9]\d+px|padding[^:]*:\s*\d{3,}px/i.test(style);
      
      if (hasLargeMargin || hasLargePadding) {
        indicators.push({
          type: 'structural',
          confidence: 0.6,
          position: $(elem).index(),
          reason: 'Large margin/padding gap',
          elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
          elementText: $(elem).text().trim().substring(0, 100)
        });
      }
    });
  }
}
