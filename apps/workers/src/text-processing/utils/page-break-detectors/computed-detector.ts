import { createLogger } from '@audibook/logger';
import { PageBreakIndicator, PageBreakOptions } from './types';

const logger = createLogger('ComputedPageBreakDetector');

/**
 * Detects computed page breaks based on content length and target page sizes
 * These are calculated breaks when no natural breaks are found
 */
export class ComputedPageBreakDetector {
  /**
   * Compute page breaks based on content length and target sizes
   */
  detect(
    content: string, 
    options: Pick<PageBreakOptions, 'targetPageSizeChars' | 'minPageSizeChars'> = {}
  ): PageBreakIndicator[] {
    const indicators: PageBreakIndicator[] = [];
    const targetSize = options.targetPageSizeChars || 2000;
    const minSize = options.minPageSizeChars || 500;

    logger.debug(`Computing page breaks for ${content.length} characters with target size ${targetSize}`);

    if (content.length <= targetSize) {
      logger.debug('Content is smaller than target page size, no breaks needed');
      return indicators;
    }

    // Find natural break points (sentences, paragraphs)
    const breakPoints = this.findNaturalBreakPoints(content);
    
    let currentPosition = 0;
    let pageCount = 0;

    while (currentPosition < content.length) {
      const idealBreakPoint = currentPosition + targetSize;
      
      if (idealBreakPoint >= content.length) {
        break; // Last page
      }

      // Find the best break point near the ideal position
      const bestBreakPoint = this.findBestBreakPoint(
        breakPoints, 
        idealBreakPoint, 
        currentPosition + minSize,
        content.length
      );

      if (bestBreakPoint > currentPosition + minSize) {
        indicators.push({
          type: 'computed',
          confidence: 0.4,
          position: bestBreakPoint,
          reason: `Computed break at ${bestBreakPoint} (page ${pageCount + 1})`,
          elementTag: undefined,
          elementText: content.substring(bestBreakPoint - 50, bestBreakPoint + 50)
        });

        currentPosition = bestBreakPoint;
        pageCount++;
      } else {
        // Force a break if we can't find a good natural one
        currentPosition = idealBreakPoint;
        pageCount++;
      }
    }

    logger.debug(`Computed ${indicators.length} page breaks for ${pageCount + 1} pages`);
    return indicators;
  }

  private findNaturalBreakPoints(content: string): number[] {
    const breakPoints: number[] = [];

    // Paragraph breaks (double newlines)
    const paragraphMatches = content.matchAll(/\n\s*\n/g);
    for (const match of paragraphMatches) {
      if (match.index !== undefined) {
        breakPoints.push(match.index + match[0].length);
      }
    }

    // Sentence endings
    const sentenceMatches = content.matchAll(/[.!?]\s+/g);
    for (const match of sentenceMatches) {
      if (match.index !== undefined) {
        breakPoints.push(match.index + match[0].length);
      }
    }

    // Sort and deduplicate
    return [...new Set(breakPoints)].sort((a, b) => a - b);
  }

  private findBestBreakPoint(
    breakPoints: number[], 
    idealPosition: number, 
    minPosition: number,
    maxPosition: number
  ): number {
    // Find break points within acceptable range
    const candidates = breakPoints.filter(
      bp => bp >= minPosition && bp <= maxPosition
    );

    if (candidates.length === 0) {
      return Math.min(idealPosition, maxPosition);
    }

    // Find the break point closest to the ideal position
    return candidates.reduce((best, current) => {
      const bestDistance = Math.abs(best - idealPosition);
      const currentDistance = Math.abs(current - idealPosition);
      return currentDistance < bestDistance ? current : best;
    });
  }
}
