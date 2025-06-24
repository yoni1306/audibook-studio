import { ISplitDetector, IChunkProcessor } from '../interfaces';
import { TextChunk, Chapter, SplitPoint, SplitterConfig } from '../types';

export class HebrewTTSSplitter {
  private splitDetectors: ISplitDetector[] = [];
  private processors: IChunkProcessor[] = [];
  private chapterTitles: string[] = [];
  private config: SplitterConfig;

  constructor(config?: Partial<SplitterConfig>) {
    this.config = {
      minChunkSize: 100,
      maxChunkSize: 800,
      debug: false,
      ...config
    };
  }

  addSplitDetector(detector: ISplitDetector): void {
    this.splitDetectors.push(detector);
  }

  addProcessor(processor: IChunkProcessor): void {
    this.processors.push(processor);
  }

  setChapterTitles(titles: string[]): void {
    this.chapterTitles = titles;
  }

  async splitText(text: string): Promise<TextChunk[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    this.log('Starting text splitting process');
    this.log(`Text length: ${text.length} characters`);

    // Find chapters first
    const chapters = this.detectChapters(text);
    this.log(`Detected ${chapters.length} chapters`);

    if (chapters.length === 0) {
      // No chapters detected, process as single text
      return this.processText(text);
    }

    // Process each chapter separately
    const allChunks: TextChunk[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const chapterChunks = await this.processChapter(chapters[i], i);
      allChunks.push(...chapterChunks);
    }

    this.log(`Final result: ${allChunks.length} chunks`);
    return allChunks;
  }

  private detectChapters(text: string): Chapter[] {
    // If manual chapter titles are provided, use them
    if (this.chapterTitles && this.chapterTitles.length > 0) {
      this.log(`Using ${this.chapterTitles.length} manual chapter titles`);
      return this.createChaptersFromManualTitles(text, this.chapterTitles);
    }

    // Fall back to automatic chapter detection
    const chapterDetector = this.splitDetectors.find(d => d.name === 'ChapterDetector');
    if (!chapterDetector || !chapterDetector.isEnabled()) {
      return [];
    }

    const chapterPoints = chapterDetector.findSplitPoints(text)
      .filter(point => point.metadata?.type === 'chapter')
      .sort((a, b) => a.position - b.position);

    if (chapterPoints.length === 0) {
      return [];
    }

    return chapterPoints.map((point, index) => {
      const nextPoint = chapterPoints[index + 1];
      const endPos = nextPoint ? nextPoint.position : text.length;
      
      return {
        id: `chapter_${index + 1}`,
        title: point.metadata?.title as string || `Chapter ${index + 1}`,
        position: {
          start: point.position,
          end: endPos
        },
        content: text.slice(point.position, endPos)
      };
    });
  }

  private async processChapter(chapter: Chapter, chapterIndex: number): Promise<TextChunk[]> {
    const chapterBody = this.extractChapterBody(chapter.content);
    const chunks = await this.processText(chapterBody, chapter.position.start);
    
    return chunks.map((chunk, chunkIndex) => ({
      ...chunk,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        index: chapterIndex,
        chunkIndex
      },
      position: {
        start: chunk.position.start + chapter.position.start,
        end: chunk.position.end + chapter.position.start
      }
    }));
  }

  private extractChapterBody(content: string): string {
    // Include the full chapter content including the title for narration
    // The title should be part of the text that gets narrated
    return content.trim();
  }

  private async processText(text: string, offset = 0): Promise<TextChunk[]> {
    const splitPoints = this.findSplitPoints(text, offset > 0);
    let chunks = this.createChunks(text, splitPoints);
    
    this.log(`Created ${chunks.length} initial chunks`);

    for (const processor of this.processors) {
      if (processor.isEnabled()) {
        chunks = await processor.process(text, chunks);
        this.log(`${processor.name} processed chunks, count: ${chunks.length}`);
      }
    }

    return chunks;
  }

  private findSplitPoints(text: string, skipChapters: boolean): SplitPoint[] {
    const allPoints: SplitPoint[] = [];
    
    for (const detector of this.splitDetectors) {
      if (!detector.isEnabled()) continue;
      if (skipChapters && detector.name === 'ChapterDetector') continue;
      
      const points = detector.findSplitPoints(text);
      allPoints.push(...points);
      
      this.log(`${detector.name} found ${points.length} split points`);
    }
    
    return allPoints.sort((a, b) => 
      a.position === b.position 
        ? a.priority - b.priority 
        : a.position - b.position
    );
  }

  private createChunks(text: string, splitPoints: SplitPoint[]): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentStart = 0;

    for (const point of splitPoints) {
      const chunkSize = point.position - currentStart;

      if (this.isValidChunkSize(chunkSize)) {
        chunks.push(this.createChunk(
          text.slice(currentStart, point.position),
          currentStart,
          point.position,
          point.metadata?.type as string
        ));
        currentStart = point.position;
      } else if (chunkSize > this.config.maxChunkSize) {
        const forcedChunks = this.forceSplitLargeSection(
          text,
          currentStart,
          point.position
        );
        chunks.push(...forcedChunks);
        currentStart = point.position;
      }
    }

    // Add remaining text
    if (currentStart < text.length) {
      chunks.push(this.createChunk(
        text.slice(currentStart),
        currentStart,
        text.length,
        'end'
      ));
    }

    return chunks;
  }

  private isValidChunkSize(size: number): boolean {
    return size >= this.config.minChunkSize && size <= this.config.maxChunkSize;
  }

  private forceSplitLargeSection(
    text: string,
    start: number,
    end: number
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentPos = start;
    
    while (currentPos < end) {
      const remainingSize = end - currentPos;
      const chunkSize = Math.min(this.config.maxChunkSize, remainingSize);
      let splitPos = currentPos + chunkSize;
      
      // Try to find space for cleaner split
      if (splitPos < end) {
        const spacePos = text.lastIndexOf(' ', splitPos);
        if (spacePos > currentPos + this.config.minChunkSize) {
          splitPos = spacePos;
        }
      }
      
      chunks.push(this.createChunk(
        text.slice(currentPos, splitPos),
        currentPos,
        splitPos,
        'forced'
      ));
      
      currentPos = splitPos;
    }
    
    return chunks;
  }

  private createChunk(
    content: string,
    start: number,
    end: number,
    splitType?: string
  ): TextChunk {
    return {
      content: content.trim(),
      position: { start, end },
      metadata: {
        splitType: splitType || 'natural'
      }
    };
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[HebrewTTSSplitter] ${message}`);
    }
  }

  private createChaptersFromManualTitles(text: string, manualTitles: string[]): Chapter[] {
    this.log(`Creating chapters from manual titles: ${manualTitles.length} titles provided`);
    
    if (manualTitles.length === 0) return [];
    
    // If only one title, treat entire text as one chapter
    if (manualTitles.length === 1) {
      return [{
        id: 'chapter_1',
        title: manualTitles[0],
        position: { start: 0, end: text.length },
        content: text
      }];
    }
    
    // Try to find chapter boundaries by looking for the chapter titles in the text
    const chapterBoundaries: { position: number; title: string; index: number; matchLength: number }[] = [];
    
    manualTitles.forEach((title, index) => {
      const match = this.findTitleInText(text, title);
      if (match) {
        chapterBoundaries.push({
          position: match.position,
          title,
          index,
          matchLength: match.length
        });
      }
    });

    // Sort boundaries by position
    chapterBoundaries.sort((a, b) => a.position - b.position);

    // If we found some boundaries in the text, use them
    if (chapterBoundaries.length > 0) {
      const chapters: Chapter[] = [];
      
      // Handle text before the first found chapter title
      if (chapterBoundaries[0].position > 0) {
        const preContent = text.slice(0, chapterBoundaries[0].position).trim();
        if (preContent.length > 0) {
          // Look for a chapter title in the pre-content
          const preTitle = this.extractChapterTitle(preContent) || 'Chapter 1';
          chapters.push({
            id: 'chapter_1',
            title: preTitle,
            position: { start: 0, end: chapterBoundaries[0].position },
            content: preContent
          });
        }
      }
      
      // Create chapters for found boundaries
      for (let i = 0; i < chapterBoundaries.length; i++) {
        const boundary = chapterBoundaries[i];
        const nextBoundary = chapterBoundaries[i + 1];
        const endPos = nextBoundary ? nextBoundary.position : text.length;
        
        // Extract content and optionally skip the title to avoid duplication
        const fullContent = text.slice(boundary.position, endPos);
        const contentWithoutTitle = text.slice(boundary.position + boundary.matchLength, endPos).trim();
        
        // Use content without title if it's substantial, otherwise keep full content
        const chapterContent = contentWithoutTitle.length > 50 ? contentWithoutTitle : fullContent;
        
        chapters.push({
          id: `chapter_${chapters.length + 1}`,
          title: boundary.title,
          position: { start: boundary.position, end: endPos },
          content: chapterContent
        });
      }
      
      this.log(`Found ${chapters.length} chapters using title matching`);
      return chapters;
    }

    // Fallback: divide text evenly among the provided titles
    this.log(`No title matches found, dividing text evenly among ${manualTitles.length} chapters`);
    const chapters: Chapter[] = [];
    const chapterLength = Math.floor(text.length / manualTitles.length);
    
    for (let i = 0; i < manualTitles.length; i++) {
      const start = i * chapterLength;
      const end = i === manualTitles.length - 1 ? text.length : (i + 1) * chapterLength;
      
      chapters.push({
        id: `chapter_${i + 1}`,
        title: manualTitles[i],
        position: { start, end },
        content: text.slice(start, end)
      });
    }
    
    return chapters;
  }

  private findTitleInText(text: string, title: string): { position: number; length: number } | null {
    // Normalize text for better matching
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedTitle = title.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Try exact match first
    const position = normalizedText.indexOf(normalizedTitle);
    if (position !== -1) {
      // Find the actual position in the original text
      const actualPosition = this.findActualPosition(text, position);
      return {
        position: actualPosition,
        length: this.calculateActualLength(text, actualPosition, title)
      };
    }
    
    // Try line-by-line matching for multiline titles
    const titleLines = title.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (titleLines.length > 1) {
      return this.findMultilineTitleInText(text, titleLines);
    }
    
    // Try fuzzy matching for single line titles (allow for minor formatting differences)
    const titleWords = normalizedTitle.split(' ').filter(word => word.length > 2);
    if (titleWords.length >= 2) {
      return this.findFuzzyTitleMatch(text, titleWords, title);
    }
    
    return null;
  }
  
  private findActualPosition(text: string, normalizedPosition: number): number {
    // Convert normalized position back to actual position in original text
    let actualPos = 0;
    let normalizedPos = 0;
    
    for (let i = 0; i < text.length && normalizedPos < normalizedPosition; i++) {
      const char = text[i];
      if (char !== ' ' || (i > 0 && text[i-1] !== ' ')) {
        normalizedPos++;
      }
      actualPos = i;
    }
    
    return actualPos;
  }
  
  private calculateActualLength(text: string, startPos: number, originalTitle: string): number {
    // Calculate the actual length of the title in the original text
    const titleLength = originalTitle.length;
    let endPos = startPos + titleLength;
    
    // Adjust for potential whitespace differences
    while (endPos < text.length && /\s/.test(text[endPos])) {
      endPos++;
    }
    
    return endPos - startPos;
  }
  
  private findMultilineTitleInText(text: string, titleLines: string[]): { position: number; length: number } | null {
    const textLines = text.split('\n');
    
    for (let i = 0; i <= textLines.length - titleLines.length; i++) {
      let matches = true;
      
      for (let j = 0; j < titleLines.length; j++) {
        const textLine = textLines[i + j]?.trim().toLowerCase() || '';
        const titleLine = titleLines[j].toLowerCase();
        
        if (!textLine.includes(titleLine) && !titleLine.includes(textLine)) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        // Calculate position and length
        const startLinePos = textLines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
        const endLinePos = textLines.slice(0, i + titleLines.length).join('\n').length;
        
        return {
          position: startLinePos,
          length: endLinePos - startLinePos
        };
      }
    }
    
    return null;
  }
  
  private findFuzzyTitleMatch(text: string, titleWords: string[], originalTitle: string): { position: number; length: number } | null {
    const normalizedText = text.toLowerCase();
    const textWords = normalizedText.split(/\s+/);
    
    // Look for sequences where most title words appear close together
    for (let i = 0; i < textWords.length - titleWords.length + 1; i++) {
      const textSegment = textWords.slice(i, i + titleWords.length * 2); // Allow some flexibility
      const matchedWords = titleWords.filter(word => 
        textSegment.some(textWord => textWord.includes(word) || word.includes(textWord))
      );
      
      // If most words match, consider it a match
      if (matchedWords.length >= Math.ceil(titleWords.length * 0.7)) {
        // Find the actual position in the original text
        const wordsBefore = textWords.slice(0, i).join(' ');
        const position = normalizedText.indexOf(wordsBefore) + wordsBefore.length;
        
        return {
          position: position,
          length: originalTitle.length
        };
      }
    }
    
    return null;
  }

  private extractChapterTitle(content: string): string | null {
    // Look for common chapter title patterns at the beginning of content
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return null;
    
    const firstLine = lines[0];
    
    // Hebrew chapter patterns
    if (/^פרק\s+[\u0590-\u05FF\d]+[:：]?\s*[\u0590-\u05FF]/.test(firstLine)) {
      return firstLine;
    }
    
    // English chapter patterns
    if (/^chapter\s+\d+/i.test(firstLine)) {
      return firstLine;
    }
    
    // Numbered patterns
    if (/^\d+[.)]\s*[\u0590-\u05FF\w]/.test(firstLine)) {
      return firstLine;
    }
    
    return null;
  }
}
