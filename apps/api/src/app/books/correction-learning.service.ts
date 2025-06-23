import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

  constructor(private prisma: PrismaService) {}

  /**
   * Record a text correction for learning purposes
   */
  async recordCorrection(data: {
    originalWord: string;
    correctedWord: string;
    contextSentence: string;
    paragraphId: string;
    fixType?: string;
  }): Promise<TextCorrection> {
    this.logger.log(`Recording correction: ${data.originalWord} → ${data.correctedWord}`);

    try {
      const correction = await this.prisma.textCorrection.create({
        data: {
          paragraphId: data.paragraphId,
          originalWord: data.originalWord,
          correctedWord: data.correctedWord,
          sentenceContext: data.contextSentence,
          fixType: data.fixType,
        },
      });

      this.logger.log(`Recorded correction with ID: ${correction.id}`);
      return correction;
    } catch (error) {
      this.logger.error(`Error recording correction: ${error.message}`, error.stack);
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
        const corrections = await this.prisma.textCorrection.groupBy({
          by: ['originalWord', 'correctedWord', 'fixType'],
          where: {
            originalWord: word,
          },
          _count: {
            id: true,
          },
          _max: {
            createdAt: true,
          },
          having: {
            id: {
              _count: {
                gte: minOccurrences,
              },
            },
          },
          orderBy: {
            _count: {
              id: 'desc',
            },
          },
        });

        // Convert to suggestions format
        for (const correction of corrections) {
          // Get a recent example for context
          const recentCorrection = await this.prisma.textCorrection.findFirst({
            where: {
              originalWord: correction.originalWord,
              correctedWord: correction.correctedWord,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          if (recentCorrection) {
            suggestions.push({
              originalWord: word, // Use the actual word from text
              suggestedWord: correction.correctedWord,
              contextSentence: recentCorrection.sentenceContext,
              occurrenceCount: correction._count.id,
              fixType: correction.fixType,
              lastUsed: correction._max.createdAt || new Date(),
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
      const [totalCorrections, uniqueWords, recentCorrections] = await Promise.all([
        this.prisma.textCorrection.count(),
        this.prisma.textCorrection.groupBy({
          by: ['originalWord'],
        }).then(groups => groups.length),
        this.prisma.textCorrection.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            originalWord: true,
            correctedWord: true,
            fixType: true,
            createdAt: true,
          },
        }),
      ]);

      const topCorrections = await this.prisma.textCorrection.groupBy({
        by: ['originalWord', 'correctedWord', 'fixType'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      return {
        totalCorrections,
        uniqueWords,
        recentCorrections,
        topCorrections: topCorrections.map(correction => ({
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          occurrenceCount: correction._count.id,
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
      const corrections = await this.prisma.textCorrection.groupBy({
        by: ['originalWord', 'correctedWord', 'fixType'],
        where: {
          originalWord,
        },
        _count: {
          id: true,
        },
        _max: {
          createdAt: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      const suggestions: CorrectionSuggestion[] = [];

      for (const correction of corrections) {
        const recentCorrection = await this.prisma.textCorrection.findFirst({
          where: {
            originalWord: correction.originalWord,
            correctedWord: correction.correctedWord,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (recentCorrection) {
          suggestions.push({
            originalWord: originalWord, // Use the input word
            suggestedWord: correction.correctedWord,
            contextSentence: recentCorrection.sentenceContext,
            occurrenceCount: correction._count.id,
            fixType: correction.fixType,
            lastUsed: correction._max.createdAt || new Date(),
          });
        }
      }

      return suggestions;
    } catch (error) {
      this.logger.error(`Error getting word corrections: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all corrections with filtering and pagination
   */
  async getAllCorrections(filters: {
    originalWord?: string;
    correctedWord?: string;
    fixType?: string;
    bookId?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'originalWord' | 'correctedWord';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    corrections: (TextCorrection & {
      paragraph: {
        id: string;
        orderIndex: number;
        chapterNumber: number;
        book: {
          id: string;
          title: string;
        };
      };
    })[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const {
        originalWord,
        correctedWord,
        fixType,
        bookId,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      // Build where clause
      const where: {
        originalWord?: { contains: string; mode: 'insensitive' };
        correctedWord?: { contains: string; mode: 'insensitive' };
        fixType?: string;
        paragraph?: { bookId: string };
      } = {};
      
      if (originalWord) {
        where.originalWord = {
          contains: originalWord,
          mode: 'insensitive',
        };
      }
      
      if (correctedWord) {
        where.correctedWord = {
          contains: correctedWord,
          mode: 'insensitive',
        };
      }
      
      if (fixType) {
        where.fixType = fixType;
      }
      
      if (bookId) {
        where.paragraph = {
          bookId: bookId,
        };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await this.prisma.textCorrection.count({ where });

      // Get corrections with related data
      const corrections = await this.prisma.textCorrection.findMany({
        where,
        include: {
          paragraph: {
            select: {
              id: true,
              orderIndex: true,
              chapterNumber: true,
              book: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      this.logger.log(`Found ${corrections.length} corrections (page ${page}/${totalPages}, total: ${total})`);

      return {
        corrections,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Error getting all corrections: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get unique fix types for filtering
   */
  async getFixTypes(): Promise<string[]> {
    this.logger.log('🔧 [SERVICE] Getting fix types - START');
    
    try {
      this.logger.log('📊 [SERVICE] Querying database for fix types...');
      
      const fixTypes = await this.prisma.textCorrection.findMany({
        where: {
          fixType: {
            not: null,
          },
        },
        select: {
          fixType: true,
        },
        distinct: ['fixType'],
      });

      this.logger.log(`📊 [SERVICE] Raw query result: ${JSON.stringify(fixTypes)}`);

      const result = fixTypes
        .map(item => item.fixType)
        .filter(Boolean) as string[];
        
      this.logger.log(`🎯 [SERVICE] Processed fix types: ${JSON.stringify(result)}`);
      
      return result;
    } catch (error) {
      this.logger.error(`💥 [SERVICE] Error getting fix types: ${error.message}`, error.stack);
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
