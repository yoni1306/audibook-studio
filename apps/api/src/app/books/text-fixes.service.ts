import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WordChange {
  originalWord: string;
  correctedWord: string;
  position: number;
  fixType?: string;
}

@Injectable()
export class TextFixesService {
  private readonly logger = new Logger(TextFixesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Analyzes differences between original and fixed text to identify word changes
   */
  analyzeTextChanges(originalText: string, correctedText: string): WordChange[] {
    // Split texts into words while preserving position information
    const originalWords = this.tokenizeText(originalText);
    const correctedWords = this.tokenizeText(correctedText);
    
    // Use a simple diff algorithm to find changes
    return this.computeWordDiff(originalWords, correctedWords);
  }

  /**
   * Tokenizes text into words with position tracking
   */
  private tokenizeText(text: string): Array<{ word: string; position: number }> {
    const words: Array<{ word: string; position: number }> = [];
    // Match words by excluding common punctuation marks
    // This approach is more reliable and avoids Unicode range issues
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
   * Simple word-level diff algorithm
   */
  private computeWordDiff(
    original: Array<{ word: string; position: number }>,
    corrected: Array<{ word: string; position: number }>
  ): WordChange[] {
    const changes: WordChange[] = [];
    const maxLength = Math.max(original.length, corrected.length);
    
    for (let i = 0; i < maxLength; i++) {
      const originalWord = original[i]?.word;
      const correctedWord = corrected[i]?.word;
      
      // Word was changed
      if (originalWord && correctedWord && originalWord !== correctedWord) {
        changes.push({
          originalWord,
          correctedWord,
          position: original[i].position,
          fixType: this.classifyChange(originalWord, correctedWord)
        });
      }
    }
    
    return changes;
  }

  /**
   * Attempts to classify the type of change made
   */
  private classifyChange(originalWord: string, correctedWord: string): string {
    // Hebrew niqqud detection - vowel marks (U+05B0-U+05BD, U+05BF, U+05C1-U+05C2, U+05C4-U+05C7)
    const niqqudPattern = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/g;
    
    // Remove niqqud from both words to compare base letters
    const originalWithoutNiqqud = originalWord.replace(niqqudPattern, '');
    const correctedWithoutNiqqud = correctedWord.replace(niqqudPattern, '');
    
    // If base letters are identical, this is a niqqud correction
    if (originalWithoutNiqqud === correctedWithoutNiqqud) {
      const originalNiqqud = originalWord.match(niqqudPattern) || [];
      const correctedNiqqud = correctedWord.match(niqqudPattern) || [];
      
      if (originalNiqqud.length === 0 && correctedNiqqud.length > 0) {
        return 'niqqud_addition'; // Added vowel marks
      } else if (originalNiqqud.length > 0 && correctedNiqqud.length === 0) {
        return 'niqqud_removal'; // Removed vowel marks
      } else if (originalNiqqud.length > 0 && correctedNiqqud.length > 0) {
        return 'niqqud_correction'; // Changed vowel marks
      }
    }
    
    // Hebrew letter corrections (consonants)
    const hebrewLetterPattern = /[\u05D0-\u05EA]/g;
    const originalLetters = originalWord.match(hebrewLetterPattern) || [];
    const correctedLetters = correctedWord.match(hebrewLetterPattern) || [];
    
    // If only Hebrew letters changed (not niqqud)
    if (originalLetters.join('') !== correctedLetters.join('') && 
        originalWithoutNiqqud !== correctedWithoutNiqqud) {
      
      // Check for common Hebrew spelling corrections
      if (originalLetters.length === correctedLetters.length) {
        return 'hebrew_spelling'; // Same number of letters, likely spelling correction
      } else if (Math.abs(originalLetters.length - correctedLetters.length) === 1) {
        return 'hebrew_letter_fix'; // Added or removed one Hebrew letter
      }
    }
    
    // Punctuation and spacing corrections
    const punctuationPattern = /[\u0590-\u05FF\s.,;:!?'"()[\]{}]/g;
    const originalPunctuation = originalWord.match(punctuationPattern) || [];
    const correctedPunctuation = correctedWord.match(punctuationPattern) || [];
    
    if (originalWithoutNiqqud === correctedWithoutNiqqud && 
        originalPunctuation.join('') !== correctedPunctuation.join('')) {
      return 'punctuation'; // Only punctuation changed
    }
    
    // Fallback to original heuristics for non-Hebrew text
    if (originalWord.length === correctedWord.length) {
      return 'character_substitution'; // Same length, character-level change
    }
    
    if (Math.abs(originalWord.length - correctedWord.length) === 1) {
      return 'insertion_deletion'; // Single character insertion/deletion
    }
    
    if (correctedWord.includes(originalWord) || originalWord.includes(correctedWord)) {
      return 'expansion_contraction'; // One word contains the other
    }
    
    return 'substitution'; // Complete word replacement
  }

  /**
   * Extract sentence context around a word in the text
   */
  private extractSentenceContext(text: string, word: string): string {
    if (!text || !word) return '';
    
    // Find the word in the text (case insensitive)
    const wordIndex = text.toLowerCase().indexOf(word.toLowerCase());
    if (wordIndex === -1) return '';
    
    // Find sentence boundaries (periods, exclamation marks, question marks)
    const sentenceEnders = /[.!?]/g;
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
    changes: WordChange[],
    ttsModel?: string,
    ttsVoice?: string
  ): Promise<void> {
    if (changes.length === 0) {
      this.logger.log(`No text changes detected for paragraph ${paragraphId}`);
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

        const textFixes = changes.map(change => ({
          paragraphId,
          bookId: paragraph.bookId,
          originalWord: change.originalWord,
          correctedWord: change.correctedWord,
          sentenceContext: this.extractSentenceContext(originalText, change.originalWord),
          fixType: change.fixType || 'manual',
          ttsModel,
          ttsVoice,
        }));

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