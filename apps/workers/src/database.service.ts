import { PrismaClient, BookStatus, AudioStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';

const logger = new Logger('DatabaseService');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export async function saveParagraphs(
  bookId: string,
  paragraphs: Array<{
    chapterNumber: number;
    orderIndex: number;
    content: string;
  }>
) {
  try {
    logger.log(`Saving ${paragraphs.length} paragraphs for book ${bookId}`);

    // Save in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize);

      await prisma.paragraph.createMany({
        data: batch.map((p) => ({
          bookId,
          chapterNumber: p.chapterNumber,
          orderIndex: p.orderIndex,
          content: p.content,
          audioStatus: AudioStatus.PENDING,
        })),
      });

      logger.log(
        `Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          paragraphs.length / batchSize
        )}`
      );
    }

    logger.log(`Successfully saved all paragraphs for book ${bookId}`);
  } catch (error) {
    logger.error(`Failed to save paragraphs: ${error}`);
    throw error;
  }
}

export async function updateBookStatus(bookId: string, status: BookStatus) {
  try {
    await prisma.book.update({
      where: { id: bookId },
      data: { status },
    });
    logger.log(`Updated book ${bookId} status to ${status}`);
  } catch (error) {
    logger.error(`Failed to update book status: ${error}`);
    throw error;
  }
}

export async function updateParagraphAudio(
  paragraphId: string,
  audioS3Key: string,
  audioDuration: number
) {
  try {
    await prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        audioS3Key,
        audioDuration,
        audioStatus: AudioStatus.READY,
      },
    });
    logger.log(`Updated paragraph ${paragraphId} with audio`);
  } catch (error) {
    logger.error(`Failed to update paragraph audio: ${error}`);
    throw error;
  }
}

export async function getParagraph(paragraphId: string) {
  try {
    return await prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: { book: true },
    });
  } catch (error) {
    logger.error(`Failed to get paragraph: ${error}`);
    throw error;
  }
}

export async function getBook(bookId: string) {
  try {
    return await prisma.book.findUnique({
      where: { id: bookId },
    });
  } catch (error) {
    logger.error(`Failed to get book: ${error}`);
    throw error;
  }
}

export async function updateParagraphAudioError(paragraphId: string) {
  try {
    await prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        audioStatus: AudioStatus.ERROR,
      },
    });
  } catch (error) {
    logger.error(`Failed to update paragraph audio error: ${error}`);
  }
}

export async function updateParagraphStatus(
  paragraphId: string,
  status: AudioStatus
) {
  try {
    await prisma.paragraph.update({
      where: { id: paragraphId },
      data: { audioStatus: status },
    });
    logger.log(`Updated paragraph ${paragraphId} audio status to ${status}`);
  } catch (error) {
    logger.error(`Failed to update paragraph status: ${error}`);
    throw error;
  }
}

// Initialize connection
prisma
  .$connect()
  .then(() => {
    logger.log('Connected to database');
  })
  .catch((error) => {
    logger.error('Failed to connect to database:', error);
  });

export { prisma };
