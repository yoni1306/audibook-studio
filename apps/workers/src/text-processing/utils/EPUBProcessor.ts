import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import * as unzipper from 'unzipper';
import { createLogger } from '@audibook/logger';
import { EPUBPage, EPUBChapter, EPUBMetadata } from '../types';
import { saveRawChapters, updateBookMetadata } from '../../database.service';

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

  async paginateChapter(
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

    for (let i = 0; i < pageBlocks.length; i++) {
      const block = pageBlocks[i];
      const blockText = this.extractText(block);
      
      // ISSUE 1 FIX: Never break on headings - always group them with following content
      // Check if this block should start a new page (but NOT for headings)
      const shouldBreak = this.hasPageBreak(block) && 
                         currentPageContent.length > 200 && 
                         !this.isHeading(block);

      if (shouldBreak && currentPageContent.length > 0) {
        // Save current page for non-heading breaks only
        pages.push({
          content: currentPageContent.trim(),
          sourceFile: chapter.href,
          pageNumber: pageNumber++,
          startOffset: currentOffset - currentPageContent.length,
          endOffset: currentOffset,
        });
        currentPageContent = '';
      }

      // ISSUE 2 FIX: Handle large content blocks that exceed target size
      if (blockText.length > targetSize) {
        // If we have existing content, save it first
        if (currentPageContent.length > 0) {
          pages.push({
            content: currentPageContent.trim(),
            sourceFile: chapter.href,
            pageNumber: pageNumber++,
            startOffset: currentOffset - currentPageContent.length,
            endOffset: currentOffset,
          });
          currentPageContent = '';
        }

        // Split the large block into smaller chunks at sentence boundaries
        const chunks = this.splitLargeContent(blockText, targetSize);
        for (let j = 0; j < chunks.length; j++) {
          if (j === 0) {
            // First chunk goes into current page content
            currentPageContent = chunks[j];
          } else {
            // Additional chunks become separate pages
            pages.push({
              content: chunks[j].trim(),
              sourceFile: chapter.href,
              pageNumber: pageNumber++,
              startOffset: currentOffset,
              endOffset: currentOffset + chunks[j].length,
            });
          }
        }
      } else {
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
          // ISSUE 1 FIX: For headings, combine with following content without paragraph break
          // For other content, use paragraph breaks
          if (this.isHeading(block) && currentPageContent.length === 0) {
            // First block is a heading - start the content
            currentPageContent = blockText;
          } else if (currentPageContent.length > 0 && this.isHeading(pageBlocks[i - 1])) {
            // Previous block was a heading, combine without paragraph break
            currentPageContent += ' ' + blockText;
          } else {
            // Regular content - use paragraph breaks
            currentPageContent += (currentPageContent ? '\n\n' : '') + blockText;
          }
        }
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

  private extractPageBlocks($: cheerio.CheerioAPI): any[] {
    const blocks: any[] = [];
    
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
        
        // Include headings regardless of length (they're structurally important)
        // For other elements, only include blocks with substantial text content
        const isHeading = this.isHeading($elem);
        if (isHeading || text.trim().length > 10) {
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

  private hasPageBreak($elem: any): boolean {
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
    
    // FIXED: Be much more conservative about breaking on headings
    // Only break on major headings (h1, h2) when they are clearly major section breaks
    const tagName = $elem.prop('tagName')?.toLowerCase();
    if (['h1', 'h2'].includes(tagName || '')) {
      const text = this.extractText($elem).trim();
      // Only break if it's a very clear chapter/section heading with specific patterns
      // AND it's substantial enough to warrant a break
      if ((text.includes('פרק ') || text.includes('שער ') || text.includes('Chapter ') || text.includes('Part ')) && 
          text.length > 10) {
        return true;
      }
    }
    
    return false;
  }

  private isHeading($elem: any): boolean {
    const tagName = $elem.prop('tagName')?.toLowerCase();
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName || '');
  }

  private extractText(elem: any, removeNestedBlocks = true): string {
    // Clone the element to avoid modifying the original
    const clone = elem.clone();
    
    // Convert br tags to spaces before processing
    clone.find('br').replaceWith(' ');
    
    // Remove nested block elements to avoid duplication only if requested
    if (removeNestedBlocks) {
      clone.find('p, div, section, article, h1, h2, h3, h4, h5, h6').remove();
    }
    
    let text = clone.text().trim();
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  private async loadChapterContent(href: string): Promise<string> {
    const content = await fs.readFile(href, 'utf-8');
    return content;
  }

  async storeInvestigationData(bookId: string): Promise<void> {
    if (!this.metadata || !this.metadata.chapters) {
      throw new Error('EPUB must be processed first before storing investigation data');
    }

    logger.info('Storing EPUB investigation data', { bookId, chapters: this.metadata.chapters.length });

    // Prepare raw chapters data
    const rawChaptersData = [];
    for (let i = 0; i < this.metadata.chapters.length; i++) {
      const chapter = this.metadata.chapters[i];
      if (!chapter.content) continue;

      // Extract page blocks for this chapter
      const $ = cheerio.load(chapter.content);
      const pageBlocks = this.extractPageBlocks($);
      
      // Convert page blocks to serializable format
      const pageBlocksData = pageBlocks.map((block, index) => ({
        index,
        tagName: block.prop('tagName')?.toLowerCase(),
        text: this.extractText(block),
        isHeading: this.isHeading(block),
        hasPageBreak: this.hasPageBreak(block),
        attributes: {
          class: block.attr('class'),
          style: block.attr('style'),
          id: block.attr('id'),
        },
      }));

      rawChaptersData.push({
        chapterNumber: i + 1,
        title: chapter.title,
        href: chapter.href,
        rawHtml: chapter.content,
        extractedText: this.extractText(cheerio.load(chapter.content)('body')),
        pageBlocks: pageBlocksData,
      });
    }

    // Store raw chapters
    await saveRawChapters(bookId, rawChaptersData);

    // Store EPUB metadata
    const processingLog = `EPUB processed at ${new Date().toISOString()}\n` +
      `Total chapters: ${this.metadata.chapters.length}\n` +
      `Target page size: ${this.config.targetPageSize}\n` +
      `Preserve formatting: ${this.config.preserveFormatting}`;

    await updateBookMetadata(bookId, this.metadata, processingLog);

    logger.info('Successfully stored EPUB investigation data', { bookId });
  }

  getMetadata(): EPUBMetadata | null {
    return this.metadata;
  }

  private splitLargeContent(content: string, targetSize: number): string[] {
    const chunks: string[] = [];
    const sentences = content.split('. ');

    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > targetSize) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence + '. ';
      } else {
        currentChunk += sentence + '. ';
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
