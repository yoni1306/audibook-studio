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
  // Include full paragraph details for the UI
  paragraphs: Array<{
    id: string;
    chapterNumber: number;
    orderIndex: number;
    content: string;
    occurrences: number;
    previewBefore: string;
    previewAfter: string;
  }>;
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
