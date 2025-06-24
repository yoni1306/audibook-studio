import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import * as unzipper from 'unzipper';
import { createLogger } from '@audibook/logger';
import { EPUBPage, EPUBChapter, EPUBMetadata } from '../types';

const logger = createLogger('EPUBProcessor');

export class EPUBProcessor {
  private metadata: EPUBMetadata | null = null;

  constructor(
    private epubPath: string,
    private config: {
      targetPageSize?: number;
      preserveFormatting?: boolean;
      extractImages?: boolean;
    } = {}
  ) {
    this.config = {
      targetPageSize: 1000,
      preserveFormatting: false,
      extractImages: false,
      ...config,
    };
  }

  async extractPages(): Promise<EPUBPage[]> {
    logger.info('Starting EPUB page extraction', { epubPath: this.epubPath });

    const chapters = await this.extractChapters();
    const pages: EPUBPage[] = [];
    let currentOffset = 0;
    let pageNumber = 1;

    for (const chapter of chapters) {
      if (!chapter.content) continue;

      const chapterPages = await this.paginateChapter(
        chapter,
        currentOffset,
        pageNumber
      );

      pages.push(...chapterPages);
      currentOffset += chapter.content.length;
      pageNumber += chapterPages.length;
    }

    logger.info('EPUB page extraction completed', {
      totalPages: pages.length,
      totalChapters: chapters.length,
    });

    return pages;
  }

  async extractChapters(): Promise<EPUBChapter[]> {
    // Extract EPUB to temp directory
    const tempDir = path.join('/tmp', `epub-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Unzip the EPUB
      await new Promise<void>((resolve, reject) => {
        const fs_sync = require('fs');
        fs_sync.createReadStream(this.epubPath)
          .pipe(unzipper.Extract({ path: tempDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      // Read container.xml to find content.opf
      const containerPath = path.join(tempDir, 'META-INF', 'container.xml');
      const containerXml = await fs.readFile(containerPath, 'utf-8');
      const container = await parseStringPromise(containerXml);

      const opfPath = container.container.rootfiles[0].rootfile[0].$['full-path'];
      const opfDir = path.dirname(path.join(tempDir, opfPath));
      const opfContent = await fs.readFile(path.join(tempDir, opfPath), 'utf-8');
      const opf = await parseStringPromise(opfContent);

      // Extract metadata
      const metadata = opf.package.metadata[0];
      this.metadata = {
        title: metadata['dc:title']?.[0] || 'Unknown Title',
        author: metadata['dc:creator']?.[0]?._ || metadata['dc:creator']?.[0] || 'Unknown Author',
        language: metadata['dc:language']?.[0] || 'en',
        chapters: [],
      };

      // Get spine order and manifest
      const spine = opf.package.spine[0].itemref;
      const manifest = opf.package.manifest[0].item;

      // Create manifest map
      const manifestMap = new Map();
      manifest.forEach((item: { $: { id: string; href: string } }) => {
        manifestMap.set(item.$.id, item.$.href);
      });

      // Process each spine item
      const chapters: EPUBChapter[] = [];
      for (const spineItem of spine) {
        const itemId = spineItem.$.idref;
        const href = manifestMap.get(itemId);

        if (!href) continue;

        const chapter: EPUBChapter = {
          title: `Chapter ${chapters.length + 1}`,
          href,
        };

        try {
          chapter.content = await this.loadChapterContent(path.join(opfDir, href));
          chapters.push(chapter);
        } catch (error) {
          logger.warn('Failed to load chapter content', { href, error: error.message });
        }
      }

      this.metadata.chapters = chapters;
      return chapters;
    } finally {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true }).catch((error) => {
        logger.warn('Failed to clean up temp directory', { error: error.message });
      });
    }
  }

  private async paginateChapter(
    chapter: EPUBChapter,
    startOffset: number,
    startPageNumber: number
  ): Promise<EPUBPage[]> {
    if (!chapter.content) return [];

    const $ = cheerio.load(chapter.content);
    const pageBlocks = this.extractPageBlocks($);
    const pages: EPUBPage[] = [];
    const targetSize = this.config.targetPageSize || 1000;

    let currentOffset = startOffset;
    let pageNumber = startPageNumber;
    let currentPageContent = '';

    for (const block of pageBlocks) {
      const blockText = this.extractText(block);
      
      // Check if this block should start a new page
      if (this.hasPageBreak(block) && currentPageContent.length > 0) {
        // Save current page
        pages.push({
          content: currentPageContent.trim(),
          sourceFile: chapter.href,
          pageNumber: pageNumber++,
          startOffset: currentOffset - currentPageContent.length,
          endOffset: currentOffset,
        });
        currentPageContent = '';
      }

      // Check if adding this block would exceed target size
      if (currentPageContent.length + blockText.length > targetSize && currentPageContent.length > 0) {
        // Save current page
        pages.push({
          content: currentPageContent.trim(),
          sourceFile: chapter.href,
          pageNumber: pageNumber++,
          startOffset: currentOffset - currentPageContent.length,
          endOffset: currentOffset,
        });
        currentPageContent = blockText;
      } else {
        currentPageContent += (currentPageContent ? '\n\n' : '') + blockText;
      }

      currentOffset += blockText.length + 2; // +2 for \n\n
    }

    // Add remaining content
    if (currentPageContent.trim().length > 0) {
      pages.push({
        content: currentPageContent.trim(),
        sourceFile: chapter.href,
        pageNumber: pageNumber,
        startOffset: currentOffset - currentPageContent.length,
        endOffset: currentOffset,
      });
    }

    return pages;
  }

  private extractPageBlocks($: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.Element>[] {
    const blocks: cheerio.Cheerio<cheerio.Element>[] = [];
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Find all block-level elements that contain text
    const blockSelectors = [
      'p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'li', 'td', 'th'
    ];
    
    for (const selector of blockSelectors) {
      $(selector).each((_, element) => {
        const $elem = $(element);
        const text = this.extractText($elem);
        
        // Only include blocks with substantial text content
        if (text.trim().length > 10) {
          blocks.push($elem);
        }
      });
    }
    
    // Sort by document order
    blocks.sort((a, b) => {
      const aIndex = a.index();
      const bIndex = b.index();
      return aIndex - bIndex;
    });
    
    return blocks;
  }

  private hasPageBreak($elem: cheerio.Cheerio<cheerio.Element>): boolean {
    // Check for explicit page break styles
    const style = $elem.attr('style') || '';
    if (style.includes('page-break') || style.includes('break-before') || style.includes('break-after')) {
      return true;
    }
    
    // Check for page break classes
    const className = $elem.attr('class') || '';
    if (className.includes('page-break') || className.includes('chapter')) {
      return true;
    }
    
    // Check if it's a heading (often indicates new page/section)
    const tagName = $elem.prop('tagName')?.toLowerCase();
    if (['h1', 'h2', 'h3'].includes(tagName || '')) {
      return true;
    }
    
    return false;
  }

  private extractText(elem: cheerio.Cheerio<cheerio.Element>): string {
    // Remove nested block elements to avoid duplication
    const clone = elem.clone();
    clone.find('p, div, section, article, h1, h2, h3, h4, h5, h6').remove();
    
    let text = clone.text().trim();
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  private async loadChapterContent(href: string): Promise<string> {
    const content = await fs.readFile(href, 'utf-8');
    return content;
  }

  getMetadata(): EPUBMetadata | null {
    return this.metadata;
  }
}
