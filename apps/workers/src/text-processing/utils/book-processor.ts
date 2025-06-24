import { createHebrewTTSSplitter, PresetName } from '../factory/presets';
import { TextChunk } from '../types';

/**
 * Database paragraph format
 */
export interface ParagraphData {
  bookId: string;
  content: string;
  orderIndex: number;
  chapterNumber: number | null;
  chapterTitle: string | null;
  audioStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  metadata: {
    merged?: boolean;
    split?: boolean;
    splitType?: string;
    originalPosition: { start: number; end: number };
    chunkIndex: number;
    [key: string]: unknown;
  };
}

export interface BookProcessingOptions {
  preset?: PresetName;
  chapterTitles?: string[];
  debug?: boolean;
  customProcessorConfigs?: {
    ChunkSizeOptimizer?: {
      minSize?: number;
      maxSize?: number;
      targetSize?: number;
      mergeThreshold?: number;
    };
  };
}

export interface BookProcessingResult {
  chunks: TextChunk[];
  totalChunks: number;
  totalCharacters: number;
  averageChunkSize: number;
  chaptersDetected: number;
  processingTimeMs: number;
}

/**
 * Process book text using Hebrew TTS Splitter
 * This is the main entry point for integrating with the EPUB parsing workflow
 */
export async function processBookText(
  bookText: string,
  options: BookProcessingOptions = {}
): Promise<BookProcessingResult> {
  const startTime = Date.now();
  
  try {
    const {
      preset = 'narrative',
      chapterTitles = [],
      debug = false,
      customProcessorConfigs
    } = options;

    // Create splitter with specified preset
    const splitter = createHebrewTTSSplitter(preset);
    
    // Configure debug mode
    if (debug) {
      splitter['config'].debug = true;
    }

    // Apply custom processor configurations
    if (customProcessorConfigs) {
      Object.entries(customProcessorConfigs).forEach(([processorName, config]) => {
        const processor = splitter['processors'].find((p: unknown) => (p as { name: string }).name === processorName);
        if (processor && config) {
          Object.assign(processor.config, config);
        }
      });
    }

    // Set chapter titles if provided
    if (chapterTitles.length > 0) {
      splitter.setChapterTitles(chapterTitles);
    }

    // Process the text
    const chunks = await splitter.splitText(bookText);
    
    // Calculate statistics
    const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    const averageChunkSize = chunks.length > 0 ? Math.round(totalCharacters / chunks.length) : 0;
    
    // Count unique chapters - try multiple approaches for robustness
    const chapterIds = new Set(chunks.map(chunk => chunk.chapter?.id).filter(Boolean));
    const chapterIndices = new Set(chunks.map(chunk => chunk.chapter?.index).filter(index => index !== undefined));
    const uniqueChapterTitles = new Set(chunks.map(chunk => chunk.chapter?.title).filter(Boolean));
    
    // Use the maximum count from different approaches
    const chaptersDetected = Math.max(chapterIds.size, chapterIndices.size, uniqueChapterTitles.size);
    
    if (debug) {
      console.log(`Chapter detection debug:
        - Unique chapter IDs: ${chapterIds.size} (${Array.from(chapterIds).join(', ')})
        - Unique chapter indices: ${chapterIndices.size} (${Array.from(chapterIndices).join(', ')})
        - Unique chapter titles: ${uniqueChapterTitles.size} (${Array.from(uniqueChapterTitles).slice(0, 3).join(', ')})
        - Final chapters detected: ${chaptersDetected}`);
    }
    
    const processingTimeMs = Date.now() - startTime;

    return {
      chunks,
      totalChunks: chunks.length,
      totalCharacters,
      averageChunkSize,
      chaptersDetected,
      processingTimeMs
    };
  } catch (error) {
    console.error('Error processing book text:', error);
    throw new Error(`Book processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert TextChunk to database paragraph format
 */
export function convertChunkToParagraph(
  chunk: TextChunk,
  bookId: string,
  orderIndex: number
): ParagraphData {
  return {
    bookId,
    content: chunk.content,
    orderIndex,
    chapterNumber: chunk.chapter ? chunk.chapter.index + 1 : null,
    chapterTitle: chunk.chapter?.title || null,
    audioStatus: 'PENDING' as const,
    metadata: {
      ...chunk.metadata,
      originalPosition: chunk.position,
      chunkIndex: chunk.chapter?.chunkIndex || 0
    }
  };
}
