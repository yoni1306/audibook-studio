import { ApiProperty } from '@nestjs/swagger';
import { AudioStatus } from '@prisma/client';

export class BookExportRequestDto {
  @ApiProperty({
    description: 'ID of the book to export',
    example: 'uuid-book-id'
  })
  bookId: string;
}

export class PageExportStatusDto {
  @ApiProperty({
    description: 'Page ID',
    example: 'uuid-page-id'
  })
  id: string;

  @ApiProperty({
    description: 'Page number in the book',
    example: 1
  })
  pageNumber: number;

  @ApiProperty({
    description: 'Number of completed paragraphs on this page',
    example: 3
  })
  completedParagraphsCount: number;

  @ApiProperty({
    description: 'Total number of paragraphs on this page',
    example: 5
  })
  totalParagraphsCount: number;

  @ApiProperty({
    description: 'Audio status for this page',
    enum: AudioStatus,
    example: AudioStatus.READY
  })
  audioStatus: AudioStatus;

  @ApiProperty({
    description: 'Duration of the combined audio in seconds',
    example: 45.5,
    required: false
  })
  audioDuration?: number;

  @ApiProperty({
    description: 'S3 key for the combined page audio',
    example: 'books/book-id/pages/page-1-audio.mp3',
    required: false
  })
  audioS3Key?: string;

  @ApiProperty({
    description: 'Whether this page will be included in export (has completed paragraphs)',
    example: true
  })
  willBeExported: boolean;
}

export class BookExportStatusDto {
  @ApiProperty({
    description: 'Book ID',
    example: 'uuid-book-id'
  })
  bookId: string;

  @ApiProperty({
    description: 'Book title',
    example: 'My Book Title'
  })
  bookTitle: string;

  @ApiProperty({
    description: 'Book author',
    example: 'Author Name',
    required: false
  })
  bookAuthor?: string;

  @ApiProperty({
    description: 'Total number of pages in the book',
    example: 10
  })
  totalPages: number;

  @ApiProperty({
    description: 'Number of pages that will be exported (have completed paragraphs)',
    example: 7
  })
  exportablePages: number;

  @ApiProperty({
    description: 'Number of pages with audio generation in progress',
    example: 2
  })
  pagesInProgress: number;

  @ApiProperty({
    description: 'Number of pages with ready audio',
    example: 5
  })
  pagesReady: number;

  @ApiProperty({
    description: 'Number of pages with audio generation errors',
    example: 0
  })
  pagesWithErrors: number;

  @ApiProperty({
    description: 'Overall export status',
    enum: ['not_started', 'in_progress', 'completed', 'partial_errors', 'failed'],
    example: 'in_progress'
  })
  exportStatus: 'not_started' | 'in_progress' | 'completed' | 'partial_errors' | 'failed';

  @ApiProperty({
    description: 'Detailed status for each page',
    type: [PageExportStatusDto]
  })
  pages: PageExportStatusDto[];

  @ApiProperty({
    description: 'Total estimated duration of all exportable audio in seconds',
    example: 1200.5,
    required: false
  })
  totalDuration?: number;

  @ApiProperty({
    description: 'Timestamp when export status was last updated',
    example: '2024-01-01T12:00:00Z'
  })
  lastUpdated: string;
}

export class StartBookExportResponseDto {
  @ApiProperty({
    description: 'Whether the export was successfully started',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Message describing the result',
    example: 'Book export started successfully. 7 pages will be processed.'
  })
  message: string;

  @ApiProperty({
    description: 'Number of pages that will be processed',
    example: 7
  })
  pagesQueued: number;

  @ApiProperty({
    description: 'Number of pages skipped (no completed paragraphs)',
    example: 3
  })
  pagesSkipped: number;

  @ApiProperty({
    description: 'Job IDs for the queued audio generation tasks',
    type: [String],
    example: ['job-1', 'job-2', 'job-3']
  })
  jobIds: string[];

  @ApiProperty({
    description: 'Timestamp when export was started',
    example: '2024-01-01T12:00:00Z'
  })
  timestamp: string;
}
