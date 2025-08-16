// libs/api-client/src/index.ts
// Typed API client for Audibook Studio using openapi-fetch

import createClient from 'openapi-fetch';
import type { paths, components } from './types';

// Re-export the generated types for convenience
export type { paths, components } from './types';

// Re-export available schema types from OpenAPI spec
export type GetAllCorrectionsRequest = components['schemas']['GetAllCorrectionsDto'];

// Custom interface for frontend convenience with nested filters
export interface GetAllCorrectionsWithFiltersRequest {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'originalWord' | 'correctedWord';
  sortOrder?: 'asc' | 'desc';
  filters?: {
    originalWord?: string;
    correctedWord?: string;
    fixType?: string;
    bookId?: string;
    bookTitle?: string;
  };
}
export type GetCorrectionSuggestionsRequest = components['schemas']['GetCorrectionSuggestionsDto'];
export type GetWordCorrectionsRequest = components['schemas']['GetWordCorrectionsDto'];
// Use generated types for aggregated corrections API
export type GetAggregatedCorrectionsRequest = paths['/books/aggregated-corrections']['post']['requestBody']['content']['application/json'];


// Re-export response types
export type CorrectionSuggestionDto = components['schemas']['CorrectionSuggestionDto'];
export type CorrectionSuggestionsResponseDto = components['schemas']['CorrectionSuggestionsResponseDto'];

// For responses, we'll use our own interfaces until the response DTOs are properly generated
export interface CorrectionWithContext {
  id: string;
  originalWord: string;
  correctedWord: string;
  sentenceContext: string;
  fixType?: string;
  createdAt: string;
  updatedAt: string;
  bookTitle: string;
  bookId: string;
  book: {
    id: string;
    title: string;
  };
  location: {
    pageId: string;
    pageNumber: number;
    paragraphId: string;
    paragraphIndex: number;
  };
}

export interface GetAllCorrectionsResponse {
  corrections: CorrectionWithContext[];
  total: number;
  page: number;
  totalPages: number;
  timestamp?: string;
}

// Aggregated corrections interfaces
export type AggregatedCorrection = components['schemas']['AggregatedCorrectionDto'];

export type CorrectionHistoryItem = components['schemas']['CorrectionInstanceDto'];

export type GetAggregatedCorrectionsResponse = paths['/books/aggregated-corrections']['post']['responses']['200']['content']['application/json'];

export interface Paragraph {
  id: string;
  pageNumber: number;
  pageId: string;
  orderIndex: number;
  content: string;
  originalContent?: string;
  audioStatus: string;
  audioS3Key: string | null;
  audioDuration: number | null;
  audioGeneratedAt: string | null;
  completed: boolean;
  updatedAt: string;
}

// Base book interface
export interface BaseBook {
  id: string;
  title: string;
  author: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  s3Key?: string;
}

// Book with full details (for detail view)
export interface BookWithDetails extends BaseBook {
  paragraphs: Paragraph[];
}

// Book with counts (for list view)
export interface BookWithCounts extends BaseBook {
  _count: {
    pages: number;
    paragraphs: number;
  };
}

// Union type for flexibility
export type Book = BookWithDetails | BookWithCounts;

export interface GetAllBooksResponse {
  books: BookWithCounts[];
  total: number;
  timestamp: string;
}

export interface BulkFixResult {
  totalParagraphsUpdated: number;
  totalWordsFixed: number;
  updatedParagraphs: Array<{
    paragraphId: string;
    pageId: string;
    pageNumber: number;
    orderIndex: number;
    wordsFixed: number;
    changes: Array<{
      originalWord: string;
      correctedWord: string;
      position: number;
      fixType?: string;
    }>;
  }>;
}

export interface GetBookByIdResponse {
  book: BookWithDetails | null;
  found: boolean;
  timestamp: string;
}

// Completed paragraphs types
export interface CompletedParagraph {
  id: string;
  content: string;
  orderIndex: number;
  audioStatus: string;
  audioDuration: number | null;
}

export interface PageWithCompletedParagraphs {
  pageId: string;
  pageNumber: number;
  completedParagraphs: CompletedParagraph[];
}

export interface GetCompletedParagraphsResponse {
  bookId: string;
  bookTitle: string;
  pages: PageWithCompletedParagraphs[];
  totalCompletedParagraphs: number;
  timestamp: string;
}

// Export-related types
export interface PageExportStatus {
  id: string;
  pageNumber: number;
  completedParagraphsCount: number;
  totalParagraphsCount: number;
  audioStatus: string | null;
  audioDuration: number | null;
  audioS3Key: string | null;
  willBeExported: boolean;
}

export interface BookExportStatus {
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
  totalPages: number;
  exportablePages: number;
  pagesInProgress: number;
  pagesReady: number;
  pagesWithErrors: number;
  exportStatus: 'not_started' | 'in_progress' | 'completed' | 'partial_errors' | 'failed';
  pages: PageExportStatus[];
  totalDuration?: number;
  lastUpdated: string;
}

export interface StartBookExportResponse {
  success: boolean;
  message: string;
  pagesQueued: number;
  pagesSkipped: number;
  jobIds: string[];
  timestamp: string;
}

export interface TextChange {
  type: 'insertion' | 'deletion' | 'substitution';
  position: number;
  originalText: string;
  newText: string;
  previewBefore: string;
  previewAfter: string;
}

export interface TextCorrection {
  type: string;
  originalWord: string;
  correctedWord: string;
  position: number;
  confidence: number;
  context: {
    previewBefore: string;
    previewAfter: string;
  };
}

export interface BulkFixSuggestion {
  originalWord: string;
  correctedWord: string;
  paragraphIds: string[];
  count: number;
  // Include full paragraph details for the UI
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

export interface UpdateParagraphResponseDto {
  id: string;
  content: string;
  bookId: string;
  textChanges?: TextChange[];
  textFixes?: TextCorrection[];
  bulkSuggestions?: BulkFixSuggestion[];
}

// API Client Factory using openapi-fetch
export function createApiClient(baseUrl: string) {
  const fullBaseUrl = `${baseUrl || 'http://localhost:3000'}/api`;
  const client = createClient<paths>({
    baseUrl: fullBaseUrl,
  });

  return {
    // Raw client for direct access
    client,

    // Books API
    books: {
      getAll: (): Promise<{ data?: GetAllBooksResponse; error?: unknown }> => 
        client.GET('/books'),
      getById: (id: string): Promise<{ data?: GetBookByIdResponse; error?: unknown }> => client.GET('/books/{id}', {
        params: { path: { id } },
      }),
      getCompletedParagraphs: (bookId: string) => 
        client.GET('/books/{id}/completed-paragraphs', {
          params: { path: { id: bookId } },
        }),
      createBook: (data: {
        title: string;
        author?: string;
        s3Key: string;
      }) =>
        client.POST('/books', { 
          body: {
            title: data.title,
            author: data.author,
            s3Key: data.s3Key,
          }
        }),
      updateParagraph: (paragraphId: string, data: { content: string; generateAudio?: boolean }) =>
        client.PATCH('/books/paragraphs/{paragraphId}', {
          params: { path: { paragraphId } },
          // @ts-expect-error - OpenAPI spec expects components['schemas'] but we need specific data
          body: data,
        }),
      applyBulkFixes: (data: {
        bookId: string;
        fixes: { originalWord: string; correctedWord: string; paragraphIds: string[] }[];
      }): Promise<{ data?: BulkFixResult; error?: unknown }> => 
        client.POST('/books/bulk-fixes', { 
          body: {
            bookId: data.bookId,
            fixes: data.fixes,
          }
        }),
      getSuggestedFixes: (paragraphId: string) => 
        client.GET('/books/paragraphs/{paragraphId}/suggested-fixes', {
          params: { path: { paragraphId } },
        }),
      findSimilarFixes: (paragraphId: string, data: {
        wordChanges: Array<{
          originalWord: string;
          correctedWord: string;
          position: number;
          fixType?: string;
        }>;
      }) => client.POST('/books/paragraphs/{paragraphId}/find-similar', {
        params: { path: { paragraphId } },
        body: data,
      }),
      streamAudio: (paragraphId: string) => 
        client.GET('/books/paragraphs/{paragraphId}/audio', {
          params: { path: { paragraphId } },
        }),
      setParagraphCompleted: (bookId: string, paragraphId: string, data: { completed: boolean }) =>
        client.PATCH('/books/{bookId}/paragraphs/{paragraphId}/completed', {
          params: { path: { bookId, paragraphId } },
          body: data,
        }),
      revertParagraph: (paragraphId: string, data: { generateAudio?: boolean }) =>
        client.POST('/books/paragraphs/{paragraphId}/revert' as any, {
          params: { path: { paragraphId } },
          body: data,
        }),
      // Correction Learning API
      getAllCorrections: (data: GetAllCorrectionsWithFiltersRequest) => {
        const apiData: GetAllCorrectionsRequest = {
          page: data.page || 1,
          limit: data.limit || 50,
          sortBy: data.sortBy || 'createdAt',
          sortOrder: data.sortOrder || 'desc',
          filters: data.filters ? {
            originalWord: data.filters.originalWord,
            correctedWord: data.filters.correctedWord,
            fixType: data.filters.fixType,
            bookId: data.filters.bookId,
            bookTitle: data.filters.bookTitle,
          } : undefined,
        };
        return client.POST('/books/all-corrections', { body: apiData });
      },
      getCorrectionSuggestions: (data: GetCorrectionSuggestionsRequest): Promise<{ data?: CorrectionSuggestionsResponseDto; error?: unknown }> =>
        client.POST('/books/correction-suggestions', { body: data }),
      // recordCorrection: (data: RecordCorrectionRequest) => 
      //   client.POST('/books/record-correction', { body: data }), // Endpoint not available
      getLearningStats: () => client.GET('/books/correction-learning/stats', {}),
      getWordCorrections: (data: GetWordCorrectionsRequest) =>
        client.POST('/books/word-corrections', { body: data }),
      // New Aggregated Corrections API
      getAggregatedCorrections: (data: GetAggregatedCorrectionsRequest): Promise<{ data?: GetAggregatedCorrectionsResponse; error?: unknown }> =>
        client.POST('/books/aggregated-corrections', { body: data }),
      
      // Get correction history for a specific aggregation key
      getCorrectionHistory: (aggregationKey: string, options?: { query?: { bookId?: string } }) =>
        client.GET('/books/correction-history/{aggregationKey}', {
          params: {
            path: { aggregationKey },
            query: options?.query,
          },
        }),

      getFixTypes: () => client.GET('/books/fix-types', {}),
      deleteBook: (bookId: string) => client.DELETE('/books/{id}', {
        params: { path: { id: bookId } },
      }),
      
      // Export API (using type assertions until OpenAPI spec is updated)
      getExportStatus: (bookId: string): Promise<{ data?: BookExportStatus; error?: unknown }> =>
        client.GET('/books/{id}/export/status' as any, {
          params: { path: { id: bookId } },
        }),
      startExport: (bookId: string): Promise<{ data?: StartBookExportResponse; error?: unknown }> =>
        client.POST('/books/{id}/export/start' as any, {
          params: { path: { id: bookId } },
        }),
      startPageExport: (bookId: string, pageId: string): Promise<{ data?: StartBookExportResponse; error?: unknown }> =>
        client.POST('/books/{id}/pages/{pageId}/export' as any, {
          params: { path: { id: bookId, pageId } },
        }),
      deletePageAudio: (bookId: string, pageId: string): Promise<{ data?: { success: boolean; message: string }; error?: unknown }> =>
        client.DELETE('/books/{id}/pages/{pageId}/audio' as any, {
          params: { path: { id: bookId, pageId } },
        }),
    },

    // Queue API
    queue: {
      getStatus: () => client.GET('/queue/status', {}),
      getJobs: (status: string) => client.GET('/queue/jobs/{status}', {
        params: { path: { status } },
      }),
      retryJob: (id: string) => client.POST('/queue/retry/{id}', {
        params: { path: { id } },
      }),
      cleanJobs: (status: string) => client.DELETE('/queue/clean/{status}', {
        params: { path: { status } },
      }),
      parseEpub: (data: { bookId: string; s3Key: string; parsingMethod?: 'page-based' | 'xhtml-based' }) => client.POST('/queue/parse-epub', { 
        body: {
          bookId: data.bookId,
          s3Key: data.s3Key,
          parsingMethod: data.parsingMethod,
        }
      }),
    },

    // Text Fixes API
    textFixes: {
      getWords: () => client.GET('/text-fixes/words', {}),
      getStatistics: () => client.GET('/text-fixes/statistics', {}),
      getSimilar: (word: string, limit = '10') => client.GET('/text-fixes/similar', {
        params: { query: { word, limit } },
      }),
      getParagraphFixes: (paragraphId: string) => client.GET('/text-fixes/paragraph/{paragraphId}', {
        params: { path: { paragraphId } },
      }),
      getBookFixes: (bookId: string) => client.GET('/text-fixes/book/{bookId}', {
        params: { path: { bookId } },
      }),
    },

    // S3 API
    s3: {
      getPresignedUpload: (data: { filename: string; contentType: string }) =>
        client.POST('/s3/presigned-upload', { body: data }),
      uploadFile: (formData: FormData) =>
        client.POST('/s3/upload', { 
          body: formData as any, // FormData doesn't match openapi-fetch body type
          bodySerializer: () => formData // Pass FormData directly
        }),
    },

    // Logs API
    logs: {
      send: (logs: unknown[]) => 
        // @ts-expect-error - OpenAPI spec doesn't have request body schema yet
        client.POST('/logs', { body: { logs } }),
    },
  };
}

// Export the client type
export type ApiClient = ReturnType<typeof createApiClient>;