import { Controller, Post, Get, Patch, Param, Body, NotFoundException, Redirect } from '@nestjs/common';
import { BooksService } from './books.service';
import { S3Service } from '../s3/s3.service';

@Controller('books')
export class BooksController {
  constructor(
    private booksService: BooksService,
    private s3Service: S3Service
  ) {}

  @Post()
  async createBook(@Body() body: { title: string; author?: string; s3Key: string }) {
    return this.booksService.createBook(body);
  }

  @Get()
  async getAllBooks() {
    return this.booksService.getAllBooks();
  }

  @Get(':id')
  async getBook(@Param('id') id: string) {
    return this.booksService.getBook(id);
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

  @Get('paragraphs/:paragraphId/audio')
  @Redirect()
  async streamAudio(@Param('paragraphId') paragraphId: string) {
    const paragraph = await this.booksService.getParagraph(paragraphId);
    
    if (!paragraph || !paragraph.audioS3Key) {
      throw new NotFoundException('Audio not found');
    }
    
    const url = await this.s3Service.getSignedUrl(paragraph.audioS3Key);
    
    return { url };
  }
}