import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextFixesService, WordChange } from './text-fixes.service';

export interface BulkFixSuggestion {
  originalWord: string;
  fixedWord: string;
  paragraphs: Array<{
    id: string;
    chapterNumber: number;
    orderIndex: number;
    content: string;
    occurrences: number;
    previewBefore: string;
    previewAfter: string;
  }>;
}

export interface BulkFixResult {
  totalParagraphsUpdated: number;
  totalWordsFixed: number;
  updatedParagraphs: Array<{
    paragraphId: string;
    chapterNumber: number;
    orderIndex: number;
    wordsFixed: number;
  }>;
}

@Injectable()
export class BulkTextFixesService {
  private readonly logger = new Logger(BulkTextFixesService.name);

  constructor(
    private prisma: PrismaService,
    private textFixesService: TextFixesService
  ) {}

  /**
   * Finds paragraphs in the same book that contain the same words that were just fixed
   */
  async findSimilarFixesInBook(
    bookId: string,
    excludeParagraphId: string,
    wordChanges: WordChange[]
  ): Promise<BulkFixSuggestion[]> {
    this.logger.debug(`findSimilarFixesInBook called for book ${bookId}, excluding paragraph ${excludeParagraphId}`);
    this.logger.debug(`Word changes to look for: ${JSON.stringify(wordChanges)}`);
    
    if (wordChanges.length === 0) {
      this.logger.debug(`No word changes provided, returning empty array`);
      return [];
    }

    const suggestions: BulkFixSuggestion[] = [];

    // Get all paragraphs in the book except the one just edited
    const bookParagraphs = await this.prisma.paragraph.findMany({
      where: {
        bookId,
        id: { not: excludeParagraphId },
      },
      orderBy: [
        { chapterNumber: 'asc' },
        { orderIndex: 'asc' },
      ],
    });
    
    this.logger.debug(`Found ${bookParagraphs.length} paragraphs to check for similar fixes`);

    // For each word change, find paragraphs that contain the original word
    for (const change of wordChanges) {
      this.logger.debug(`Looking for paragraphs containing word: '${change.originalWord}'`);
      const matchingParagraphs = [];

      for (const paragraph of bookParagraphs) {
        // For Hebrew text, we need a special approach for word boundaries
        // since \b doesn't work correctly with Hebrew characters
        const matches = this.findHebrewWordMatches(paragraph.content, change.originalWord);
        
        if (matches && matches.length > 0) {
          // Create preview of the change
          // Use the same Hebrew-aware approach for replacement
          let previewAfter = paragraph.content;
          
          // Create a pattern that matches the word with proper boundaries
          const escapedWord = this.escapeRegExp(change.originalWord);
          const pattern = `(^|\\s|[\\p{P}])(${escapedWord})($|\\s|[\\p{P}])`;
          
          try {
            // Replace all occurrences while preserving the surrounding characters
            const regex = new RegExp(pattern, 'gu');
            previewAfter = previewAfter.replace(regex, (match, before, word, after) => {
              return `${before}${change.fixedWord}${after}`;
            });
          } catch (error) {
            // Fallback to standard regex replacement if Unicode regex fails
            this.logger.error(`Error using Unicode regex for Hebrew word replacement: ${error}`);
            previewAfter = paragraph.content.replace(
              new RegExp(`\\b${this.escapeRegExp(change.originalWord)}\\b`, 'gi'),
              change.fixedWord
            );
          }

          matchingParagraphs.push({
            id: paragraph.id,
            chapterNumber: paragraph.chapterNumber,
            orderIndex: paragraph.orderIndex,
            content: paragraph.content,
            occurrences: matches.length,
            previewBefore: this.createPreview(paragraph.content, change.originalWord),
            previewAfter: this.createPreview(previewAfter, change.fixedWord),
          });
        }
      }

      if (matchingParagraphs.length > 0) {
        this.logger.debug(`Found ${matchingParagraphs.length} paragraphs containing '${change.originalWord}'`);
        suggestions.push({
          originalWord: change.originalWord,
          fixedWord: change.fixedWord,
          paragraphs: matchingParagraphs,
        });
      } else {
        this.logger.debug(`No paragraphs found containing '${change.originalWord}'`);
      }
    }

    return suggestions;
  }

  /**
   * Applies bulk fixes to selected paragraphs
   */
  async applyBulkFixes(
    bookId: string,
    fixes: Array<{
      originalWord: string;
      fixedWord: string;
      paragraphIds: string[];
    }>
  ): Promise<BulkFixResult> {
    const result: BulkFixResult = {
      totalParagraphsUpdated: 0,
      totalWordsFixed: 0,
      updatedParagraphs: [],
    };

    this.logger.log(`Applying bulk fixes to ${fixes.length} word changes in book ${bookId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        const processedParagraphs = new Set<string>();

        for (const fix of fixes) {
          for (const paragraphId of fix.paragraphIds) {
            if (processedParagraphs.has(paragraphId)) continue;

            // Get current paragraph content
            const paragraph = await tx.paragraph.findUnique({
              where: { id: paragraphId },
            });

            if (!paragraph) {
              this.logger.warn(`Paragraph ${paragraphId} not found, skipping`);
              continue;
            }

            // Apply the fix
            const wordRegex = new RegExp(`\\b${this.escapeRegExp(fix.originalWord)}\\b`, 'g');
            const originalContent = paragraph.content;
            const newContent = originalContent.replace(wordRegex, fix.fixedWord);
            
            // Count how many words were actually replaced
            const originalMatches = originalContent.match(wordRegex) || [];
            const wordsFixed = originalMatches.length;

            if (wordsFixed > 0) {
              // Update paragraph content (but keep existing audio status and S3 key)
              await tx.paragraph.update({
                where: { id: paragraphId },
                data: {
                  content: newContent,
                  // NOTE: We don't reset audioStatus or audioS3Key for bulk fixes
                  // The existing audio remains valid since these are just text corrections
                },
              });

              // Track the text changes
              const changes = this.textFixesService.analyzeTextChanges(originalContent, newContent);
              
              // Save text fixes
              for (const change of changes) {
                await tx.textFix.create({
                  data: {
                    paragraphId,
                    originalText: originalContent,
                    fixedText: newContent,
                    originalWord: change.originalWord,
                    fixedWord: change.fixedWord,
                    wordPosition: change.position,
                    fixType: change.fixType || null,
                  },
                });
              }

              result.updatedParagraphs.push({
                paragraphId,
                chapterNumber: paragraph.chapterNumber,
                orderIndex: paragraph.orderIndex,
                wordsFixed,
              });

              result.totalWordsFixed += wordsFixed;
              processedParagraphs.add(paragraphId);
            }
          }
        }

        result.totalParagraphsUpdated = processedParagraphs.size;
      });

      // NOTE: We don't queue audio generation for bulk-applied paragraphs
      // Audio will only be generated for the original paragraph that was manually edited

      this.logger.log(
        `Bulk fix completed: ${result.totalParagraphsUpdated} paragraphs updated, ${result.totalWordsFixed} words fixed`
      );

    } catch (error) {
      this.logger.error('Error applying bulk fixes:', error);
      throw error;
    }

    this.logger.log(
      `Bulk fix completed: ${result.totalParagraphsUpdated} paragraphs updated, ${result.totalWordsFixed} words fixed`
    );
    
    return result;
  }

/**
 * Creates a preview snippet showing the word in context
 * @param content The paragraph content
 * @param word The word to highlight
 * @param contextLength The length of context to include (used as fallback)
 * @returns A preview with the complete sentences containing the word
 */
private createPreview(content: string, word: string, contextLength = 50): string {
  // For Hebrew words, we need to use our special matching function
  const matches = this.findHebrewWordMatches(content, word);
  
  if (!matches || matches.length === 0) {
    // Fallback to the original behavior
    return content.substring(0, contextLength) + '...';
  }

  // Find all sentences containing the matched word
  // Split content by sentence endings (., !, ?)
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentences = [];
  let sentenceMatch;
  
  while ((sentenceMatch = sentenceRegex.exec(content)) !== null) {
    const sentence = sentenceMatch[0];
    // Check if this sentence contains our word
    const wordInSentence = this.findHebrewWordMatches(sentence, word);
    if (wordInSentence && wordInSentence.length > 0) {
      sentences.push(sentence.trim());
    }
  }
  
  // If no complete sentences found, fall back to the original behavior
  if (sentences.length === 0) {
    const index = content.indexOf(matches[0]);
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + matches[0].length + contextLength);
    
    let preview = content.substring(start, end);
    
    if (start > 0) preview = '...' + preview;
    if (end < content.length) preview = preview + '...';
    
    return preview;
  }
  
  // Join the sentences with a space
  return sentences.join(' ');
}

/**
 * Escapes special regex characters
 */
private escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

  /**
   * Finds matches of a Hebrew word in text, properly handling word boundaries
   * This is needed because JavaScript's \b doesn't work correctly with Hebrew characters
   * @param text The text to search in
   * @param word The Hebrew word to find
   * @returns An array of matches (similar to String.match() result)
   */
  private findHebrewWordMatches(text: string, word: string): RegExpMatchArray | null {
    // Escape the word for regex safety
    const escapedWord = this.escapeRegExp(word);
    
    // Create a pattern that matches the word when surrounded by spaces, punctuation, or at start/end of text
    // This is a more reliable approach for Hebrew text than using \b
    const pattern = `(^|\\s|[\\p{P}])(${escapedWord})($|\\s|[\\p{P}])`;
    
    try {
      // Use Unicode flag 'u' to properly handle Unicode characters
      const regex = new RegExp(pattern, 'gu');
      const matches = [];
      let match;
      
      // Find all matches and extract just the word part (capture group 2)
      while ((match = regex.exec(text)) !== null) {
        matches.push(match[2]);
      }
      
      return matches.length > 0 ? matches as RegExpMatchArray : null;
    } catch (error) {
      // Fallback to standard word boundary if the Unicode regex fails
      // This might happen in older browsers that don't support Unicode property escapes
      this.logger.error(`Error using Unicode regex for Hebrew word matching: ${error}`);
      this.logger.debug('Falling back to standard word boundary regex');
      
      // Fallback approach using standard word boundaries
      const fallbackRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
      return text.match(fallbackRegex);
    }
  }

  /**
   * Gets suggested fixes based on historical data
   */
  async getSuggestedFixes(bookId: string, content: string): Promise<Array<{
    originalWord: string;
    suggestedWord: string;
    confidence: number;
    occurrences: number;
  }>> {
    // Tokenize the content to get individual words
    const words = content.match(/\b\w+\b/g) || [];
    const suggestions = [];

    // For each word, check if there are historical fixes
    for (const word of words) {
      const historicalFixes = await this.prisma.textFix.groupBy({
        by: ['originalWord', 'fixedWord'],
        where: {
          originalWord: {
            equals: word,
            mode: 'insensitive',
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 1,
      });

      if (historicalFixes.length > 0) {
        const fix = historicalFixes[0];
        const confidence = Math.min(fix._count.id / 10, 1); // Simple confidence calculation

        suggestions.push({
          originalWord: word,
          suggestedWord: fix.fixedWord,
          confidence,
          occurrences: fix._count.id,
        });
      }
    }

    return suggestions;
  }
}