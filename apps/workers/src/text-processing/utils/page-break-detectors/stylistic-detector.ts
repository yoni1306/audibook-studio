import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { PageBreakIndicator, ElementWithTag } from './types';

const logger = createLogger('StylisticPageBreakDetector');

/**
 * Detects stylistic page breaks based on CSS classes and visual formatting
 * These indicate page boundaries based on visual design patterns
 */
export class StylisticPageBreakDetector {
  /**
   * Detect stylistic page breaks from CSS classes and formatting
   */
  detect($: cheerio.CheerioAPI): PageBreakIndicator[] {
    const indicators: PageBreakIndicator[] = [];

    logger.debug('Starting stylistic page break detection');

    // CSS classes that commonly indicate page breaks
    this.detectPageBreakClasses($, indicators);
    
    // Text alignment patterns
    this.detectAlignmentPatterns($, indicators);
    
    // Font size changes
    this.detectFontSizeChanges($, indicators);

    logger.debug(`Found ${indicators.length} stylistic page breaks`);
    return indicators;
  }

  private detectPageBreakClasses(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    const pageBreakClasses = [
      'page-break',
      'new-page',
      'page-start',
      'chapter-start',
      'section-break'
    ];

    pageBreakClasses.forEach(className => {
      $(`.${className}, [class*="${className}"]`).each((index, elem) => {
        indicators.push({
          type: 'stylistic',
          confidence: 0.8,
          position: $(elem).index(),
          reason: `Page break CSS class: ${className}`,
          elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
          elementText: $(elem).text().trim().substring(0, 100)
        });
      });
    });
  }

  private detectAlignmentPatterns(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    // Center-aligned elements often start new sections/pages
    $('[style*="text-align: center"], .center, .text-center').each((index, elem) => {
      const text = $(elem).text().trim();
      
      // Higher confidence if it looks like a title
      let confidence = 0.6;
      if (/^(chapter|part|section|book)\s+\d+/i.test(text) || text.length < 50) {
        confidence = 0.7;
      }

      indicators.push({
        type: 'stylistic',
        confidence,
        position: $(elem).index(),
        reason: 'Center-aligned text (possible title)',
        elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
        elementText: text.substring(0, 100)
      });
    });
  }

  private detectFontSizeChanges(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    // Large font sizes often indicate titles/headers
    $('[style*="font-size"]').each((index, elem) => {
      const style = $(elem).attr('style') || '';
      const hasLargeFont = /font-size:\s*(?:[2-9]\d+px|\d{3,}px|[2-9]\.?\d*em|[2-9]\.?\d*rem)/i.test(style);
      
      if (hasLargeFont) {
        const text = $(elem).text().trim();
        let confidence = 0.6;
        
        // Higher confidence for short text (likely titles)
        if (text.length < 100) {
          confidence = 0.7;
        }

        indicators.push({
          type: 'stylistic',
          confidence,
          position: $(elem).index(),
          reason: 'Large font size (possible title)',
          elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
          elementText: text.substring(0, 100)
        });
      }
    });
  }
}
