import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { PageBreakIndicator, PageBreakOptions } from './types';
import { ExplicitPageBreakDetector } from './explicit-detector';
import { StructuralPageBreakDetector } from './structural-detector';
import { StylisticPageBreakDetector } from './stylistic-detector';
import { SemanticPageBreakDetector } from './semantic-detector';

const logger = createLogger('EPUBPageBreakDetector');

/**
 * Main page break detector that coordinates all detection strategies
 * Combines multiple approaches for comprehensive page break detection
 */
export class EPUBPageBreakDetector {
  private readonly defaultOptions: Required<PageBreakOptions> = {
    includeExplicit: true,
    includeStructural: true,
    includeStylistic: true,
    includeSemantic: true,
    minConfidence: 0.6,
  };

  private readonly explicitDetector = new ExplicitPageBreakDetector();
  private readonly structuralDetector = new StructuralPageBreakDetector();
  private readonly stylisticDetector = new StylisticPageBreakDetector();
  private readonly semanticDetector = new SemanticPageBreakDetector();

  constructor(private options: PageBreakOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    logger.debug('EPUBPageBreakDetector initialized with options:', this.options);
  }

  /**
   * Main detection method combining all approaches
   */
  detectAllPageBreaks(
    content: string,
    $: cheerio.CheerioAPI,
    options: PageBreakOptions = {}
  ): PageBreakIndicator[] {
    const mergedOptions = { ...this.options, ...options };
    const indicators: PageBreakIndicator[] = [];

    logger.debug(`🔍 Starting page break detection`, {
      contentLength: content.length,
      detectionTypes: {
        explicit: mergedOptions.includeExplicit,
        structural: mergedOptions.includeStructural,
        stylistic: mergedOptions.includeStylistic,
        semantic: mergedOptions.includeSemantic,
      }
    });

    // Explicit page breaks (highest priority)
    if (mergedOptions.includeExplicit) {
      const explicit = this.explicitDetector.detect(content, $);
      indicators.push(...explicit);
      logger.debug(`Found ${explicit.length} explicit page breaks`);
    }

    // Structural page breaks
    if (mergedOptions.includeStructural) {
      const structural = this.structuralDetector.detect($);
      indicators.push(...structural);
      logger.debug(`Found ${structural.length} structural page breaks`);
    }

    // Stylistic page breaks
    if (mergedOptions.includeStylistic) {
      const stylistic = this.stylisticDetector.detect($);
      indicators.push(...stylistic);
      logger.debug(`Found ${stylistic.length} stylistic page breaks`);
    }

    // Semantic page breaks (based on content meaning)
    if (mergedOptions.includeSemantic) {
      const semantic = this.semanticDetector.detect($);
      indicators.push(...semantic);
      logger.debug(`Found ${semantic.length} semantic page breaks`);
    }

    // Filter by confidence and sort by position
    const filteredIndicators = indicators
      .filter(indicator => indicator.confidence >= mergedOptions.minConfidence)
      .sort((a, b) => a.position - b.position);

    logger.debug(`Filtered ${indicators.length} indicators to ${filteredIndicators.length} by confidence >= ${mergedOptions.minConfidence}`);

    // Remove nearby duplicates (within 50 positions)
    const deduped = this.removeDuplicates(filteredIndicators);

    const result = deduped.sort((a, b) => a.position - b.position);
    
    logger.info('Page break detection completed', {
      totalFound: indicators.length,
      afterFiltering: filteredIndicators.length,
      afterDeduplication: result.length,
      finalBreaks: result.map(r => ({ position: r.position, type: r.type, confidence: r.confidence }))
    });

    return result;
  }

  /**
   * Remove duplicate indicators that are too close to each other
   */
  private removeDuplicates(indicators: PageBreakIndicator[]): PageBreakIndicator[] {
    const deduped: PageBreakIndicator[] = [];
    const proximityThreshold = 50;

    indicators.forEach(indicator => {
      const tooClose = deduped.some(existing => 
        Math.abs(existing.position - indicator.position) < proximityThreshold
      );
      
      if (!tooClose) {
        deduped.push(indicator);
        logger.debug(`Added indicator at position ${indicator.position} (${indicator.type}, confidence: ${indicator.confidence})`);
      } else {
        logger.debug(`Skipped duplicate indicator at position ${indicator.position} (too close to existing)`);
      }
    });

    return deduped;
  }

  /**
   * Get detection statistics for debugging
   */
  getDetectionStats(content: string, $: cheerio.CheerioAPI): Record<string, number> {
    const stats = {
      explicit: this.explicitDetector.detect(content, $).length,
      structural: this.structuralDetector.detect($).length,
      stylistic: this.stylisticDetector.detect($).length,
      semantic: this.semanticDetector.detect($).length,
    };

    logger.debug('Detection statistics:', stats);
    return stats;
  }
}
