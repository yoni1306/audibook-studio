import { Controller, Get, Param, Query } from '@nestjs/common';
import { BooksService } from './books.service';

@Controller('text-fixes')
export class TextFixesController {
  constructor(private booksService: BooksService) {}

  // Get all text fixes for a specific paragraph
  @Get('paragraph/:paragraphId')
  async getParagraphFixes(@Param('paragraphId') paragraphId: string) {
    return this.booksService.getParagraphTextFixes(paragraphId);
  }

  // Get all text fixes for a specific book
  @Get('book/:bookId')
  async getBookFixes(@Param('bookId') bookId: string) {
    return this.booksService.getBookTextFixes(bookId);
  }

  // Get statistics about text fixes
  @Get('statistics')
  async getStatistics() {
    return this.booksService.getTextFixesStatistics();
  }

  // Get all unique word fixes across the system
  @Get('words')
  async getAllWordFixes() {
    return this.booksService.getAllWordFixes();
  }

  // Find similar fixes for a given word
  @Get('similar')
  async findSimilarFixes(
    @Query('word') word: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.booksService.findSimilarFixes(word, limitNum);
  }
}