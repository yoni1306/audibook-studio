import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Request DTOs
export class GetCorrectionSuggestionsDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minOccurrences?: number = 2;
}

export class RecordCorrectionDto {
  @IsString()
  originalWord: string;

  @IsString()
  correctedWord: string;

  @IsString()
  contextSentence: string;

  @IsString()
  paragraphId: string;

  @IsOptional()
  @IsString()
  fixType?: string;
}

export class GetWordCorrectionsDto {
  @IsString()
  originalWord: string;
}

export class GetAllCorrectionsDto {
  @IsOptional()
  @IsString()
  originalWord?: string;

  @IsOptional()
  @IsString()
  correctedWord?: string;

  @IsOptional()
  @IsString()
  fixType?: string;

  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'originalWord' | 'correctedWord' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Response DTOs
export class CorrectionSuggestionDto {
  @IsString()
  originalWord: string;

  @IsString()
  suggestedWord: string;

  @IsString()
  contextSentence: string;

  @IsNumber()
  occurrenceCount: number;

  @IsOptional()
  @IsString()
  fixType?: string;

  @IsDate()
  @Type(() => Date)
  lastUsed: Date;
}

export class CorrectionSuggestionsResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectionSuggestionDto)
  suggestions: CorrectionSuggestionDto[];

  @IsNumber()
  totalSuggestions: number;

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
  @IsString()
  id: string;

  @IsString()
  originalWord: string;

  @IsString()
  correctedWord: string;

  @IsString()
  sentenceContext: string;

  @IsOptional()
  @IsString()
  fixType?: string;

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

  paragraph: {
    id: string;
    orderIndex: number;
    chapterNumber: number;
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
  @IsArray()
  @IsString({ each: true })
  fixTypes: string[];

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
