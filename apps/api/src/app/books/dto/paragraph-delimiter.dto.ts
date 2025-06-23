import { IsString, IsNotEmpty } from 'class-validator';

export class PreviewParagraphDelimiterDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @IsString()
  @IsNotEmpty()
  delimiter: string;
}

export class ApplyParagraphDelimiterDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @IsString()
  @IsNotEmpty()
  delimiter: string;
}

export class ParagraphPreview {
  chapterNumber: number;
  orderIndex: number;
  content: string;
  characterCount: number;
  wordCount: number;
  isNew: boolean; // true if this is a new paragraph created by the delimiter
  originalParagraphId?: string; // ID of the original paragraph this came from
}

export class PreviewParagraphDelimiterResponseDto {
  bookId: string;
  delimiter: string;
  originalParagraphCount: number;
  newParagraphCount: number;
  previewParagraphs: ParagraphPreview[];
  timestamp: string;
}

export class ApplyParagraphDelimiterResponseDto {
  bookId: string;
  delimiter: string;
  originalParagraphCount: number;
  newParagraphCount: number;
  appliedAt: string;
  timestamp: string;
}
