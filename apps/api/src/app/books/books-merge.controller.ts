import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookMerger, MergeOptions } from '../../scripts/merge-book-original-paragraphs';

interface MergeBookRequest {
  oldBookId: string;
  newBookId: string;
  dryRun?: boolean;
}

interface MergeBookResponse {
  success: boolean;
  message: string;
  stats: {
    pagesMatched: number;
    originalParagraphsTransferred: number;
    paragraphsLinked: number;
  };
  errors?: string[];
}

@ApiTags('books')
@Controller('books')
export class BooksMergeController {
  @Post('merge-original-paragraphs')
  @ApiOperation({
    summary: 'Merge original paragraphs from new book to old book',
    description: `
      Transfers original paragraphs from a new book (with original paragraphs) 
      to an old book (without original paragraphs), then deletes the new book.
      
      This is useful for production migration where you have duplicate books:
      - Old book: has user edits, audio, etc. but no original paragraphs
      - New book: has original paragraphs but no user state
      
      Result: Old book with all its state + original paragraphs from new book
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Merge completed successfully',
    type: Object,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or merge validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during merge',
  })
  async mergeOriginalParagraphs(
    @Body() request: MergeBookRequest,
  ): Promise<MergeBookResponse> {
    try {
      const options: MergeOptions = {
        oldBookId: request.oldBookId,
        newBookId: request.newBookId,
        dryRun: request.dryRun || false,
        verbose: true,
      };

      const merger = new BookMerger(options);
      await merger.merge();

      return {
        success: true,
        message: request.dryRun 
          ? 'Dry run completed successfully. No changes were made.' 
          : 'Books merged successfully. New book has been deleted.',
        stats: {
          pagesMatched: (merger as any).stats.pagesMatched,
          originalParagraphsTransferred: (merger as any).stats.originalParagraphsTransferred,
          paragraphsLinked: (merger as any).stats.paragraphsLinked,
        },
        errors: (merger as any).stats.errors.length > 0 ? (merger as any).stats.errors : undefined,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Merge operation failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
