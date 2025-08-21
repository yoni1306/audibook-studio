import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookStatus, Prisma } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { TextFixesService, WordChange } from './text-fixes.service';
import { UpdateParagraphResponseDto, BulkFixSuggestion as BulkFixSuggestionDto } from './dto/paragraph-update.dto';
import { S3Service } from '../s3/s3.service';
import { BulkTextFixesService, BulkFixSuggestion as ServiceBulkFixSuggestion } from './bulk-text-fixes.service';

// Token diff interfaces for precise frontend rendering
interface TokenDiffItem {
  type: 'added' | 'modified' | 'removed' | 'unchanged';
  text: string;
  startPos: number;
  endPos: number;
  originalText?: string;
  fixType?: string;
  changeId?: string;
}

// TTS Settings interface
interface TTSSettings {
  rate?: number; // Speech rate (-50 to +50 percentage)
  pitch?: number; // Speech pitch (-50 to +50 percentage)
  volume?: number; // Speech volume (0 to 100)
  [key: string]: unknown; // Allow additional provider-specific settings
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  /**
   * Maps service BulkFixSuggestion to DTO format
   */
  private mapBulkSuggestionsToDto(suggestions: ServiceBulkFixSuggestion[]): BulkFixSuggestionDto[] {
    return suggestions.map(suggestion => ({
      originalWord: suggestion.originalWord,
      correctedWord: suggestion.correctedWord,
      fixType: suggestion.fixType,
      paragraphIds: suggestion.paragraphs.map(p => p.id),
      count: suggestion.paragraphs.reduce((total, p) => total + p.occurrences, 0),
      previewBefore: suggestion.paragraphs[0]?.previewBefore || '',
      previewAfter: suggestion.paragraphs[0]?.previewAfter || '',
      occurrences: suggestion.paragraphs.map(p => ({
        paragraphId: p.id,
        previewBefore: p.previewBefore,
        previewAfter: p.previewAfter
      })),
      paragraphs: suggestion.paragraphs
    }));
  }


  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private textFixesService: TextFixesService,
    private s3Service: S3Service,
    private bulkTextFixesService: BulkTextFixesService
  ) {}

  async createBook(data: { 
    title: string; 
    author?: string; 
    s3Key: string;
    ttsModel?: string;
    ttsVoice?: string;
    ttsSettings?: TTSSettings;
  }) {
    return this.prisma.book.create({
      data: {
        title: data.title,
        author: data.author,
        s3Key: data.s3Key,
        status: BookStatus.UPLOADING,
        ttsModel: data.ttsModel || 'azure',
        ttsVoice: data.ttsVoice,
        ttsSettings: data.ttsSettings as Prisma.InputJsonValue,
      },
    });
  }

  async updateBookStatus(bookId: string, status: BookStatus) {
    return this.prisma.book.update({
      where: { id: bookId },
      data: { status },
    });
  }

  async updateParagraph(paragraphId: string, content: string, generateAudio = false, recordTextCorrections = true): Promise<UpdateParagraphResponseDto> {
    this.logger.log(`Attempting to update paragraph with ID: ${paragraphId}`);

    // First, get the existing paragraph to track changes
    const existingParagraph = await this.prisma.paragraph.findUnique({
      where: { id: paragraphId },
    });

    if (!existingParagraph) {
      this.logger.error(`Paragraph not found with ID: ${paragraphId}`);
      throw new Error(`Paragraph not found with ID: ${paragraphId}`);
    }

    // Track text changes if content is different AND recordTextCorrections is true
    let textChanges = [];
  
    if (existingParagraph.content !== content && recordTextCorrections) {
      this.logger.log(`Tracking text changes for paragraph ${paragraphId}`);
      textChanges = await this.textFixesService.processParagraphUpdate(
        paragraphId,
        existingParagraph.content,
        content
      );
      
      this.logger.log(
        `Detected ${textChanges.length} text changes for paragraph ${paragraphId}`
      );
    } else if (existingParagraph.content !== content && !recordTextCorrections) {
      this.logger.log(`Skipping text correction recording for paragraph ${paragraphId} (recordTextCorrections=false)`);
    }

    // Update the paragraph
    const paragraph = await this.prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        content,
      },
      include: {
        page: {
          include: {
            book: true,
          },
        },
        originalParagraph: {
          select: {
            content: true,
          },
        },
        textCorrections: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Include recent fixes
        },
      },
    });

    // Queue audio generation only if requested
    if (generateAudio) {
      // Update paragraph with audio generation timestamp
      await this.prisma.paragraph.update({
        where: { id: paragraphId },
        data: { audioGeneratedAt: new Date() }
      });
      
      await this.queueService.addAudioGenerationJob({
        paragraphId: paragraph.id,
        bookId: paragraph.page.bookId,
        content: paragraph.content,
      });
      
      this.logger.log(
        `Updated paragraph ${paragraphId}, tracked ${textChanges.length} changes, and queued audio generation for this paragraph`
      );
    } else {
      this.logger.log(
        `Updated paragraph ${paragraphId}, tracked ${textChanges.length} changes, audio generation skipped`
      );
    }

    // Generate bulk fix suggestions after saving the text (only if there were text changes)
    let mappedBulkSuggestions: BulkFixSuggestionDto[] = [];
    if (textChanges.length > 0) {
      // textChanges already have the correct WordChange format (including position property)
      const bulkSuggestions = await this.bulkTextFixesService.findSimilarFixesInBook(
        paragraph.page.bookId,
        paragraphId,
        textChanges
      );

      // Map service response to DTO format
      mappedBulkSuggestions = this.mapBulkSuggestionsToDto(bulkSuggestions);
    }

    return {
      ...paragraph,
      originalContent: paragraph.originalParagraph?.content,
      textChanges,
      textCorrections: paragraph.textCorrections,
      bulkSuggestions: mappedBulkSuggestions, // Include bulk fix suggestions in the response
    } as UpdateParagraphResponseDto;
  }

  async revertParagraph(paragraphId: string, generateAudio = false): Promise<UpdateParagraphResponseDto> {
    this.logger.log(`Attempting to revert paragraph with ID: ${paragraphId}`);

    // First, get the existing paragraph with its original content
    const existingParagraph = await this.prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: {
        originalParagraph: {
          select: {
            content: true,
          },
        },
        page: {
          include: {
            book: true,
          },
        },
      },
    });

    if (!existingParagraph) {
      this.logger.error(`Paragraph not found with ID: ${paragraphId}`);
      throw new Error(`Paragraph not found with ID: ${paragraphId}`);
    }

    if (!existingParagraph.originalParagraph?.content) {
      this.logger.error(`No original content found for paragraph: ${paragraphId}`);
      throw new Error(`No original content available for paragraph: ${paragraphId}`);
    }

    const originalContent = existingParagraph.originalParagraph.content;
    
    // Check if paragraph is already at original content
    if (existingParagraph.content === originalContent) {
      this.logger.log(`Paragraph ${paragraphId} is already at original content, but still clearing text corrections`);
    } else {
      this.logger.log(`Reverting paragraph ${paragraphId} content to original`);
    }

    // For reverts, we don't analyze text changes since this is not a text fixing action
    // Reverting is simply undoing changes, not making corrections
    const textChanges: WordChange[] = []; // Empty array since no text corrections should be recorded
  
    this.logger.log(
      `Reverting paragraph ${paragraphId} to original content (no text corrections recorded for revert action)`
    );

    // Clear all text correction records for this paragraph since we're starting fresh
    this.logger.log(
      `About to clear text correction records for paragraph ${paragraphId}`
    );
    
    const deletedCorrections = await this.prisma.textCorrection.deleteMany({
      where: { paragraphId }
    });
    
    this.logger.log(
      `Cleared ${deletedCorrections.count} text correction records for paragraph ${paragraphId}`
    );

    // Update the paragraph to original content
    const paragraph = await this.prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        content: originalContent,
      },
      include: {
        page: {
          include: {
            book: true,
          },
        },
        originalParagraph: {
          select: {
            content: true,
          },
        },
        // Don't include textCorrections since we just deleted them all
      },
    });

    // Queue audio generation if requested
    if (generateAudio) {
      // Update paragraph with audio generation timestamp
      await this.prisma.paragraph.update({
        where: { id: paragraphId },
        data: { audioGeneratedAt: new Date() }
      });
      
      await this.queueService.addAudioGenerationJob({
        paragraphId: paragraph.id,
        bookId: paragraph.page.bookId,
        content: paragraph.content,
      });
      
      this.logger.log(
        `Reverted paragraph ${paragraphId} to original content and queued audio generation`
      );
    } else {
      this.logger.log(
        `Reverted paragraph ${paragraphId} to original content, audio generation skipped`
      );
    }

    return {
      ...paragraph,
      originalContent: paragraph.originalParagraph?.content,
      textChanges,
      textFixes: [], // Empty array since we just deleted all corrections
      bulkSuggestions: [], // No bulk suggestions for reverts
    } as UpdateParagraphResponseDto;
  }

  async getParagraphDiff(paragraphId: string) {
    this.logger.log(`Getting diff for paragraph ${paragraphId}`);

    // Fetch the paragraph with original content and additional debug info
    const paragraph = await this.prisma.paragraph.findUnique({
      where: { id: paragraphId },
      select: {
        id: true,
        content: true,
        orderIndex: true,
        originalParagraphId: true,
        originalParagraph: {
          select: {
            id: true,
            content: true,
          },
        },
        page: {
          select: {
            id: true,
            pageNumber: true,
          },
        },
      },
    });

    if (!paragraph) {
      throw new Error(`Paragraph not found with ID: ${paragraphId}`);
    }

    if (!paragraph.originalParagraph?.content) {
      throw new Error(`No original content available for paragraph ${paragraphId}`);
    }

    // Debug logging to help identify paragraph drift issues
    const originalContent = paragraph.originalParagraph.content;
    const currentContent = paragraph.content;
    
    this.logger.log(`[DEBUG] Paragraph ${paragraphId} details:`);
    this.logger.log(`[DEBUG] - Page: ${paragraph.page?.pageNumber || 'unknown'} (ID: ${paragraph.page?.id || 'unknown'})`);
    this.logger.log(`[DEBUG] - Order Index: ${paragraph.orderIndex}`);
    this.logger.log(`[DEBUG] - Original Paragraph ID: ${paragraph.originalParagraph.id}`);
    this.logger.log(`[DEBUG] - Current content preview: "${currentContent.substring(0, 100)}${currentContent.length > 100 ? '...' : ''}"`);
    this.logger.log(`[DEBUG] - Original content preview: "${originalContent.substring(0, 100)}${originalContent.length > 100 ? '...' : ''}"`);
    this.logger.log(`[DEBUG] - Content lengths: current=${currentContent.length}, original=${originalContent.length}`);

    // Check if content is identical - no need for diff computation
    if (originalContent === currentContent) {
      this.logger.log(`Content is identical for paragraph ${paragraphId}, returning empty diff`);
      return {
        changes: [],
        originalContent,
        currentContent,
        tokenDiff: [], // No changes when content is identical
      };
    }

    // Use the existing text analysis service to compute the diff
    const changes = this.textFixesService.analyzeTextChanges(originalContent, currentContent);

    // Generate token-level diff information for accurate frontend rendering
    const tokenDiff = this.generateTokenDiff(originalContent, currentContent);

    this.logger.log(`Found ${changes.length} changes between original and current content for paragraph ${paragraphId}`);

    return {
      changes,
      originalContent,
      currentContent,
      tokenDiff, // New: precise token-level diff for frontend rendering
    };
  }

  /**
   * Generate token-level diff information for precise frontend rendering
   * Uses Myers algorithm to properly handle duplicate words and complex changes
   */
  private generateTokenDiff(originalContent: string, currentContent: string): TokenDiffItem[] {
    // Use the robust Myers algorithm from TextFixesService to get accurate word-level diff
    const wordLevelChanges = this.textFixesService.analyzeTextChanges(originalContent, currentContent);
    
    // Split both contents into tokens (words + whitespace)
    const originalTokens = originalContent.split(/(\s+)/);
    const currentTokens = currentContent.split(/(\s+)/);
    
    // Create maps for quick lookup of changes
    const changesByOriginal = new Map<string, WordChange>();
    const changesByCorrected = new Map<string, WordChange>();
    
    wordLevelChanges.forEach(change => {
      changesByOriginal.set(change.originalWord, change);
      changesByCorrected.set(change.correctedWord, change);
    });

    // Use Myers diff algorithm on token arrays to get precise diff
    const diff = require('diff');
    const tokenDiffs = diff.diffArrays(originalTokens, currentTokens);
    
    const result: TokenDiffItem[] = [];
    let charPosition = 0;
    
    // Process each diff part
    for (const part of tokenDiffs) {
      if (!part.added && !part.removed) {
        // Unchanged tokens
        for (const token of part.value || []) {
          result.push({
            type: 'unchanged',
            text: token,
            startPos: charPosition,
            endPos: charPosition + token.length,
          });
          charPosition += token.length;
        }
      } else if (part.removed) {
        // Removed tokens
        for (const token of part.value || []) {
          const isWhitespace = /^\s+$/.test(token);
          if (!isWhitespace) {
            // Check if this is part of a modification
            const change = changesByOriginal.get(token);
            if (change) {
              result.push({
                type: 'removed',
                text: token,
                startPos: charPosition,
                endPos: charPosition + token.length,
                fixType: 'deletion',
                changeId: `removed-${token}`,
              });
            } else {
              result.push({
                type: 'removed',
                text: token,
                startPos: charPosition,
                endPos: charPosition + token.length,
                fixType: 'deletion',
                changeId: `removed-${token}`,
              });
            }
          } else {
            // Removed whitespace
            result.push({
              type: 'removed',
              text: token,
              startPos: charPosition,
              endPos: charPosition + token.length,
              fixType: 'deletion',
              changeId: `removed-whitespace`,
            });
          }
          charPosition += token.length;
        }
      } else if (part.added) {
        // Added tokens
        for (const token of part.value || []) {
          const isWhitespace = /^\s+$/.test(token);
          if (!isWhitespace) {
            // Check if this is part of a modification
            const change = changesByCorrected.get(token);
            if (change) {
              result.push({
                type: 'modified',
                text: token,
                startPos: charPosition,
                endPos: charPosition + token.length,
                originalText: change.originalWord,
                fixType: change.fixType,
                changeId: `${change.originalWord}->${token}`,
              });
            } else {
              result.push({
                type: 'added',
                text: token,
                startPos: charPosition,
                endPos: charPosition + token.length,
                fixType: 'addition',
                changeId: `added-${token}`,
              });
            }
          } else {
            // Added whitespace
            result.push({
              type: 'added',
              text: token,
              startPos: charPosition,
              endPos: charPosition + token.length,
              fixType: 'addition',
              changeId: `added-whitespace`,
            });
          }
          charPosition += token.length;
        }
      }
    }
    
    return result;
  }

  async getBook(id: string, completedFilter?: 'all' | 'completed' | 'incomplete') {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            paragraphs: {
              orderBy: { orderIndex: 'asc' },
              include: {
                originalParagraph: {
                  select: {
                    content: true,
                  },
                },
                textCorrections: {
                  orderBy: { createdAt: 'desc' },
                  take: 5, // Include recent fixes for each paragraph
                },
              },
            },
          },
        },
      },
    });

    if (!book) {
      return null;
    }

    // Flatten paragraphs from all pages for frontend compatibility
    let paragraphs = book.pages.flatMap(page => 
      page.paragraphs.map(paragraph => ({
        ...paragraph,
        pageNumber: page.pageNumber,
        pageId: page.id,
        originalContent: paragraph.originalParagraph?.content,
      }))
    );

    // Apply completion status filter if specified
    if (completedFilter && completedFilter !== 'all') {
      const filterCompleted = completedFilter === 'completed';
      paragraphs = paragraphs.filter(paragraph => paragraph.completed === filterCompleted);
    }

    return {
      ...book,
      paragraphs, // Add flattened paragraphs array
    };
  }

  async getCompletedParagraphs(bookId: string) {
    this.logger.log(`🔍 Getting completed paragraphs for book: ${bookId}`);
    
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            paragraphs: {
              where: { completed: true }, // Only get completed paragraphs
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                content: true,
                orderIndex: true,
                audioStatus: true,
                audioDuration: true,
              },
            },
          },
        },
      },
    });

    if (!book) {
      this.logger.log(`📚 Book not found: ${bookId}`);
      return null;
    }

    // Transform data to the expected format
    const pages = book.pages
      .filter(page => page.paragraphs.length > 0) // Only include pages with completed paragraphs
      .map(page => ({
        pageId: page.id,
        pageNumber: page.pageNumber,
        completedParagraphs: page.paragraphs,
      }));

    const totalCompletedParagraphs = pages.reduce(
      (total, page) => total + page.completedParagraphs.length,
      0
    );

    this.logger.log(`✅ Found ${totalCompletedParagraphs} completed paragraphs across ${pages.length} pages for book: ${bookId}`);

    return {
      bookId: book.id,
      bookTitle: book.title,
      pages,
      totalCompletedParagraphs,
    };
  }

  async getAllBooks() {
    return this.prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { 
            pages: true,
            textCorrections: true,
          },
        },
      },
    });
  }

  async getParagraph(paragraphId: string) {
    return this.prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: {
        page: {
          include: {
            book: true,
          },
        },
        textCorrections: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async setParagraphCompleted(paragraphId: string, completed: boolean) {
    this.logger.log(`Setting paragraph ${paragraphId} completed status to: ${completed}`);
    
    // First check if paragraph exists
    const existingParagraph = await this.prisma.paragraph.findUnique({
      where: { id: paragraphId },
    });

    if (!existingParagraph) {
      this.logger.error(`Paragraph not found with ID: ${paragraphId}`);
      throw new Error(`Paragraph not found with ID: ${paragraphId}`);
    }

    // Update the completed status
    const updatedParagraph = await this.prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        completed,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Successfully updated paragraph ${paragraphId} completed status to: ${completed}`);
    
    return updatedParagraph;
  }

  // New methods for text fixes functionality

  async getParagraphTextFixes(paragraphId: string) {
    return this.textFixesService.getParagraphFixes(paragraphId);
  }

  async getBookTextFixes(bookId: string) {
    return this.textFixesService.getBookFixes(bookId);
  }

  async getTextFixesStatistics() {
    return this.textFixesService.getFixesStatistics();
  }

  async findSimilarFixes(originalWord: string, limit = 10) {
    return this.textFixesService.findSimilarFixes(originalWord, limit);
  }

  // Get all unique word fixes across the system
  async getAllWordFixes() {
    const fixes = await this.prisma.textCorrection.findMany({
      include: {
        book: {
          select: {
            id: true,
            title: true,
          },
        },
        paragraph: {
          select: {
            id: true,
            content: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return fixes.map(fix => ({
      id: fix.id,
      originalWord: fix.originalWord,
      correctedWord: fix.correctedWord,
      fixType: fix.fixType,
      createdAt: fix.createdAt,
      paragraph: {
        id: fix.paragraph.id,
        content: fix.paragraph.content,
        book: fix.book,
      },
    }));
  }



  async deleteBook(bookId: string): Promise<void> {
    this.logger.log(`🗑️ Starting deletion of book: ${bookId}`);

    try {
      // First, get the book with all related data to collect S3 keys
      const book = await this.prisma.book.findUnique({
        where: { id: bookId },
        include: {
          pages: {
            include: {
              paragraphs: {
                select: {
                  audioS3Key: true,
                },
              },
            },
          },
        },
      });

      if (!book) {
        this.logger.error(`Book not found: ${bookId}`);
        throw new Error(`Book not found: ${bookId}`);
      }

      this.logger.log(`📚 Found book "${book.title}" with ${book.pages.length} pages`);

      // Collect all S3 keys that need to be deleted
      const s3KeysToDelete: string[] = [];
      
      // Add the original EPUB file
      if (book.s3Key) {
        s3KeysToDelete.push(book.s3Key);
      }
      
      // Add page-level audio files
      book.pages.forEach(page => {
        if (page.audioS3Key) {
          s3KeysToDelete.push(page.audioS3Key);
        }
        
        // Add paragraph-level audio files
        page.paragraphs.forEach(paragraph => {
          if (paragraph.audioS3Key) {
            s3KeysToDelete.push(paragraph.audioS3Key);
          }
        });
      });

      this.logger.log(`🗂️ Found ${s3KeysToDelete.length} S3 files to delete`);

      // Delete the book from database (cascade will handle related entities)
      await this.prisma.book.delete({
        where: { id: bookId },
      });

      this.logger.log(`✅ Book deleted from database: ${bookId}`);
      this.logger.log(`📊 Cascade deletion will remove:`);
      this.logger.log(`   - ${book.pages.length} pages`);
      this.logger.log(`   - ${book.pages.reduce((sum, page) => sum + page.paragraphs.length, 0)} paragraphs`);
      this.logger.log(`   - All related text corrections`);

      // Delete S3 files (always call deleteFiles for consistency)
      this.logger.log(`🗑️ Deleting ${s3KeysToDelete.length} files from S3...`);
      await this.s3Service.deleteFiles(s3KeysToDelete);
      if (s3KeysToDelete.length > 0) {
        this.logger.log(`✅ S3 cleanup completed`);
      } else {
        this.logger.log(`ℹ️ No S3 files to delete`);
      }

      this.logger.log(`🎉 Book deletion completed successfully: ${bookId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to delete book ${bookId}:`, error.message);
      throw error;
    }
  }

  /**
   * Add Hebrew diacritics to book paragraphs
   */
  async addDiacriticsToBook(bookId: string, paragraphIds?: string[]) {
    this.logger.log(`🔤 Starting diacritics processing for book ${bookId}`, {
      paragraphIds: paragraphIds?.length || 'all paragraphs',
    });

    try {
      // Verify book exists
      const book = await this.prisma.book.findUnique({
        where: { id: bookId },
        select: { id: true, title: true, status: true },
      });

      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      // Check if there are paragraphs to process
      const whereClause = {
        bookId,
        ...(paragraphIds && { id: { in: paragraphIds } }),
      };

      const paragraphCount = await this.prisma.paragraph.count({
        where: whereClause,
      });

      if (paragraphCount === 0) {
        this.logger.log(`ℹ️ No paragraphs found to process for diacritics in book ${bookId}`);
        return { message: 'No paragraphs found for diacritics processing', paragraphCount: 0 };
      }

      // Add diacritics processing job to queue
      const jobResult = await this.queueService.addDiacriticsProcessingJob({
        bookId,
        paragraphIds,
      });

      this.logger.log(
        `🔤 Diacritics processing job queued for book ${bookId}`,
        {
          jobId: jobResult.jobId,
          paragraphCount,
          bookTitle: book.title,
        }
      );

      return {
        message: 'Diacritics processing job queued successfully',
        jobId: jobResult.jobId,
        paragraphCount,
        bookTitle: book.title,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to queue diacritics processing for book ${bookId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get paragraph count for a book (simplified since we modify content directly)
   */
  async getDiacriticsStatus(bookId: string) {
    this.logger.log(`📊 Getting paragraph count for book ${bookId}`);

    try {
      const totalParagraphs = await this.prisma.paragraph.count({
        where: { bookId },
      });

      return {
        bookId,
        totalParagraphs,
        message: 'Diacritics processing modifies content directly - no separate tracking needed',
      };
    } catch (error) {
      this.logger.error(`❌ Failed to get paragraph count for book ${bookId}:`, error.message);
      throw error;
    }
  }
}