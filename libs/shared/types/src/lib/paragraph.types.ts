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

export interface UpdateParagraphResponse {
  id: string;
  content: string;
  bookId: string;
  textChanges?: TextChange[];
  textFixes?: Array<{
    id: string;
    paragraphId: string;
    originalWord: string;
    fixedWord: string;
    position: number;
    fixType: string;
    createdAt: string;
    updatedAt: string;
  }>;
  bulkSuggestions?: BulkFixSuggestion[];
}

export interface UpdateParagraphRequest {
  content: string;
}
