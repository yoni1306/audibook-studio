// src/types/index.ts
export enum SplitPriority {
  CHAPTER = 0,
  PARAGRAPH = 1,
  SENTENCE_END = 2,
  SEMICOLON = 3,
  COMMA = 4,
  SPACE = 5
}

export interface Position {
  start: number;
  end: number;
}

export interface SplitPoint {
  position: number;
  priority: SplitPriority;
  marker: string;
  context: {
    before: string;
    after: string;
  };
  metadata?: Record<string, unknown>;
}

export interface TextChunk {
  content: string;
  position: Position;
  metadata?: ChunkMetadata;
  chapter?: ChapterInfo;
}

export interface ChunkMetadata {
  splitType?: string;
  ssml?: boolean;
  originalContent?: string;
  merged?: boolean;
  split?: boolean;
  [key: string]: unknown;
}

export interface ChapterInfo {
  id: string;
  title: string;
  index: number;
  chunkIndex: number;
}

export interface Chapter {
  id: string;
  title: string;
  position: Position;
  content: string;
  chunks?: TextChunk[];
}

export interface PluginConfig {
  enabled: boolean;
  [key: string]: unknown;
}

// src/interfaces/index.ts
export interface IPlugin {
  readonly name: string;
  config: PluginConfig;
  isEnabled(): boolean;
  configure(config: Partial<PluginConfig>): void;
}

export interface ISplitDetector extends IPlugin {
  findSplitPoints(text: string): SplitPoint[];
}

export interface IChunkProcessor extends IPlugin {
  process(text: string, chunks: TextChunk[]): TextChunk[] | Promise<TextChunk[]>;
}

// src/plugins/base/BasePlugin.ts
export abstract class BasePlugin implements IPlugin {
  abstract readonly name: string;
  
  protected _config: PluginConfig;

  constructor(config?: Partial<PluginConfig>) {
    this._config = {
      enabled: true,
      ...this.getDefaultConfig(),
      ...config
    };
  }

  get config(): PluginConfig {
    return this._config;
  }

  isEnabled(): boolean {
    return this._config.enabled;
  }

  configure(config: Partial<PluginConfig>): void {
    this._config = { ...this._config, ...config };
  }

  protected abstract getDefaultConfig(): Partial<PluginConfig>;
}

// src/plugins/detectors/HebrewPunctuationDetector.ts
import { BasePlugin } from '../base/BasePlugin';
import { ISplitDetector, SplitPoint, SplitPriority } from '../../types';

export class HebrewPunctuationDetector extends BasePlugin implements ISplitDetector {
  readonly name = 'HebrewPunctuationDetector';

  protected getDefaultConfig() {
    return {
      patterns: {
        [SplitPriority.SENTENCE_END]: /[׃:.!?]/g,
        [SplitPriority.SEMICOLON]: /[;]/g,
        [SplitPriority.COMMA]: /[,،]/g
      },
      contextLength: 20
    };
  }

  findSplitPoints(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    const patterns = this.config.patterns as Record<number, RegExp>;
    const contextLength = this.config.contextLength as number;
    
    for (const [priority, pattern] of Object.entries(patterns)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(text)) !== null) {
        points.push(this.createSplitPoint(
          text,
          match.index + match[0].length,
          parseInt(priority),
          match[0],
          contextLength
        ));
      }
    }
    
    return points;
  }

  private createSplitPoint(
    text: string,
    position: number,
    priority: SplitPriority,
    marker: string,
    contextLength: number
  ): SplitPoint {
    return {
      position,
      priority,
      marker,
      context: {
        before: text.slice(Math.max(0, position - contextLength), position),
        after: text.slice(position, Math.min(text.length, position + contextLength))
      }
    };
  }
}

// src/plugins/detectors/ChapterDetector.ts
import { BasePlugin } from '../base/BasePlugin';
import { ISplitDetector, SplitPoint, SplitPriority } from '../../types';

interface ChapterMatch {
  index: number;
  matchedText: string;
  title: string;
}

export class ChapterDetector extends BasePlugin implements ISplitDetector {
  readonly name = 'ChapterDetector';
  
  private chapterTitles: string[] = [];

  protected getDefaultConfig() {
    return {
      fuzzyMatch: true,
      matchThreshold: 0.8,
      requireNewline: true,
      numberPrefixPattern: /^(פרק\s+[\u0590-\u05FF\d]+|Chapter\s+\d+|[\d]+\.?)\s*/,
      contextLength: 50
    };
  }

  setChapterTitles(titles: string[]): void {
    this.chapterTitles = [...titles];
  }

  findSplitPoints(text: string): SplitPoint[] {
    if (!this.chapterTitles.length) {
      return [];
    }

    const matches = this.findAllChapterMatches(text);
    return matches.map(match => this.createChapterSplitPoint(text, match));
  }

  private findAllChapterMatches(text: string): ChapterMatch[] {
    const matches: ChapterMatch[] = [];
    
    for (const title of this.chapterTitles) {
      const titleMatches = this.findTitleMatches(text, title);
      matches.push(...titleMatches);
    }
    
    return matches.sort((a, b) => a.index - b.index);
  }

  private findTitleMatches(text: string, title: string): ChapterMatch[] {
    const matches: ChapterMatch[] = [];
    
    // Exact match
    matches.push(...this.findExactMatches(text, title));
    
    // Pattern match with prefix
    matches.push(...this.findPatternMatches(text, title));
    
    // Fuzzy match if enabled and no exact matches
    if (this.config.fuzzyMatch && matches.length === 0) {
      matches.push(...this.findFuzzyMatches(text, title));
    }
    
    return this.deduplicateMatches(matches);
  }

  private findExactMatches(text: string, title: string): ChapterMatch[] {
    const matches: ChapterMatch[] = [];
    let index = text.indexOf(title);
    
    while (index !== -1) {
      if (this.isValidChapterPosition(text, index)) {
        matches.push({ index, matchedText: title, title });
      }
      index = text.indexOf(title, index + 1);
    }
    
    return matches;
  }

  private findPatternMatches(text: string, title: string): ChapterMatch[] {
    const matches: ChapterMatch[] = [];
    const pattern = this.config.numberPrefixPattern as RegExp;
    const regex = new RegExp(`(${pattern.source})?\\s*${this.escapeRegex(title)}`, 'gi');
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      if (this.isValidChapterPosition(text, match.index)) {
        matches.push({
          index: match.index,
          matchedText: match[0],
          title
        });
      }
    }
    
    return matches;
  }

  private findFuzzyMatches(text: string, title: string): ChapterMatch[] {
    const matches: ChapterMatch[] = [];
    const lines = text.split('\n');
    const threshold = this.config.matchThreshold as number;
    let currentPos = 0;
    
    for (const line of lines) {
      const similarity = this.calculateSimilarity(line.trim(), title);
      
      if (similarity >= threshold) {
        matches.push({
          index: currentPos,
          matchedText: line.trim(),
          title
        });
      }
      
      currentPos += line.length + 1;
    }
    
    return matches;
  }

  private isValidChapterPosition(text: string, index: number): boolean {
    if (!this.config.requireNewline) return true;
    return index === 0 || text[index - 1] === '\n';
  }

  private createChapterSplitPoint(text: string, match: ChapterMatch): SplitPoint {
    const contextLength = this.config.contextLength as number;
    
    return {
      position: match.index,
      priority: SplitPriority.CHAPTER,
      marker: match.matchedText,
      context: {
        before: text.slice(Math.max(0, match.index - contextLength), match.index),
        after: text.slice(match.index, Math.min(text.length, match.index + 100))
      },
      metadata: {
        type: 'chapter',
        title: match.title,
        matchedText: match.matchedText
      }
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str2.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const cost = str2[i - 1] === str1[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + cost,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private deduplicateMatches(matches: ChapterMatch[]): ChapterMatch[] {
    return matches.filter((match, index, self) =>
      index === self.findIndex(m => m.index === match.index)
    );
  }
}

// src/plugins/processors/ChunkSizeOptimizer.ts
import { BasePlugin } from '../base/BasePlugin';
import { IChunkProcessor, TextChunk, Position } from '../../types';

export class ChunkSizeOptimizer extends BasePlugin implements IChunkProcessor {
  readonly name = 'ChunkSizeOptimizer';

  protected getDefaultConfig() {
    return {
      minSize: 200,
      maxSize: 500,
      targetSize: 350,
      mergeTiny: true,
      splitLarge: true
    };
  }

  process(text: string, chunks: TextChunk[]): TextChunk[] {
    if (!this.isEnabled()) return chunks;
    
    const optimized = this.config.mergeTiny 
      ? this.mergeSmallChunks(chunks)
      : chunks;
    
    return this.config.splitLarge
      ? this.splitLargeChunks(optimized)
      : optimized;
  }

  private mergeSmallChunks(chunks: TextChunk[]): TextChunk[] {
    const result: TextChunk[] = [];
    let buffer: TextChunk | null = null;
    
    for (const chunk of chunks) {
      if (this.shouldMerge(chunk, buffer)) {
        buffer = this.mergeChunks(buffer!, chunk);
      } else {
        if (buffer) result.push(buffer);
        buffer = chunk;
      }
    }
    
    if (buffer) result.push(buffer);
    return result;
  }

  private splitLargeChunks(chunks: TextChunk[]): TextChunk[] {
    const result: TextChunk[] = [];
    
    for (const chunk of chunks) {
      if (chunk.content.length > this.config.maxSize) {
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
    return chunk.content.length < this.config.minSize && 
           combinedLength <= this.config.maxSize;
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
    const sentences = text.split(/([.!?׃:])/);
    const result: string[] = [];
    
    for (let i = 0; i < sentences.length - 1; i += 2) {
      if (sentences[i].trim()) {
        result.push(sentences[i] + sentences[i + 1]);
      }
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

// src/plugins/processors/SSMLWrapper.ts
import { BasePlugin } from '../base/BasePlugin';
import { IChunkProcessor, TextChunk } from '../../types';

export class SSMLWrapper extends BasePlugin implements IChunkProcessor {
  readonly name = 'SSMLWrapper';

  protected getDefaultConfig() {
    return {
      rate: 'medium',
      pitch: 'medium',
      volume: 'medium',
      addPauses: true,
      pauseDuration: '200ms',
      wrapSentences: true
    };
  }

  process(text: string, chunks: TextChunk[]): TextChunk[] {
    if (!this.isEnabled()) return chunks;
    
    return chunks.map((chunk, index) => ({
      ...chunk,
      content: this.wrapInSSML(chunk.content, index === 0),
      metadata: {
        ...chunk.metadata,
        ssml: true,
        originalContent: chunk.content
      }
    }));
  }

  private wrapInSSML(content: string, isFirst: boolean): string {
    const { rate, pitch, volume, addPauses, pauseDuration, wrapSentences } = this.config;
    
    const processedContent = wrapSentences 
      ? this.wrapSentencesInTags(content)
      : content;
    
    const pauseTag = !isFirst && addPauses 
      ? `    <break time="${pauseDuration}"/>\n`
      : '';
    
    return `<speak>
  <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
${pauseTag}${processedContent}
  </prosody>
</speak>`;
  }

  private wrapSentencesInTags(content: string): string {
    const sentences = this.splitIntoSentences(content);
    return sentences
      .map(s => `    <s>${s}</s>`)
      .join('\n');
  }

  private splitIntoSentences(text: string): string[] {
    const sentences = text.split(/([.!?׃:])/);
    const result: string[] = [];
    
    for (let i = 0; i < sentences.length - 1; i += 2) {
      const sentence = sentences[i].trim();
      if (sentence) {
        result.push(sentence + sentences[i + 1]);
      }
    }
    
    // Handle last sentence if no punctuation at end
    if (sentences.length % 2 === 1 && sentences[sentences.length - 1].trim()) {
      result.push(sentences[sentences.length - 1].trim());
    }
    
    return result;
  }
}

// src/core/HebrewTTSSplitter.ts
import { 
  TextChunk, 
  Chapter, 
  SplitPoint, 
  ISplitDetector, 
  IChunkProcessor,
  Position
} from '../types';
import { ChapterDetector } from '../plugins/detectors/ChapterDetector';

export interface SplitterConfig {
  minChunkSize: number;
  maxChunkSize: number;
  processChaptersSeparately: boolean;
  debug: boolean;
}

export class HebrewTTSSplitter {
  private splitDetectors: ISplitDetector[] = [];
  private processors: IChunkProcessor[] = [];
  private chapterDetector: ChapterDetector | null = null;
  private config: SplitterConfig;

  constructor(config?: Partial<SplitterConfig>) {
    this.config = {
      minChunkSize: 200,
      maxChunkSize: 500,
      processChaptersSeparately: true,
      debug: false,
      ...config
    };
  }

  setChapterTitles(titles: string[]): this {
    if (!this.chapterDetector) {
      this.chapterDetector = new ChapterDetector();
      this.splitDetectors.unshift(this.chapterDetector);
    }
    this.chapterDetector.setChapterTitles(titles);
    return this;
  }

  addSplitDetector(detector: ISplitDetector): this {
    this.splitDetectors.push(detector);
    return this;
  }

  addProcessor(processor: IChunkProcessor): this {
    this.processors.push(processor);
    return this;
  }

  removePlugin(name: string): this {
    this.splitDetectors = this.splitDetectors.filter(d => d.name !== name);
    this.processors = this.processors.filter(p => p.name !== name);
    if (this.chapterDetector?.name === name) {
      this.chapterDetector = null;
    }
    return this;
  }

  configure(config: Partial<SplitterConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  configurePlugin(name: string, config: Record<string, unknown>): this {
    const plugin = this.findPlugin(name);
    plugin?.configure(config);
    return this;
  }

  async splitText(text: string): Promise<TextChunk[]> {
    this.log('Starting text split process...');

    if (this.shouldProcessByChapters()) {
      return this.splitByChapters(text);
    }

    return this.processText(text);
  }

  private shouldProcessByChapters(): boolean {
    return this.config.processChaptersSeparately && 
           this.chapterDetector !== null &&
           (this.chapterDetector.config.chapterTitles as string[])?.length > 0;
  }

  private async splitByChapters(text: string): Promise<TextChunk[]> {
    const chapters = this.detectChapters(text);
    this.log(`Found ${chapters.length} chapters`);

    const allChunks: TextChunk[] = [];
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      this.log(`Processing chapter: ${chapter.title}`);

      const chapterChunks = await this.processChapter(chapter, i);
      allChunks.push(...chapterChunks);
    }

    return allChunks;
  }

  private detectChapters(text: string): Chapter[] {
    const chapterPoints = this.chapterDetector!.findSplitPoints(text);
    
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
    const lines = content.split('\n');
    let bodyStart = 1; // Skip title line
    
    // Skip empty lines after title
    while (bodyStart < lines.length && !lines[bodyStart].trim()) {
      bodyStart++;
    }
    
    return lines.slice(bodyStart).join('\n');
  }

  private async processText(text: string, offset: number = 0): Promise<TextChunk[]> {
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
        const forcedChunks = this.forceSpitLargeSection(
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

  private forceSpitLargeSection(
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
      metadata: { splitType: splitType || 'punctuation' }
    };
  }

  private findPlugin(name: string): IPlugin | undefined {
    return [...this.splitDetectors, ...this.processors].find(p => p.name === name);
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[HebrewTTSSplitter] ${message}`);
    }
  }
}

// src/analysis/AudioChapterAnalyzer.ts
export interface ChapterAnalysis {
  id: string;
  title: string;
  chunks: TextChunk[];
  totalWords: number;
  totalCharacters: number;
  estimatedDuration: number;
}

export class AudioChapterAnalyzer {
  private static readonly DEFAULT_WPM = 150;
  
  constructor(private wordsPerMinute: number = AudioChapterAnalyzer.DEFAULT_WPM) {}

  analyzeChapters(chunks: TextChunk[]): Map<string, ChapterAnalysis> {
    const chapterMap = new Map<string, ChapterAnalysis>();
    
    for (const chunk of chunks) {
      if (!chunk.chapter) continue;
      
      const chapterId = chunk.chapter.id;
      
      if (!chapterMap.has(chapterId)) {
        chapterMap.set(chapterId, {
          id: chapterId,
          title: chunk.chapter.title,
          chunks: [],
          totalWords: 0,
          totalCharacters: 0,
          estimatedDuration: 0
        });
      }
      
      const chapter = chapterMap.get(chapterId)!;
      chapter.chunks.push(chunk);
      
      const words = this.countWords(chunk.content);
      chapter.totalWords += words;
      chapter.totalCharacters += chunk.content.length;
    }
    
    // Calculate durations
    for (const chapter of chapterMap.values()) {
      chapter.estimatedDuration = this.calculateDuration(chapter.totalWords);
    }
    
    return chapterMap;
  }

  generateReport(chunks: TextChunk[]): string {
    const analysis = this.analyzeChapters(chunks);
    const lines: string[] = [
      'Chapter Analysis Report',
      '='.repeat(50),
      '',
      `Total Chapters: ${analysis.size}`,
      `Total Chunks: ${chunks.length}`,
      ''
    ];
    
    analysis.forEach(chapter => {
      lines.push(
        `Chapter: ${chapter.title}`,
        `- Chunks: ${chapter.chunks.length}`,
        `- Words: ${chapter.totalWords.toLocaleString()}`,
        `- Characters: ${chapter.totalCharacters.toLocaleString()}`,
        `- Estimated Duration: ${this.formatDuration(chapter.estimatedDuration)}`,
        ''
      );
    });
    
    const totalDuration = Array.from(analysis.values())
      .reduce((sum, ch) => sum + ch.estimatedDuration, 0);
    
    lines.push(
      '='.repeat(50),
      `Total Estimated Duration: ${this.formatDuration(totalDuration)}`
    );
    
    return lines.join('\n');
  }

  private countWords(text: string): number {
    // Remove SSML tags if present
    const cleanText = text.replace(/<[^>]*>/g, '');
    return cleanText.split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateDuration(wordCount: number): number {
    return (wordCount / this.wordsPerMinute) * 60; // seconds
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  }
}

// src/factory/presets.ts
import { HebrewTTSSplitter } from '../core/HebrewTTSSplitter';
import { HebrewPunctuationDetector } from '../plugins/detectors/HebrewPunctuationDetector';
import { ChapterDetector } from '../plugins/detectors/ChapterDetector';
import { ChunkSizeOptimizer } from '../plugins/processors/ChunkSizeOptimizer';
import { SSMLWrapper } from '../plugins/processors/SSMLWrapper';

export type PresetName = 'default' | 'narrative' | 'dialogue' | 'technical';

interface PresetConfig {
  detectors: Array<{ plugin: any; config?: Record<string, any> }>;
  processors: Array<{ plugin: any; config?: Record<string, any> }>;
  splitterConfig?: Partial<SplitterConfig>;
}

const PRESETS: Record<PresetName, PresetConfig> = {
  default: {
    detectors: [
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { plugin: ChunkSizeOptimizer },
      { plugin: SSMLWrapper }
    ]
  },
  
  narrative: {
    detectors: [
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { 
        plugin: ChunkSizeOptimizer,
        config: { targetSize: 400, minSize: 250 }
      },
      {
        plugin: SSMLWrapper,
        config: { pauseDuration: '250ms', rate: 'medium' }
      }
    ]
  },
  
  dialogue: {
    detectors: [
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { 
        plugin: ChunkSizeOptimizer,
        config: { minSize: 150, maxSize: 400 }
      },
      {
        plugin: SSMLWrapper,
        config: { pauseDuration: '300ms', pitch: 'medium' }
      }
    ]
  },
  
  technical: {
    detectors: [
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { 
        plugin: ChunkSizeOptimizer,
        config: { minSize: 250, maxSize: 600 }
      },
      {
        plugin: SSMLWrapper,
        config: { rate: 'slow', wrapSentences: true }
      }
    ],
    splitterConfig: {
      maxChunkSize: 600
    }
  }
};

export function createHebrewTTSSplitter(preset: PresetName = 'default'): HebrewTTSSplitter {
  const config = PRESETS[preset];
  const splitter = new HebrewTTSSplitter(config.splitterConfig);
  
  // Add detectors
  for (const { plugin: Plugin, config } of config.detectors) {
    const instance = new Plugin(config);
    splitter.addSplitDetector(instance);
  }
  
  // Add processors
  for (const { plugin: Plugin, config } of config.processors) {
    const instance = new Plugin(config);
    splitter.addProcessor(instance);
  }
  
  return splitter;
}

// src/index.ts - Main entry point
export * from './types';
export * from './interfaces';
export * from './core/HebrewTTSSplitter';
export * from './plugins/base/BasePlugin';
export * from './plugins/detectors/HebrewPunctuationDetector';
export * from './plugins/detectors/ChapterDetector';
export * from './plugins/processors/ChunkSizeOptimizer';
export * from './plugins/processors/SSMLWrapper';
export * from './analysis/AudioChapterAnalyzer';
export * from './factory/presets';

// Example usage with better error handling
export async function processBook(
  bookText: string,
  chapterTitles: string[],
  options?: {
    preset?: PresetName;
    outputFormat?: 'json' | 'ssml' | 'plain';
    generateReport?: boolean;
  }
): Promise<{
  chunks: TextChunk[];
  report?: string;
  error?: Error;
}> {
  try {
    const preset = options?.preset || 'narrative';
    const splitter = createHebrewTTSSplitter(preset);
    
    if (chapterTitles.length > 0) {
      splitter.setChapterTitles(chapterTitles);
    }
    
    const chunks = await splitter.splitText(bookText);
    
    // Format output based on options
    const formattedChunks = formatChunks(chunks, options?.outputFormat || 'plain');
    
    // Generate report if requested
    const report = options?.generateReport
      ? new AudioChapterAnalyzer().generateReport(chunks)
      : undefined;
    
    return { chunks: formattedChunks, report };
  } catch (error) {
    console.error('Error processing book:', error);
    return { 
      chunks: [], 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

function formatChunks(chunks: TextChunk[], format: 'json' | 'ssml' | 'plain'): TextChunk[] {
  switch (format) {
    case 'json':
      // Already in correct format
      return chunks;
      
    case 'ssml':
      // Ensure SSML formatting
      return chunks.map(chunk => ({
        ...chunk,
        content: chunk.metadata?.ssml 
          ? chunk.content 
          : `<speak>${chunk.content}</speak>`
      }));
      
    case 'plain':
      // Strip SSML if present
      return chunks.map(chunk => ({
        ...chunk,
        content: chunk.metadata?.originalContent || 
                 chunk.content.replace(/<[^>]*>/g, '')
      }));
      
    default:
      return chunks;
  }
}