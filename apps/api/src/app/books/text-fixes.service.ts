import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FixType } from '@prisma/client';
import { FixTypeHandlerRegistry } from './fix-type-handlers/fix-type-handler-registry';
import * as diff from 'diff';

export interface WordChange {
  originalWord: string;
  correctedWord: string;
  position: number;
  fixType: FixType;
}

@Injectable()
export class TextFixesService {
  private readonly logger = new Logger(TextFixesService.name);

  constructor(
    private prisma: PrismaService,
    private fixTypeRegistry: FixTypeHandlerRegistry
  ) {}

  /**
   * Analyzes differences between original and fixed text to identify word changes
   * Uses Myers diff algorithm for robust text comparison
   */
  analyzeTextChanges(originalText: string, correctedText: string): WordChange[] {
    return this.computeRobustWordDiff(originalText, correctedText);
  }

  /**
   * Tokenizes text into words with position tracking
   */
  private tokenizeText(text: string): Array<{ word: string; position: number }> {
    const words: Array<{ word: string; position: number }> = [];
    const wordRegex = /[^\s.,;:!?()[\]{}""''`~@#$%^&*+=|\\/<>]+/g;
    let match;
    let position = 0;

    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0],
        position: position++
      });
    }

    return words;
  }

  /**
   * Robust word-level diff algorithm using Myers algorithm
   * Handles insertions, deletions, and modifications correctly
   */
  private computeRobustWordDiff(originalText: string, correctedText: string): WordChange[] {
    const changes: WordChange[] = [];
    
    if (!originalText || !correctedText || typeof originalText !== 'string' || typeof correctedText !== 'string') {
      return changes;
    }
    
    const originalWords = this.extractWords(originalText);
    const correctedWords = this.extractWords(correctedText);
    const wordDiffs = diff.diffArrays(originalWords, correctedWords);
    
    let wordPosition = 0;
    let i = 0;
    
    while (i < wordDiffs.length) {
      const part = wordDiffs[i];
      
      if (!part.added && !part.removed) {
        const wordCount = part.count || 0;
        wordPosition += wordCount;
        i++;
        
      } else if (part.removed) {
        const nextPart = wordDiffs[i + 1];
        
        if (nextPart && nextPart.added) {
          const originalWordsInPart = part.value || [];
          const correctedWordsInPart = nextPart.value || [];
          
          if (originalWordsInPart.length === 1 && correctedWordsInPart.length > 1) {
            // Word split case: one word becomes multiple words
            const originalWord = originalWordsInPart[0];
            const fullCorrectedPhrase = correctedWordsInPart.join(' ');
            
            try {
              const classification = this.fixTypeRegistry.classifyCorrection(originalWord, fullCorrectedPhrase);
              
              changes.push({
                originalWord,
                correctedWord: fullCorrectedPhrase,
                position: wordPosition,
                fixType: classification.fixType
              });
            } catch (error) {
              this.logger.warn(`Failed to classify word split: ${originalWord} → ${fullCorrectedPhrase}`, error);
            }
            
          } else if (originalWordsInPart.length > 1 && correctedWordsInPart.length === 1) {
            // Word merge case: multiple words become one word
            const fullOriginalPhrase = originalWordsInPart.join(' ');
            const correctedWord = correctedWordsInPart[0];
            
            try {
              const classification = this.fixTypeRegistry.classifyCorrection(fullOriginalPhrase, correctedWord);
              
              changes.push({
                originalWord: fullOriginalPhrase,
                correctedWord,
                position: wordPosition,
                fixType: classification.fixType
              });
            } catch (error) {
              this.logger.warn(`Failed to classify word merge: ${fullOriginalPhrase} → ${correctedWord}`, error);
            }
            
          } else {
            // Handle word substitutions
            const minLength = Math.min(originalWordsInPart.length, correctedWordsInPart.length);
            
            for (let j = 0; j < minLength; j++) {
              const originalWord = originalWordsInPart[j];
              const correctedWord = correctedWordsInPart[j];
              
              if (originalWord && correctedWord && originalWord !== correctedWord) {
                try {
                  const classification = this.fixTypeRegistry.classifyCorrection(originalWord, correctedWord);
                  
                  changes.push({
                    originalWord,
                    correctedWord,
                    position: wordPosition + j,
                    fixType: classification.fixType
                  });
                } catch (error) {
                  this.logger.warn(`Failed to classify correction: ${originalWord} → ${correctedWord}`, error);
                }
              }
            }
          }
          
          wordPosition += Math.max(originalWordsInPart.length, correctedWordsInPart.length);
          i += 2;
          
        } else {
          const removedWords = part.value || [];
          wordPosition += removedWords.length;
          i++;
        }
        
      } else if (part.added) {
        i++;
        
      } else {
        i++;
      }
    }
    
    return changes;
  }
  
  /**
   * Extract words from text, filtering out empty strings and whitespace
   */
  private extractWords(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const wordRegex = /[^\s.,;:!?()[\]{}""''`~@#$%^&*+=|\\/<>]+/g;
    const matches = text.match(wordRegex);
    if (!matches) {
      return [];
    }
    
    return matches.filter(word => word.trim().length > 0);
  }





  /**
   * Extract sentence context around a word in the text
   */
  private extractSentenceContext(text: string, word: string): string {
    if (!text || !word) return '';
    
    // Find the word in the text (case insensitive)
    const wordIndex = text.toLowerCase().indexOf(word.toLowerCase());
    if (wordIndex === -1) return '';
    
    // Find sentence boundaries
    const sentenceEnders = /[.!?;]/g;
    let start = 0;
    let end = text.length;
    
    // Find the start of the sentence (look backwards from word position)
    for (let i = wordIndex - 1; i >= 0; i--) {
      if (sentenceEnders.test(text[i])) {
        start = i + 1;
        break;
      }
    }
    
    // Find the end of the sentence (look forwards from word position)
    sentenceEnders.lastIndex = 0; // Reset regex
    for (let i = wordIndex; i < text.length; i++) {
      if (sentenceEnders.test(text[i])) {
        end = i + 1;
        break;
      }
    }
    
    // Extract and clean the sentence
    const sentence = text.substring(start, end).trim();
    return sentence || text.substring(Math.max(0, wordIndex - 50), Math.min(text.length, wordIndex + 50)).trim();
  }

  /**
   * Saves text fixes to the database
   */
  async saveTextFixes(
    paragraphId: string,
    originalText: string,
    correctedText: string,
    changes: WordChange[]
  ): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    try {
      // Save all changes in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Get the paragraph to find the bookId
        const paragraph = await tx.paragraph.findUnique({
          where: { id: paragraphId },
          select: { bookId: true },
        });

        if (!paragraph) {
          throw new Error(`Paragraph ${paragraphId} not found`);
        }

        // Get the book's TTS model information
        const book = await tx.book.findUnique({
          where: { id: paragraph.bookId },
          select: {
            ttsModel: true,
            ttsVoice: true
          }
        });

        const textFixes = changes.map(change => {
          // Always use automatic classification for fix type
          const classification = this.fixTypeRegistry.classifyCorrection(change.originalWord, change.correctedWord);
          const fixType = classification?.fixType as FixType || FixType.disambiguation;
          
          // Generate aggregation key using pipe format
          const aggregationKey = `${change.originalWord}|${change.correctedWord}`;
          
          return {
            paragraphId,
            bookId: paragraph.bookId,
            originalWord: change.originalWord,
            correctedWord: change.correctedWord,
            aggregationKey,
            sentenceContext: this.extractSentenceContext(originalText, change.originalWord),
            fixType,
            ttsModel: book?.ttsModel || null,
            ttsVoice: book?.ttsVoice || null,
          };
        });

        await tx.textCorrection.createMany({
          data: textFixes,
        });
      });

      this.logger.log(
        `Saved ${changes.length} text fixes for paragraph ${paragraphId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to save text fixes for paragraph ${paragraphId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets all text fixes for a specific paragraph
   */
  async getParagraphFixes(paragraphId: string) {
    return this.prisma.textCorrection.findMany({
      where: { paragraphId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gets all text fixes for a book
   */
  async getBookFixes(bookId: string) {
    return this.prisma.textCorrection.findMany({
      where: {
        paragraph: {
          bookId,
        },
      },
      include: {
        paragraph: {
          select: {
            orderIndex: true,
            page: {
              select: {
                pageNumber: true,
              },
            },
          },
        },
      },
      orderBy: [
        { paragraph: { page: { pageNumber: 'asc' } } },
        { paragraph: { orderIndex: 'asc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Gets statistics about text fixes across all books
   */
  async getFixesStatistics() {
    const [totalFixes, fixesByType, mostCorrectedWords] = await Promise.all([
      // Total number of fixes
      this.prisma.textCorrection.count(),
      
      // Fixes grouped by type
      this.prisma.textCorrection.groupBy({
        by: ['fixType'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      }),
      
      // Most frequently fixed words
      this.prisma.textCorrection.groupBy({
        by: ['originalWord', 'correctedWord'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 50,
      }),
    ]);

    return {
      totalFixes,
      fixesByType,
      mostCorrectedWords,
    };
  }

  /**
   * Searches for similar fixes across the database
   * Useful for suggesting automatic fixes
   */
  async findSimilarFixes(originalWord: string, limit = 10) {
    // First get the count of each fix
    const fixCounts = await this.prisma.textCorrection.groupBy({
      by: ['originalWord', 'correctedWord', 'fixType'],
      where: {
        originalWord: {
          contains: originalWord,
          mode: 'insensitive',
        },
      },
      _count: {
        id: true,
      },
      orderBy: [
        { _count: { id: 'desc' } },
        { originalWord: 'asc' },
      ],
      take: limit,
    });

    // Transform the results to the expected format
    return fixCounts.map(fix => ({
      originalWord: fix.originalWord,
      correctedWord: fix.correctedWord,
      fixType: fix.fixType,
      count: fix._count.id,
    }));
  }

  /**
   * Processes a paragraph update and tracks changes
   */
  async processParagraphUpdate(
    paragraphId: string,
    originalContent: string,
    newContent: string
  ): Promise<WordChange[]> {
    // Analyze changes
    const changes = this.analyzeTextChanges(originalContent, newContent);
    
    // Save changes to database if any exist
    if (changes.length > 0) {
      await this.saveTextFixes(paragraphId, originalContent, newContent, changes);
    }
    
    return changes;
  }
}