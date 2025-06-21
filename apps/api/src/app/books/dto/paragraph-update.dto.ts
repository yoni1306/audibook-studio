import { TextFix } from '@prisma/client';

export interface TextChange {
  originalWord: string;
  fixedWord: string;
  position: number;
  fixType: string;
}

export interface BulkFixSuggestion {
  originalWord: string;
  fixedWord: string;
  fixType: string;
  paragraphIds: string[];
  count: number;
}

export interface UpdateParagraphResponseDto {
  id: string;
  content: string;
  bookId: string;
  textChanges?: TextChange[];
  textFixes?: TextFix[];
  bulkSuggestions?: BulkFixSuggestion[];
}

export interface UpdateParagraphRequestDto {
  content: string;
  generateAudio?: boolean; // Optional flag to control audio generation
}
