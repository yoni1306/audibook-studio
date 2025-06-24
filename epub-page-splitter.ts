// src/plugins/detectors/EPUBPageDetector.ts
import { BasePlugin } from '../base/BasePlugin';
import { ISplitDetector } from '../../interfaces';
import { SplitPoint, SplitPriority } from '../../types';
import * as cheerio from 'cheerio';

export interface EPUBPage {
  content: string;
  sourceFile: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

export class EPUBPageDetector extends BasePlugin implements ISplitDetector {
  readonly name = 'EPUBPageDetector';
  
  private epubPages: EPUBPage[] = [];

  protected getDefaultConfig() {
    return {
      // Page-based splitting priority (between CHAPTER and PARAGRAPH)
      priority: SplitPriority.PARAGRAPH - 0.5,
      // Consider natural page breaks from EPUB structure
      respectPageBreaks: true,
      // CSS selectors that typically indicate page breaks
      pageBreakSelectors: [
        '.page-break',
        '[style*="page-break"]',
        'div[class*="chapter"]',
        'section',
        'article',
        'h1', 'h2', 'h3', // Headings often start new pages
      ],
      // Block elements that create natural boundaries
      blockElements: [
        'p', 'div', 'section', 'article', 'blockquote',
        'ul', 'ol', 'figure', 'aside', 'nav'
      ],
      // Target size for EPUB pages (characters)
      targetPageSize: 1000,
      maxPageSize: 2000,
      minPageSize: 300
    };
  }

  setEPUBContent(pages: EPUBPage[]): void {
    this.epubPages = pages;
  }

  findSplitPoints(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    
    // If we have pre-processed EPUB pages, use them
    if (this.epubPages.length > 0) {
      return this.findPageBasedSplitPoints();
    }
    
    // Otherwise, try to detect page-like structures in the text
    return this.findStructuralSplitPoints(text);
  }

  private findPageBasedSplitPoints(): SplitPoint[] {
    const points: SplitPoint[] = [];
    const priority = this.config.priority as number;
    
    for (let i = 0; i < this.epubPages.length - 1; i++) {
      const page = this.epubPages[i];
      const nextPage = this.epubPages[i + 1];
      
      points.push({
        position: page.endOffset,
        priority: priority,
        marker: '[EPUB_PAGE_BREAK]',
        context: {
          before: page.content.slice(-50),
          after: nextPage.content.slice(0, 50)
        },
        metadata: {
          type: 'epub_page',
          pageNumber: page.pageNumber,
          sourceFile: page.sourceFile
        }
      });
    }
    
    return points;
  }

  private findStructuralSplitPoints(text: string): SplitPoint[] {
    // Fallback: detect HTML-like structure in text
    const points: SplitPoint[] = [];
    const htmlPattern = /<\/?(p|div|section|article|h[1-6])[^>]*>/gi;
    let match: RegExpExecArray | null;
    
    while ((match = htmlPattern.exec(text)) !== null) {
      if (this.isPageBreakElement(match[0])) {
        points.push({
          position: match.index + match[0].length,
          priority: this.config.priority as number,
          marker: match[0],
          context: {
            before: text.slice(Math.max(0, match.index - 50), match.index),
            after: text.slice(match.index + match[0].length, match.index + match[0].length + 50)
          },
          metadata: {
            type: 'structural_break',
            element: match[1]
          }
        });
      }
    }
    
    return points;
  }

  private isPageBreakElement(element: string): boolean {
    const pageBreakSelectors = this.config.pageBreakSelectors as string[];
    return pageBreakSelectors.some(selector => 
      element.toLowerCase().includes(selector.replace('.', '').replace('[', ''))
    );
  }
}

// src/utils/epubProcessor.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { EPUBPage } from '../plugins/detectors/EPUBPageDetector';

export interface EPUBChapter {
  title: string;
  href: string;
  content?: string;
  pages?: EPUBPage[];
}

export interface EPUBMetadata {
  title: string;
  author: string;
  language: string;
  chapters: EPUBChapter[];
}

export class EPUBProcessor {
  private metadata: EPUBMetadata | null = null;
  
  constructor(
    private epubPath: string,
    private config: {
      targetPageSize?: number;
      preserveFormatting?: boolean;
      extractImages?: boolean;
    } = {}
  ) {}

  async extractPages(): Promise<EPUBPage[]> {
    // This is a simplified version - in reality you'd use a library like epub.js or epubjs-reader
    const pages: EPUBPage[] = [];
    
    // Parse EPUB structure (simplified for example)
    const chapters = await this.extractChapters();
    
    let globalOffset = 0;
    let pageNumber = 1;
    
    for (const chapter of chapters) {
      const chapterPages = await this.paginateChapter(chapter, globalOffset, pageNumber);
      pages.push(...chapterPages);
      
      if (chapterPages.length > 0) {
        const lastPage = chapterPages[chapterPages.length - 1];
        globalOffset = lastPage.endOffset;
        pageNumber = lastPage.pageNumber + 1;
      }
    }
    
    return pages;
  }

  private async extractChapters(): Promise<EPUBChapter[]> {
    // Simplified - would parse OPF file and spine
    return [
      { title: 'Chapter 1', href: 'chapter1.xhtml' },
      { title: 'Chapter 2', href: 'chapter2.xhtml' }
    ];
  }

  private async paginateChapter(
    chapter: EPUBChapter,
    startOffset: number,
    startPageNumber: number
  ): Promise<EPUBPage[]> {
    const pages: EPUBPage[] = [];
    const content = await this.loadChapterContent(chapter.href);
    const $ = cheerio.load(content);
    
    // Extract text blocks that would naturally form pages
    const blocks = this.extractPageBlocks($);
    
    let currentPage = '';
    let pageOffset = startOffset;
    let pageNum = startPageNumber;
    
    for (const block of blocks) {
      const blockText = this.extractText(block);
      
      // Check if adding this block would exceed target page size
      if (currentPage.length + blockText.length > (this.config.targetPageSize || 1000)) {
        // Save current page
        if (currentPage.length > 0) {
          pages.push({
            content: currentPage.trim(),
            sourceFile: chapter.href,
            pageNumber: pageNum++,
            startOffset: pageOffset,
            endOffset: pageOffset + currentPage.length
          });
          pageOffset += currentPage.length;
          currentPage = '';
        }
      }
      
      currentPage += blockText + '\n\n';
    }
    
    // Add remaining content as last page
    if (currentPage.length > 0) {
      pages.push({
        content: currentPage.trim(),
        sourceFile: chapter.href,
        pageNumber: pageNum,
        startOffset: pageOffset,
        endOffset: pageOffset + currentPage.length
      });
    }
    
    return pages;
  }

  private extractPageBlocks($: cheerio.CheerioAPI): cheerio.Cheerio[] {
    const blocks: cheerio.Cheerio[] = [];
    
    // Elements that typically create visual page breaks
    const pageElements = [
      'body > *',
      'section',
      'article',
      'div.chapter',
      'div.section'
    ];
    
    pageElements.forEach(selector => {
      $(selector).each((_, elem) => {
        const $elem = $(elem);
        
        // Check for explicit page breaks
        if (this.hasPageBreak($elem)) {
          blocks.push($elem);
        } else {
          // Extract child blocks
          $elem.find('p, div, blockquote, ul, ol, h1, h2, h3, h4, h5, h6').each((_, child) => {
            blocks.push($(child));
          });
        }
      });
    });
    
    return blocks;
  }

  private hasPageBreak($elem: cheerio.Cheerio): boolean {
    const style = $elem.attr('style') || '';
    const className = $elem.attr('class') || '';
    
    return style.includes('page-break') || 
           className.includes('page-break') ||
           className.includes('chapter');
  }

  private extractText(elem: cheerio.Cheerio): string {
    // Remove scripts, styles, etc.
    elem.find('script, style, noscript').remove();
    
    // Get text content
    let text = elem.text().trim();
    
    // Preserve some formatting if configured
    if (this.config.preserveFormatting) {
      // Add line breaks for block elements
      elem.find('br').replaceWith('\n');
      elem.find('p').append('\n');
    }
    
    return text;
  }

  private async loadChapterContent(href: string): Promise<string> {
    // Simplified - would extract from EPUB zip
    return '<p>Chapter content here...</p>';
  }
}

// src/plugins/processors/EPUBPageOptimizer.ts
import { BasePlugin } from '../base/BasePlugin';
import { IChunkProcessor } from '../../interfaces';
import { TextChunk } from '../../types';

export class EPUBPageOptimizer extends BasePlugin implements IChunkProcessor {
  readonly name = 'EPUBPageOptimizer';

  protected getDefaultConfig() {
    return {
      // Optimize EPUB pages that are too large or too small
      optimizeSize: true,
      minPageSize: 300,
      maxPageSize: 1500,
      targetPageSize: 800,
      
      // Respect visual breaks
      preservePageBreaks: true,
      
      // Merge very small pages (like single paragraph pages)
      mergeSmallPages: true,
      
      // Split very large pages at natural boundaries
      splitLargePages: true
    };
  }

  async process(text: string, chunks: TextChunk[]): Promise<TextChunk[]> {
    if (!this.isEnabled()) return chunks;
    
    let optimized = chunks;
    
    // First pass: identify EPUB page chunks
    const epubPages = chunks.filter(c => c.metadata?.type === 'epub_page');
    const otherChunks = chunks.filter(c => c.metadata?.type !== 'epub_page');
    
    if (epubPages.length === 0) {
      // No EPUB pages to optimize
      return chunks;
    }
    
    // Optimize EPUB pages
    if (this.config.mergeSmallPages) {
      optimized = this.mergeSmallEPUBPages(epubPages);
    }
    
    if (this.config.splitLargePages) {
      optimized = await this.splitLargeEPUBPages(optimized, text);
    }
    
    // Combine with other chunks and sort by position
    const allChunks = [...optimized, ...otherChunks];
    return allChunks.sort((a, b) => a.position.start - b.position.start);
  }

  private mergeSmallEPUBPages(pages: TextChunk[]): TextChunk[] {
    const minSize = this.config.minPageSize as number;
    const maxSize = this.config.maxPageSize as number;
    const result: TextChunk[] = [];
    let buffer: TextChunk | null = null;
    
    for (const page of pages) {
      if (!buffer) {
        buffer = page;
        continue;
      }
      
      const combinedLength = buffer.content.length + page.content.length;
      
      // Merge if both are small and combined size is reasonable
      if (buffer.content.length < minSize && 
          page.content.length < minSize && 
          combinedLength <= maxSize) {
        buffer = {
          ...buffer,
          content: buffer.content + '\n\n' + page.content,
          position: {
            start: buffer.position.start,
            end: page.position.end
          },
          metadata: {
            ...buffer.metadata,
            mergedPages: true,
            originalPageCount: 2
          }
        };
      } else {
        result.push(buffer);
        buffer = page;
      }
    }
    
    if (buffer) {
      result.push(buffer);
    }
    
    return result;
  }

  private async splitLargeEPUBPages(
    pages: TextChunk[],
    fullText: string
  ): Promise<TextChunk[]> {
    const maxSize = this.config.maxPageSize as number;
    const targetSize = this.config.targetPageSize as number;
    const result: TextChunk[] = [];
    
    for (const page of pages) {
      if (page.content.length <= maxSize) {
        result.push(page);
        continue;
      }
      
      // Split large page at natural boundaries
      const subPages = this.splitAtNaturalBoundaries(page, targetSize);
      result.push(...subPages);
    }
    
    return result;
  }

  private splitAtNaturalBoundaries(
    page: TextChunk,
    targetSize: number
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    
    // Split by paragraphs (double newline)
    const paragraphs = page.content.split(/\n\n+/);
    
    let currentChunk = '';
    let currentStart = page.position.start;
    
    for (const paragraph of paragraphs) {
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
}

// src/factory/epubPreset.ts
import { HebrewTTSSplitter } from '../core/HebrewTTSSplitter';
import { EPUBPageDetector } from '../plugins/detectors/EPUBPageDetector';
import { EPUBPageOptimizer } from '../plugins/processors/EPUBPageOptimizer';
import { HebrewPunctuationDetector } from '../plugins/detectors/HebrewPunctuationDetector';
import { ChunkSizeOptimizer } from '../plugins/processors/ChunkSizeOptimizer';
import { SSMLWrapper } from '../plugins/processors/SSMLWrapper';
import { EPUBProcessor, EPUBPage } from '../utils/epubProcessor';

export async function createEPUBSplitter(
  epubPath: string,
  options?: {
    usePageStructure?: boolean;
    optimizePages?: boolean;
    targetPageSize?: number;
    finalOptimization?: boolean;
  }
): Promise<HebrewTTSSplitter> {
  const splitter = new HebrewTTSSplitter({
    processChaptersSeparately: true
  });

  // Process EPUB to extract pages if requested
  if (options?.usePageStructure !== false) {
    const epubProcessor = new EPUBProcessor(epubPath, {
      targetPageSize: options?.targetPageSize || 1000
    });
    
    const pages = await epubProcessor.extractPages();
    
    // Add EPUB page detector with extracted pages
    const pageDetector = new EPUBPageDetector();
    pageDetector.setEPUBContent(pages);
    splitter.addSplitDetector(pageDetector);
  }

  // Add standard Hebrew punctuation detection
  splitter.addSplitDetector(new HebrewPunctuationDetector());

  // Add EPUB page optimizer if requested
  if (options?.optimizePages !== false) {
    splitter.addProcessor(new EPUBPageOptimizer({
      targetPageSize: options?.targetPageSize || 800,
      mergeSmallPages: true,
      splitLargePages: true
    }));
  }

  // Add final optimization if requested
  if (options?.finalOptimization) {
    splitter.addProcessor(new ChunkSizeOptimizer({
      minSize: 200,
      maxSize: 600,
      targetSize: 400
    }));
  }

  // Always add SSML wrapper
  splitter.addProcessor(new SSMLWrapper());

  return splitter;
}

// Example usage
async function processEPUBBook() {
  const epubPath = './book.epub';
  
  // Create EPUB-aware splitter
  const splitter = await createEPUBSplitter(epubPath, {
    usePageStructure: true,
    optimizePages: true,
    targetPageSize: 800,
    finalOptimization: true
  });
  
  // Set chapter titles if known
  splitter.setChapterTitles(['Chapter 1', 'Chapter 2']);
  
  // Process the book text (extracted from EPUB)
  const bookText = await extractTextFromEPUB(epubPath);
  const chunks = await splitter.splitText(bookText);
  
  console.log(`Total chunks: ${chunks.length}`);
  
  // Analyze page-based chunks
  const epubPageChunks = chunks.filter(c => 
    c.metadata?.type === 'epub_page' || 
    c.metadata?.type === 'epub_page_split'
  );
  
  console.log(`EPUB page-based chunks: ${epubPageChunks.length}`);
}

async function extractTextFromEPUB(epubPath: string): Promise<string> {
  // Implementation would extract all text from EPUB
  return 'Full book text here...';
}