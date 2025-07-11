import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookStatus } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { TextFixesService } from './text-fixes.service';
import { UpdateParagraphResponseDto } from './dto/paragraph-update.dto';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private textFixesService: TextFixesService
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

  async updateParagraph(paragraphId: string, content: string, generateAudio = false): Promise<UpdateParagraphResponseDto> {
    this.logger.log(`Attempting to update paragraph with ID: ${paragraphId}`);

    // First, get the existing paragraph to track changes
    const existingParagraph = await this.prisma.paragraph.findUnique({
      where: { id: paragraphId },
    });

    if (!existingParagraph) {
      this.logger.error(`Paragraph not found with ID: ${paragraphId}`);
      throw new Error(`Paragraph not found with ID: ${paragraphId}`);
    }

    // Track text changes if content is different
    let textChanges = [];
    if (existingParagraph.content !== content) {
      this.logger.log(`Tracking text changes for paragraph ${paragraphId}`);
      textChanges = await this.textFixesService.processParagraphUpdate(
        paragraphId,
        existingParagraph.content,
        content
      );
      
      // Log all text changes for debugging
      this.logger.debug('=== TEXT CHANGES DEBUG ===');
      this.logger.debug(`Paragraph ID: ${paragraphId}`);
      this.logger.debug(`Original content: ${existingParagraph.content}`);
      this.logger.debug(`New content: ${content}`);
      this.logger.debug(`Number of changes: ${textChanges.length}`);
      this.logger.debug(`Text changes: ${JSON.stringify(textChanges, null, 2)}`);
      this.logger.debug('=== END TEXT CHANGES DEBUG ===');
      
      this.logger.log(
        `Detected ${textChanges.length} text changes for paragraph ${paragraphId}`
      );
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
        textCorrections: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Include recent fixes
        },
      },
    });

    // Queue audio generation only if requested
    if (generateAudio) {
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

    return {
      ...paragraph,
      textChanges, // Include the changes in the response
    } as UpdateParagraphResponseDto;
  }

  async getBook(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            paragraphs: {
              orderBy: { orderIndex: 'asc' },
              include: {
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
    const paragraphs = book.pages.flatMap(page => 
      page.paragraphs.map(paragraph => ({
        ...paragraph,
        pageNumber: page.pageNumber,
        pageId: page.id,
      }))
    );

    return {
      ...book,
      paragraphs, // Add flattened paragraphs array
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
}