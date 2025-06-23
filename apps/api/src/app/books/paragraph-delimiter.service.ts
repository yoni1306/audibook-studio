import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParagraphPreview } from './dto/paragraph-delimiter.dto';
import { ParagraphLimitsConfig } from '../../config/paragraph-limits.config';

@Injectable()
export class ParagraphDelimiterService {
  private readonly logger = new Logger(ParagraphDelimiterService.name);

  constructor(
    private prisma: PrismaService,
    private paragraphLimitsConfig: ParagraphLimitsConfig,
  ) {}

  /**
   * Preview how paragraphs would be divided with the given delimiter
   */
  async previewParagraphDelimiter(bookId: string, delimiter: string): Promise<{
    originalParagraphCount: number;
    newParagraphCount: number;
    previewParagraphs: ParagraphPreview[];
  }> {
    this.logger.log(`🔍 Previewing paragraph delimiter for book ${bookId} with delimiter: "${delimiter}"`);

    // Validate inputs
    if (!delimiter || delimiter.trim() === '') {
      throw new BadRequestException('Delimiter cannot be empty');
    }

    // Fetch the book with paragraphs
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        paragraphs: {
          orderBy: [
            { chapterNumber: 'asc' },
            { orderIndex: 'asc' }
          ]
        }
      }
    });

    if (!book) {
      throw new NotFoundException(`Book not found with ID: ${bookId}`);
    }

    const originalParagraphs = book.paragraphs;
    const originalCount = originalParagraphs.length;

    this.logger.log(`📊 Original book has ${originalCount} paragraphs`);

    // Merge all paragraph content into one big text
    const mergedContent = originalParagraphs
      .map(p => p.content)
      .join(' '); // Join with space to avoid words merging

    this.logger.log(`📝 Merged content length: ${mergedContent.length} characters`);

    // Split the merged content by the delimiter
    const splitContent = this.splitByDelimiter(mergedContent, delimiter);
    
    // Apply post-processing: split long paragraphs and merge small ones
    const processedParagraphs = this.postProcessParagraphs(splitContent);

    const previewParagraphs: ParagraphPreview[] = processedParagraphs
      .filter(content => content.trim().length > 0)
      .map((content, index) => {
        const trimmedContent = content.trim();
        const characterCount = trimmedContent.length;
        const wordCount = trimmedContent.split(/\s+/).length;
        
        return {
          chapterNumber: 1,
          orderIndex: index + 1,
          content: trimmedContent,
          characterCount,
          wordCount,
          isNew: true,
        };
      });

    const newCount = previewParagraphs.length;

    this.logger.log(`📊 Preview complete: ${originalCount} → ${newCount} paragraphs`);

    return {
      originalParagraphCount: originalCount,
      newParagraphCount: newCount,
      previewParagraphs,
    };
  }

  /**
   * Apply the paragraph delimiter and update the database
   */
  async applyParagraphDelimiter(bookId: string, delimiter: string): Promise<{
    originalParagraphCount: number;
    newParagraphCount: number;
  }> {
    this.logger.log(`🔧 Applying paragraph delimiter for book ${bookId} with delimiter: "${delimiter}"`);

    // Validate inputs
    if (!delimiter || delimiter.trim() === '') {
      throw new BadRequestException('Delimiter cannot be empty');
    }

    // Get preview first to calculate new paragraphs
    const preview = await this.previewParagraphDelimiter(bookId, delimiter);
    
    // Apply the changes to the database
    const result = await this.prisma.$transaction(async (tx) => {
      const originalCount = preview.originalParagraphCount;

      // Delete all existing paragraphs
      await tx.paragraph.deleteMany({
        where: { bookId },
      });

      this.logger.log(`🗑️ Deleted ${originalCount} existing paragraphs`);

      // Create new paragraphs from preview
      const newParagraphs = preview.previewParagraphs.map((previewParagraph) => ({
        bookId,
        chapterNumber: previewParagraph.chapterNumber,
        orderIndex: previewParagraph.orderIndex,
        content: previewParagraph.content,
        audioStatus: 'PENDING' as const,
      }));

      await tx.paragraph.createMany({
        data: newParagraphs
      });

      this.logger.log(`✅ Created ${newParagraphs.length} new paragraphs`);

      return {
        originalParagraphCount: originalCount,
        newParagraphCount: newParagraphs.length,
      };
    });

    this.logger.log(`🎉 Successfully applied delimiter: ${result.originalParagraphCount} → ${result.newParagraphCount} paragraphs`);

    return result;
  }

  /**
   * Automatically optimize paragraph lengths for a book
   * Enforces both minimum and maximum length limits
   */
  async optimizeParagraphLengths(bookId: string): Promise<{
    originalParagraphCount: number;
    optimizedParagraphCount: number;
    splitCount: number;
    mergedCount: number;
  }> {
    this.logger.log(`🔧 Optimizing paragraph lengths for book ${bookId}`);

    // Fetch the book with paragraphs
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        paragraphs: {
          orderBy: [
            { chapterNumber: 'asc' },
            { orderIndex: 'asc' }
          ]
        }
      }
    });

    if (!book) {
      throw new NotFoundException(`Book not found with ID: ${bookId}`);
    }

    const originalParagraphs = book.paragraphs;
    const originalCount = originalParagraphs.length;

    this.logger.log(`📊 Original book has ${originalCount} paragraphs`);

    // Merge all paragraph content into one big text
    const mergedContent = originalParagraphs
      .map(p => p.content)
      .join(' '); // Join with space to avoid words merging

    // Apply post-processing: split long paragraphs and merge small ones
    const optimizedContent = this.postProcessParagraphs([mergedContent]);

    const optimizedCount = optimizedContent.length;
    const splitCount = optimizedCount > originalCount ? optimizedCount - originalCount : 0;
    const mergedCount = originalCount > optimizedCount ? originalCount - optimizedCount : 0;

    // Apply the optimization to the database
    await this.prisma.$transaction(async (tx) => {
      // Delete existing paragraphs
      await tx.paragraph.deleteMany({
        where: { bookId }
      });

      // Create optimized paragraphs
      const newParagraphs = optimizedContent.map((content, index) => ({
        bookId,
        chapterNumber: 1,
        orderIndex: index + 1,
        content: content.trim(),
        audioStatus: 'PENDING' as const,
      }));

      await tx.paragraph.createMany({
        data: newParagraphs
      });
    });

    this.logger.log(`✅ Paragraph optimization complete: ${originalCount} → ${optimizedCount} paragraphs`);

    return {
      originalParagraphCount: originalCount,
      optimizedParagraphCount: optimizedCount,
      splitCount,
      mergedCount,
    };
  }

  /**
   * Split content by delimiter, handling edge cases
   */
  private splitByDelimiter(content: string, delimiter: string): string[] {
    if (!delimiter || !content) {
      return [content];
    }

    // Handle different types of delimiters
    let splitContent: string[];

    if (delimiter === '\\n') {
      // Handle newline delimiter
      splitContent = content.split('\n');
    } else if (delimiter === '\\t') {
      // Handle tab delimiter
      splitContent = content.split('\t');
    } else if (delimiter.startsWith('/') && delimiter.endsWith('/')) {
      // Handle regex delimiter (e.g., "/\\d+\\./")
      try {
        const regexPattern = delimiter.slice(1, -1); // Remove the / at start and end
        const regex = new RegExp(regexPattern);
        splitContent = content.split(regex);
      } catch (error) {
        this.logger.warn(`⚠️ Invalid regex delimiter "${delimiter}", falling back to literal split: ${error instanceof Error ? error.message : String(error)}`);
        splitContent = content.split(delimiter);
      }
    } else {
      // Handle literal string delimiter
      splitContent = content.split(delimiter);
    }

    // Filter out empty strings and trim whitespace
    return splitContent
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }

  /**
   * Post-processing to merge small paragraphs and split long ones
   */
  private postProcessParagraphs(paragraphs: string[]): string[] {
    const MAX_CHARACTERS = this.paragraphLimitsConfig.getMaxCharacters();
    const MAX_WORDS = this.paragraphLimitsConfig.getMaxWords();
    const MIN_CHARACTERS = this.paragraphLimitsConfig.getMinCharacters();
    const MIN_WORDS = this.paragraphLimitsConfig.getMinWords();

    const processedParagraphs: string[] = [];

    // First pass: split long paragraphs
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      const wordCount = trimmed.split(/\s+/).length;

      if (trimmed.length > MAX_CHARACTERS || wordCount > MAX_WORDS) {
        // Split long paragraph
        const splitParagraphs = this.splitLongParagraph(trimmed);
        processedParagraphs.push(...splitParagraphs);
      } else {
        processedParagraphs.push(trimmed);
      }
    }

    // Second pass: Strict merging - enforce minimum limits like maximum limits
    // This ensures all paragraphs meet the configured minimum requirements
    const finalParagraphs: string[] = [];
    
    for (let i = 0; i < processedParagraphs.length; i++) {
      const currentParagraph = processedParagraphs[i];
      const currentWordCount = currentParagraph.split(/\s+/).length;
      
      // Enforce minimum limits strictly (AND condition - must meet both)
      if (currentParagraph.length < MIN_CHARACTERS && currentWordCount < MIN_WORDS) {
        // Try to merge with previous paragraph if possible
        if (finalParagraphs.length > 0) {
          const lastParagraph = finalParagraphs[finalParagraphs.length - 1];
          const mergedContent = lastParagraph + ' ' + currentParagraph;
          const mergedWordCount = mergedContent.split(/\s+/).length;
          
          // Check if merged paragraph would still be within maximum limits
          if (mergedContent.length <= MAX_CHARACTERS && mergedWordCount <= MAX_WORDS) {
            finalParagraphs[finalParagraphs.length - 1] = mergedContent;
            this.logger.log(`📏 Merged paragraph below minimum limits: ${currentParagraph.length} chars, ${currentWordCount} words`);
            continue;
          }
        }
        
        // If can't merge with previous, try to merge with next paragraph
        if (i + 1 < processedParagraphs.length) {
          const nextParagraph = processedParagraphs[i + 1];
          const mergedContent = currentParagraph + ' ' + nextParagraph;
          const mergedWordCount = mergedContent.split(/\s+/).length;
          
          // Check if merged paragraph would still be within maximum limits
          if (mergedContent.length <= MAX_CHARACTERS && mergedWordCount <= MAX_WORDS) {
            finalParagraphs.push(mergedContent);
            this.logger.log(`📏 Merged paragraph with next: ${currentParagraph.length} + ${nextParagraph.length} chars`);
            i++; // Skip the next paragraph as it's already merged
            continue;
          }
        }
        
        // If can't merge, keep the paragraph but log a warning
        this.logger.warn(`📏 Warning: Paragraph below minimum limits cannot be merged: ${currentParagraph.length} chars, ${currentWordCount} words`);
        finalParagraphs.push(currentParagraph);
      } else {
        // Paragraph meets minimum requirements
        finalParagraphs.push(currentParagraph);
      }
    }

    this.logger.log(`📏 Post-processing: ${paragraphs.length} → ${finalParagraphs.length} paragraphs`);
    return finalParagraphs;
  }

  /**
   * Split a long paragraph into smaller ones while preserving sentence boundaries
   */
  private splitLongParagraph(content: string): string[] {
    const MAX_CHARACTERS = this.paragraphLimitsConfig.getMaxCharacters();
    const MAX_WORDS = this.paragraphLimitsConfig.getMaxWords();
    
    // If paragraph is within limits, return as-is
    const wordCount = content.split(/\s+/).length;
    if (content.length <= MAX_CHARACTERS && wordCount <= MAX_WORDS) {
      return [content];
    }

    this.logger.log(`📏 Splitting long paragraph: ${content.length} chars, ${wordCount} words`);

    // Split by sentence boundaries (handles Hebrew and English punctuation)
    const sentenceRegex = /[.!?؟。！？]+\s*/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const sentence = content.substring(lastIndex, match.index + match[0].length).trim();
      if (sentence) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining content as last sentence
    const remaining = content.substring(lastIndex).trim();
    if (remaining) {
      sentences.push(remaining);
    }

    this.logger.log(`📏 Found ${sentences.length} sentences`);

    // If no sentences found, split by word boundaries as fallback
    if (sentences.length <= 1) {
      this.logger.log(`📏 No sentences found, using word boundary fallback`);
      return this.splitByWordBoundaries(content, MAX_CHARACTERS, MAX_WORDS);
    }

    // Group sentences into paragraphs within limits
    const splitParagraphs: string[] = [];
    let currentParagraph = '';
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      const spacer = currentParagraph ? ' ' : '';
      const newLength = currentParagraph.length + spacer.length + sentence.length;
      const newWordCount = currentWordCount + sentenceWords;

      // Check if adding this sentence would exceed limits
      if (currentParagraph && (newLength > MAX_CHARACTERS || newWordCount > MAX_WORDS)) {
        // Save current paragraph and start new one
        splitParagraphs.push(currentParagraph.trim());
        currentParagraph = sentence;
        currentWordCount = sentenceWords;
      } else {
        // Add sentence to current paragraph
        currentParagraph += spacer + sentence;
        currentWordCount = newWordCount;
      }
    }

    // Add final paragraph if it has content
    if (currentParagraph.trim()) {
      splitParagraphs.push(currentParagraph.trim());
    }

    this.logger.log(`📏 Split into ${splitParagraphs.length} paragraphs`);
    return splitParagraphs.length > 0 ? splitParagraphs : [content];
  }

  /**
   * Fallback method to split by word boundaries when sentence detection fails
   */
  private splitByWordBoundaries(content: string, maxChars: number, maxWords: number): string[] {
    this.logger.log(`📏 Word boundary splitting: ${content.length} chars, max ${maxChars} chars, max ${maxWords} words`);
    
    const words = content.split(/\s+/);
    const splitParagraphs: string[] = [];
    let currentParagraph = '';
    let currentWordCount = 0;

    for (const word of words) {
      const spacer = currentParagraph ? ' ' : '';
      const newLength = currentParagraph.length + spacer.length + word.length;
      const newWordCount = currentWordCount + 1;

      if (currentParagraph && (newLength > maxChars || newWordCount > maxWords)) {
        splitParagraphs.push(currentParagraph.trim());
        this.logger.log(`📏 Split paragraph: ${currentParagraph.length} chars, ${currentWordCount} words`);
        currentParagraph = word;
        currentWordCount = 1;
      } else {
        currentParagraph += spacer + word;
        currentWordCount = newWordCount;
      }
    }

    if (currentParagraph.trim()) {
      splitParagraphs.push(currentParagraph.trim());
      this.logger.log(`📏 Final paragraph: ${currentParagraph.length} chars, ${currentWordCount} words`);
    }

    this.logger.log(`📏 Word boundary split result: ${splitParagraphs.length} paragraphs`);
    return splitParagraphs.length > 0 ? splitParagraphs : [content];
  }
}
