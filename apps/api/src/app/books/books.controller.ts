import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Patch,
  NotFoundException,
} from '@nestjs/common';
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

  @Get()
  async getAllBooks() {
    return this.booksService.getAllBooks();
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

  @Patch('paragraphs/:paragraphId')
  async updateParagraph(
    @Param('paragraphId') paragraphId: string,
    @Body() body: { content: string }
  ) {
    try {
      return await this.booksService.updateParagraph(paragraphId, body.content);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
