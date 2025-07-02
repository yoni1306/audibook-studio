import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextFixesService, WordChange } from './text-fixes.service';

export interface BulkFixSuggestion {
  originalWord: string;
  correctedWord: string;
  fixType?: string;
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
    this.logger.debug(
      `findSimilarFixesInBook called for book ${bookId}, excluding paragraph ${excludeParagraphId}`
    );
    this.logger.debug(
      `Word changes to look for: ${JSON.stringify(wordChanges)}`
    );

    if (wordChanges.length === 0) {
      this.logger.debug(`No word changes provided, returning empty array`);
      return [];
    }

    // Filter out word changes with identical original and corrected words
    // and ensure fix type is always set
    const validWordChanges = wordChanges.filter((change) => {
      // Skip changes where original and corrected words are identical
      if (change.originalWord === change.correctedWord) {
        this.logger.debug(
          `Skipping identical word change: '${change.originalWord}' -> '${change.correctedWord}'`
        );
        return false;
      }

      // Skip changes without a fix type
      if (!change.fixType) {
        this.logger.debug(
          `Skipping word change without fix type: '${change.originalWord}' -> '${change.correctedWord}'`
        );
        return false;
      }

      return true;
    });

    if (validWordChanges.length === 0) {
      this.logger.debug(`No valid word changes after filtering, returning empty array`);
      return [];
    }

    this.logger.debug(
      `Filtered to ${validWordChanges.length} valid word changes from ${wordChanges.length} original changes`
    );

    // Get all paragraphs in the book except the one just edited
    const bookParagraphs = await this.fetchBookParagraphs(bookId, excludeParagraphId);
    this.logger.debug(
      `Found ${bookParagraphs.length} paragraphs to check for similar fixes`
    );

    // Process each word change to find similar fixes
    const suggestions = await this.processBulkFixSuggestions(
      validWordChanges,
      bookParagraphs
    );

    return suggestions;
  }

  /**
   * Fetches all paragraphs in a book except the excluded one
   */
  private async fetchBookParagraphs(
    bookId: string,
    excludeParagraphId: string
  ) {
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
      orderBy: [{ page: { pageNumber: 'asc' } }, { orderIndex: 'asc' }],
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
      page: { pageNumber: number };
    }>
  ): Promise<BulkFixSuggestion[]> {
    const suggestions: BulkFixSuggestion[] = [];

    for (const change of wordChanges) {
      this.logger.debug(
        `Looking for paragraphs containing word: '${change.originalWord}'`
      );
      const matchingParagraphs = this.findMatchingParagraphs(
        change,
        bookParagraphs
      );

      if (matchingParagraphs.length > 0) {
        this.logger.debug(
          `Found ${matchingParagraphs.length} paragraphs containing '${change.originalWord}'`
        );
        suggestions.push({
          originalWord: change.originalWord,
          correctedWord: change.correctedWord,
          fixType: change.fixType,
          paragraphs: matchingParagraphs,
        });
      } else {
        this.logger.debug(
          `No paragraphs found containing '${change.originalWord}'`
        );
      }
    }

    return suggestions;
  }

  /**
   * Finds paragraphs that contain the original word and creates preview content
   */
  private findMatchingParagraphs(
    change: WordChange,
    bookParagraphs: Array<{
      id: string;
      pageId: string;
      orderIndex: number;
      content: string;
      page: { pageNumber: number };
    }>
  ) {
    const matchingParagraphs = [];

    for (const paragraph of bookParagraphs) {
      // For all text types, we need proper word boundary detection
      const matches = this.findWordMatches(
        paragraph.content,
        change.originalWord
      );

      if (matches && matches.length > 0) {
        // Create both previews from the original content
        const previewBefore = this.createPreview(
          paragraph.content,
          change.originalWord
        );
        
        // Create the fixed content and extract the same sentences
        const fixedContent = this.createFixedPreviewContent(
          paragraph.content,
          change.originalWord,
          change.correctedWord
        );
        const previewAfter = this.extractSameSentences(
          previewBefore,
          fixedContent,
          change.correctedWord
        );

        matchingParagraphs.push({
          id: paragraph.id,
          pageId: paragraph.pageId,
          pageNumber: paragraph.page.pageNumber,
          orderIndex: paragraph.orderIndex,
          content: paragraph.content,
          occurrences: matches.length,
          previewBefore,
          previewAfter,
        });
      }
    }

    return matchingParagraphs;
  }

  /**
   * Creates a preview of content with the original word replaced by the corrected word
   */
  private createFixedPreviewContent(
    content: string,
    originalWord: string,
    correctedWord: string
  ): string {
    // Use the same word boundary logic as findWordMatches and replaceWordMatches
    return this.replaceWordMatches(content, originalWord, correctedWord);
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
      fixType?: string;
    }>,
    ttsModel?: string,
    ttsVoice?: string
  ): Promise<BulkFixResult> {
    this.logger.log(`🔧 Starting bulk fixes application for book: ${bookId}`);
    this.logger.log(
      `📊 Received ${fixes.length} fixes: ${JSON.stringify(
        fixes.map(
          (f) =>
            `"${f.originalWord}" → "${f.correctedWord}" (${f.paragraphIds.length} paragraphs)`
        )
      )}`
    );

    // Group fixes by paragraph ID
    const paragraphFixes = new Map<
      string,
      Array<{ originalWord: string; correctedWord: string; fixType?: string }>
    >();

    fixes.forEach((fix) => {
      this.logger.log(
        `📝 Processing fix: "${fix.originalWord}" → "${
          fix.correctedWord
        }" for paragraphs: ${JSON.stringify(fix.paragraphIds)}`
      );
      fix.paragraphIds.forEach((paragraphId) => {
        if (!paragraphFixes.has(paragraphId)) {
          paragraphFixes.set(paragraphId, []);
        }
        const fixesForParagraph = paragraphFixes.get(paragraphId);
        if (fixesForParagraph) {
          fixesForParagraph.push({
            originalWord: fix.originalWord,
            correctedWord: fix.correctedWord,
            fixType: fix.fixType,
          });
        }
      });
    });

    this.logger.log(
      `🎯 Grouped fixes by paragraph: ${paragraphFixes.size} paragraphs to process`
    );
    paragraphFixes.forEach((fixes, paragraphId) => {
      this.logger.log(`📋 Paragraph ${paragraphId}: ${fixes.length} fixes`);
    });

    const updatedParagraphs = [];
    let totalWordsFixed = 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        this.logger.log('🚀 Starting database transaction...');

        for (const [
          paragraphId,
          paragraphFixesList,
        ] of paragraphFixes.entries()) {
          this.logger.log(
            `🔍 Processing paragraph ${paragraphId} with ${paragraphFixesList.length} fixes...`
          );

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

          this.logger.log(
            `📄 Found paragraph ${paragraphId}: "${paragraph.content.substring(
              0,
              100
            )}${paragraph.content.length > 100 ? '...' : ''}"`
          );

          let updatedContent = paragraph.content;
          let wordsFixedInParagraph = 0;
          const appliedChanges = [];

          // Apply all fixes for this paragraph
          for (const fix of paragraphFixesList) {
            this.logger.log(
              `🔧 Applying fix: "${fix.originalWord}" → "${fix.correctedWord}"`
            );
            this.logger.log(
              `📄 Paragraph content to search in: "${updatedContent}"`
            );
            this.logger.log(
              `🔍 Looking for exact word: "${fix.originalWord}" (length: ${fix.originalWord.length})`
            );

            // Collect all match positions using consistent word boundary detection
            const matchPositions = this.findWordPositions(
              paragraph.content,
              fix.originalWord
            );



            if (matchPositions.length > 0) {
              this.logger.log(
                `✅ Found ${matchPositions.length} occurrences for "${fix.originalWord}"`
              );
              const beforeContent = updatedContent;

              // Replace all occurrences using consistent word boundary detection
              updatedContent = this.replaceWordMatches(
                updatedContent,
                fix.originalWord,
                fix.correctedWord
              );

              wordsFixedInParagraph += matchPositions.length;
              this.logger.log(
                `✅ Successfully replaced ${matchPositions.length} occurrences of "${fix.originalWord}" with "${fix.correctedWord}"`
              );
              this.logger.log(
                `📝 Content changed from: "${beforeContent.substring(0, 100)}${
                  beforeContent.length > 100 ? '...' : ''
                }"`
              );
              this.logger.log(
                `📝 Content changed to: "${updatedContent.substring(0, 100)}${
                  updatedContent.length > 100 ? '...' : ''
                }"`
              );

              // Record each individual correction that was actually applied
              for (const matchPosition of matchPositions) {
                try {
                  const sentenceContext = this.extractSentenceContext(
                    paragraph.content,
                    fix.originalWord,
                    matchPosition
                  );
                  await tx.textCorrection.create({
                    data: {
                      bookId,
                      paragraphId,
                      originalWord: fix.originalWord,
                      correctedWord: fix.correctedWord,
                      sentenceContext,
                      fixType: fix.fixType,
                      ttsModel,
                      ttsVoice,
                    },
                  });
                  this.logger.log(
                    `📝 Recorded correction: "${fix.originalWord}" → "${fix.correctedWord}" in paragraph ${paragraphId} (at position ${matchPosition})`
                  );
                  // Add to applied changes for response
                  appliedChanges.push({
                    originalWord: fix.originalWord,
                    correctedWord: fix.correctedWord,
                    position: matchPosition,
                    fixType: fix.fixType,
                  });
                } catch (error) {
                  this.logger.error(
                    `❌ Failed to record correction: ${error.message}`
                  );
                  // Don't fail the entire operation if correction recording fails
                }
              }
            } else {
              this.logger.log(
                `⚠️ No matches found for "${fix.originalWord}" in paragraph ${paragraphId}`
              );
            }
          }

          // Update the paragraph if any changes were made
          if (updatedContent !== paragraph.content) {
            this.logger.log(
              `💾 Updating paragraph ${paragraphId} with ${wordsFixedInParagraph} words fixed`
            );

            await tx.paragraph.update({
              where: { id: paragraphId },
              data: {
                content: updatedContent,
              },
            });

            updatedParagraphs.push({
              paragraphId,
              pageId: paragraph.pageId,
              pageNumber: paragraph.page.pageNumber,
              orderIndex: paragraph.orderIndex,
              wordsFixed: wordsFixedInParagraph,
              changes: appliedChanges,
            });

            totalWordsFixed += wordsFixedInParagraph;
            this.logger.log(`✅ Paragraph ${paragraphId} updated successfully`);
          } else {
            this.logger.log(
              `⚠️ No changes made to paragraph ${paragraphId} - content remained the same`
            );
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
      this.logger.log(
        `📈 Final results: ${result.totalParagraphsUpdated} paragraphs updated, ${result.totalWordsFixed} words fixed`
      );

      return result;
    } catch (error) {
      this.logger.error('💥 Error applying bulk fixes:', error);
      this.logger.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        bookId,
        fixesCount: fixes.length,
        paragraphCount: paragraphFixes.size,
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
  private createPreview(
    content: string,
    word: string,
    contextLength = 50
  ): string {
    // For all word types, we need to use our word boundary matching function
    const matches = this.findWordMatches(content, word);

    if (!matches || matches.length === 0) {
      // Fallback to the original behavior
      return content.substring(0, contextLength) + '...';
    }

    // Find all sentences containing the matched word
    const sentences = this.extractSentencesContainingWord(content, word);

    // If no complete sentences found, fall back to context-based preview
    if (sentences.length === 0) {
      const index = content.indexOf(matches[0]);
      const start = Math.max(0, index - contextLength);
      const end = Math.min(
        content.length,
        index + matches[0].length + contextLength
      );

      let preview = content.substring(start, end);

      if (start > 0) preview = '...' + preview;
      if (end < content.length) preview = preview + '...';

      return preview;
    }

    // Join the sentences with a space
    return sentences.join(' ');
  }

  /**
   * Extracts sentences from content that contain the specified word
   */
  private extractSentencesContainingWord(content: string, word: string): string[] {
    // Split content by sentence endings (., !, ?)
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    const sentences = [];
    let sentenceMatch;

    while ((sentenceMatch = sentenceRegex.exec(content)) !== null) {
      const sentence = sentenceMatch[0];
      // Check if this sentence contains our word
      const wordInSentence = this.findWordMatches(sentence, word);
      if (wordInSentence && wordInSentence.length > 0) {
        sentences.push(sentence.trim());
      }
    }

    // If no sentences found with punctuation, create logical word-based segments
    if (sentences.length === 0) {
      const wordInContent = this.findWordMatches(content, word);
      if (wordInContent && wordInContent.length > 0) {
        // Create word-based sentences (15-20 words per segment)
        const words = content.trim().split(/\s+/);
        const wordsPerSegment = 15;
        
        for (let i = 0; i < words.length; i += wordsPerSegment) {
          const segment = words.slice(i, i + wordsPerSegment).join(' ');
          const wordInSegment = this.findWordMatches(segment, word);
          if (wordInSegment && wordInSegment.length > 0) {
            sentences.push(segment);
          }
        }
        
        // If still no segments found, return the entire content as one segment
        if (sentences.length === 0) {
          sentences.push(content.trim());
        }
      }
    }

    return sentences;
  }

  /**
   * Extracts the same sentences from fixed content that were found in the original preview
   */
  private extractSameSentences(
    originalPreview: string,
    fixedContent: string,
    correctedWord: string
  ): string {
    // If the original preview was a fallback (contains '...'), 
    // we need to find the equivalent section in the fixed content
    if (originalPreview.includes('...')) {
      // For fallback previews, just return the sentences containing the corrected word
      const sentences = this.extractSentencesContainingWord(fixedContent, correctedWord);
      return sentences.length > 0 ? sentences.join(' ') : fixedContent.substring(0, 50) + '...';
    }

    // For sentence-based previews, find the same sentences in the fixed content
    const sentences = this.extractSentencesContainingWord(fixedContent, correctedWord);
    return sentences.length > 0 ? sentences.join(' ') : originalPreview;
  }

  /**
   * Escapes special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Finds the position of the first occurrence of a Hebrew word in text
   * @param text The text to search in
   * @param word The Hebrew word to find
   * @returns The position of the first occurrence, or 0 if not found
   */
  private findWordPosition(text: string, word: string): number {
    // Escape the search word for regex safety
    const escapedWord = this.escapeRegExp(word);

    // Hebrew word boundaries are more complex than English
    const hebrewPrefixes = '[ובלכמשה]';
    const pattern = `(^|\\s|[\\p{P}]|${hebrewPrefixes})(${escapedWord})(?=\\s|[\\p{P}]|$)`;

    try {
      const regex = new RegExp(pattern, 'u'); // Note: no 'g' flag to get first match only
      const match = regex.exec(text);

      if (match) {
        const prefix = match[1];
        const wordMatch = match[2];
        const matchStart = match.index;
        const wordStart = matchStart + prefix.length;
        const wordEnd = wordStart + wordMatch.length;

        // Check if there's a hyphen immediately before or after the word itself
        const charBefore = wordStart > 0 ? text[wordStart - 1] : '';
        const charAfter = wordEnd < text.length ? text[wordEnd] : '';

        if (charBefore !== '-' && charAfter !== '-') {
          return wordStart; // Return the position of the word itself, not including prefix
        }
      }
    } catch (error) {
      this.logger.error(
        `Error using Unicode regex for word position: ${error}`
      );
    }

    // Fallback to simple indexOf if regex fails
    return Math.max(0, text.indexOf(word));
  }

  /**
   * Finds the positions of word matches in text, using the same boundary logic as findWordMatches
   * @param text The text to search in
   * @param word The word to find
   * @param allowPrefixes Whether to allow Hebrew prefixes in the regex
   * @returns An array of match positions (indices)
   */
  private findWordPositions(
    text: string,
    word: string,
    allowPrefixes = false
  ): number[] {
    const escapedWord = this.escapeRegExp(word);
    const hebrewPrefixes = '[ובלכמשה]';
    const positions: number[] = [];
    
    // Detect if the word contains Hebrew characters
    const isHebrewWord = /[\u0590-\u05FF]/.test(word);
    // Detect if the word is a number
    const isNumber = /^\d+$/.test(word);
    
    let pattern;
    if (isHebrewWord) {
      // Hebrew word boundary detection
      if (allowPrefixes) {
        // Allow optional Hebrew prefix
        pattern = `(?<![\u0590-\u05FF-])(?:${hebrewPrefixes})?(${escapedWord})(?![\u0590-\u05FF-])`;
      } else {
        // No prefix allowed
        pattern = `(?<![\u0590-\u05FF-])(${escapedWord})(?![\u0590-\u05FF-])`;
      }
    } else if (isNumber) {
      // Number boundary detection - prevent matching digits that are part of larger numbers
      // This includes decimal numbers with dots (.) or commas (,) as separators
      // Also excludes Hebrew hyphen (־) to prevent matching numbers in compound expressions like "ב־2"
      pattern = `(?<![\\d.,־])(${escapedWord})(?![\\d.,])`;
    } else {
      // Non-Hebrew, non-number words (English, etc.) - use standard word boundaries
      // Prevent matching inside other words
      pattern = `(?<!\\w)(${escapedWord})(?!\\w)`;
    }
    
    try {
      const regex = new RegExp(pattern, 'gu');
      let match;
      while ((match = regex.exec(text)) !== null) {
        positions.push(match.index);
      }
    } catch {
      // Fallback: match exact word boundaries if lookbehind is not supported
      let fallbackPattern;
      if (isHebrewWord) {
        if (allowPrefixes) {
          fallbackPattern = `(^|\\s|[\\p{P}])(?:${hebrewPrefixes})?(${escapedWord})(?=$|\\s|[\\p{P}])`;
        } else {
          fallbackPattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=$|\\s|[\\p{P}])`;
        }
      } else if (isNumber) {
        // For numbers, exclude decimal separators from punctuation boundaries
        // Use whitespace and non-digit, non-decimal-separator characters as boundaries
        fallbackPattern = `(^|\\s|[^\\d.,\\s])(${escapedWord})(?=$|\\s|[^\\d.,\\s])`;
      } else {
        // For non-Hebrew, non-number words, use word boundaries with whitespace/punctuation
        fallbackPattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=$|\\s|[\\p{P}])`;
      }
      const regex = new RegExp(fallbackPattern, 'gu');
      let match;
      while ((match = regex.exec(text)) !== null) {
        // match[0] includes the prefix/suffix, match[1] is prefix, match[2] is the word
        // The word starts after the prefix
        const prefixLength = match[1] ? match[1].length : 0;
        const wordStart = match.index + prefixLength;
        positions.push(wordStart);
      }
    }
    
    return positions;
  }

  /**
   * Replaces word matches in text using the same boundary logic as findWordMatches
   * @param text The text to search and replace in
   * @param originalWord The word to find and replace
   * @param replacementWord The word to replace with
   * @param allowPrefixes Whether to allow Hebrew prefixes in the regex
   * @returns The text with replacements made
   */
  private replaceWordMatches(
    text: string,
    originalWord: string,
    replacementWord: string,
    allowPrefixes = false
  ): string {
    const escapedWord = this.escapeRegExp(originalWord);
    const hebrewPrefixes = '[ובלכמשה]';
    
    // Detect if the word contains Hebrew characters
    const isHebrewWord = /[\u0590-\u05FF]/.test(originalWord);
    // Detect if the word is a number
    const isNumber = /^\d+$/.test(originalWord);
    
    let pattern;
    if (isHebrewWord) {
      // Hebrew word boundary detection
      if (allowPrefixes) {
        // Allow optional Hebrew prefix
        pattern = `(?<![\u0590-\u05FF-])(?:${hebrewPrefixes})?(${escapedWord})(?![\u0590-\u05FF-])`;
      } else {
        // No prefix allowed
        pattern = `(?<![\u0590-\u05FF-])(${escapedWord})(?![\u0590-\u05FF-])`;
      }
    } else if (isNumber) {
      // Number boundary detection - prevent matching digits that are part of larger numbers
      // This includes decimal numbers with dots (.) or commas (,) as separators
      // Also excludes Hebrew hyphen (־) to prevent matching numbers in compound expressions like "ב־2"
      pattern = `(?<![\\d.,־])(${escapedWord})(?![\\d.,])`;
    } else {
      // Non-Hebrew, non-number words (English, etc.) - use standard word boundaries
      // Prevent matching inside other words
      pattern = `(?<!\\w)(${escapedWord})(?!\\w)`;
    }
    
    try {
      const regex = new RegExp(pattern, 'gu');
      return text.replace(regex, replacementWord);
    } catch {
      // Fallback: match exact word boundaries if lookbehind is not supported
      let fallbackPattern;
      if (isHebrewWord) {
        if (allowPrefixes) {
          fallbackPattern = `(^|\\s|[\\p{P}])(?:${hebrewPrefixes})?(${escapedWord})(?=$|\\s|[\\p{P}])`;
        } else {
          fallbackPattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=$|\\s|[\\p{P}])`;
        }
      } else if (isNumber) {
        // For numbers, exclude decimal separators from punctuation boundaries
        // Use whitespace and non-digit, non-decimal-separator characters as boundaries
        fallbackPattern = `(^|\\s|[^\\d.,\\s])(${escapedWord})(?=$|\\s|[^\\d.,\\s])`;
      } else {
        // For non-Hebrew, non-number words, use word boundaries with whitespace/punctuation
        fallbackPattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=$|\\s|[\\p{P}])`;
      }
      const regex = new RegExp(fallbackPattern, 'gu');
      return text.replace(regex, (match, prefix) => {
        // Preserve the prefix/suffix in the replacement
        return prefix + replacementWord;
      });
    }
  }

  /**
   * Finds matches of a word in text, properly handling word boundaries
   * This handles Hebrew words (where JavaScript's \b doesn't work correctly) and numbers
   * Uses exact matching - words must match exactly including niqqud, but ignores punctuation
   * @param text The text to search in
   * @param word The word to find (Hebrew, numbers, or other text)
   * @param allowPrefixes Whether to allow Hebrew prefixes in the regex
   * @returns An array of matches (similar to String.match() result)
   */
  private findWordMatches(
    text: string,
    word: string,
    allowPrefixes = false
  ): RegExpMatchArray | null {
    const escapedWord = this.escapeRegExp(word);
    const hebrewPrefixes = '[ובלכמשה]';
    
    // Detect if the word contains Hebrew characters
    const isHebrewWord = /[\u0590-\u05FF]/.test(word);
    // Detect if the word is a number
    const isNumber = /^\d+$/.test(word);
    
    let pattern;
    if (isHebrewWord) {
      // Hebrew word boundary detection
      if (allowPrefixes) {
        // Allow optional Hebrew prefix
        pattern = `(?<![\u0590-\u05FF-])(?:${hebrewPrefixes})?(${escapedWord})(?![\u0590-\u05FF-])`;
      } else {
        // No prefix allowed
        pattern = `(?<![\u0590-\u05FF-])(${escapedWord})(?![\u0590-\u05FF-])`;
      }
    } else if (isNumber) {
      // Number boundary detection - prevent matching digits that are part of larger numbers
      // This includes decimal numbers with dots (.) or commas (,) as separators
      // Also excludes Hebrew hyphen (־) to prevent matching numbers in compound expressions like "ב־2"
      pattern = `(?<![\\d.,־])(${escapedWord})(?![\\d.,])`;
    } else {
      // Non-Hebrew, non-number words (English, etc.) - use standard word boundaries
      // Prevent matching inside other words
      pattern = `(?<!\\w)(${escapedWord})(?!\\w)`;
    }
    
    try {
      const regex = new RegExp(pattern, 'gu');
      return text.match(regex);
    } catch {
      // Fallback: match exact word boundaries if lookbehind is not supported
      let fallbackPattern;
      if (isHebrewWord) {
        if (allowPrefixes) {
          fallbackPattern = `(^|\\s|[\\p{P}])(?:${hebrewPrefixes})?(${escapedWord})(?=$|\\s|[\\p{P}])`;
        } else {
          fallbackPattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=$|\\s|[\\p{P}])`;
        }
      } else if (isNumber) {
        // For numbers, exclude decimal separators from punctuation boundaries
        // Use whitespace and non-digit, non-decimal-separator characters as boundaries
        fallbackPattern = `(^|\\s|[^\\d.,\\s])(${escapedWord})(?=$|\\s|[^\\d.,\\s])`;
      } else {
        // For non-Hebrew, non-number words, use word boundaries with whitespace/punctuation
        fallbackPattern = `(^|\\s|[\\p{P}])(${escapedWord})(?=$|\\s|[\\p{P}])`;
      }
      const regex = new RegExp(fallbackPattern, 'gu');
      return text.match(regex);
    }
  }

  /**
   * Gets suggested fixes based on historical data
   */
  async getSuggestedFixes(
    bookId: string,
    content: string
  ): Promise<
    Array<{
      originalWord: string;
      suggestedWord: string;
      confidence: number;
      occurrences: number;
    }>
  > {
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

  private extractSentenceContext(
    content: string,
    word: string,
    position: number
  ): string {
    // Find the sentence containing the word at the given position
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    let sentenceMatch;

    while ((sentenceMatch = sentenceRegex.exec(content)) !== null) {
      const sentence = sentenceMatch[0];
      const sentenceStart = sentenceMatch.index;
      const sentenceEnd = sentenceStart + sentence.length;

      // Check if the position falls within this sentence
      if (position >= sentenceStart && position < sentenceEnd) {
        return sentence.trim();
      }
    }

    // If no sentence found, extract context around the position
    const contextLength = 50;
    const start = Math.max(0, position - contextLength);
    const end = Math.min(
      content.length,
      position + word.length + contextLength
    );

    let context = content.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';

    return context;
  }
}
