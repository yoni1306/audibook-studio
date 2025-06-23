import { Controller, Post, Get, Patch, Param, Body, NotFoundException, Redirect, Logger, InternalServerErrorException } from '@nestjs/common';
import { BooksService } from './books.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { CorrectionLearningService } from './correction-learning.service';
import { UpdateParagraphRequestDto, UpdateParagraphResponseDto, BulkFixSuggestion as DtoBulkFixSuggestion } from './dto/paragraph-update.dto';
import { 
  GetCorrectionSuggestionsDto, 
  RecordCorrectionDto, 
  GetWordCorrectionsDto,
  GetAllCorrectionsDto,
  CorrectionSuggestionsResponseDto,
  LearningStatsResponseDto,
  RecordCorrectionResponseDto,
  GetAllCorrectionsResponseDto,
  GetFixTypesResponseDto
} from './dto/correction-learning.dto';
import { BulkFixSuggestion as ServiceBulkFixSuggestion } from './bulk-text-fixes.service';
import { S3Service } from '../s3/s3.service';

@Controller('books')
export class BooksController {
  private readonly logger = new Logger(BooksController.name);
  
  constructor(
    private booksService: BooksService,
    private bulkTextFixesService: BulkTextFixesService,
    private correctionLearningService: CorrectionLearningService,
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
        correctedWord: suggestion.correctedWord,
        // These fields don't exist in the service format, so we provide default values
        fixType: 'spelling', // Default fix type
        paragraphIds,
        count: suggestion.paragraphs.reduce((sum, p) => sum + p.occurrences, 0),
        // Include the full paragraph details for the UI
        paragraphs: suggestion.paragraphs
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
        correctedWord: string;
        paragraphIds: string[];
      }>;
    }
  ) {
    this.logger.log('Bulk fixes endpoint called');
    this.logger.log('Request body:', JSON.stringify(body, null, 2));
    this.logger.log(`Book ID: ${body.bookId}`);
    this.logger.log(`Number of fixes: ${body.fixes.length}`);
    
    try {
      const result = await this.bulkTextFixesService.applyBulkFixes(body.bookId, body.fixes);
      this.logger.log('Bulk fixes completed successfully');
      this.logger.log('Result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      this.logger.error('Error in bulk fixes endpoint:', error);
      this.logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        bookId: body.bookId,
        fixesCount: body.fixes.length
      });
      throw error;
    }
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
        correctedWord: string;
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

  // Smart Text Correction Learning System Endpoints

  /**
   * Get correction suggestions for a given text
   */
  @Post('correction-suggestions')
  async getCorrectionSuggestions(@Body() dto: GetCorrectionSuggestionsDto): Promise<CorrectionSuggestionsResponseDto> {
    this.logger.log(`Getting correction suggestions for text: ${dto.text.substring(0, 50)}...`);
    
    try {
      const suggestions = await this.correctionLearningService.getCorrectionSuggestions(
        dto.text,
        dto.minOccurrences
      );
      
      this.logger.log(`Found ${suggestions.length} correction suggestions`);
      return {
        suggestions,
        totalSuggestions: suggestions.length,
      };
    } catch (error) {
      this.logger.error(`Error getting correction suggestions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Record a manual correction for learning
   */
  @Post('record-correction')
  async recordCorrection(@Body() dto: RecordCorrectionDto): Promise<RecordCorrectionResponseDto> {
    this.logger.log(`Recording correction: ${dto.originalWord} → ${dto.correctedWord}`);
    
    try {
      const correction = await this.correctionLearningService.recordCorrection({
        originalWord: dto.originalWord,
        correctedWord: dto.correctedWord,
        contextSentence: dto.contextSentence,
        paragraphId: dto.paragraphId,
        fixType: dto.fixType,
      });
      
      this.logger.log(`Successfully recorded correction with ID: ${correction.id}`);
      
      return {
        id: correction.id,
        originalWord: correction.originalWord,
        correctedWord: correction.correctedWord,
        message: 'Correction recorded successfully',
      };
    } catch (error) {
      this.logger.error(`Error recording correction: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get learning system statistics
   */
  @Get('correction-learning/stats')
  async getLearningStats(): Promise<LearningStatsResponseDto> {
    this.logger.log('Getting correction learning statistics');
    
    try {
      const stats = await this.correctionLearningService.getLearningStats();
      this.logger.log(`Learning stats: ${stats.totalCorrections} total corrections, ${stats.uniqueWords} unique words`);
      return stats;
    } catch (error) {
      this.logger.error(`Error getting learning stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get corrections for a specific word
   */
  @Post('word-corrections')
  async getWordCorrections(@Body() dto: GetWordCorrectionsDto): Promise<CorrectionSuggestionsResponseDto> {
    this.logger.log(`Getting corrections for word: ${dto.originalWord}`);
    
    try {
      const suggestions = await this.correctionLearningService.getWordCorrections(dto.originalWord);
      this.logger.log(`Found ${suggestions.length} corrections for word: ${dto.originalWord}`);
      
      return {
        suggestions,
        totalSuggestions: suggestions.length,
      };
    } catch (error) {
      this.logger.error(`Error getting word corrections: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all corrections with filtering and pagination
   */
  @Post('all-corrections')
  async getAllCorrections(@Body() dto: GetAllCorrectionsDto): Promise<GetAllCorrectionsResponseDto> {
    this.logger.log(`Getting all corrections with filters: ${JSON.stringify(dto)}`);
    
    try {
      const result = await this.correctionLearningService.getAllCorrections(dto);
      this.logger.log(`Found ${result.corrections.length} corrections (page ${result.page}/${result.totalPages}, total: ${result.total})`);
      
      return result;
    } catch (error) {
      this.logger.error(`Error getting all corrections: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Test endpoint to verify routing
   */
  @Get('test-endpoint')
  async testEndpoint() {
    this.logger.log('🧪 [API] Test endpoint called');
    return { message: 'Test endpoint working', timestamp: new Date().toISOString() };
  }

  /**
   * Get available fix types for filtering
   */
  @Get('fix-types')
  async getFixTypes() {
    this.logger.log('🔧 [API] Getting available fix types - START');
    
    try {
      const fixTypes = await this.correctionLearningService.getFixTypes();
      this.logger.log(`📊 [API] Found ${fixTypes.length} fix types: ${JSON.stringify(fixTypes)}`);
      
      const response = {
        fixTypes,
      };
      
      this.logger.log(`🎯 [API] Returning response: ${JSON.stringify(response)}`);
      
      return response;
    } catch (error) {
      this.logger.error(`💥 [API] Error getting fix types: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get fix types');
    }
  }
}