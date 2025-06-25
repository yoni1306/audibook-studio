import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { PageLocation } from './types';

const logger = createLogger('EPUB3PageListExtractor');

/**
 * Extracts page locations from EPUB3 navigation documents
 * Handles EPUB3 page-list navigation structure
 */
export class EPUB3PageListExtractor {
  /**
   * Extract page locations from EPUB3 navigation document
   */
  extractFromNavigation(navDoc: string): PageLocation[] {
    const $ = cheerio.load(navDoc);
    const pageLocations: PageLocation[] = [];

    logger.debug('Extracting page locations from EPUB3 navigation');

    try {
      // EPUB3 page-list navigation
      $('nav[epub\\:type="page-list"] ol li a').each((index, elem) => {
        const $link = $(elem);
        const href = $link.attr('href') || '';
        const pageNum = $link.text().trim();

        pageLocations.push({
          pageNumber: parseInt(pageNum) || index + 1,
          href: href,
          label: pageNum
        });
      });

      // Fallback: look for any page-list structure
      if (pageLocations.length === 0) {
        $('ol.page-list li a, ul.page-list li a').each((index, elem) => {
          const $link = $(elem);
          const href = $link.attr('href') || '';
          const pageNum = $link.text().trim();

          pageLocations.push({
            pageNumber: parseInt(pageNum) || index + 1,
            href: href,
            label: pageNum
          });
        });
      }

      logger.debug(`Extracted ${pageLocations.length} page locations from navigation`);
    } catch (error) {
      logger.error('Error extracting page locations:', error);
    }

    return pageLocations;
  }

  /**
   * Extract page references from any navigation structure
   */
  extractPageReferences(navDoc: string): PageLocation[] {
    const $ = cheerio.load(navDoc);
    const pageLocations: PageLocation[] = [];

    logger.debug('Extracting page references from navigation');

    try {
      // Look for any links that might be page references
      $('a[href]').each((index, elem) => {
        const $link = $(elem);
        const href = $link.attr('href') || '';
        const text = $link.text().trim();

        // Check if this looks like a page reference
        const pageMatch = text.match(/^(?:page\s*)?(\d+)$/i);
        if (pageMatch) {
          pageLocations.push({
            pageNumber: parseInt(pageMatch[1]),
            href: href,
            label: text
          });
        }
      });

      logger.debug(`Extracted ${pageLocations.length} page references from navigation`);
    } catch (error) {
      logger.error('Error extracting page references:', error);
    }

    return pageLocations;
  }
}
