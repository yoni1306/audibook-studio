import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Request DTOs
export class GetCorrectionSuggestionsDto {
  @ApiProperty({ description: 'Text to analyze for correction suggestions' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Minimum occurrences for a suggestion', minimum: 1, default: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minOccurrences?: number = 2;
}

export class RecordCorrectionDto {
  @ApiProperty({ description: 'Original word that was corrected' })
  @IsString()
  originalWord: string;

  @ApiProperty({ description: 'Corrected word' })
  @IsString()
  correctedWord: string;

  @ApiProperty({ description: 'Sentence context where the correction occurred' })
  @IsString()
  contextSentence: string;

  @ApiProperty({ description: 'ID of the paragraph where the correction occurred' })
  @IsString()
  paragraphId: string;

  @ApiPropertyOptional({ description: 'Type of fix applied' })
  @IsOptional()
  @IsString()
  fixType?: string;
}

export class GetWordCorrectionsDto {
  @ApiProperty({ description: 'Original word to get corrections for' })
  @IsString()
  originalWord: string;
}

export class GetAllCorrectionsDto {
  @ApiPropertyOptional({ description: 'Filter by original word' })
  @IsOptional()
  @IsString()
  originalWord?: string;

  @ApiPropertyOptional({ description: 'Filter by corrected word' })
  @IsOptional()
  @IsString()
  correctedWord?: string;

  @ApiPropertyOptional({ description: 'Filter by fix type' })
  @IsOptional()
  @IsString()
  fixType?: string;

  @ApiPropertyOptional({ description: 'Filter by book ID' })
  @IsOptional()
  @IsString()
  bookId?: string;

  @ApiPropertyOptional({ description: 'Filter by book title' })
  @IsOptional()
  @IsString()
  bookTitle?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 50, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['createdAt', 'originalWord', 'correctedWord'], default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'originalWord' | 'correctedWord' = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Response DTOs
export class CorrectionSuggestionDto {
  @ApiProperty({ description: 'Original word that was corrected' })
  @IsString()
  originalWord: string;

  @ApiProperty({ description: 'Suggested corrected word' })
  @IsString()
  suggestedWord: string;

  @ApiProperty({ description: 'Context sentence where the correction was used' })
  @IsString()
  contextSentence: string;

  @ApiProperty({ description: 'Number of times this correction has been used' })
  @IsNumber()
  occurrenceCount: number;

  @ApiPropertyOptional({ description: 'Type of fix applied' })
  @IsOptional()
  @IsString()
  fixType?: string;

  @ApiProperty({ description: 'Date when this correction was last used' })
  @IsDate()
  @Type(() => Date)
  lastUsed: Date;
}

export class CorrectionSuggestionsResponseDto {
  @ApiProperty({ description: 'List of correction suggestions', type: [CorrectionSuggestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectionSuggestionDto)
  suggestions: CorrectionSuggestionDto[];

  @ApiProperty({ description: 'Total number of suggestions returned' })
  @IsNumber()
  totalSuggestions: number;

  @ApiPropertyOptional({ description: 'Timestamp when suggestions were generated' })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class RecordCorrectionResponseDto {
  @IsString()
  id: string;

  @IsString()
  originalWord: string;

  @IsString()
  correctedWord: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class CorrectionWithContextDto {
  @ApiProperty({ description: 'Correction ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Original word before correction' })
  @IsString()
  originalWord: string;

  @ApiProperty({ description: 'Corrected word' })
  @IsString()
  correctedWord: string;

  @ApiProperty({ description: 'Sentence context where correction was made' })
  @IsString()
  sentenceContext: string;

  @ApiPropertyOptional({ description: 'Type of fix applied' })
  @IsOptional()
  @IsString()
  fixType?: string;

  @IsOptional()
  @IsString()
  ttsModel?: string;

  @IsOptional()
  @IsString()
  ttsVoice?: string;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @IsString()
  bookTitle: string;

  @IsString()
  bookId: string;

  location: {
    pageId: string;
    pageNumber: number;
    paragraphId: string;
    paragraphIndex: number;
  };
}

export class GetAllCorrectionsResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectionWithContextDto)
  corrections: CorrectionWithContextDto[];

  @IsNumber()
  total: number;

  @IsNumber()
  page: number;

  @IsNumber()
  totalPages: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class GetFixTypesResponseDto {
  @ApiProperty({ description: 'Available fix types for filtering', type: [String] })
  @IsArray()
  @IsString({ each: true })
  fixTypes: string[];

  @ApiProperty({ description: 'Response timestamp', required: false })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class TopCorrectionDto {
  @IsString()
  originalWord: string;

  @IsString()
  correctedWord: string;

  @IsNumber()
  occurrenceCount: number;

  @IsOptional()
  @IsString()
  fixType?: string;
}

export class RecentCorrectionDto {
  @IsString()
  originalWord: string;

  @IsString()
  correctedWord: string;

  @IsString()
  fixType: string;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;
}

export class LearningStatsResponseDto {
  @IsNumber()
  totalCorrections: number;

  @IsNumber()
  uniqueWords: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecentCorrectionDto)
  recentCorrections: RecentCorrectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopCorrectionDto)
  topCorrections: TopCorrectionDto[];

  @IsOptional()
  @IsString()
  timestamp?: string;
}
