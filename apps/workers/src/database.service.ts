import { PrismaClient, BookStatus } from '@prisma/client';
import { createLogger } from '@audibook/logger';

const logger = createLogger('DatabaseService');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
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
 * Update book metadata with extracted EPUB information
 */
export async function updateBookMetadata(
  bookId: string,
  metadata: {
    title?: string;
    author?: string;
    language?: string;
    publisher?: string;
    description?: string;
  }
): Promise<void> {
  try {
    logger.info(`Updating book metadata for ${bookId}`, {
      title: metadata.title ? `"${metadata.title}"` : 'Not provided',
      author: metadata.author ? `"${metadata.author}"` : 'Not provided',
      language: metadata.language || 'Not provided',
      publisher: metadata.publisher ? `"${metadata.publisher}"` : 'Not provided'
    });

    // Only update fields that are provided and not empty
    const updateData: Record<string, string> = {};
    
    if (metadata.title && metadata.title.trim()) {
      updateData.title = metadata.title.trim();
    }
    
    if (metadata.author && metadata.author.trim()) {
      updateData.author = metadata.author.trim();
    }
    
    if (metadata.language && metadata.language.trim()) {
      updateData.language = metadata.language.trim();
    }
    
    if (metadata.publisher && metadata.publisher.trim()) {
      updateData.publisher = metadata.publisher.trim();
    }
    
    if (metadata.description && metadata.description.trim()) {
      updateData.description = metadata.description.trim();
    }

    // Only perform update if there's data to update
    if (Object.keys(updateData).length > 0) {
      await prisma.book.update({
        where: { id: bookId },
        data: updateData,
      });

      logger.info(`Successfully updated book metadata for ${bookId}`, {
        updatedFields: Object.keys(updateData),
        title: updateData.title,
        author: updateData.author
      });
    } else {
      logger.info(`No metadata to update for book ${bookId} - all fields were empty`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to update book metadata for ${bookId}: ${errorMessage}`, {
      bookId,
      metadata,
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
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Database health check failed: ${errorMessage}`);
    return false;
  }
}

/**
 * Get book metadata
 */
export async function getBookMetadata(bookId: string) {
  try {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { processingMetadata: true }
    });
    return book;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching book metadata for ${bookId}: ${errorMessage}`);
    throw error;
  }
}

/**
 * Disconnect database
 */
export async function disconnectDatabase() {
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
