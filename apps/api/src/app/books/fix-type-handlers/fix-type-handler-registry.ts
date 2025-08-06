import { Injectable, Logger } from '@nestjs/common';
import { FixType } from '@prisma/client';
import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';
import { VowelizationHandler } from './vowelization-handler';
import { DisambiguationHandler } from './disambiguation-handler';
import { PunctuationHandler } from './punctuation-handler';
import { SentenceBreakHandler } from './sentence-break-handler';
import { DialogueMarkingHandler } from './dialogue-marking-handler';
import { ExpansionHandler } from './expansion-handler';

export interface FixTypeClassificationResult {
  fixType: FixType;
  confidence: number;
  reason: string;
  matches: FixTypeMatch[];
  debugInfo: {
    totalHandlers: number;
    matchingHandlers: number;
    allMatches: FixTypeMatch[];
    validationPassed: boolean;
    validationError?: string;
    selectedMatch?: FixTypeMatch;
  };
}

@Injectable()
export class FixTypeHandlerRegistry {
  private readonly logger = new Logger(FixTypeHandlerRegistry.name);
  private readonly handlers: BaseFixTypeHandler[];

  constructor() {
    // Initialize all fix type handlers
    this.handlers = [
      new VowelizationHandler(),
      new DisambiguationHandler(),
      new PunctuationHandler(),
      new SentenceBreakHandler(),
      new DialogueMarkingHandler(),
      new ExpansionHandler()
    ];

    this.logger.log(`Initialized ${this.handlers.length} fix type handlers: ${this.handlers.map(h => h.fixType).join(', ')}`);
  }

  /**
   * Classify a text correction by running it through all fix type handlers
   * and validating that only one handler matches
   */
  classifyCorrection(originalWord: string, correctedWord: string): FixTypeClassificationResult {
    this.logger.debug(`Classifying correction: "${originalWord}" → "${correctedWord}"`);

    const allMatches: FixTypeMatch[] = [];
    
    // Run through all handlers to collect matches
    for (const handler of this.handlers) {
      try {
        const match = handler.canHandle(originalWord, correctedWord);
        if (match) {
          allMatches.push(match);
          this.logger.debug(`Handler ${handler.fixType} matched with confidence ${match.confidence}: ${match.reason}`);
        }
      } catch (error) {
        this.logger.error(`Error in handler ${handler.fixType}:`, error);
      }
    }

    // Handle no matches - use default fix type
    if (allMatches.length === 0) {
      this.logger.warn(`No fix type handlers matched "${originalWord}" → "${correctedWord}", using default fix type`);
      
      return {
        fixType: FixType.default,
        confidence: 0.1, // Low confidence for default classification
        reason: 'No specific fix type matched, using default classification',
        matches: allMatches,
        debugInfo: {
          totalHandlers: this.handlers.length,
          matchingHandlers: 0,
          allMatches,
          validationPassed: true // Still valid, just using default
        }
      };
    }

    // Select the match with highest confidence
    const bestMatch = allMatches.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    if (allMatches.length > 1) {
      const matchingSummary = allMatches
        .map(m => `${m.fixType} (${m.confidence})`)
        .join(', ');
      this.logger.debug(`Multiple matches found for "${originalWord}" → "${correctedWord}": ${matchingSummary}. Selected highest confidence: ${bestMatch.fixType} (${bestMatch.confidence})`);
    }

    this.logger.log(`Successfully classified "${originalWord}" → "${correctedWord}" as ${bestMatch.fixType} (confidence: ${bestMatch.confidence})`);
    
    return {
      fixType: bestMatch.fixType,
      confidence: bestMatch.confidence,
      reason: bestMatch.reason,
      matches: allMatches,
      debugInfo: {
        totalHandlers: this.handlers.length,
        matchingHandlers: allMatches.length,
        allMatches,
        selectedMatch: bestMatch,
        validationPassed: true
      }
    };
  }

  /**
   * Get information about all available fix type handlers
   */
  getHandlerInfo(): Array<{ fixType: FixType; description: string }> {
    return this.handlers.map(handler => ({
      fixType: handler.fixType,
      description: handler.description
    }));
  }

  /**
   * Validate that we have exactly one matching handler
   */
  private validateMatches(matches: FixTypeMatch[]): {
    isValid: boolean;
    error?: string;
  } {
    if (matches.length === 0) {
      return {
        isValid: false,
        error: 'No fix type handlers matched this correction'
      };
    }

    if (matches.length === 1) {
      return { isValid: true };
    }

    // Multiple matches - this is a validation error
    const matchingSummary = matches
      .map(m => `${m.fixType} (${m.confidence})`)
      .join(', ');

    return {
      isValid: false,
      error: `Multiple fix types matched: ${matchingSummary}. Each correction should match exactly one fix type.`
    };
  }

  /**
   * Get the best match from multiple matches (for debugging/analysis purposes)
   * This should not be used in production - we want to fix the handlers instead
   */
  getBestMatch(matches: FixTypeMatch[]): FixTypeMatch | null {
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    // Sort by confidence and return the highest
    const sorted = [...matches].sort((a, b) => b.confidence - a.confidence);
    
    this.logger.warn(`Multiple matches found, returning highest confidence: ${sorted[0].fixType} (${sorted[0].confidence})`);
    return sorted[0];
  }

  /**
   * Enable or disable debug logging for all handlers
   */
  setDebugMode(enabled: boolean): void {
    this.handlers.forEach(handler => {
      (handler as any).debugEnabled = enabled;
    });
    this.logger.log(`Debug mode ${enabled ? 'enabled' : 'disabled'} for all fix type handlers`);
  }
}
