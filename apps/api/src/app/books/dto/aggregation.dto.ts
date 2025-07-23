import { ApiProperty } from '@nestjs/swagger';
import { FixType } from '@prisma/client';

export class CorrectionInstanceDto {
  @ApiProperty({ description: 'Correction instance ID' })
  id: string;

  @ApiProperty({ description: 'Original word before correction' })
  originalWord: string;

  @ApiProperty({ description: 'Corrected word after correction' })
  correctedWord: string;

  @ApiProperty({ description: 'Sentence context where correction was applied' })
  sentenceContext: string;

  @ApiProperty({ enum: FixType, description: 'Type of correction applied' })
  fixType: FixType;

  @ApiProperty({ description: 'TTS model used for audio generation' })
  ttsModel: string;

  @ApiProperty({ description: 'TTS voice used for audio generation' })
  ttsVoice: string;

  @ApiProperty({ description: 'When the correction was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Book title where correction was applied' })
  bookTitle: string;

  @ApiProperty({ description: 'Book author' })
  bookAuthor: string;

  @ApiProperty({ description: 'Page number where correction was applied' })
  pageNumber: number;

  @ApiProperty({ description: 'Paragraph order index within the page' })
  paragraphOrderIndex: number;
}

export class AggregatedCorrectionDto {
  @ApiProperty({ description: 'Aggregation key in format "originalWord|correctedWord"' })
  aggregationKey: string;

  @ApiProperty({ description: 'Original word before correction' })
  originalWord: string;

  @ApiProperty({ description: 'Corrected word after correction' })
  correctedWord: string;

  @ApiProperty({ description: 'Number of times this correction was applied' })
  fixCount: number;

  @ApiProperty({ enum: FixType, description: 'Type of correction' })
  fixType: FixType;

  @ApiProperty({ description: 'Most recent correction timestamp' })
  lastCorrectionAt: Date;

  @ApiProperty({ type: [CorrectionInstanceDto], description: 'All correction instances with full context' })
  corrections: CorrectionInstanceDto[];
}

export class AggregatedCorrectionsRequestDto {
  @ApiProperty({ required: false, description: 'Filter by book ID' })
  bookId?: string;

  @ApiProperty({ enum: FixType, required: false, description: 'Filter by fix type' })
  fixType?: FixType;

  @ApiProperty({ required: false, description: 'Filter by original word' })
  originalWord?: string;

  @ApiProperty({ required: false, description: 'Filter by corrected word' })
  correctedWord?: string;

  @ApiProperty({ required: false, description: 'Filter by aggregation key' })
  aggregationKey?: string;

  @ApiProperty({ required: false, description: 'Minimum number of occurrences to include' })
  minOccurrences?: number;

  @ApiProperty({ required: false, description: 'Maximum number of results to return' })
  limit?: number;

  @ApiProperty({ enum: ['asc', 'desc'], required: false, description: 'Sort order by creation date' })
  orderBy?: 'asc' | 'desc';
}

export class AggregatedCorrectionsResponseDto {
  @ApiProperty({ type: [AggregatedCorrectionDto], description: 'Aggregated corrections grouped by fix type' })
  aggregatedCorrections: AggregatedCorrectionDto[];

  @ApiProperty({ description: 'Total number of aggregated correction types' })
  total: number;

  @ApiProperty({ description: 'Response timestamp' })
  timestamp: string;
}

export class WordCorrectionHistoryRequestDto {
  @ApiProperty({ required: false, description: 'Filter by book ID' })
  bookId?: string;
}

export class WordCorrectionHistoryResponseDto {
  @ApiProperty({ description: 'Aggregation key (originalWord|correctedWord)' })
  aggregationKey: string;

  @ApiProperty({ description: 'Original word that was corrected' })
  originalWord: string;

  @ApiProperty({ description: 'Corrected word' })
  correctedWord: string;

  @ApiProperty({ type: [CorrectionInstanceDto], description: 'All correction instances for this aggregation key' })
  corrections: CorrectionInstanceDto[];

  @ApiProperty({ description: 'Total number of correction instances' })
  total: number;

  @ApiProperty({ description: 'Response timestamp' })
  timestamp: string;
}
