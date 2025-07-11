import path from 'path';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import { parseStringPromise } from 'xml2js';
import { JSDOM } from 'jsdom';
import * as unzipper from 'unzipper';
import * as cheerio from 'cheerio';
import { createLogger } from '@audibook/logger';
import { 
  detectEPUBPageBreaks, 
  EPUBChapterContent, 
  EPUBPageBreak,
  PageBreakOptions 
} from './utils/epub-page-break-detector';
import { ParagraphProcessor, ProcessedParagraph } from './utils/paragraph-processor';
import { HTMLTextExtractor } from './utils/html-text-extractor';
import { DEFAULT_EPUB_PARSER_CONFIG } from '../config/epub-parser-config';

const logger = createLogger('PageBasedEpubParser');

export interface ParsedPage {
  pageNumber: number;
  sourceChapter: number;
  startPosition: number;
  endPosition: number;
  pageBreakInfo: {
    startBreak?: EPUBPageBreak;
    endBreak?: EPUBPageBreak;
  };
  paragraphs: ProcessedParagraph[];
}

// Using ProcessedParagraph from shared utility directly

export interface EPUBParseResult {
  pages: ParsedPage[];
  metadata: {
    totalPages: number;
    totalParagraphs: number;
    averageParagraphsPerPage: number;
  };
}

export interface PageBasedParserOptions {
  pageBreakDetection?: PageBreakOptions;
  paragraphTargetLengthChars?: number;
  paragraphTargetLengthWords?: number;
}

export class PageBasedEPUBParser {
  private readonly defaultOptions: Required<PageBasedParserOptions> = {
    pageBreakDetection: DEFAULT_EPUB_PARSER_CONFIG.pageBreakDetection,
    paragraphTargetLengthChars: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthChars,
    paragraphTargetLengthWords: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthWords,
  };
  
  private readonly paragraphProcessor: ParagraphProcessor;
  private readonly htmlTextExtractor: HTMLTextExtractor;

  constructor(private options: PageBasedParserOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    this.paragraphProcessor = new ParagraphProcessor({
      paragraphTargetLengthChars: this.options.paragraphTargetLengthChars,
      paragraphTargetLengthWords: this.options.paragraphTargetLengthWords,
    });
    this.htmlTextExtractor = new HTMLTextExtractor();
  }

  async parseEpub(epubPath: string): Promise<EPUBParseResult> {
    logger.info(`Starting page-based EPUB parsing: ${epubPath}`);
    
    const tempDir = path.join('/tmp', `epub-${Date.now()}`);
    
    try {
      // Extract EPUB
      await this.extractEPUB(epubPath, tempDir);
      
      // Parse EPUB structure
      const chapters = await this.parseEPUBStructure(tempDir);
      
      // Detect page breaks
      const pageBreaks = await detectEPUBPageBreaks(chapters, this.options.pageBreakDetection);
      
      // Create pages from page breaks
      const pages = await this.createPagesFromBreaks(chapters, pageBreaks);
      
      // Clean up
      await this.cleanup(tempDir);
      
      const totalParagraphs = pages.reduce((sum, page) => sum + page.paragraphs.length, 0);
      
      const result: EPUBParseResult = {
        pages,
        metadata: {
          totalPages: pages.length,
          totalParagraphs,
          averageParagraphsPerPage: pages.length > 0 ? totalParagraphs / pages.length : 0,
        }
      };

      logger.info('Page-based EPUB parsing completed', result.metadata);
      return result;
      
    } catch (error) {
      await this.cleanup(tempDir);
      logger.error('Page-based EPUB parsing failed:', error);
      throw error;
    }
  }

  private async extractEPUB(epubPath: string, tempDir: string): Promise<void> {
    logger.debug(`Extracting EPUB to: ${tempDir}`);
    
    await fsPromises.mkdir(tempDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(epubPath)
        .pipe(unzipper.Extract({ path: tempDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    logger.debug('EPUB extraction completed');
  }

  private async parseEPUBStructure(tempDir: string): Promise<EPUBChapterContent[]> {
    logger.debug('Parsing EPUB structure');

    // Read container.xml to find content.opf
    const containerPath = path.join(tempDir, 'META-INF', 'container.xml');
    const containerXml = await fsPromises.readFile(containerPath, 'utf-8');
    const container = await parseStringPromise(containerXml);

    const opfPath = container.container.rootfiles[0].rootfile[0].$['full-path'];
    const opfDir = path.dirname(path.join(tempDir, opfPath));
    const opfContent = await fsPromises.readFile(path.join(tempDir, opfPath), 'utf-8');
    const opf = await parseStringPromise(opfContent);

    // Get spine order (reading order)
    const spine = opf.package.spine[0].itemref;
    const manifest = opf.package.manifest[0].item;

    // Create manifest map
    const manifestMap = new Map();
    manifest.forEach((item: { $: { id: string; href: string } }) => {
      manifestMap.set(item.$.id, item.$.href);
    });

    const chapters: EPUBChapterContent[] = [];

    // Process each spine item
    for (let chapterIndex = 0; chapterIndex < spine.length; chapterIndex++) {
      const itemId = spine[chapterIndex].$.idref;
      const href = manifestMap.get(itemId);

      if (!href) continue;

      const contentPath = path.join(opfDir, href);

      try {
        const content = await fsPromises.readFile(contentPath, 'utf-8');
        
        // Extract title from content
        const $ = cheerio.load(content);
        const title = $('title').text() || $('h1').first().text() || `Chapter ${chapterIndex + 1}`;

        chapters.push({
          href,
          content,
          title: title.trim(),
          chapterNumber: chapterIndex + 1,
        });

        logger.debug(`Processed chapter ${chapterIndex + 1}: ${title}`);
      } catch (error) {
        logger.error(`Error processing chapter ${chapterIndex + 1} (${href}):`, error);
      }
    }

    logger.debug(`Parsed ${chapters.length} chapters from EPUB structure`);
    return chapters;
  }

  private async createPagesFromBreaks(
    chapters: EPUBChapterContent[], 
    pageBreaks: EPUBPageBreak[]
  ): Promise<ParsedPage[]> {
    logger.info('🔄 Starting page creation from detected breaks', {
      totalChapters: chapters.length,
      totalPageBreaks: pageBreaks.length,
      pageBreaksByType: pageBreaks.reduce((acc, pb) => {
        acc[pb.type] = (acc[pb.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    const pages: ParsedPage[] = [];
    let pageNumber = 1;

    // Group page breaks by chapter
    const breaksByChapter = new Map<number, EPUBPageBreak[]>();
    pageBreaks.forEach(pb => {
      if (!breaksByChapter.has(pb.chapterNumber)) {
        breaksByChapter.set(pb.chapterNumber, []);
      }
      breaksByChapter.get(pb.chapterNumber)!.push(pb);
    });

    logger.debug('📊 Page breaks grouped by chapter', {
      chaptersWithBreaks: breaksByChapter.size,
      breakDistribution: Array.from(breaksByChapter.entries()).map(([chapterNum, breaks]) => ({
        chapter: chapterNum,
        breakCount: breaks.length,
        breakTypes: breaks.map(b => b.type)
      }))
    });

    for (const chapter of chapters) {
      const chapterBreaks = breaksByChapter.get(chapter.chapterNumber) || [];
      
      logger.info(`📖 Processing chapter ${chapter.chapterNumber}`, {
        title: chapter.title,
        pageBreaksFound: chapterBreaks.length,
        chapterContentLength: chapter.content.length
      });
      
      // Parse HTML content to get text content
      const dom = new JSDOM(chapter.content, {
        contentType: 'application/xhtml+xml',
      });
      const document = dom.window.document;

      // Remove script and style elements
      document.querySelectorAll('script, style').forEach((el) => el.remove());

      const fullText = this.extractFullText(document);
      
      logger.debug(`📝 Extracted text from chapter ${chapter.chapterNumber}`, {
        originalContentLength: chapter.content.length,
        extractedTextLength: fullText.length,
        textPreview: fullText.substring(0, 200) + (fullText.length > 200 ? '...' : '')
      });
      
      if (chapterBreaks.length === 0) {
        // No page breaks in this chapter, treat entire chapter as one page
        logger.info(`📄 No page breaks found in chapter ${chapter.chapterNumber} - creating single page`);
        
        const paragraphs = this.extractParagraphsFromText(fullText, 0);
        
        logger.debug(`📝 Extracted paragraphs for single-page chapter ${chapter.chapterNumber}`, {
          paragraphCount: paragraphs.length,
          totalTextLength: fullText.length,
          paragraphLengths: paragraphs.map(p => p.content.length)
        });
        
        if (paragraphs.length > 0) {
          const newPage = {
            pageNumber: pageNumber++,
            sourceChapter: chapter.chapterNumber,
            startPosition: 0,
            endPosition: fullText.length,
            pageBreakInfo: {},
            paragraphs,
          };
          
          pages.push(newPage);
          
          logger.info(`✅ Created single page ${newPage.pageNumber} for chapter ${chapter.chapterNumber}`, {
            paragraphCount: paragraphs.length,
            textLength: fullText.length,
            firstParagraphPreview: paragraphs[0]?.content.substring(0, 100) + '...'
          });
        } else {
          logger.warn(`⚠️ No valid paragraphs found in chapter ${chapter.chapterNumber} - skipping page creation`);
        }
      } else {
        // Create pages based on breaks
        const sortedBreaks = [...chapterBreaks].sort((a, b) => a.position - b.position);
        
        logger.info(`🔀 Creating pages based on ${sortedBreaks.length} breaks in chapter ${chapter.chapterNumber}`, {
          breakPositions: sortedBreaks.map(b => ({
            position: b.position,
            type: b.type,
            confidence: b.confidence,
            reason: b.reason
          }))
        });
        
        // Create page from start to first break
        if (sortedBreaks[0].position > 0) {
          const pageText = fullText.substring(0, sortedBreaks[0].position);
          
          logger.debug(`📄 Creating initial page from start to first break`, {
            chapter: chapter.chapterNumber,
            startPos: 0,
            endPos: sortedBreaks[0].position,
            textLength: pageText.length,
            firstBreak: {
              type: sortedBreaks[0].type,
              reason: sortedBreaks[0].reason
            }
          });
          
          const paragraphs = this.extractParagraphsFromText(pageText, 0);
          
          if (paragraphs.length > 0) {
            const newPage = {
              pageNumber: pageNumber++,
              sourceChapter: chapter.chapterNumber,
              startPosition: 0,
              endPosition: sortedBreaks[0].position,
              pageBreakInfo: {
                endBreak: sortedBreaks[0],
              },
              paragraphs,
            };
            
            pages.push(newPage);
            
            logger.info(`✅ Created initial page ${newPage.pageNumber}`, {
              chapter: chapter.chapterNumber,
              paragraphCount: paragraphs.length,
              textLength: pageText.length,
              endBreakType: sortedBreaks[0].type
            });
          } else {
            logger.warn(`⚠️ No valid paragraphs in initial page section (0-${sortedBreaks[0].position}) of chapter ${chapter.chapterNumber}`);
          }
        }

        // Create pages between breaks
        for (let i = 0; i < sortedBreaks.length - 1; i++) {
          const startPos = sortedBreaks[i].position;
          const endPos = sortedBreaks[i + 1].position;
          const pageText = fullText.substring(startPos, endPos);
          
          logger.debug(`📄 Creating middle page ${i + 1}/${sortedBreaks.length - 1}`, {
            chapter: chapter.chapterNumber,
            startPos,
            endPos,
            textLength: pageText.length,
            startBreak: {
              type: sortedBreaks[i].type,
              reason: sortedBreaks[i].reason
            },
            endBreak: {
              type: sortedBreaks[i + 1].type,
              reason: sortedBreaks[i + 1].reason
            }
          });
          
          const paragraphs = this.extractParagraphsFromText(pageText, startPos);
          
          if (paragraphs.length > 0) {
            const newPage = {
              pageNumber: pageNumber++,
              sourceChapter: chapter.chapterNumber,
              startPosition: startPos,
              endPosition: endPos,
              pageBreakInfo: {
                startBreak: sortedBreaks[i],
                endBreak: sortedBreaks[i + 1],
              },
              paragraphs,
            };
            
            pages.push(newPage);
            
            logger.info(`✅ Created middle page ${newPage.pageNumber}`, {
              chapter: chapter.chapterNumber,
              paragraphCount: paragraphs.length,
              textLength: pageText.length,
              startBreakType: sortedBreaks[i].type,
              endBreakType: sortedBreaks[i + 1].type
            });
          } else {
            logger.warn(`⚠️ No valid paragraphs in middle page section (${startPos}-${endPos}) of chapter ${chapter.chapterNumber}`);
          }
        }

        // Create page from last break to end
        const lastBreak = sortedBreaks[sortedBreaks.length - 1];
        if (lastBreak.position < fullText.length) {
          const pageText = fullText.substring(lastBreak.position);
          
          logger.debug(`📄 Creating final page from last break to end`, {
            chapter: chapter.chapterNumber,
            startPos: lastBreak.position,
            endPos: fullText.length,
            textLength: pageText.length,
            lastBreak: {
              type: lastBreak.type,
              reason: lastBreak.reason
            }
          });
          
          const paragraphs = this.extractParagraphsFromText(pageText, lastBreak.position);
          
          if (paragraphs.length > 0) {
            const newPage = {
              pageNumber: pageNumber++,
              sourceChapter: chapter.chapterNumber,
              startPosition: lastBreak.position,
              endPosition: fullText.length,
              pageBreakInfo: {
                startBreak: lastBreak,
              },
              paragraphs,
            };
            
            pages.push(newPage);
            
            logger.info(`✅ Created final page ${newPage.pageNumber}`, {
              chapter: chapter.chapterNumber,
              paragraphCount: paragraphs.length,
              textLength: pageText.length,
              startBreakType: lastBreak.type
            });
          } else {
            logger.warn(`⚠️ No valid paragraphs in final page section (${lastBreak.position}-${fullText.length}) of chapter ${chapter.chapterNumber}`);
          }
        }
      }

      const chapterPages = pages.filter(p => p.sourceChapter === chapter.chapterNumber);
      logger.info(`📊 Chapter ${chapter.chapterNumber} processing complete`, {
        chapterTitle: chapter.title,
        pageBreaksDetected: chapterBreaks.length,
        pagesCreated: chapterPages.length,
        totalParagraphs: chapterPages.reduce((sum, p) => sum + p.paragraphs.length, 0),
        pageNumbers: chapterPages.map(p => p.pageNumber)
      });
    }

    logger.info(`🎉 Page creation completed successfully`, {
      totalChapters: chapters.length,
      totalPages: pages.length,
      totalParagraphs: pages.reduce((sum, p) => sum + p.paragraphs.length, 0),
      averageParagraphsPerPage: (pages.reduce((sum, p) => sum + p.paragraphs.length, 0) / pages.length).toFixed(2),
      pagesByChapter: Array.from(breaksByChapter.keys()).map(chapterNum => ({
        chapter: chapterNum,
        pages: pages.filter(p => p.sourceChapter === chapterNum).length
      }))
    });
    
    return pages;
  }

  private extractFullText(document: Document): string {
    // Use shared HTML text extractor to avoid duplication from nested elements
    return this.htmlTextExtractor.extractFullText(document);
  }



  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private meetsTargetSize(text: string): boolean {
    const charCount = text.length;
    const wordCount = this.countWords(text);
    
    return charCount >= this.options.paragraphTargetLengthChars || 
           wordCount >= this.options.paragraphTargetLengthWords;
  }

  private extractParagraphsFromText(text: string, basePosition: number): ProcessedParagraph[] {
    logger.debug(`📝 Starting paragraph extraction with shared processor`, {
      textLength: text.length,
      basePosition,
      textPreview: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
      targetChars: this.options.paragraphTargetLengthChars,
      targetWords: this.options.paragraphTargetLengthWords
    });

    // Split by double newlines to get initial text chunks
    const textChunks = text.split(/\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);
    
    logger.debug(`📊 Initial text split`, {
      totalChunks: text.split(/\n\s*\n/).length,
      validChunks: textChunks.length,
      filteredOutCount: text.split(/\n\s*\n/).length - textChunks.length
    });

    // Use shared paragraph processor for consistent results
    const processedParagraphs = this.paragraphProcessor.processTextChunks(textChunks);

    logger.info(`📄 Paragraph extraction completed with shared processor`, {
      totalParagraphs: processedParagraphs.length,
      averageChars: processedParagraphs.length > 0 ? Math.round(processedParagraphs.reduce((sum, p) => sum + p.content.length, 0) / processedParagraphs.length) : 0,
      averageWords: processedParagraphs.length > 0 ? Math.round(processedParagraphs.reduce((sum, p) => sum + this.countWords(p.content), 0) / processedParagraphs.length) : 0,
      targetChars: this.options.paragraphTargetLengthChars,
      targetWords: this.options.paragraphTargetLengthWords
    });

    return processedParagraphs;
  }

  // All paragraph processing logic now handled by shared ParagraphProcessor utility

  private async cleanup(tempDir: string): Promise<void> {
    try {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      logger.debug(`Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      logger.error('Failed to clean up temp directory:', error);
    }
  }
}

// Convenience function for backward compatibility
export async function parseEpubAsPages(
  epubPath: string, 
  options: PageBasedParserOptions = {}
): Promise<ParsedPage[]> {
  const parser = new PageBasedEPUBParser(options);
  const result = await parser.parseEpub(epubPath);
  return result.pages;
}
