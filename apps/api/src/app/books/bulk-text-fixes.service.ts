import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextFixesService, WordChange } from './text-fixes.service';

export interface BulkFixSuggestion {
  originalWord: string;
  correctedWord: string;
  paragraphs: Array<{
    id: string;
    pageId: string;
    pageNumber: number;
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
    pageId: string;
    pageNumber: number;
    orderIndex: number;
    wordsFixed: number;
    changes: WordChange[];
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

    // Get all paragraphs in the book except the one just edited
    const bookParagraphs = await this.fetchBookParagraphs(bookId, excludeParagraphId);
    this.logger.debug(`Found ${bookParagraphs.length} paragraphs to check for similar fixes`);

    // Process each word change to find similar fixes
    const suggestions = await this.processBulkFixSuggestions(wordChanges, bookParagraphs);

    return suggestions;
  }

  /**
   * Fetches all paragraphs in a book except the excluded one
   */
  private async fetchBookParagraphs(bookId: string, excludeParagraphId: string) {
    return this.prisma.paragraph.findMany({
      where: {
        bookId,
        id: { not: excludeParagraphId },
      },
      include: {
        page: {
          select: {
            pageNumber: true,
          },
        },
      },
      orderBy: [
        { page: { pageNumber: 'asc' } },
        { orderIndex: 'asc' },
      ],
    });
  }

  /**
   * Processes word changes to find bulk fix suggestions
   */
  private async processBulkFixSuggestions(
    wordChanges: WordChange[], 
    bookParagraphs: Array<{ 
      id: string; 
      pageId: string; 
      orderIndex: number; 
      content: string; 
      page: { pageNumber: number }
    }>
  ): Promise<BulkFixSuggestion[]> {
    const suggestions: BulkFixSuggestion[] = [];

    for (const change of wordChanges) {
      this.logger.debug(`Looking for paragraphs containing word: '${change.originalWord}'`);
      const matchingParagraphs = this.findMatchingParagraphs(change, bookParagraphs);

      if (matchingParagraphs.length > 0) {
        this.logger.debug(`Found ${matchingParagraphs.length} paragraphs containing '${change.originalWord}'`);
        suggestions.push({
          originalWord: change.originalWord,
          correctedWord: change.correctedWord,
          paragraphs: matchingParagraphs,
        });
      } else {
        this.logger.debug(`No paragraphs found containing '${change.originalWord}'`);
      }
    }

    return suggestions;
  }

  /**
   * Finds paragraphs that contain the original word and creates preview content
   */
  private findMatchingParagraphs(
    change: WordChange,
    bookParagraphs: Array<{ id: string; pageId: string; orderIndex: number; content: string; page: { pageNumber: number } }>
  ) {
    const matchingParagraphs = [];

    for (const paragraph of bookParagraphs) {
      // For Hebrew text, we need a special approach for word boundaries
      const matches = this.findHebrewWordMatches(paragraph.content, change.originalWord);
      
      if (matches && matches.length > 0) {
        // Create preview with the corrected word applied
        const previewAfter = this.createFixedPreviewContent(paragraph.content, change.originalWord, change.correctedWord);

        matchingParagraphs.push({
          id: paragraph.id,
          pageId: paragraph.pageId,
          pageNumber: paragraph.page.pageNumber,
          orderIndex: paragraph.orderIndex,
          content: paragraph.content,
          occurrences: matches.length,
          previewBefore: this.createPreview(paragraph.content, change.originalWord),
          previewAfter: this.createPreview(previewAfter, change.correctedWord),
        });
      }
    }

    return matchingParagraphs;
  }

  /**
   * Creates a preview of content with the original word replaced by the corrected word
   */
  private createFixedPreviewContent(content: string, originalWord: string, correctedWord: string): string {
    // Create a pattern that matches the word with proper boundaries
    const escapedWord = this.escapeRegExp(originalWord);
    const pattern = `(^|\\s|[\\p{P}])(${escapedWord})($|\\s|[\\p{P}])`;
    
    try {
      // Replace all occurrences while preserving the surrounding characters
      const regex = new RegExp(pattern, 'gu');
      return content.replace(regex, (match, before, word, after) => {
        return `${before}${correctedWord}${after}`;
      });
    } catch (error) {
      // Fallback to standard regex replacement if Unicode regex fails
      this.logger.error(`Error using Unicode regex for Hebrew word replacement: ${error}`);
      return content.replace(
        new RegExp(`\\b${this.escapeRegExp(originalWord)}\\b`, 'gi'),
        correctedWord
      );
    }
  }

  /**
   * Applies bulk fixes to selected paragraphs
   */
  async applyBulkFixes(
    bookId: string,
    fixes: Array<{
      originalWord: string;
      correctedWord: string;
      paragraphIds: string[];
    }>,
    ttsModel?: string,
    ttsVoice?: string
  ): Promise<BulkFixResult> {
    this.logger.log(`🔧 Starting bulk fixes application for book: ${bookId}`);
    this.logger.log(`📊 Received ${fixes.length} fixes: ${JSON.stringify(fixes.map(f => `"${f.originalWord}" → "${f.correctedWord}" (${f.paragraphIds.length} paragraphs)`))}`);
    
    // Group fixes by paragraph ID
    const paragraphFixes = new Map<string, Array<{ originalWord: string; correctedWord: string }>>();
    
    fixes.forEach(fix => {
      this.logger.log(`📝 Processing fix: "${fix.originalWord}" → "${fix.correctedWord}" for paragraphs: ${JSON.stringify(fix.paragraphIds)}`);
      fix.paragraphIds.forEach(paragraphId => {
        if (!paragraphFixes.has(paragraphId)) {
          paragraphFixes.set(paragraphId, []);
        }
        const fixesForParagraph = paragraphFixes.get(paragraphId);
        if (fixesForParagraph) {
          fixesForParagraph.push({
            originalWord: fix.originalWord,
            correctedWord: fix.correctedWord
          });
        }
      });
    });

    this.logger.log(`🎯 Grouped fixes by paragraph: ${paragraphFixes.size} paragraphs to process`);
    paragraphFixes.forEach((fixes, paragraphId) => {
      this.logger.log(`📋 Paragraph ${paragraphId}: ${fixes.length} fixes`);
    });

    const updatedParagraphs = [];
    let totalWordsFixed = 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        this.logger.log('🚀 Starting database transaction...');
        
        for (const [paragraphId, paragraphFixesList] of paragraphFixes.entries()) {
          this.logger.log(`🔍 Processing paragraph ${paragraphId} with ${paragraphFixesList.length} fixes...`);
          
          // Find the paragraph
          const paragraph = await tx.paragraph.findUnique({
            where: { id: paragraphId },
            include: {
              page: {
                select: {
                  pageNumber: true,
                },
              },
            },
          });

          if (!paragraph) {
            this.logger.log(`⚠️ Paragraph ${paragraphId} not found - skipping`);
            continue;
          }

          this.logger.log(`📄 Found paragraph ${paragraphId}: "${paragraph.content.substring(0, 100)}${paragraph.content.length > 100 ? '...' : ''}"`);

          let updatedContent = paragraph.content;
          let wordsFixedInParagraph = 0;

          // Apply all fixes for this paragraph
          for (const fix of paragraphFixesList) {
            this.logger.log(`🔧 Applying fix: "${fix.originalWord}" → "${fix.correctedWord}"`);
            this.logger.log(`📄 Paragraph content to search in: "${updatedContent}"`);
            this.logger.log(`🔍 Looking for exact word: "${fix.originalWord}" (length: ${fix.originalWord.length})`);
            
            const matches = this.findHebrewWordMatches(updatedContent, fix.originalWord);
            this.logger.log(`🎯 Found ${matches ? matches.length : 0} matches for "${fix.originalWord}"`);
            
            if (matches && matches.length > 0) {
              this.logger.log(`✅ Matches found: ${JSON.stringify(matches)}`);
              const beforeContent = updatedContent;
              
              // Replace all occurrences using the same Hebrew-aware pattern
              const escapedWord = this.escapeRegExp(fix.originalWord);
              const pattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=\\s|[\\p{P}]|$)`;
              try {
                const regex = new RegExp(pattern, 'gu');
                updatedContent = updatedContent.replace(regex, `$1${fix.correctedWord}`);
              } catch (error) {
                this.logger.error(`Error using Unicode regex for Hebrew word replacement: ${error}`);
                // Fallback to standard word boundary regex
                const fallbackRegex = new RegExp(`\\b${escapedWord}\\b`, 'g');
                updatedContent = updatedContent.replace(fallbackRegex, fix.correctedWord);
              }
              
              if (beforeContent !== updatedContent) {
                wordsFixedInParagraph += matches.length;
                this.logger.log(`✅ Successfully replaced ${matches.length} occurrences of "${fix.originalWord}" with "${fix.correctedWord}"`);
                this.logger.log(`📝 Content changed from: "${beforeContent.substring(0, 100)}${beforeContent.length > 100 ? '...' : ''}"`);
                this.logger.log(`📝 Content changed to: "${updatedContent.substring(0, 100)}${updatedContent.length > 100 ? '...' : ''}"`);
              } else {
                this.logger.log(`⚠️ Content unchanged after attempting to replace "${fix.originalWord}" - this might indicate a matching issue`);
              }
            } else {
              this.logger.log(`⚠️ No matches found for "${fix.originalWord}" in paragraph ${paragraphId}`);
            }
          }

          // Update the paragraph if any changes were made
          if (updatedContent !== paragraph.content) {
            this.logger.log(`💾 Updating paragraph ${paragraphId} with ${wordsFixedInParagraph} words fixed`);
            
            await tx.paragraph.update({
              where: { id: paragraphId },
              data: {
                content: updatedContent,
              },
            });

            // Analyze the changes for the response
            const changes = this.textFixesService.analyzeTextChanges(
              paragraph.content,
              updatedContent
            );

            // Record each individual correction in the textCorrection table
            for (const change of changes) {
              try {
                await tx.textCorrection.create({
                  data: {
                    bookId,
                    paragraphId,
                    originalWord: change.originalWord,
                    correctedWord: change.correctedWord,
                    sentenceContext: this.extractSentenceContext(updatedContent, change.originalWord, change.position),
                    fixType: change.fixType,
                    ttsModel,
                    ttsVoice,
                  },
                });
                this.logger.log(`📝 Recorded correction: "${change.originalWord}" → "${change.correctedWord}" in paragraph ${paragraphId}`);
              } catch (error) {
                this.logger.error(`❌ Failed to record correction: ${error.message}`);
                // Don't fail the entire operation if correction recording fails
              }
            }

            updatedParagraphs.push({
              paragraphId,
              pageId: paragraph.pageId,
              pageNumber: paragraph.page.pageNumber,
              orderIndex: paragraph.orderIndex,
              wordsFixed: wordsFixedInParagraph,
              changes,
            });

            totalWordsFixed += wordsFixedInParagraph;
            this.logger.log(`✅ Paragraph ${paragraphId} updated successfully`);
          } else {
            this.logger.log(`⚠️ No changes made to paragraph ${paragraphId} - content remained the same`);
          }
        }
        
        this.logger.log('✅ Database transaction completed successfully');
      });

      const result = {
        totalParagraphsUpdated: updatedParagraphs.length,
        totalWordsFixed,
        updatedParagraphs,
      };

      this.logger.log(`🎉 Bulk fixes completed successfully!`);
      this.logger.log(`📈 Final results: ${result.totalParagraphsUpdated} paragraphs updated, ${result.totalWordsFixed} words fixed`);
      
      return result;
    } catch (error) {
      this.logger.error('💥 Error applying bulk fixes:', error);
      this.logger.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        bookId,
        fixesCount: fixes.length,
        paragraphCount: paragraphFixes.size
      });
      throw error;
    }
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
   * Uses exact matching - words must match exactly including niqqud, but ignores punctuation
   * @param text The text to search in
   * @param word The Hebrew word to find
   * @returns An array of matches (similar to String.match() result)
   */
  private findHebrewWordMatches(text: string, word: string): RegExpMatchArray | null {
    // Escape the search word for regex safety
    const escapedWord = this.escapeRegExp(word);
    
    // Create a pattern that matches the word when surrounded by spaces, punctuation, or at start/end of text
    // The word itself should not include punctuation, but can be followed by it
    const pattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=\\s|[\\p{P}]|$)`;
    
    try {
      // Use Unicode flag 'u' to properly handle Unicode characters
      const regex = new RegExp(pattern, 'gu');
      const matches = [];
      let match;
      
      // Find all matches in the text and return only the word part (without punctuation)
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
      const historicalFixes = await this.prisma.textCorrection.groupBy({
        by: ['originalWord', 'correctedWord'],
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
          suggestedWord: fix.correctedWord,
          confidence,
          occurrences: fix._count.id,
        });
      }
    }

    return suggestions;
  }

  private extractSentenceContext(content: string, word: string, position: number): string {
    // Find the sentence containing the word at the given position
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    let sentenceMatch;
    let currentPos = 0;
    
    while ((sentenceMatch = sentenceRegex.exec(content)) !== null) {
      const sentence = sentenceMatch[0];
      const sentenceStart = currentPos;
      const sentenceEnd = currentPos + sentence.length;
      
      // Check if the position falls within this sentence
      if (position >= sentenceStart && position < sentenceEnd) {
        return sentence.trim();
      }
      
      currentPos = sentenceEnd;
    }
    
    // If no sentence found, extract context around the position
    const contextLength = 50;
    const start = Math.max(0, position - contextLength);
    const end = Math.min(content.length, position + word.length + contextLength);
    
    let context = content.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';
    
    return context;
  }
}