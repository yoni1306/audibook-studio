import { AudioStatus } from '@prisma/client';
import { createLogger } from '@audibook/logger';
import { ParsedPage } from './text-processing/page-based-epub-parser';
import { prisma } from './database.service';

const logger = createLogger('PageBasedDatabaseService');

export interface BookMetadata {
  totalPages: number;
  totalParagraphs: number;
  averageParagraphsPerPage: number;
  processingInfo?: any;
}

/**
 * Save pages and their paragraphs in a transaction
 */
export async function savePages(
  bookId: string,
  pages: ParsedPage[]
): Promise<void> {
  if (pages.length === 0) {
    logger.warn(`No pages to save for book ${bookId}`);
    return;
  }

  try {
    logger.info(`Saving ${pages.length} pages for book ${bookId}`);

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // First, delete any existing data for this book to avoid unique constraint violations
      logger.debug(`Clearing existing data for book ${bookId}`);
      await tx.paragraph.deleteMany({
        where: { bookId }
      });
      await tx.page.deleteMany({
        where: { bookId }
      });
      logger.debug(`Existing data cleared for book ${bookId}`);

      for (const page of pages) {
        logger.debug(`Saving page ${page.pageNumber} with ${page.paragraphs.length} paragraphs`);

        // Create the page
        const createdPage = await tx.page.create({
          data: {
            bookId,
            pageNumber: page.pageNumber,
            sourceChapter: page.sourceChapter,
            startPosition: page.startPosition,
            endPosition: page.endPosition,
            pageBreakInfo: page.pageBreakInfo ? JSON.stringify(page.pageBreakInfo) : null,
            audioStatus: AudioStatus.PENDING,
          },
        });

        // Create paragraphs for this page
        if (page.paragraphs.length > 0) {
          // First create original paragraphs and then current paragraphs that reference them
          const paragraphsWithOriginals = await Promise.all(
            page.paragraphs.map(async (p) => {
              // Create original paragraph
              const originalParagraph = await tx.originalParagraph.create({
                data: {
                  pageId: createdPage.id,
                  content: p.content,
                },
              });

              // Return data for current paragraph creation
              return {
                pageId: createdPage.id,
                bookId,
                orderIndex: p.orderIndex,
                content: p.content,
                originalParagraphId: originalParagraph.id,
              };
            })
          );

          // Create current paragraphs
          await tx.paragraph.createMany({
            data: paragraphsWithOriginals,
            skipDuplicates: true,
          });
        }
      }
    });

    logger.info(`Successfully saved all pages for book ${bookId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save pages for book ${bookId}: ${errorMessage}`, {
      bookId,
      pageCount: pages.length,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Save book metadata with processing information
 */
export async function saveBookMetadata(
  bookId: string,
  metadata: BookMetadata
): Promise<void> {
  try {
    logger.info(`Saving metadata for book ${bookId}`, metadata);

    await prisma.book.update({
      where: { id: bookId },
      data: {
        totalPages: metadata.totalPages,
        totalParagraphs: metadata.totalParagraphs,
        processingMetadata: JSON.stringify({
          averageParagraphsPerPage: metadata.averageParagraphsPerPage,
          processingInfo: metadata.processingInfo,
          processedAt: new Date().toISOString(),
        }),
      },
    });

    logger.info(`Successfully saved metadata for book ${bookId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save book metadata for ${bookId}: ${errorMessage}`, {
      bookId,
      metadata,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Get book with all pages and paragraphs
 */
export async function getBookWithPages(bookId: string) {
  try {
    logger.debug(`Fetching book ${bookId} with pages`);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            paragraphs: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!book) {
      logger.warn(`Book ${bookId} not found`);
      return null;
    }

    logger.debug(`Successfully fetched book ${bookId} with ${book.pages.length} pages`);
    return book;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get book with pages for ${bookId}: ${errorMessage}`, {
      bookId,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Get a single page with its paragraphs
 */
export async function getPage(pageId: string) {
  try {
    logger.debug(`Fetching page ${pageId}`);

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: {
        paragraphs: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!page) {
      logger.warn(`Page ${pageId} not found`);
      return null;
    }

    logger.debug(`Successfully fetched page ${pageId} with ${page.paragraphs.length} paragraphs`);
    return page;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get page ${pageId}: ${errorMessage}`, {
      pageId,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Update page audio status and metadata
 */
export async function updatePageAudioStatus(
  pageId: string,
  status: AudioStatus,
  audioS3Key?: string,
  audioDuration?: number
): Promise<void> {
  try {
    logger.debug(`Updating page ${pageId} audio status to ${status}`);

    await prisma.page.update({
      where: { id: pageId },
      data: {
        audioStatus: status,
        audioS3Key,
        audioDuration,
      },
    });

    logger.info(`Updated page ${pageId} audio status to ${status}`, {
      pageId,
      status,
      audioS3Key,
      audioDuration
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to update page audio status for ${pageId}: ${errorMessage}`, {
      pageId,
      targetStatus: status,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Update paragraph audio status and metadata
 */
export async function updateParagraphAudioStatus(
  paragraphId: string,
  status: AudioStatus,
  audioS3Key?: string,
  audioDuration?: number
): Promise<void> {
  try {
    logger.debug(`Updating paragraph ${paragraphId} audio status to ${status}`);

    await prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        audioStatus: status,
        audioS3Key,
        audioDuration,
      },
    });

    logger.info(`Updated paragraph ${paragraphId} audio status to ${status}`, {
      paragraphId,
      status,
      audioS3Key,
      audioDuration
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to update paragraph audio status for ${paragraphId}: ${errorMessage}`, {
      paragraphId,
      targetStatus: status,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Get pages that need audio generation
 */
export async function getPagesForAudioGeneration(bookId: string) {
  try {
    logger.debug(`Fetching pages for audio generation for book ${bookId}`);

    const pages = await prisma.page.findMany({
      where: {
        bookId,
        audioStatus: AudioStatus.PENDING,
      },
      include: {
        paragraphs: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { pageNumber: 'asc' },
    });

    logger.info(`Found ${pages.length} pages pending audio generation for book ${bookId}`);
    return pages;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get pages for audio generation for ${bookId}: ${errorMessage}`, {
      bookId,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Get comprehensive book statistics
 */
export async function getBookStatistics(bookId: string) {
  try {
    logger.debug(`Fetching statistics for book ${bookId}`);

    const [book, totalParagraphs, audioStats, pageStats] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        include: {
          _count: {
            select: {
              pages: true,
            },
          },
        },
      }),
      prisma.paragraph.count({
        where: { bookId },
      }),
      prisma.page.groupBy({
        by: ['audioStatus'],
        where: { bookId },
        _count: {
          audioStatus: true,
        },
      }),
      prisma.page.findMany({
        where: { bookId },
        select: {
          pageNumber: true,
          sourceChapter: true,
          audioStatus: true,
          audioDuration: true,
          _count: {
            select: {
              paragraphs: true,
            },
          },
        },
        orderBy: { pageNumber: 'asc' },
      })
    ]);

    if (!book) {
      logger.warn(`Book ${bookId} not found for statistics`);
      return null;
    }

    const statistics = {
      book,
      totalPages: book._count.pages,
      totalParagraphs,
      audioStats: audioStats.map(s => ({
        status: s.audioStatus,
        count: s._count.audioStatus,
      })),
      pageStats,
    };

    logger.debug(`Successfully fetched statistics for book ${bookId}`, {
      totalPages: statistics.totalPages,
      totalParagraphs: statistics.totalParagraphs,
      audioStatsCount: statistics.audioStats.length
    });

    return statistics;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get book statistics for ${bookId}: ${errorMessage}`, {
      bookId,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Combined function for saving complete EPUB parse result
 */
export async function saveEPUBParseResult(
  bookId: string,
  pages: ParsedPage[],
  metadata: BookMetadata
): Promise<void> {
  try {
    logger.info(`Starting page-based save operation for book ${bookId}`, {
      pages: pages.length,
      metadata,
    });

    // Use transaction to ensure data consistency
    await prisma.$transaction(async () => {
      // Save pages and paragraphs
      await savePages(bookId, pages);
      
      // Save metadata
      await saveBookMetadata(bookId, metadata);
    });

    logger.info(`Page-based save operation completed successfully for book ${bookId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Page-based save operation failed for book ${bookId}: ${errorMessage}`, {
      bookId,
      pageCount: pages.length,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Helper function to get page content for audio generation
 */
export function getPageContentForAudio(page: any): string {
  if (!page?.paragraphs || page.paragraphs.length === 0) {
    return '';
  }

  return page.paragraphs
    .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
    .map((p: any) => p.content)
    .join('\n\n');
}

// Re-export existing functions for backward compatibility
export { updateBookStatus } from './database.service';
