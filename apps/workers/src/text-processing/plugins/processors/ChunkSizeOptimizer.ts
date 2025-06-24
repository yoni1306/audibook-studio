import { BasePlugin } from '../base/BasePlugin';
import { IChunkProcessor } from '../../interfaces';
import { TextChunk } from '../../types';
import { createLogger } from '@audibook/logger';

const logger = createLogger('ChunkSizeOptimizer');

export class ChunkSizeOptimizer extends BasePlugin implements IChunkProcessor {
  readonly name = 'ChunkSizeOptimizer';

  protected getDefaultConfig() {
    return {
      minSize: 200,
      maxSize: 600,
      targetSize: 400,
      preserveChapterBoundaries: true,
      splitOnSentences: true,
    };
  }

  async process(text: string, chunks: TextChunk[]): Promise<TextChunk[]> {
    logger.debug('Starting chunk size optimization', {
      inputChunks: chunks.length,
      targetSize: this.config.targetSize,
    });

    let optimizedChunks = [...chunks];

    // Merge small chunks
    optimizedChunks = this.mergeSmallChunks(optimizedChunks);

    // Split large chunks
    optimizedChunks = this.splitLargeChunks(optimizedChunks);

    logger.debug('Chunk size optimization completed', {
      inputChunks: chunks.length,
      outputChunks: optimizedChunks.length,
      averageSize: optimizedChunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / optimizedChunks.length,
    });

    return optimizedChunks;
  }

  private mergeSmallChunks(chunks: TextChunk[]): TextChunk[] {
    const minSize = this.config.minSize as number;
    const targetSize = this.config.targetSize as number;
    const preserveChapters = this.config.preserveChapterBoundaries as boolean;
    const merged: TextChunk[] = [];

    let i = 0;
    while (i < chunks.length) {
      const currentChunk = chunks[i];

      if (currentChunk.content.length >= minSize) {
        merged.push(currentChunk);
        i++;
        continue;
      }

      // Try to merge with next chunks
      let mergedContent = currentChunk.content;
      let mergedEnd = currentChunk.position.end;
      let mergedMetadata = { ...currentChunk.metadata };
      let j = i + 1;

      while (j < chunks.length && mergedContent.length < targetSize) {
        const nextChunk = chunks[j];

        // Check chapter boundary
        if (preserveChapters && this.isDifferentChapter(currentChunk, nextChunk)) {
          break;
        }

        mergedContent += '\n\n' + nextChunk.content;
        mergedEnd = nextChunk.position.end;
        j++;

        if (mergedContent.length >= minSize) {
          break;
        }
      }

      merged.push({
        content: mergedContent,
        position: {
          start: currentChunk.position.start,
          end: mergedEnd,
        },
        metadata: {
          ...mergedMetadata,
          type: 'size_optimized',
          mergedChunkCount: j - i,
        },
      });

      i = j;
    }

    return merged;
  }

  private splitLargeChunks(chunks: TextChunk[]): TextChunk[] {
    const maxSize = this.config.maxSize as number;
    const targetSize = this.config.targetSize as number;
    const splitOnSentences = this.config.splitOnSentences as boolean;
    const split: TextChunk[] = [];

    for (const chunk of chunks) {
      if (chunk.content.length <= maxSize) {
        split.push(chunk);
        continue;
      }

      if (splitOnSentences) {
        split.push(...this.splitBySentences(chunk, targetSize));
      } else {
        split.push(...this.splitByWords(chunk, targetSize));
      }
    }

    return split;
  }

  private splitBySentences(chunk: TextChunk, targetSize: number): TextChunk[] {
    const sentences = this.extractSentences(chunk.content);
    const subChunks: TextChunk[] = [];
    
    let currentContent = '';
    let currentStart = chunk.position.start;

    for (const sentence of sentences) {
      if (currentContent.length + sentence.length > targetSize && currentContent.length > 0) {
        // Save current chunk
        subChunks.push({
          content: currentContent.trim(),
          position: {
            start: currentStart,
            end: currentStart + currentContent.length,
          },
          metadata: {
            ...chunk.metadata,
            type: 'sentence_split',
            splitFromChunk: true,
          },
        });

        currentContent = sentence;
        currentStart += currentContent.length + 1;
      } else {
        currentContent += (currentContent ? ' ' : '') + sentence;
      }
    }

    // Add remaining content
    if (currentContent.trim()) {
      subChunks.push({
        content: currentContent.trim(),
        position: {
          start: currentStart,
          end: chunk.position.end,
        },
        metadata: {
          ...chunk.metadata,
          type: 'sentence_split',
          splitFromChunk: true,
        },
      });
    }

    return subChunks;
  }

  private splitByWords(chunk: TextChunk, targetSize: number): TextChunk[] {
    const words = chunk.content.split(/\s+/);
    const subChunks: TextChunk[] = [];
    
    let currentContent = '';
    let currentStart = chunk.position.start;

    for (const word of words) {
      if (currentContent.length + word.length + 1 > targetSize && currentContent.length > 0) {
        // Save current chunk
        subChunks.push({
          content: currentContent.trim(),
          position: {
            start: currentStart,
            end: currentStart + currentContent.length,
          },
          metadata: {
            ...chunk.metadata,
            type: 'word_split',
            splitFromChunk: true,
          },
        });

        currentContent = word;
        currentStart += currentContent.length + 1;
      } else {
        currentContent += (currentContent ? ' ' : '') + word;
      }
    }

    // Add remaining content
    if (currentContent.trim()) {
      subChunks.push({
        content: currentContent.trim(),
        position: {
          start: currentStart,
          end: chunk.position.end,
        },
        metadata: {
          ...chunk.metadata,
          type: 'word_split',
          splitFromChunk: true,
        },
      });
    }

    return subChunks;
  }

  private extractSentences(text: string): string[] {
    // Hebrew and English sentence endings
    const sentencePattern = /[.!?׃]+\s+/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentencePattern.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index + match[0].length).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex).trim();
      if (remaining.length > 0) {
        sentences.push(remaining);
      }
    }

    return sentences;
  }

  private isDifferentChapter(chunk1: TextChunk, chunk2: TextChunk): boolean {
    const chapter1 = chunk1.metadata?.chapterNumber;
    const chapter2 = chunk2.metadata?.chapterNumber;
    
    return chapter1 !== undefined && chapter2 !== undefined && chapter1 !== chapter2;
  }
}
