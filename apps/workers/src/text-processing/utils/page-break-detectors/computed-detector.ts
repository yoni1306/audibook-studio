import { createLogger } from '@audibook/logger';
import { PageBreakIndicator } from './types';

const logger = createLogger('ComputedPageBreakDetector');

/**
 * Detects computed page breaks based on content length and target page sizes
 * These are calculated breaks when no natural breaks are found
 */
export class ComputedPageBreakDetector {
  /**
   * Compute page breaks based on content length and target sizes
   * Currently returns empty array since we're not using computed breaks
   */
  detect(content: string): PageBreakIndicator[] {
    logger.debug(`Computed page break detection disabled for ${content.length} characters`);
    return [];
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
