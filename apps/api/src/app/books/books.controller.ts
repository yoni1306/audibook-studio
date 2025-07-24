import { Controller, Post, Get, Patch, Delete, Param, Body, Query, NotFoundException, BadRequestException, Redirect, Logger, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { CorrectionLearningService } from './correction-learning.service';
import { TextCorrectionRepository } from './text-correction.repository';
import { UpdateParagraphRequestDto, UpdateParagraphResponseDto, BulkFixSuggestion as DtoBulkFixSuggestion, SuggestedFixesResponseDto } from './dto/paragraph-update.dto';
import { 
  GetAllCorrectionsDto,
  GetAllCorrectionsResponseDto,
  GetFixTypesResponseDto,
  GetCorrectionSuggestionsDto, 
  GetWordCorrectionsDto,
  CorrectionSuggestionsResponseDto,
  LearningStatsResponseDto
} from './dto/correction-learning.dto';
import {
  AggregatedCorrectionsRequestDto,
  AggregatedCorrectionsResponseDto,
  WordCorrectionHistoryResponseDto
} from './dto/aggregation.dto';
import { BulkFixSuggestion as ServiceBulkFixSuggestion } from './bulk-text-fixes.service';
import { WordChange } from './text-fixes.service';
import { FixType } from '@prisma/client';
import { S3Service } from '../s3/s3.service';

@ApiTags('books')
@Controller('books')
export class BooksController {
  private readonly logger = new Logger(BooksController.name);
  
  constructor(
    private booksService: BooksService,
    private bulkTextFixesService: BulkTextFixesService,
    private correctionLearningService: CorrectionLearningService,
    private textCorrectionRepository: TextCorrectionRepository,
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
  @ApiOperation({ summary: 'Get a book by ID', description: 'Retrieve a specific book with all its pages and paragraphs' })
  @ApiParam({ name: 'id', description: 'Book ID' })
  @ApiQuery({ name: 'completedFilter', required: false, description: 'Filter paragraphs by completion status: all (default), completed, or incomplete' })
  @ApiResponse({ status: 200, description: 'Book retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async getBook(
    @Param('id') id: string,
    @Query('completedFilter') completedFilter?: 'all' | 'completed' | 'incomplete'
  ) {
    try {
      this.logger.log(`🔍 [API] Getting book with ID: ${id}`);
      
      const book = await this.booksService.getBook(id, completedFilter);
      
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
      
      // Pass the generateAudio flag to the service, default to false if not specified
      const generateAudio = body.generateAudio !== undefined ? body.generateAudio : false;
      const result = await this.booksService.updateParagraph(paragraphId, body.content, generateAudio);
      
      // BooksService already handles bulk suggestions, so just return the result
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
              position: { type: 'number', description: 'Position in text' }
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
        fixType?: FixType;
      }>;
    }
  ) {
    const paragraph = await this.booksService.getParagraph(paragraphId);
    if (!paragraph) {
      throw new NotFoundException('Paragraph not found');
    }

    // Convert input to WordChange[] by adding fixType if missing
    const wordChanges: WordChange[] = body.wordChanges.map(change => ({
      originalWord: change.originalWord,
      correctedWord: change.correctedWord,
      position: change.position,
      fixType: change.fixType || FixType.default
    }));
    
    const suggestions = await this.bulkTextFixesService.findSimilarFixesInBook(
      paragraph.page?.book?.id || '',
      paragraphId,
      wordChanges
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
   * Get available fix types for filtering
   */
  @Get('fix-types')
  @ApiOperation({ summary: 'Get fix types', description: 'Get all available fix types for filtering corrections' })
  @ApiResponse({ status: 200, description: 'Fix types retrieved successfully', type: GetFixTypesResponseDto })
  async getFixTypes(): Promise<GetFixTypesResponseDto> {
    this.logger.log('Getting available fix types');
    
    try {
      // Return all available FixType enum values
      const fixTypes = Object.values(FixType);
      
      this.logger.log(`Found ${fixTypes.length} fix types`);
      
      return {
        fixTypes,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting fix types: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get fix types',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get all corrections with optional filtering and pagination
   */
  @Post('all-corrections')
  @ApiOperation({ summary: 'Get all corrections', description: 'Get all text corrections with optional filtering and pagination' })
  @ApiBody({ type: GetAllCorrectionsDto })
  @ApiResponse({ status: 200, description: 'All corrections retrieved successfully', type: GetAllCorrectionsResponseDto })
  async getAllCorrections(@Body() dto: GetAllCorrectionsDto): Promise<GetAllCorrectionsResponseDto> {
    this.logger.log('Getting all corrections with filters:', dto);
    
    try {
      const filters = {
        bookId: dto.filters?.bookId,
        fixType: dto.filters?.fixType ? dto.filters.fixType as FixType : undefined,
        originalWord: dto.filters?.originalWord,
        orderBy: dto.sortOrder || 'desc' as 'asc' | 'desc',
        limit: dto.limit || 100,
      };
      
      // Use the new repository method that includes book and paragraph info
      const correctionDtos = await this.textCorrectionRepository.findManyWithBookInfo(filters);
      
      this.logger.log(`Found ${correctionDtos.length} corrections`);
      const totalPages = Math.ceil(correctionDtos.length / (dto.limit || 50));
      return {
        corrections: correctionDtos,
        total: correctionDtos.length,
        page: dto.page || 1,
        totalPages,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting all corrections: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get all corrections',
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
   * Delete a book and all related data
   */
  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete a book', 
    description: 'Delete a book and all related entities (pages, paragraphs, text corrections) and associated S3 audio files' 
  })
  @ApiParam({ name: 'id', description: 'Book ID to delete' })
  @ApiResponse({ status: 200, description: 'Book deleted successfully' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  @ApiResponse({ status: 500, description: 'Internal server error during deletion' })
  async deleteBook(@Param('id') id: string) {
    this.logger.log(`🗑️ [API] Deleting book: ${id}`);
    
    try {
      await this.booksService.deleteBook(id);
      
      this.logger.log(`✅ [API] Book deleted successfully: ${id}`);
      return {
        message: 'Book deleted successfully',
        bookId: id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ [API] Failed to delete book ${id}:`, error.message);
      
      if (error.message.includes('Book not found')) {
        throw new NotFoundException({
          error: 'Not Found',
          message: `Book with ID ${id} not found`,
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }
      
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to delete book',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get aggregated text corrections grouped by fix type
   */
  @Post('aggregated-corrections')
  @ApiOperation({ 
    summary: 'Get aggregated text corrections', 
    description: 'Get text corrections grouped by aggregation key (originalWord|correctedWord) with all contexts' 
  })
  @ApiResponse({ status: 200, description: 'Successfully retrieved aggregated corrections', type: AggregatedCorrectionsResponseDto })
  @ApiBody({ type: AggregatedCorrectionsRequestDto, description: 'Aggregation filters' })
  async getAggregatedCorrections(
    @Body() filters?: AggregatedCorrectionsRequestDto
  ): Promise<AggregatedCorrectionsResponseDto> {
    this.logger.log('📊 [API] Getting aggregated corrections with filters:', filters);
    
    try {
      const aggregatedCorrections = await this.textCorrectionRepository.findAggregatedCorrections(filters);
      
      this.logger.log(`📊 [API] Found ${aggregatedCorrections.length} aggregated corrections`);
      
      // Transform to match DTO structure
      const transformedCorrections = aggregatedCorrections.map(correction => ({
        aggregationKey: correction.aggregationKey,
        originalWord: correction.originalWord,
        correctedWord: correction.correctedWord,
        fixCount: correction.fixCount,
        fixType: correction.corrections[0]?.fixType || FixType.vowelization,
        lastCorrectionAt: correction.corrections.reduce((latest, curr) => 
          curr.createdAt > latest ? curr.createdAt : latest, 
          correction.corrections[0]?.createdAt || new Date()
        ),
        corrections: correction.corrections.map(instance => ({
          id: instance.id,
          originalWord: instance.originalWord,
          correctedWord: instance.correctedWord,
          sentenceContext: instance.sentenceContext,
          fixType: instance.fixType,
          ttsModel: instance.ttsModel,
          ttsVoice: instance.ttsVoice,
          createdAt: instance.createdAt,
          bookTitle: instance.book?.title || 'Unknown',
          bookAuthor: instance.book?.author || 'Unknown',
          pageNumber: instance.location?.pageNumber || 0,
          paragraphOrderIndex: instance.location?.paragraphIndex || 0,
        }))
      }));
      
      return {
        aggregatedCorrections: transformedCorrections,
        total: transformedCorrections.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ [API] Error getting aggregated corrections:', error);
      throw new InternalServerErrorException('Failed to get aggregated corrections');
    }
  }

  /**
   * Get correction history for a specific word
   */
  @Get('correction-history/:aggregationKey')
  @ApiOperation({ 
    summary: 'Get correction history by aggregation key', 
    description: 'Get all correction instances for a specific aggregation key (originalWord|correctedWord) with full context' 
  })
  @ApiParam({ name: 'aggregationKey', description: 'Aggregation key (originalWord|correctedWord) to get history for' })
  @ApiQuery({ name: 'bookId', required: false, description: 'Filter by book ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved correction history', type: WordCorrectionHistoryResponseDto })
  async getCorrectionHistory(
    @Param('aggregationKey') aggregationKey: string,
    @Query('bookId') bookId?: string
  ): Promise<WordCorrectionHistoryResponseDto> {
    this.logger.log(`📜 [API] Getting correction history for aggregation key: ${aggregationKey}`);
    
    try {
      const corrections = await this.textCorrectionRepository.findCorrectionsByAggregationKey(aggregationKey, bookId);
      
      // Parse aggregation key to get original and corrected words
      const [originalWord, correctedWord] = aggregationKey.split('|');
      
      this.logger.log(`📜 [API] Found ${corrections.length} corrections for aggregation key: ${aggregationKey}`);
      
      return {
        aggregationKey,
        originalWord,
        correctedWord,
        corrections: corrections.map(correction => ({
          id: correction.id,
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          sentenceContext: correction.sentenceContext,
          fixType: correction.fixType,
          ttsModel: correction.ttsModel,
          ttsVoice: correction.ttsVoice,
          createdAt: correction.createdAt,
          bookTitle: correction.book?.title || 'Unknown',
          bookAuthor: correction.book?.author || 'Unknown',
          pageNumber: correction.location?.pageNumber || 0,
          paragraphOrderIndex: correction.location?.paragraphIndex || 0,
        })),
        total: corrections.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`📜 [API] Failed to get correction history for aggregation key: ${aggregationKey}`, error);
      throw new InternalServerErrorException('Failed to get correction history');
    }
  }

  /**
   * Set paragraph completed status
   */
  @Patch(':bookId/paragraphs/:paragraphId/completed')
  @ApiOperation({ summary: 'Set paragraph completed status', description: 'Mark a paragraph as completed or not completed' })
  @ApiParam({ name: 'bookId', description: 'ID of the book containing the paragraph' })
  @ApiParam({ name: 'paragraphId', description: 'ID of the paragraph to update' })
  @ApiBody({
    description: 'Completed status',
    schema: {
      type: 'object',
      properties: {
        completed: { type: 'boolean', description: 'Whether the paragraph is completed' }
      },
      required: ['completed']
    }
  })
  @ApiResponse({ status: 200, description: 'Paragraph completed status updated successfully' })
  async setParagraphCompleted(
    @Param('bookId') bookId: string,
    @Param('paragraphId') paragraphId: string,
    @Body() body: { completed: boolean }
  ) {
    this.logger.log(`📝 [API] Setting paragraph ${paragraphId} in book ${bookId} completed status to: ${body.completed}`);
    
    try {
      const updatedParagraph = await this.booksService.setParagraphCompleted(paragraphId, body.completed);
      
      this.logger.log(`✅ [API] Successfully updated paragraph ${paragraphId} completed status`);
      
      return {
        success: true,
        paragraph: {
          id: updatedParagraph.id,
          completed: updatedParagraph.completed,
          updatedAt: updatedParagraph.updatedAt
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`❌ [API] Failed to update paragraph ${paragraphId} completed status:`, error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to update paragraph completed status');
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


}