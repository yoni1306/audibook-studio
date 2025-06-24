import { BasePlugin } from '../base/BasePlugin';
import { IChunkProcessor } from '../../interfaces';
import { TextChunk } from '../../types';

export class ChunkSizeOptimizer extends BasePlugin implements IChunkProcessor {
  readonly name = 'ChunkSizeOptimizer';

  protected getDefaultConfig() {
    return {
      minSize: 200,
      maxSize: 500,
      targetSize: 350,
      mergeThreshold: 0.7 // Merge if combined size is less than 70% of target
    };
  }

  async process(text: string, chunks: TextChunk[]): Promise<TextChunk[]> {
    let optimizedChunks = this.mergeSmallChunks(chunks);
    optimizedChunks = this.splitLargeChunks(optimizedChunks);
    
    return optimizedChunks;
  }

  private mergeSmallChunks(chunks: TextChunk[]): TextChunk[] {
    const result: TextChunk[] = [];
    let buffer: TextChunk | null = null;
    const minSize = this.config.minSize as number;
    
    for (const chunk of chunks) {
      if (this.shouldMerge(chunk, buffer)) {
        buffer = this.mergeChunks(buffer as TextChunk, chunk);
      } else {
        if (buffer) {
          result.push(buffer);
        }
        buffer = chunk.content.length < minSize ? chunk : null;
        if (!buffer) {
          result.push(chunk);
        }
      }
    }
    
    if (buffer) {
      result.push(buffer);
    }
    
    return result;
  }

  private splitLargeChunks(chunks: TextChunk[]): TextChunk[] {
    const result: TextChunk[] = [];
    const maxSize = this.config.maxSize as number;
    
    for (const chunk of chunks) {
      if (chunk.content.length > maxSize) {
        result.push(...this.splitChunk(chunk));
      } else {
        result.push(chunk);
      }
    }
    
    return result;
  }

  private shouldMerge(chunk: TextChunk, buffer: TextChunk | null): boolean {
    if (!buffer) return false;
    
    const combinedLength = buffer.content.length + chunk.content.length;
    const targetSize = this.config.targetSize as number;
    const mergeThreshold = this.config.mergeThreshold as number;
    const minSize = this.config.minSize as number;
    
    return chunk.content.length < minSize && 
           combinedLength <= targetSize * mergeThreshold;
  }

  private mergeChunks(chunk1: TextChunk, chunk2: TextChunk): TextChunk {
    return {
      content: chunk1.content + ' ' + chunk2.content,
      position: {
        start: chunk1.position.start,
        end: chunk2.position.end
      },
      metadata: {
        ...chunk1.metadata,
        ...chunk2.metadata,
        merged: true
      },
      chapter: chunk1.chapter // Preserve chapter info from first chunk
    };
  }

  private splitChunk(chunk: TextChunk): TextChunk[] {
    const sentences = this.splitIntoSentences(chunk.content);
    const subChunks: TextChunk[] = [];
    
    let currentContent = '';
    let currentStart = chunk.position.start;
    
    for (const sentence of sentences) {
      if (this.shouldStartNewChunk(currentContent, sentence)) {
        if (currentContent) {
          subChunks.push(this.createSubChunk(
            currentContent,
            currentStart,
            chunk
          ));
        }
        currentContent = sentence;
        currentStart += currentContent.length;
      } else {
        currentContent += sentence;
      }
    }
    
    if (currentContent) {
      subChunks.push(this.createSubChunk(
        currentContent,
        currentStart,
        chunk
      ));
    }
    
    return subChunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Hebrew and English sentence endings
    const sentences = text.split(/([.!?׃:])/);
    const result: string[] = [];
    
    for (let i = 0; i < sentences.length - 1; i += 2) {
      if (sentences[i].trim()) {
        result.push(sentences[i] + (sentences[i + 1] || ''));
      }
    }
    
    // Handle case where text doesn't end with punctuation
    if (sentences.length % 2 === 1 && sentences[sentences.length - 1].trim()) {
      result.push(sentences[sentences.length - 1]);
    }
    
    return result;
  }

  private shouldStartNewChunk(current: string, sentence: string): boolean {
    const targetSize = this.config.targetSize as number;
    return current.length + sentence.length > targetSize && current.length > 0;
  }

  private createSubChunk(
    content: string,
    startPos: number,
    originalChunk: TextChunk
  ): TextChunk {
    return {
      content: content.trim(),
      position: {
        start: startPos,
        end: startPos + content.length
      },
      metadata: {
        ...originalChunk.metadata,
        split: true
      },
      chapter: originalChunk.chapter
    };
  }
}
