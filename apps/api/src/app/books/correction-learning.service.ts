import { Injectable, Logger } from '@nestjs/common';
import { TextCorrectionRepository, CreateTextCorrectionData } from './text-correction.repository';
import { TextCorrection } from '@prisma/client';

export interface CorrectionSuggestion {
  originalWord: string;
  suggestedWord: string;
  contextSentence: string;
  occurrenceCount: number;
  fixType?: string;
  lastUsed: Date;
}

export interface LearningStats {
  totalCorrections: number;
  uniqueWords: number;
  recentCorrections: {
    originalWord: string;
    correctedWord: string;
    fixType: string | null;
    createdAt: Date;
  }[];
  topCorrections: {
    originalWord: string;
    correctedWord: string;
    occurrenceCount: number;
    fixType: string | null;
  }[];
}

@Injectable()
export class CorrectionLearningService {
  private readonly logger = new Logger(CorrectionLearningService.name);

  constructor(private textCorrectionRepository: TextCorrectionRepository) {}

  /**
   * Record a single text correction for learning purposes
   */
  async recordCorrection(correctionData: CreateTextCorrectionData): Promise<TextCorrection> {
    this.logger.log(`Recording correction: "${correctionData.originalWord}" → "${correctionData.correctedWord}"`);
    
    try {
      const correction = await this.textCorrectionRepository.create(correctionData);
      this.logger.log(`Successfully recorded correction with ID: ${correction.id}`);
      return correction;
    } catch (error) {
      this.logger.error(`Failed to record correction:`, error);
      throw error;
    }
  }

  /**
   * Get correction suggestions for a given text based on learned patterns
   */
  async getCorrectionSuggestions(
    text: string,
    minOccurrences = 2
  ): Promise<CorrectionSuggestion[]> {
    this.logger.log(`Getting correction suggestions for text with min occurrences: ${minOccurrences}`);

    try {
      const words = this.extractWords(text);
      const suggestions: CorrectionSuggestion[] = [];

      // For each word in the text, check if we have learned corrections
      for (const word of words) {
        // Get all corrections for this word, grouped by correction
        const groupedCorrections = await this.textCorrectionRepository.findGroupedCorrections({
          originalWord: word,
          minOccurrences,
        });

        // Convert to suggestions format
        for (const correction of groupedCorrections) {
          // Get a recent correction for context
          const recentCorrections = await this.textCorrectionRepository.findMany({
            originalWord: correction.originalWord,
            correctedWord: correction.correctedWord,
            limit: 1,
            orderBy: 'desc',
          });
          const recentCorrection = recentCorrections[0];

          if (recentCorrection) {
            suggestions.push({
              originalWord: word, // Use the actual word from text
              suggestedWord: correction.correctedWord,
              contextSentence: recentCorrection.sentenceContext,
              occurrenceCount: correction.occurrenceCount,
              fixType: correction.fixType,
              lastUsed: recentCorrection.updatedAt || new Date(),
            });
          }
        }
      }

      this.logger.log(`Found ${suggestions.length} correction suggestions`);
      return suggestions;
    } catch (error) {
      this.logger.error(`Error getting correction suggestions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<LearningStats> {
    try {
      const stats = await this.textCorrectionRepository.getStats();
      const recentCorrections = await this.textCorrectionRepository.findMany({
        limit: 5,
        orderBy: 'desc',
      });

      const topCorrections = await this.textCorrectionRepository.getTopCorrections({
        take: 10,
      });

      return {
        totalCorrections: stats.totalCorrections,
        uniqueWords: stats.uniqueWords,
        recentCorrections: recentCorrections.map(correction => ({
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          fixType: correction.fixType,
          createdAt: correction.createdAt,
        })),
        topCorrections: topCorrections.map(correction => ({
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          occurrenceCount: correction.occurrenceCount,
          fixType: correction.fixType,
        })),
      };
    } catch (error) {
      this.logger.error(`Error getting learning stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all corrections for a specific word
   */
  async getWordCorrections(originalWord: string): Promise<CorrectionSuggestion[]> {
    try {
      // Get all corrections for this word, grouped by correction
      const corrections = await this.textCorrectionRepository.findGroupedCorrections({
        originalWord,
      });

      const suggestions: CorrectionSuggestion[] = [];

      for (const correction of corrections) {
        const recentCorrections = await this.textCorrectionRepository.findMany({
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          limit: 1,
          orderBy: 'desc',
        });

        const recentCorrection = recentCorrections[0];
        if (recentCorrection) {
          suggestions.push({
            originalWord: originalWord, // Use the input word
            suggestedWord: correction.correctedWord,
            contextSentence: recentCorrection.sentenceContext,
            occurrenceCount: correction.occurrenceCount,
            fixType: correction.fixType,
            lastUsed: recentCorrection.updatedAt || new Date(),
          });
        }
      }

      return suggestions;
    } catch (error) {
      this.logger.error(`Error getting word corrections: ${error.message}`, error.stack);
      throw error;
    }
  }



  private extractWords(text: string): string[] {
    // Extract Hebrew words, handling niqqud and punctuation
    const hebrewWordRegex = /[\u0590-\u05FF]+/g;
    const matches = text.match(hebrewWordRegex) || [];
    
    // Remove duplicates and filter out very short words
    return [...new Set(matches.filter(word => word.length > 1))];
  }
}
