import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { S3Service } from '../s3/s3.service';
import { BookExportStatusDto, StartBookExportResponseDto, PageExportStatusDto } from './dto/book-export.dto';

@Injectable()
export class BooksExportService {
  private readonly logger = new Logger(BooksExportService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private s3Service: S3Service
  ) {}

  /**
   * Get the export status for a book
   */
  async getBookExportStatus(bookId: string): Promise<BookExportStatusDto> {
    this.logger.log(`📊 Getting export status for book: ${bookId}`);

    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        pages: {
          include: {
            paragraphs: {
              select: {
                id: true,
                completed: true,
                audioStatus: true,
                audioDuration: true,
              },
            },
          },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    if (!book) {
      throw new Error(`Book not found: ${bookId}`);
    }

    const pages: PageExportStatusDto[] = book.pages.map(page => {
      const completedParagraphs = page.paragraphs.filter(p => p.completed);
      const totalParagraphs = page.paragraphs.length;
      const willBeExported = completedParagraphs.length > 0;

      return {
        id: page.id,
        pageNumber: page.pageNumber,
        completedParagraphsCount: completedParagraphs.length,
        totalParagraphsCount: totalParagraphs,
        audioStatus: page.audioStatus,
        audioDuration: page.audioDuration,
        audioS3Key: page.audioS3Key,
        willBeExported,
      };
    });

    const exportablePages = pages.filter(p => p.willBeExported);
    const pagesInProgress = exportablePages.filter(p => p.audioStatus === 'GENERATING').length;
    const pagesReady = exportablePages.filter(p => p.audioStatus === 'READY').length;
    const pagesWithErrors = exportablePages.filter(p => p.audioStatus === 'ERROR').length;

    let exportStatus: 'not_started' | 'in_progress' | 'completed' | 'partial_errors' | 'failed';
    if (exportablePages.length === 0) {
      exportStatus = 'not_started';
    } else if (pagesWithErrors === exportablePages.length) {
      exportStatus = 'failed';
    } else if (pagesReady === exportablePages.length) {
      exportStatus = 'completed';
    } else if (pagesWithErrors > 0) {
      exportStatus = 'partial_errors';
    } else {
      exportStatus = 'in_progress';
    }

    const totalDuration = pages
      .filter(p => p.willBeExported && p.audioDuration)
      .reduce((sum, p) => sum + (p.audioDuration || 0), 0);

    return {
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      totalPages: book.pages.length,
      exportablePages: exportablePages.length,
      pagesInProgress,
      pagesReady,
      pagesWithErrors,
      exportStatus,
      pages,
      totalDuration: totalDuration > 0 ? totalDuration : undefined,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Start the export process for a book
   */
  async startBookExport(bookId: string): Promise<StartBookExportResponseDto> {
    this.logger.log(`🚀 Starting export for book: ${bookId}`);

    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        pages: {
          include: {
            paragraphs: {
              select: {
                id: true,
                completed: true,
                audioStatus: true,
                audioS3Key: true,
              },
            },
          },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    if (!book) {
      throw new Error(`Book not found: ${bookId}`);
    }

    const jobIds: string[] = [];
    let pagesQueued = 0;
    let pagesSkipped = 0;

    for (const page of book.pages) {
      const completedParagraphs = page.paragraphs.filter(p => p.completed);
      
      if (completedParagraphs.length === 0) {
        pagesSkipped++;
        this.logger.log(`⏭️ Skipping page ${page.pageNumber} - no completed paragraphs`);
        continue;
      }

      // Check if all completed paragraphs have audio ready
      const paragraphsWithAudio = completedParagraphs.filter(
        p => p.audioStatus === 'READY' && p.audioS3Key
      );

      if (paragraphsWithAudio.length !== completedParagraphs.length) {
        this.logger.log(
          `⚠️ Page ${page.pageNumber} has ${completedParagraphs.length} completed paragraphs but only ${paragraphsWithAudio.length} have ready audio. Skipping.`
        );
        pagesSkipped++;
        continue;
      }

      // Queue the page audio combination job
      const result = await this.queueService.addPageAudioCombinationJob({
        pageId: page.id,
        bookId: book.id,
      });

      jobIds.push(result.jobId);
      pagesQueued++;

      // Update page status to GENERATING
      await this.prisma.page.update({
        where: { id: page.id },
        data: { audioStatus: 'GENERATING' },
      });

      this.logger.log(`✅ Queued audio combination for page ${page.pageNumber}`);
    }

    const message = pagesQueued > 0 
      ? `Book export started successfully. ${pagesQueued} pages will be processed.`
      : 'No pages available for export. All pages either have no completed paragraphs or missing audio.';

    this.logger.log(`📊 Export summary: ${pagesQueued} queued, ${pagesSkipped} skipped`);

    return {
      success: pagesQueued > 0,
      message,
      pagesQueued,
      pagesSkipped,
      jobIds,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Start export for a specific page
   */
  async startPageExport(bookId: string, pageId: string): Promise<StartBookExportResponseDto> {
    this.logger.log(`🚀 Starting export for page: ${pageId} in book: ${bookId}`);

    const page = await this.prisma.page.findUnique({
      where: { id: pageId, bookId },
      include: {
        paragraphs: {
          select: {
            id: true,
            completed: true,
            audioStatus: true,
            audioS3Key: true,
          },
        },
      },
    });

    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const completedParagraphs = page.paragraphs.filter(p => p.completed);
    
    if (completedParagraphs.length === 0) {
      return {
        success: false,
        message: 'Page has no completed paragraphs to export.',
        pagesQueued: 0,
        pagesSkipped: 1,
        jobIds: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Check if all completed paragraphs have audio ready
    const paragraphsWithAudio = completedParagraphs.filter(
      p => p.audioStatus === 'READY' && p.audioS3Key
    );

    if (paragraphsWithAudio.length !== completedParagraphs.length) {
      return {
        success: false,
        message: `Page has ${completedParagraphs.length} completed paragraphs but only ${paragraphsWithAudio.length} have ready audio.`,
        pagesQueued: 0,
        pagesSkipped: 1,
        jobIds: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Queue the page audio combination job
    const result = await this.queueService.addPageAudioCombinationJob({
      pageId: page.id,
      bookId,
    });

    // Update page status to GENERATING
    await this.prisma.page.update({
      where: { id: page.id },
      data: { audioStatus: 'GENERATING' },
    });

    this.logger.log(`✅ Queued audio combination for page ${page.pageNumber}`);

    return {
      success: true,
      message: `Page ${page.pageNumber} export started successfully.`,
      pagesQueued: 1,
      pagesSkipped: 0,
      jobIds: [result.jobId],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Delete exported audio for a specific page
   */
  async deletePageAudio(bookId: string, pageId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🗑️ Deleting exported audio for page: ${pageId} in book: ${bookId}`);

    const page = await this.prisma.page.findUnique({
      where: { id: pageId, bookId },
      select: {
        id: true,
        pageNumber: true,
        audioS3Key: true,
        audioStatus: true,
      },
    });

    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    if (!page.audioS3Key) {
      return {
        success: false,
        message: `Page ${page.pageNumber} has no exported audio to delete.`,
      };
    }

    try {
      // Delete the audio file from S3 and update database
      await this.prisma.$transaction(async (tx) => {
        // First update the database
        await tx.page.update({
          where: { id: page.id },
          data: {
            audioS3Key: null,
            audioStatus: null,
            audioDuration: null,
          },
        });

        // Then delete from S3
        if (page.audioS3Key) {
          await this.s3Service.deleteFiles([page.audioS3Key]);
        }
      });

      this.logger.log(`✅ Successfully deleted exported audio for page ${page.pageNumber}`);
      
      return {
        success: true,
        message: `Exported audio for page ${page.pageNumber} has been deleted.`,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to delete exported audio for page ${pageId}:`, error);
      throw new Error('Failed to delete page audio');
    }
  }
}
