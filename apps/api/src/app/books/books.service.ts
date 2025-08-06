import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookStatus } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { TextFixesService, WordChange } from './text-fixes.service';
import { UpdateParagraphResponseDto, BulkFixSuggestion as BulkFixSuggestionDto } from './dto/paragraph-update.dto';
import { S3Service } from '../s3/s3.service';
import { BulkTextFixesService, BulkFixSuggestion as ServiceBulkFixSuggestion } from './bulk-text-fixes.service';

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

  async createBook(data: { title: string; author?: string; s3Key: string }) {
    return this.prisma.book.create({
      data: {
        title: data.title,
        author: data.author,
        s3Key: data.s3Key,
        status: BookStatus.UPLOADING,
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
      this.logger.log(`Paragraph ${paragraphId} is already at original content`);
      
      // Still return the paragraph data for consistency
      const paragraph = await this.prisma.paragraph.findUnique({
        where: { id: paragraphId },
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
            take: 10,
          },
        },
      });

      if (!paragraph) {
        throw new Error(`Failed to retrieve paragraph data: ${paragraphId}`);
      }

      return {
        ...paragraph,
        originalContent: paragraph.originalParagraph?.content,
        textChanges: [],
        textCorrections: paragraph.textCorrections,
        bulkSuggestions: [],
      } as UpdateParagraphResponseDto;
    }

    // For reverts, we don't analyze text changes since this is not a text fixing action
    // Reverting is simply undoing changes, not making corrections
    const textChanges: WordChange[] = []; // Empty array since no text corrections should be recorded
  
    this.logger.log(
      `Reverting paragraph ${paragraphId} to original content (no text corrections recorded for revert action)`
    );

    // Clear all text correction records for this paragraph since we're starting fresh
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
        textCorrections: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
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
      textCorrections: paragraph.textCorrections,
      bulkSuggestions: [], // No bulk suggestions for reverts
    } as UpdateParagraphResponseDto;
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
}