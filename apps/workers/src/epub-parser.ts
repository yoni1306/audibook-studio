import { createLogger } from '@audibook/logger';
import { createEPUBSplitter, extractTextFromEPUB } from './text-processing';

const logger = createLogger('AdvancedEpubParser');

export interface ParsedParagraph {
  chapterNumber: number;
  orderIndex: number;
  content: string;
  metadata?: {
    sourceFile?: string;
    pageNumber?: number;
    startOffset?: number;
    endOffset?: number;
  };
}

export interface AdvancedParseOptions {
  usePageStructure?: boolean;
  optimizeChunks?: boolean;
  targetChunkSize?: number;
  chapterTitles?: string[];
}

export async function parseEpubAdvanced(
  epubPath: string,
  options: AdvancedParseOptions = {}
): Promise<ParsedParagraph[]> {
  logger.info('Starting advanced EPUB parsing for audio narration', { epubPath, options });

  try {
    // Create the simplified EPUB splitter optimized for audio narration
    const { splitter, pages } = await createEPUBSplitter(epubPath, {
      usePageStructure: options.usePageStructure !== false,
      optimizeChunks: options.optimizeChunks !== false,
      targetChunkSize: options.targetChunkSize || 400,
      chapterTitles: options.chapterTitles,
    });

    // Use structured pages instead of plain text extraction
    if (pages && pages.length > 0) {
      logger.info('Using structured page-based approach', {
        pagesExtracted: pages.length,
      });

      // Convert pages directly to paragraphs, preserving structure
      const paragraphs: ParsedParagraph[] = pages.map((page, index) => {
        // Determine chapter number from page metadata or estimate
        let chapterNumber = 1;
        if (page.sourceFile) {
          // Extract chapter number from source file name if possible
          const chapterMatch = page.sourceFile.match(/chapter[_-]?(\d+)/i) || 
                              page.sourceFile.match(/(\d+)/);
          if (chapterMatch) {
            chapterNumber = parseInt(chapterMatch[1], 10);
          }
        }

        return {
          content: page.content.trim(),
          orderIndex: index + 1,
          chapterNumber,
          metadata: {
            sourceFile: page.sourceFile,
            pageNumber: page.pageNumber,
            startOffset: page.startOffset,
            endOffset: page.endOffset,
          },
        };
      });

      logger.info('Advanced EPUB parsing completed using structured pages', {
        totalParagraphs: paragraphs.length,
        averageContentLength: paragraphs.reduce((sum, p) => sum + p.content.length, 0) / paragraphs.length,
      });

      return paragraphs;
    }

    // Fallback to text-based approach if pages are not available
    logger.warn('Pages not available, falling back to text-based approach');

    // Extract text from EPUB
    const fullText = await extractTextFromEPUB(epubPath);
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('No text content found in EPUB');
    }

    logger.info('Text extracted from EPUB', {
      textLength: fullText.length,
    });

    // Split the text using the advanced splitter
    const chunks = await splitter.split(fullText);
    
    if (!chunks || chunks.length === 0) {
      throw new Error('No chunks generated from text splitting');
    }

    logger.info('Text splitting completed', {
      chunksGenerated: chunks.length,
      averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length,
    });

    // Convert chunks to the expected paragraph format
    const paragraphs: ParsedParagraph[] = chunks.map((chunk, index) => {
      // Determine chapter number from metadata or position
      let chapterNumber = 1;
      
      if (chunk.metadata?.chapterNumber) {
        chapterNumber = chunk.metadata.chapterNumber;
      } else if (chunk.metadata?.pageNumber && pages.length > 0) {
        // Estimate chapter from page structure
        const pageIndex = chunk.metadata.pageNumber - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          // Simple heuristic: assume 10-20 pages per chapter
          chapterNumber = Math.floor(pageIndex / 15) + 1;
        }
      } else {
        // Fallback: estimate chapter from chunk position
        const totalChunks = chunks.length;
        const estimatedChapters = Math.max(1, Math.floor(totalChunks / 20));
        chapterNumber = Math.floor((index / totalChunks) * estimatedChapters) + 1;
      }

      return {
        chapterNumber,
        orderIndex: index,
        content: chunk.content,
      };
    });

    // Group by chapters and log statistics
    const chapterGroups = paragraphs.reduce((acc, p) => {
      acc[p.chapterNumber] = (acc[p.chapterNumber] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    logger.info('Advanced EPUB parsing completed', {
      totalParagraphs: paragraphs.length,
      chaptersDetected: Object.keys(chapterGroups).length,
      chapterDistribution: chapterGroups,
      averageContentLength: paragraphs.reduce((sum, p) => sum + p.content.length, 0) / paragraphs.length,
    });

    return paragraphs;

  } catch (error) {
    logger.error('Advanced EPUB parsing failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function parseEpubWithChapterTitles(
  epubPath: string,
  chapterTitles: string[],
  options: Omit<AdvancedParseOptions, 'chapterTitles'> = {}
): Promise<ParsedParagraph[]> {
  logger.info('Parsing EPUB with manual chapter titles', {
    epubPath,
    chapterCount: chapterTitles.length,
  });

  return parseEpubAdvanced(epubPath, {
    ...options,
    chapterTitles,
    usePageStructure: false, // Use manual titles instead of page structure
  });
}
