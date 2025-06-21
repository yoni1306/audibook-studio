import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WordChange {
  originalWord: string;
  fixedWord: string;
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
  analyzeTextChanges(originalText: string, fixedText: string): WordChange[] {
    const changes: WordChange[] = [];
    
    // Split texts into words while preserving position information
    const originalWords = this.tokenizeText(originalText);
    const fixedWords = this.tokenizeText(fixedText);
    
    // Use a simple diff algorithm to find changes
    const diffResult = this.computeWordDiff(originalWords, fixedWords);
    
    return diffResult;
  }

  /**
   * Tokenizes text into words with position tracking
   */
  private tokenizeText(text: string): Array<{ word: string; position: number }> {
    const words: Array<{ word: string; position: number }> = [];
    const wordRegex = /\S+/g;
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
    fixed: Array<{ word: string; position: number }>
  ): WordChange[] {
    const changes: WordChange[] = [];
    const maxLength = Math.max(original.length, fixed.length);
    
    for (let i = 0; i < maxLength; i++) {
      const originalWord = original[i]?.word;
      const fixedWord = fixed[i]?.word;
      
      // Word was changed
      if (originalWord && fixedWord && originalWord !== fixedWord) {
        changes.push({
          originalWord,
          fixedWord,
          position: i,
          fixType: this.classifyChange(originalWord, fixedWord)
        });
      }
    }
    
    return changes;
  }

  /**
   * Attempts to classify the type of change made
   */
  private classifyChange(originalWord: string, fixedWord: string): string {
    // Simple heuristics for change classification
    if (originalWord.length === fixedWord.length) {
      return 'pronunciation'; // Same length, likely pronunciation fix
    }
    
    if (Math.abs(originalWord.length - fixedWord.length) === 1) {
      return 'spelling'; // Small change, likely spelling
    }
    
    if (fixedWord.includes(originalWord) || originalWord.includes(fixedWord)) {
      return 'expansion'; // One word contains the other
    }
    
    return 'substitution'; // Complete word replacement
  }

  /**
   * Saves text fixes to the database
   */
  async saveTextFixes(
    paragraphId: string,
    originalText: string,
    fixedText: string,
    changes: WordChange[]
  ): Promise<void> {
    if (changes.length === 0) {
      this.logger.log(`No text changes detected for paragraph ${paragraphId}`);
      return;
    }

    try {
      // Save all changes in a transaction
      await this.prisma.$transaction(async (tx) => {
        const textFixes = changes.map(change => ({
          paragraphId,
          originalText,
          fixedText,
          originalWord: change.originalWord,
          fixedWord: change.fixedWord,
          wordPosition: change.position,
          fixType: change.fixType || null,
        }));

        await tx.textFix.createMany({
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
    return this.prisma.textFix.findMany({
      where: { paragraphId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gets all text fixes for a book
   */
  async getBookFixes(bookId: string) {
    return this.prisma.textFix.findMany({
      where: {
        paragraph: {
          bookId,
        },
      },
      include: {
        paragraph: {
          select: {
            chapterNumber: true,
            orderIndex: true,
          },
        },
      },
      orderBy: [
        { paragraph: { chapterNumber: 'asc' } },
        { paragraph: { orderIndex: 'asc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Gets statistics about text fixes across all books
   */
  async getFixesStatistics() {
    const [totalFixes, fixesByType, mostFixedWords] = await Promise.all([
      // Total number of fixes
      this.prisma.textFix.count(),
      
      // Fixes grouped by type
      this.prisma.textFix.groupBy({
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
      this.prisma.textFix.groupBy({
        by: ['originalWord', 'fixedWord'],
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
      mostFixedWords,
    };
  }

  /**
   * Searches for similar fixes across the database
   * Useful for suggesting automatic fixes
   */
  async findSimilarFixes(originalWord: string, limit = 10) {
    // First get the count of each fix
    const fixCounts = await this.prisma.textFix.groupBy({
      by: ['originalWord', 'fixedWord', 'fixType'],
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
      fixedWord: fix.fixedWord,
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