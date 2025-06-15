import { Controller, Post, Get, Param, Body, Patch } from '@nestjs/common';
import { BooksService } from './books.service';

@Controller('books')
export class BooksController {
  constructor(private booksService: BooksService) {}

  @Post()
  async createBook(
    @Body() body: { title: string; author?: string; s3Key: string }
  ) {
    return this.booksService.createBook(body);
  }

  @Get(':id')
  async getBook(@Param('id') id: string) {
    return this.booksService.getBook(id);
  }

  @Post(':id/paragraphs')
  async createParagraphs(
    @Param('id') id: string,
    @Body()
    body: {
      paragraphs: Array<{
        chapterNumber: number;
        orderIndex: number;
        content: string;
      }>;
    }
  ) {
    return this.booksService.createParagraphs(id, body.paragraphs);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string }
  ) {
    return this.booksService.updateBookStatus(id, body.status as any);
  }
}
