import { BasePlugin } from '../base/BasePlugin';
import { IChunkProcessor } from '../../interfaces';
import { TextChunk } from '../../types';
import { createLogger } from '@audibook/logger';

const logger = createLogger('EPUBPageOptimizer');

export class EPUBPageOptimizer extends BasePlugin implements IChunkProcessor {
  readonly name = 'EPUBPageOptimizer';

  protected getDefaultConfig() {
    return {
      targetPageSize: 800,
      minPageSize: 200,
      maxPageSize: 1500,
      mergeSmallPages: true,
      splitLargePages: true,
      preserveChapterBoundaries: true,
    };
  }

  async process(text: string, chunks: TextChunk[]): Promise<TextChunk[]> {
    logger.debug('Starting EPUB page optimization', {
      inputChunks: chunks.length,
      targetSize: this.config.targetPageSize,
    });

    let optimizedChunks = [...chunks];

    // First pass: merge small pages
    if (this.config.mergeSmallPages) {
      optimizedChunks = this.mergeSmallEPUBPages(optimizedChunks);
    }

    // Second pass: split large pages
    if (this.config.splitLargePages) {
      optimizedChunks = await this.splitLargeEPUBPages(optimizedChunks, text);
    }

    logger.debug('EPUB page optimization completed', {
      inputChunks: chunks.length,
      outputChunks: optimizedChunks.length,
      averageSize: optimizedChunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / optimizedChunks.length,
    });

    return optimizedChunks;
  }

  private mergeSmallEPUBPages(pages: TextChunk[]): TextChunk[] {
    const minSize = this.config.minPageSize as number;
    const targetSize = this.config.targetPageSize as number;
    const preserveChapters = this.config.preserveChapterBoundaries as boolean;
    const merged: TextChunk[] = [];

    let i = 0;
    while (i < pages.length) {
      const currentPage = pages[i];

      // If page is large enough, keep as is
      if (currentPage.content.length >= minSize) {
        merged.push(currentPage);
        i++;
        continue;
      }

      // Try to merge with next pages
      let mergedContent = currentPage.content;
      let mergedEnd = currentPage.position.end;
      let mergedMetadata = { ...currentPage.metadata };
      let j = i + 1;

      while (j < pages.length && mergedContent.length < targetSize) {
        const nextPage = pages[j];

        // Check if we should preserve chapter boundary
        if (preserveChapters && this.isDifferentChapter(currentPage, nextPage)) {
          break;
        }

        // Merge the pages
        mergedContent += '\n\n' + nextPage.content;
        mergedEnd = nextPage.position.end;

        // Update metadata
        if (nextPage.metadata?.pageNumber) {
          mergedMetadata.mergedPages = mergedMetadata.mergedPages || [];
          mergedMetadata.mergedPages.push(nextPage.metadata.pageNumber);
        }

        j++;

        // Stop if we've reached a good size
        if (mergedContent.length >= minSize) {
          break;
        }
      }

      // Create merged chunk
      merged.push({
        content: mergedContent,
        position: {
          start: currentPage.position.start,
          end: mergedEnd,
        },
        metadata: {
          ...mergedMetadata,
          type: 'merged_epub_page',
          originalPageCount: j - i,
        },
      });

      i = j;
    }

    logger.debug('Small page merging completed', {
      originalPages: pages.length,
      mergedPages: merged.length,
      reductionRatio: (pages.length - merged.length) / pages.length,
    });

    return merged;
  }

  private async splitLargeEPUBPages(
    pages: TextChunk[],
    fullText: string
  ): Promise<TextChunk[]> {
    const maxSize = this.config.maxPageSize as number;
    const targetSize = this.config.targetPageSize as number;
    const split: TextChunk[] = [];

    for (const page of pages) {
      if (page.content.length <= maxSize) {
        split.push(page);
        continue;
      }

      // Split large page
      const subChunks = this.splitAtNaturalBoundaries(page, targetSize);
      split.push(...subChunks);
    }

    logger.debug('Large page splitting completed', {
      originalPages: pages.length,
      splitPages: split.length,
      expansionRatio: (split.length - pages.length) / pages.length,
    });

    return split;
  }

  private splitAtNaturalBoundaries(
    page: TextChunk,
    targetSize: number
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    const content = page.content;

    // Split by paragraphs first
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let currentStart = page.position.start;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed target size and we have content
      if (currentChunk.length + paragraph.length > targetSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          position: {
            start: currentStart,
            end: currentStart + currentChunk.length
          },
          metadata: {
            ...page.metadata,
            splitFromPage: page.metadata?.pageNumber,
            type: 'epub_page_split'
          }
        });
        
        currentChunk = paragraph;
        currentStart += currentChunk.length + 2; // +2 for \n\n
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add remaining content
    if (currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        position: {
          start: currentStart,
          end: page.position.end
        },
        metadata: {
          ...page.metadata,
          splitFromPage: page.metadata?.pageNumber,
          type: 'epub_page_split'
        }
      });
    }
    
    return chunks;
  }

  private isDifferentChapter(page1: TextChunk, page2: TextChunk): boolean {
    const chapter1 = page1.metadata?.chapterNumber;
    const chapter2 = page2.metadata?.chapterNumber;
    
    return chapter1 !== undefined && chapter2 !== undefined && chapter1 !== chapter2;
  }
}
