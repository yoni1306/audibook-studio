import { createLogger } from '@audibook/logger';
import { ISplitDetector, IChunkProcessor, ITextSplitter } from '../interfaces';
import { SplitPoint, TextChunk } from '../types';

const logger = createLogger('HebrewTTSSplitter');

export interface HebrewTTSSplitterConfig {
  processChaptersSeparately?: boolean;
  maxChunkSize?: number;
  minChunkSize?: number;
  targetChunkSize?: number;
}

export class HebrewTTSSplitter implements ITextSplitter {
  private splitDetectors: ISplitDetector[] = [];
  private processors: IChunkProcessor[] = [];
  private manualChapterTitles: string[] = [];
  private config: HebrewTTSSplitterConfig;

  constructor(config: HebrewTTSSplitterConfig = {}) {
    this.config = {
      processChaptersSeparately: false,
      maxChunkSize: 1000,
      minChunkSize: 100,
      targetChunkSize: 500,
      ...config,
    };
  }

  addSplitDetector(detector: ISplitDetector): void {
    this.splitDetectors.push(detector);
    logger.debug(`Added split detector: ${detector.name}`);
  }

  addProcessor(processor: IChunkProcessor): void {
    this.processors.push(processor);
    logger.debug(`Added processor: ${processor.name}`);
  }

  setChapterTitles(titles: string[]): void {
    this.manualChapterTitles = titles;
    logger.debug(`Set ${titles.length} manual chapter titles`);
  }

  async splitText(text: string): Promise<TextChunk[]> {
    logger.info('Starting text splitting', {
      textLength: text.length,
      detectors: this.splitDetectors.length,
      processors: this.processors.length,
    });

    let chunks: TextChunk[];

    if (this.manualChapterTitles.length > 0) {
      // Use manual chapter titles for splitting
      chunks = this.createChaptersFromManualTitles(text, this.manualChapterTitles);
    } else {
      // Use split detectors
      chunks = await this.detectAndSplitText(text);
    }

    // Apply processors
    for (const processor of this.processors) {
      logger.debug(`Applying processor: ${processor.name}`);
      chunks = await processor.process(text, chunks);
    }

    logger.info('Text splitting completed', {
      totalChunks: chunks.length,
      averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length,
    });

    return chunks;
  }

  private async detectAndSplitText(text: string): Promise<TextChunk[]> {
    // Collect all split points from detectors
    const allSplitPoints: SplitPoint[] = [];

    for (const detector of this.splitDetectors) {
      const points = detector.findSplitPoints(text);
      allSplitPoints.push(...points);
      logger.debug(`Detector ${detector.name} found ${points.length} split points`);
    }

    // Sort by position and priority
    allSplitPoints.sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return b.priority - a.priority; // Higher priority first
    });

    // Remove duplicate positions, keeping highest priority
    const uniqueSplitPoints: SplitPoint[] = [];
    let lastPosition = -1;

    for (const point of allSplitPoints) {
      if (point.position !== lastPosition) {
        uniqueSplitPoints.push(point);
        lastPosition = point.position;
      }
    }

    // Create chunks from split points
    return this.createChunksFromSplitPoints(text, uniqueSplitPoints);
  }

  private createChunksFromSplitPoints(text: string, splitPoints: SplitPoint[]): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentStart = 0;

    for (let i = 0; i < splitPoints.length; i++) {
      const splitPoint = splitPoints[i];
      const chunkContent = text.slice(currentStart, splitPoint.position).trim();

      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          position: {
            start: currentStart,
            end: splitPoint.position,
          },
          metadata: {
            type: 'auto_split',
            splitReason: splitPoint.marker,
            ...splitPoint.metadata,
          },
        });
      }

      currentStart = splitPoint.position;
    }

    // Add remaining text
    if (currentStart < text.length) {
      const remainingContent = text.slice(currentStart).trim();
      if (remainingContent.length > 0) {
        chunks.push({
          content: remainingContent,
          position: {
            start: currentStart,
            end: text.length,
          },
          metadata: {
            type: 'auto_split',
            splitReason: 'end_of_text',
          },
        });
      }
    }

    return chunks;
  }

  private createChaptersFromManualTitles(text: string, manualTitles: string[]): TextChunk[] {
    logger.debug('Creating chapters from manual titles', { titleCount: manualTitles.length });

    const chapterBoundaries: Array<{
      position: number;
      title: string;
      index: number;
      matchLength: number;
    }> = [];

    // Find chapter boundaries by locating manual titles in text
    manualTitles.forEach((title, index) => {
      const match = this.findTitleInText(text, title);
      if (match) {
        chapterBoundaries.push({
          position: match.position,
          title,
          index,
          matchLength: match.length,
        });
      }
    });

    // Sort by position
    chapterBoundaries.sort((a, b) => a.position - b.position);

    const chunks: TextChunk[] = [];

    // Handle text before first chapter
    if (chapterBoundaries.length > 0 && chapterBoundaries[0].position > 0) {
      const preContent = text.slice(0, chapterBoundaries[0].position).trim();
      if (preContent.length > 0) {
        chunks.push({
          content: preContent,
          position: { start: 0, end: chapterBoundaries[0].position },
          metadata: {
            type: 'pre_chapter',
            chapterNumber: 0,
          },
        });
      }
    }

    // Create chapters
    for (let i = 0; i < chapterBoundaries.length; i++) {
      const boundary = chapterBoundaries[i];
      const nextBoundary = chapterBoundaries[i + 1];
      const endPos = nextBoundary ? nextBoundary.position : text.length;

      let chapterContent = text.slice(boundary.position, endPos);

      // Remove the title from the beginning of the content to avoid duplication
      const titleInContent = chapterContent.slice(0, boundary.matchLength);
      if (this.normalizeText(titleInContent) === this.normalizeText(boundary.title)) {
        chapterContent = chapterContent.slice(boundary.matchLength).trim();
      }

      if (chapterContent.length > 0) {
        chunks.push({
          content: chapterContent,
          position: { start: boundary.position, end: endPos },
          metadata: {
            type: 'manual_chapter',
            chapterNumber: boundary.index + 1,
            chapterTitle: boundary.title,
          },
        });
      }
    }

    // Handle text after last chapter
    if (chapterBoundaries.length > 0) {
      const lastBoundary = chapterBoundaries[chapterBoundaries.length - 1];
      const postContent = text.slice(lastBoundary.position + lastBoundary.matchLength).trim();
      if (postContent.length > 0) {
        chunks.push({
          content: postContent,
          position: { start: lastBoundary.position + lastBoundary.matchLength, end: text.length },
          metadata: {
            type: 'post_chapter',
            chapterNumber: chapterBoundaries.length + 1,
          },
        });
      }
    }

    // If no boundaries found, create single chunk
    if (chapterBoundaries.length === 0) {
      chunks.push({
        content: text.trim(),
        position: { start: 0, end: text.length },
        metadata: {
          type: 'single_chapter',
          chapterNumber: 1,
        },
      });
    }

    return chunks;
  }

  private findTitleInText(text: string, title: string): { position: number; length: number } | null {
    // Normalize text for better matching
    const normalizedText = this.normalizeText(text);
    const normalizedTitle = this.normalizeText(title);

    // Try exact match first
    const position = normalizedText.indexOf(normalizedTitle);
    if (position !== -1) {
      const actualPosition = this.findActualPosition(text, position);
      return {
        position: actualPosition,
        length: this.calculateActualLength(text, actualPosition, title),
      };
    }

    // Try multiline matching
    return this.findMultilineTitleInText(text, title);
  }

  private findMultilineTitleInText(text: string, title: string): { position: number; length: number } | null {
    const titleLines = title.split('\n').map(line => this.normalizeText(line)).filter(line => line.length > 0);
    if (titleLines.length <= 1) return null;

    const textLines = text.split('\n').map(line => this.normalizeText(line));

    for (let i = 0; i <= textLines.length - titleLines.length; i++) {
      let matches = true;
      for (let j = 0; j < titleLines.length; j++) {
        if (textLines[i + j] !== titleLines[j]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        // Find actual position in original text
        const actualPosition = this.findLinePosition(text, i);
        const actualLength = this.calculateMultilineLength(text, i, titleLines.length);
        return { position: actualPosition, length: actualLength };
      }
    }

    return null;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private findActualPosition(text: string, normalizedPosition: number): number {
    // Convert normalized position back to actual position
    let actualPos = 0;
    let normalizedPos = 0;
    const normalizedText = this.normalizeText(text);

    while (normalizedPos < normalizedPosition && actualPos < text.length) {
      if (normalizedText[normalizedPos] === this.normalizeText(text[actualPos])[0]) {
        normalizedPos++;
      }
      actualPos++;
    }

    return actualPos;
  }

  private calculateActualLength(text: string, position: number, originalTitle: string): number {
    return originalTitle.length;
  }

  private findLinePosition(text: string, lineIndex: number): number {
    const lines = text.split('\n');
    let position = 0;
    for (let i = 0; i < lineIndex && i < lines.length; i++) {
      position += lines[i].length + 1; // +1 for newline
    }
    return position;
  }

  private calculateMultilineLength(text: string, startLineIndex: number, lineCount: number): number {
    const lines = text.split('\n');
    let length = 0;
    for (let i = startLineIndex; i < startLineIndex + lineCount && i < lines.length; i++) {
      length += lines[i].length;
      if (i < startLineIndex + lineCount - 1) {
        length += 1; // Add newline character except for last line
      }
    }
    return length;
  }

  /**
   * Main method to split text into optimized chunks
   */
  async split(text: string): Promise<TextChunk[]> {
    logger.info('Starting text splitting process', {
      textLength: text.length,
      detectors: this.splitDetectors.length,
      processors: this.processors.length,
    });

    let chunks: TextChunk[];

    // First, try manual chapter splitting if titles are provided
    if (this.manualChapterTitles.length > 0) {
      chunks = this.createChaptersFromManualTitles(text, this.manualChapterTitles);
      logger.debug('Manual chapter splitting completed', { chunks: chunks.length });
    } else {
      // Use detector-based splitting
      chunks = await this.detectAndSplitText(text);
      logger.debug('Detector-based splitting completed', { chunks: chunks.length });
    }

    // Apply all processors to optimize chunks
    for (const processor of this.processors) {
      logger.debug('Applying processor', { processor: processor.name });
      chunks = await processor.process(text, chunks);
    }

    logger.info('Text splitting process completed', {
      finalChunks: chunks.length,
      averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length,
    });

    return chunks;
  }
}
