import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookStatus } from '@prisma/client';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService
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

  async updateParagraph(paragraphId: string, content: string) {
    this.logger.log(`Attempting to update paragraph with ID: ${paragraphId}`);

    // First, check if the paragraph exists
    const existingParagraph = await this.prisma.paragraph.findUnique({
      where: { id: paragraphId },
    });

    if (!existingParagraph) {
      this.logger.error(`Paragraph not found with ID: ${paragraphId}`);
      throw new Error(`Paragraph not found with ID: ${paragraphId}`);
    }

    // Update the paragraph
    const paragraph = await this.prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        content,
        audioStatus: 'PENDING',
        audioS3Key: null,
      },
      include: {
        book: true,
      },
    });

    // Queue audio generation
    await this.queueService.addAudioGenerationJob({
      paragraphId: paragraph.id,
      bookId: paragraph.bookId,
      content: paragraph.content,
    });

    this.logger.log(
      `Updated paragraph ${paragraphId} and queued audio generation`
    );
    return paragraph;
  }

  async createParagraphs(
    bookId: string,
    paragraphs: Array<{
      chapterNumber: number;
      orderIndex: number;
      content: string;
    }>
  ) {
    return this.prisma.paragraph.createMany({
      data: paragraphs.map((p) => ({
        ...p,
        bookId,
      })),
    });
  }

  async getBook(id: string) {
    return this.prisma.book.findUnique({
      where: { id },
      include: {
        paragraphs: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async getAllBooks() {
    return this.prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { paragraphs: true },
        },
      },
    });
  }
}
