import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookStatus } from '@prisma/client';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(private prisma: PrismaService) {}

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
