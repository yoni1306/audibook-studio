import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { PageBreakIndicator, ElementWithTag } from './types';

const logger = createLogger('ExplicitPageBreakDetector');

/**
 * Detects explicit page breaks in HTML content
 * These are the highest confidence indicators as they are intentionally placed
 */
export class ExplicitPageBreakDetector {
  /**
   * Detect explicit page breaks from CSS properties and EPUB markers
   */
  detect(html: string, $?: cheerio.CheerioAPI): PageBreakIndicator[] {
    const indicators: PageBreakIndicator[] = [];
    const cheerioInstance = $ || cheerio.load(html);

    logger.debug('Starting explicit page break detection');

    // CSS page-break properties
    this.detectCSSPageBreaks(cheerioInstance, indicators);
    
    // EPUB:type="pagebreak" attribute (EPUB3)
    this.detectEPUBPageBreakMarkers(cheerioInstance, indicators);
    
    // Adobe Digital Editions page markers
    this.detectPageNumberMarkers(cheerioInstance, indicators);

    logger.debug(`Found ${indicators.length} explicit page breaks`);
    return indicators;
  }

  private detectCSSPageBreaks(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    const pageBreakStyles = [
      'page-break-before: always',
      'page-break-after: always',
      'break-before: page',
      'break-after: page',
      'page-break-inside: avoid'
    ];

    $('[style*="page-break"]').each((index, elem) => {
      const style = $(elem).attr('style') || '';
      if (pageBreakStyles.some(pb => style.includes(pb))) {
        indicators.push({
          type: 'explicit',
          confidence: 1.0,
          position: $(elem).index(),
          reason: 'CSS page-break property',
          elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
          elementText: $(elem).text().trim().substring(0, 100)
        });
      }
    });
  }

  private detectEPUBPageBreakMarkers(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    $('[epub\\:type="pagebreak"], [role="doc-pagebreak"]').each((index, elem) => {
      indicators.push({
        type: 'explicit',
        confidence: 1.0,
        position: $(elem).index(),
        reason: 'EPUB pagebreak marker',
        elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
        elementText: $(elem).text().trim().substring(0, 100)
      });
    });
  }

  private detectPageNumberMarkers(
    $: cheerio.CheerioAPI, 
    indicators: PageBreakIndicator[]
  ): void {
    $('span[id^="page"], a[id^="page"]').each((index, elem) => {
      const id = $(elem).attr('id') || '';
      if (/page[-_]?\d+/i.test(id)) {
        indicators.push({
          type: 'explicit',
          confidence: 0.9,
          position: $(elem).index(),
          reason: 'Page number marker',
          elementTag: (elem as unknown as ElementWithTag).tagName || 'unknown',
          elementText: $(elem).text().trim().substring(0, 100)
        });
      }
    });
  }
}
