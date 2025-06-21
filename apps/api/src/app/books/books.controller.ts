import { Controller, Post, Get, Patch, Param, Body, NotFoundException, Redirect, Logger } from '@nestjs/common';
import { BooksService } from './books.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { UpdateParagraphRequestDto, UpdateParagraphResponseDto, BulkFixSuggestion as DtoBulkFixSuggestion } from './dto/paragraph-update.dto';
import { BulkFixSuggestion as ServiceBulkFixSuggestion } from './bulk-text-fixes.service';
import { S3Service } from '../s3/s3.service';

@Controller('books')
export class BooksController {
  private readonly logger = new Logger(BooksController.name);
  
  constructor(
    private booksService: BooksService,
    private bulkTextFixesService: BulkTextFixesService,
    private s3Service: S3Service
  ) {}
  
  /**
   * Maps the service BulkFixSuggestion format to the DTO format expected by the API
   */
  private mapBulkSuggestionsToDto(suggestions: ServiceBulkFixSuggestion[]): DtoBulkFixSuggestion[] {
    return suggestions.map(suggestion => {
      // Extract paragraph IDs from the paragraphs array
      const paragraphIds = suggestion.paragraphs.map(p => p.id);
      
      return {
        originalWord: suggestion.originalWord,
        fixedWord: suggestion.fixedWord,
        // These fields don't exist in the service format, so we provide default values
        fixType: 'spelling', // Default fix type
        paragraphIds,
        count: suggestion.paragraphs.reduce((sum, p) => sum + p.occurrences, 0)
      };
    });
  }

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
    @Body() body: UpdateParagraphRequestDto
  ): Promise<UpdateParagraphResponseDto> {
    try {
      this.logger.debug(`Updating paragraph ${paragraphId} with content: ${body.content.substring(0, 20)}...`);
      // Pass the generateAudio flag to the service, default to false if not specified
      const generateAudio = body.generateAudio !== undefined ? body.generateAudio : false;
      this.logger.debug(`Audio generation requested: ${generateAudio}`);
      const result = await this.booksService.updateParagraph(paragraphId, body.content, generateAudio);
      this.logger.debug(`Update result - textChanges: ${JSON.stringify(result.textChanges)}`);
      
      // If there were text changes, find similar fixes in the book
      if (result.textChanges && result.textChanges.length > 0) {
        this.logger.debug(`Found ${result.textChanges.length} text changes, looking for similar fixes in book ${result.bookId}`);
        const bulkSuggestions = await this.bulkTextFixesService.findSimilarFixesInBook(
          result.bookId,
          paragraphId,
          result.textChanges
        );
        
        this.logger.debug(`Found ${bulkSuggestions?.length || 0} bulk suggestions`);
        
        // Convert service format to DTO format
        const mappedSuggestions = this.mapBulkSuggestionsToDto(bulkSuggestions);
        this.logger.debug(`Mapped ${mappedSuggestions.length} bulk suggestions to DTO format`);

        return {
          ...result,
          bulkSuggestions: mappedSuggestions,
        };
      } else {
        this.logger.debug(`No text changes detected, not looking for bulk suggestions`);
      }

      return result;
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  // New endpoint for applying bulk fixes
  @Post('bulk-fixes')
  async applyBulkFixes(
    @Body() body: {
      bookId: string;
      fixes: Array<{
        originalWord: string;
        fixedWord: string;
        paragraphIds: string[];
      }>;
    }
  ) {
    return this.bulkTextFixesService.applyBulkFixes(body.bookId, body.fixes);
  }

  // Get suggested fixes for a paragraph based on historical data
  @Get('paragraphs/:paragraphId/suggested-fixes')
  async getSuggestedFixes(@Param('paragraphId') paragraphId: string) {
    const paragraph = await this.booksService.getParagraph(paragraphId);
    if (!paragraph) {
      throw new NotFoundException('Paragraph not found');
    }

    return this.bulkTextFixesService.getSuggestedFixes(
      paragraph.book?.id || '',
      paragraph.content
    );
  }

  // Find similar fixes in book for a specific word change
  @Post('paragraphs/:paragraphId/find-similar')
  async findSimilarFixes(
    @Param('paragraphId') paragraphId: string,
    @Body() body: {
      wordChanges: Array<{
        originalWord: string;
        fixedWord: string;
        position: number;
        fixType?: string;
      }>;
    }
  ) {
    const paragraph = await this.booksService.getParagraph(paragraphId);
    if (!paragraph) {
      throw new NotFoundException('Paragraph not found');
    }

    return this.bulkTextFixesService.findSimilarFixesInBook(
      paragraph.book?.id || '',
      paragraphId,
      body.wordChanges
    );
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