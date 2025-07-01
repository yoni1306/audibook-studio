import { PrismaClient, BookStatus } from '@prisma/client';
import { createLogger } from '@audibook/logger';

const logger = createLogger('DatabaseService');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export interface ParagraphData {
  pageId: string;
  orderIndex: number;
  content: string;
}

/**
 * Save paragraphs in batches to avoid overwhelming the database
 */
export async function saveParagraphs(
  bookId: string,
  paragraphs: ParagraphData[]
): Promise<void> {
  if (paragraphs.length === 0) {
    logger.warn(`No paragraphs to save for book ${bookId}`);
    return;
  }

  try {
    logger.info(`Saving ${paragraphs.length} paragraphs for book ${bookId}`);

    // Save in batches to avoid overwhelming the database
    const batchSize = 100;
    const totalBatches = Math.ceil(paragraphs.length / batchSize);

    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;

      logger.debug(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} paragraphs)`);

      await prisma.paragraph.createMany({
        data: batch.map((p) => ({
          bookId,
          pageId: p.pageId,
          orderIndex: p.orderIndex,
          content: p.content,
        })),
        skipDuplicates: true, // Skip duplicates to handle retries
      });

      logger.debug(`Completed batch ${currentBatch}/${totalBatches}`);
    }

    logger.info(`Successfully saved all paragraphs for book ${bookId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save paragraphs for book ${bookId}: ${errorMessage}`, {
      bookId,
      paragraphCount: paragraphs.length,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Update book status with proper error handling
 */
export async function updateBookStatus(
  bookId: string, 
  status: BookStatus
): Promise<void> {
  try {
    logger.debug(`Updating book ${bookId} status to ${status}`);

    await prisma.book.update({
      where: { id: bookId },
      data: { status },
    });

    logger.info(`Updated book ${bookId} status to ${status}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to update book status for ${bookId}: ${errorMessage}`, {
      bookId,
      targetStatus: status,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Get paragraph with related page and book data
 */
export async function getParagraph(paragraphId: string) {
  try {
    logger.debug(`Fetching paragraph ${paragraphId}`);

    const paragraph = await prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: { 
        page: {
          include: {
            book: true
          }
        }
      },
    });

    if (!paragraph) {
      logger.warn(`Paragraph ${paragraphId} not found`);
      return null;
    }

    logger.debug(`Successfully fetched paragraph ${paragraphId}`);
    return paragraph;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get paragraph ${paragraphId}: ${errorMessage}`, {
      paragraphId,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Initialize database connection with proper error handling
 */
async function initializeDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Successfully connected to database');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to connect to database: ${errorMessage}`, {
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Cleanup database connections
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    logger.info('Closing database connection...');
    await prisma.$disconnect();
    logger.info('Database connection closed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error closing database connection: ${errorMessage}`);
    throw error;
  }
}

// Initialize connection
initializeDatabase().catch((error) => {
  logger.error('Database initialization failed:', error);
  process.exit(1);
});

export { prisma };
