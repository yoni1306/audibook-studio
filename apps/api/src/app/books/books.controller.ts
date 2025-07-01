import { Controller, Post, Get, Patch, Param, Body, NotFoundException, BadRequestException, Redirect, Logger, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { CorrectionLearningService } from './correction-learning.service';
import { UpdateParagraphRequestDto, UpdateParagraphResponseDto, BulkFixSuggestion as DtoBulkFixSuggestion, SuggestedFixesResponseDto } from './dto/paragraph-update.dto';
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

@ApiTags('books')
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
      
      // Create preview text from first occurrence
      const firstParagraph = suggestion.paragraphs[0];
      const previewBefore = firstParagraph?.previewBefore || '';
      const previewAfter = firstParagraph?.previewAfter || '';
      
      // Map occurrences to the expected format
      const occurrences = suggestion.paragraphs.map(p => ({
        paragraphId: p.id,
        previewBefore: p.previewBefore,
        previewAfter: p.previewAfter
      }));
      
      return {
        originalWord: suggestion.originalWord,
        correctedWord: suggestion.correctedWord,
        fixType: 'spelling', // Default fix type
        paragraphIds,
        count: suggestion.paragraphs.reduce((sum, p) => sum + p.occurrences, 0),
        previewBefore,
        previewAfter,
        occurrences,
        paragraphs: suggestion.paragraphs.map(p => ({
          id: p.id,
          pageId: p.pageId,
          pageNumber: p.pageNumber,
          orderIndex: p.orderIndex,
          content: p.content,
          occurrences: p.occurrences,
          previewBefore: p.previewBefore,
          previewAfter: p.previewAfter
        }))
      };
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new book', description: 'Create a new book with title, author, and S3 key' })
  @ApiResponse({ status: 201, description: 'Book created successfully' })
  @ApiBody({
    description: 'Book creation data',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Book title' },
        author: { type: 'string', description: 'Book author (optional)' },
        s3Key: { type: 'string', description: 'S3 key for the book file' }
      },
      required: ['title', 's3Key']
    }
  })
  async createBook(@Body() body: { title: string; author?: string; s3Key: string }) {
    return this.booksService.createBook(body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all books', description: 'Retrieve all books in the system' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved all books' })
  async getAllBooks() {
    try {
      this.logger.log('📚 [API] Getting all books');
      
      const books = await this.booksService.getAllBooks();
      
      this.logger.log(`📚 [API] Found ${books.length} books`);
      
      return {
        books,
        total: books.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting all books: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to retrieve books',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get book by ID', description: 'Retrieve a specific book by its ID' })
  @ApiParam({ name: 'id', description: 'Book ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved book' })
  async getBook(@Param('id') id: string) {
    try {
      this.logger.log(`🔍 [API] Getting book with ID: ${id}`);
      
      const book = await this.booksService.getBook(id);
      
      if (!book) {
        this.logger.log(`📚 [API] Book not found with ID: ${id} (valid request, no data)`);
        return {
          book: null,
          found: false,
          timestamp: new Date().toISOString(),
        };
      }
      
      this.logger.log(`📚 [API] Successfully retrieved book: ${book.title}`);
      return {
        book,
        found: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting book ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to retrieve book',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Patch('paragraphs/:paragraphId')
  @ApiOperation({ summary: 'Update paragraph content', description: 'Update the content of a specific paragraph and optionally generate audio' })
  @ApiParam({ name: 'paragraphId', description: 'Paragraph ID' })
  @ApiResponse({ status: 200, description: 'Paragraph updated successfully', type: UpdateParagraphResponseDto })
  @ApiBody({ type: UpdateParagraphRequestDto, description: 'Paragraph update data' })
  async updateParagraph(
    @Param('paragraphId') paragraphId: string,
    @Body() body: UpdateParagraphRequestDto
  ): Promise<UpdateParagraphResponseDto> {
    try {
      // Validate that content is provided
      if (!body.content || typeof body.content !== 'string') {
        throw new BadRequestException('Content is required and must be a string');
      }
      
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
  @ApiOperation({ summary: 'Apply bulk text fixes', description: 'Apply multiple text fixes to a book' })
  @ApiResponse({ status: 200, description: 'Bulk fixes applied successfully' })
  @ApiBody({
    description: 'Bulk fixes data',
    schema: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: 'Book ID' },
        fixes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              originalWord: { type: 'string', description: 'Original word to replace' },
              correctedWord: { type: 'string', description: 'Corrected word' },
              paragraphIds: { type: 'array', items: { type: 'string' }, description: 'Paragraph IDs to apply fix to' }
            },
            required: ['originalWord', 'correctedWord', 'paragraphIds']
          }
        }
      },
      required: ['bookId', 'fixes']
    }
  })
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
  @ApiOperation({ summary: 'Get suggested fixes for paragraph', description: 'Get suggested text fixes for a paragraph based on historical data' })
  @ApiParam({ name: 'paragraphId', description: 'Paragraph ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved suggested fixes', type: SuggestedFixesResponseDto })
  async getSuggestedFixes(@Param('paragraphId') paragraphId: string): Promise<SuggestedFixesResponseDto> {
    try {
      this.logger.log(`🔍 [API] Getting suggested fixes for paragraph: ${paragraphId}`);
      
      const paragraph = await this.booksService.getParagraph(paragraphId);
      
      if (!paragraph) {
        this.logger.log(`📝 [API] Paragraph not found with ID: ${paragraphId} (valid request, no data)`);
        return {
          paragraph: null,
          found: false,
          suggestions: [],
          totalSuggestions: 0,
          timestamp: new Date().toISOString(),
        };
      }

      const suggestions = await this.bulkTextFixesService.getSuggestedFixes(
        paragraph.page?.book?.id || '',
        paragraph.content
      );
      
      this.logger.log(`💡 [API] Found ${suggestions.length} suggested fixes for paragraph: ${paragraphId}`);
      
      return {
        paragraph: {
          id: paragraph.id,
          content: paragraph.content,
        },
        found: true,
        suggestions,
        totalSuggestions: suggestions.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error getting suggested fixes for paragraph ${paragraphId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get suggested fixes',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Post('paragraphs/:paragraphId/find-similar')
  @ApiOperation({ summary: 'Find similar text fixes', description: 'Find similar text fixes for a paragraph based on word changes' })
  @ApiParam({ name: 'paragraphId', description: 'Paragraph ID' })
  @ApiResponse({ status: 200, description: 'Successfully found similar fixes', type: [DtoBulkFixSuggestion] })
  @ApiBody({
    description: 'Word changes to find similar fixes for',
    schema: {
      type: 'object',
      properties: {
        wordChanges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              originalWord: { type: 'string', description: 'Original word' },
              correctedWord: { type: 'string', description: 'Corrected word' },
              position: { type: 'number', description: 'Position in text' },
              fixType: { type: 'string', description: 'Type of fix (optional)' }
            },
            required: ['originalWord', 'correctedWord', 'position']
          }
        }
      },
      required: ['wordChanges']
    }
  })
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

    const suggestions = await this.bulkTextFixesService.findSimilarFixesInBook(
      paragraph.page?.book?.id || '',
      paragraphId,
      body.wordChanges
    );
    
    // Map service suggestions to DTO format
    return this.mapBulkSuggestionsToDto(suggestions);
  }

  @Get('paragraphs/:paragraphId/audio')
  @ApiOperation({ summary: 'Stream paragraph audio', description: 'Get audio stream URL for a specific paragraph' })
  @ApiParam({ name: 'paragraphId', description: 'Paragraph ID' })
  @ApiResponse({ status: 302, description: 'Redirect to audio stream URL' })
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
  @ApiOperation({ summary: 'Get correction suggestions for text' })
  @ApiResponse({ status: 200, description: 'Correction suggestions retrieved successfully', type: CorrectionSuggestionsResponseDto })
  @ApiBody({ type: GetCorrectionSuggestionsDto })
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
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting correction suggestions: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get correction suggestions',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
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
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error recording correction: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to record correction',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get learning system statistics
   */
  @Get('correction-learning/stats')
  @ApiOperation({ summary: 'Get learning statistics', description: 'Get correction learning system statistics' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved learning statistics', type: 'LearningStatsResponseDto' })
  async getLearningStats(): Promise<LearningStatsResponseDto> {
    this.logger.log('Getting correction learning statistics');
    
    try {
      const stats = await this.correctionLearningService.getLearningStats();
      this.logger.log(`Learning stats: ${stats.totalCorrections} total corrections, ${stats.uniqueWords} unique words`);
      
      return {
        ...stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting learning stats: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get learning statistics',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
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
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting word corrections: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get word corrections',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get all corrections with filtering and pagination
   */
  @Post('all-corrections')
  @ApiOperation({ summary: 'Get all corrections', description: 'Retrieve all corrections with filtering and pagination' })
  @ApiBody({ type: GetAllCorrectionsDto })
  @ApiResponse({ status: 200, description: 'Successfully retrieved corrections', type: GetAllCorrectionsResponseDto })
  async getAllCorrections(@Body() dto: GetAllCorrectionsDto): Promise<GetAllCorrectionsResponseDto> {
    this.logger.log(`Getting all corrections with filters: ${JSON.stringify(dto)}`);
    
    try {
      const result = await this.correctionLearningService.getAllCorrections(dto);
      this.logger.log(`Found ${result.corrections.length} corrections (page ${result.page}/${result.totalPages}, total: ${result.total})`);
      
      return {
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting all corrections: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get corrections',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Test endpoint to verify routing
   */
  @Get('test-endpoint')
  @ApiOperation({ summary: 'Test endpoint', description: 'Test endpoint to verify routing and API functionality' })
  @ApiResponse({ status: 200, description: 'Test endpoint response' })
  async testEndpoint() {
    this.logger.log('🧪 [API] Test endpoint called');
    return { message: 'Test endpoint working', timestamp: new Date().toISOString() };
  }

  /**
   * Get available fix types for filtering
   */
  @Get('fix-types')
  @ApiOperation({ summary: 'Get fix types', description: 'Get available fix types for filtering corrections' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved fix types', type: GetFixTypesResponseDto })
  async getFixTypes() {
    this.logger.log('🔧 [API] Getting available fix types - START');
    
    try {
      const result = await this.correctionLearningService.getFixTypes();
      this.logger.log(`📊 [API] Found ${result.fixTypes.length} fix types: ${JSON.stringify(result.fixTypes)}`);
      
      const response = {
        ...result,
        timestamp: new Date().toISOString(),
      };
      
      this.logger.log(`🎯 [API] Returning response: ${JSON.stringify(response)}`);
      
      return response;
    } catch (error) {
      this.logger.error(`💥 [API] Error getting fix types: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get fix types',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }
}