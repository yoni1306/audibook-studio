import { TextCorrection } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class TextChange {
  @ApiProperty({ description: 'Original word that was changed' })
  originalWord: string;

  @ApiProperty({ description: 'Corrected word' })
  correctedWord: string;

  @ApiProperty({ description: 'Position in text where change occurred' })
  position: number;
}

export class BulkFixSuggestion {
  @ApiProperty({ description: 'Original word to be fixed' })
  originalWord: string;

  @ApiProperty({ description: 'Suggested corrected word' })
  correctedWord: string;

  @ApiProperty({ description: 'Array of paragraph IDs where this fix applies', type: [String] })
  paragraphIds: string[];

  @ApiProperty({ description: 'Number of occurrences found' })
  count: number;

  @ApiProperty({ description: 'Preview text before the fix' })
  previewBefore: string;

  @ApiProperty({ description: 'Preview text after the fix' })
  previewAfter: string;

  @ApiProperty({ 
    description: 'Detailed occurrences with context',
    type: 'array',
    items: {
      type: 'object',
      required: ['paragraphId', 'previewBefore', 'previewAfter'],
      properties: {
        paragraphId: { type: 'string' },
        previewBefore: { type: 'string' },
        previewAfter: { type: 'string' }
      }
    }
  })
  occurrences: Array<{
    paragraphId: string;
    previewBefore: string;
    previewAfter: string;
  }>;

  @ApiProperty({ 
    description: 'Full paragraph details for UI display',
    type: 'array',
    items: {
      type: 'object',
      required: ['id', 'pageId', 'pageNumber', 'orderIndex', 'content', 'occurrences', 'previewBefore', 'previewAfter'],
      properties: {
        id: { type: 'string' },
        pageId: { type: 'string' },
        pageNumber: { type: 'number' },
        orderIndex: { type: 'number' },
        content: { type: 'string' },
        occurrences: { type: 'number' },
        previewBefore: { type: 'string' },
        previewAfter: { type: 'string' }
      }
    }
  })
  paragraphs: Array<{
    id: string;
    pageId: string;
    pageNumber: number;
    orderIndex: number;
    content: string;
    occurrences: number;
    previewBefore: string;
    previewAfter: string;
  }>;
}

export class UpdateParagraphResponseDto {
  @ApiProperty({ description: 'Paragraph ID' })
  id: string;

  @ApiProperty({ description: 'Updated paragraph content' })
  content: string;

  @ApiProperty({
    description: 'Original paragraph content from the original book',
    example: 'זה הטקסט המקורי של הפסקה לפני כל שינוי',
    required: false,
  })
  originalContent?: string;

  @ApiProperty({
    description: 'Reference ID to the original paragraph in the original book',
    example: 'uuid-of-original-paragraph',
    required: false,
  })
  originalParagraphId?: string;

  @ApiProperty({ description: 'Book ID this paragraph belongs to' })
  bookId: string;

  @ApiProperty({ description: 'Text changes made', type: [TextChange], required: false })
  textChanges?: TextChange[];

  @ApiProperty({ description: 'Text corrections applied', required: false })
  textFixes?: TextCorrection[];

  @ApiProperty({ description: 'Bulk fix suggestions found', type: [BulkFixSuggestion], required: false })
  bulkSuggestions?: BulkFixSuggestion[];
}

export class UpdateParagraphRequestDto {
  @ApiProperty({ description: 'New paragraph content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'Whether to generate audio for updated paragraph', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;

  @ApiProperty({ description: 'Whether to record text corrections for this update', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  recordTextCorrections?: boolean;
}

export class SuggestedFixDto {
  @ApiProperty({ description: 'Original word that could be fixed' })
  originalWord: string;

  @ApiProperty({ description: 'Suggested corrected word' })
  suggestedWord: string;

  @ApiProperty({ description: 'Confidence score for the suggestion (0-1)' })
  confidence: number;

  @ApiProperty({ description: 'Number of times this correction has been used' })
  occurrences: number;
}

export class ParagraphInfoDto {
  @ApiProperty({ description: 'Paragraph ID' })
  id: string;

  @ApiProperty({ description: 'Paragraph content' })
  content: string;
}

export class SuggestedFixesResponseDto {
  @ApiProperty({ description: 'Paragraph information', type: ParagraphInfoDto })
  paragraph: ParagraphInfoDto;

  @ApiProperty({ description: 'Whether paragraph was found' })
  found: boolean;

  @ApiProperty({ description: 'List of suggested fixes', type: [SuggestedFixDto] })
  suggestions: SuggestedFixDto[];

  @ApiProperty({ description: 'Total number of suggestions' })
  totalSuggestions: number;

  @ApiProperty({ description: 'Response timestamp' })
  timestamp: string;
}
