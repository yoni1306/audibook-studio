import { Controller, Get, Param, Query, Logger, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BooksService } from './books.service';

@Controller('text-fixes')
export class TextFixesController {
  private readonly logger = new Logger(TextFixesController.name);
  
  constructor(private booksService: BooksService) {}

  // Get all text fixes for a specific paragraph
  @Get('paragraph/:paragraphId')
  @ApiOperation({ summary: 'Get paragraph text fixes', description: 'Get all text fixes for a specific paragraph' })
  @ApiParam({ name: 'paragraphId', description: 'Paragraph ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved paragraph text fixes' })
  async getParagraphFixes(@Param('paragraphId') paragraphId: string) {
    try {
      this.logger.log(`🔧 [API] Getting text fixes for paragraph: ${paragraphId}`);
      
      const fixes = await this.booksService.getParagraphTextFixes(paragraphId);
      
      this.logger.log(`🔧 [API] Found ${fixes?.length || 0} text fixes for paragraph: ${paragraphId}`);
      
      return {
        fixes: fixes || [],
        paragraphId,
        total: fixes?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting paragraph text fixes for ${paragraphId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get paragraph text fixes',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Get all text fixes for a specific book
  @Get('book/:bookId')
  @ApiOperation({ summary: 'Get book text fixes', description: 'Get all text fixes for a specific book' })
  @ApiParam({ name: 'bookId', description: 'Book ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved book text fixes' })
  async getBookFixes(@Param('bookId') bookId: string) {
    try {
      this.logger.log(`📚 [API] Getting text fixes for book: ${bookId}`);
      
      const fixes = await this.booksService.getBookTextFixes(bookId);
      
      this.logger.log(`📚 [API] Found ${fixes?.length || 0} text fixes for book: ${bookId}`);
      
      return {
        fixes: fixes || [],
        bookId,
        total: fixes?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting book text fixes for ${bookId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get book text fixes',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Get statistics about text fixes
  @Get('statistics')
  @ApiOperation({ summary: 'Get text fixes statistics', description: 'Get statistics about text fixes across all books' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved text fixes statistics' })
  async getStatistics() {
    try {
      this.logger.log('📊 [API] Getting text fixes statistics');
      
      const statistics = await this.booksService.getTextFixesStatistics();
      
      this.logger.log('📊 [API] Successfully retrieved text fixes statistics');
      
      return {
        ...statistics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting text fixes statistics: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get text fixes statistics',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Get all unique word fixes across the system
  @Get('words')
  @ApiOperation({ summary: 'Get all word fixes', description: 'Get all unique word fixes across the system' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved all word fixes' })
  async getAllWordFixes() {
    try {
      this.logger.log('🔤 [API] Getting all word fixes');
      
      const wordFixes = await this.booksService.getAllWordFixes();
      
      this.logger.log(`🔤 [API] Found ${wordFixes?.length || 0} word fixes`);
      
      return {
        wordFixes: wordFixes || [],
        total: wordFixes?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting all word fixes: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get word fixes',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Find similar fixes for a given word
  @Get('similar')
  @ApiOperation({ summary: 'Find similar fixes', description: 'Find similar fixes for a given word' })
  @ApiQuery({ name: 'word', description: 'Word to find similar fixes for', required: true })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results to return', required: false })
  @ApiResponse({ status: 200, description: 'Successfully found similar fixes' })
  async findSimilarFixes(
    @Query('word') word: string,
    @Query('limit') limit?: string
  ) {
    try {
      this.logger.log(`🔍 [API] Finding similar fixes for word: ${word}`);
      
      const limitNum = limit ? parseInt(limit, 10) : 10;
      const similarFixes = await this.booksService.findSimilarFixes(word, limitNum);
      
      this.logger.log(`🔍 [API] Found ${similarFixes?.length || 0} similar fixes for word: ${word}`);
      
      return {
        word,
        similarFixes: similarFixes || [],
        limit: limitNum,
        total: similarFixes?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error finding similar fixes for word ${word}: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to find similar fixes',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }
}