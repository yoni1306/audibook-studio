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

export interface EPUBMetadata {
  title?: string;
  author?: string;
  language?: string;
  publisher?: string;
  description?: string;
}

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
  bookMetadata: EPUBMetadata;
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
      const { chapters, metadata: bookMetadata } = await this.parseEPUBStructure(tempDir);
      
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
        },
        bookMetadata
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

  private async parseEPUBStructure(tempDir: string): Promise<{ chapters: EPUBChapterContent[]; metadata: EPUBMetadata }> {
    logger.debug('Parsing EPUB structure');

    // Read container.xml to find content.opf
    const containerPath = path.join(tempDir, 'META-INF', 'container.xml');
    const containerXml = await fsPromises.readFile(containerPath, 'utf-8');
    const container = await parseStringPromise(containerXml);

    const opfPath = container.container.rootfiles[0].rootfile[0].$['full-path'];
    const opfDir = path.dirname(path.join(tempDir, opfPath));
    const opfContent = await this.readFileWithProperEncoding(path.join(tempDir, opfPath));
    const opf = await parseStringPromise(opfContent);

    // Extract book metadata from OPF
    const metadata = this.extractBookMetadata(opf);

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
    logger.info('Extracted book metadata', {
      title: metadata.title,
      author: metadata.author,
      language: metadata.language
    });
    
    return { chapters, metadata };
  }

  /**
   * Read XML file with proper encoding detection to avoid Hebrew text corruption
   */
  private async readFileWithProperEncoding(filePath: string): Promise<string> {
    logger.info(`🔍 Starting encoding detection for file: ${path.basename(filePath)}`);
    
    try {
      // First, read the file as binary to detect encoding
      const buffer = await fsPromises.readFile(filePath);
      logger.debug(`📁 File size: ${buffer.length} bytes`);
      
      // Convert buffer to string with UTF-8 first to check for encoding declaration
      const utf8Content = buffer.toString('utf-8');
      logger.debug(`📝 UTF-8 content preview (first 200 chars): ${utf8Content.substring(0, 200)}...`);
      
      // Look for XML encoding declaration
      const encodingMatch = utf8Content.match(/<\?xml[^>]*encoding=["']([^"']*)["']/i);
      
      if (encodingMatch) {
        const declaredEncoding = encodingMatch[1].toLowerCase();
        logger.info(`🏷️  Found XML encoding declaration: "${declaredEncoding}"`);
        
        // Handle common encoding variations
        if (declaredEncoding === 'utf-8' || declaredEncoding === 'utf8') {
          logger.info('✅ Using declared UTF-8 encoding');
          return utf8Content;
        } else if (declaredEncoding === 'iso-8859-1' || declaredEncoding === 'latin1') {
          const latin1Content = buffer.toString('latin1');
          logger.info('✅ Using declared Latin1 encoding');
          logger.debug(`📝 Latin1 content preview (first 200 chars): ${latin1Content.substring(0, 200)}...`);
          return latin1Content;
        } else if (declaredEncoding === 'windows-1252' || declaredEncoding === 'cp1252') {
          const latin1Content = buffer.toString('latin1');
          logger.info('✅ Using Latin1 as fallback for Windows-1252 encoding');
          logger.debug(`📝 Latin1 content preview (first 200 chars): ${latin1Content.substring(0, 200)}...`);
          return latin1Content;
        } else {
          logger.warn(`⚠️  Unknown declared encoding: "${declaredEncoding}", continuing with detection`);
        }
      } else {
        logger.debug('🔍 No XML encoding declaration found, proceeding with content analysis');
      }
      
      // If no encoding declaration or unknown encoding, try to detect Hebrew content
      // Hebrew characters are in Unicode range U+0590-U+05FF
      const hebrewMatches = utf8Content.match(/[\u0590-\u05FF]/g);
      const hasHebrewChars = hebrewMatches && hebrewMatches.length > 0;
      
      if (hasHebrewChars) {
        logger.info(`🔤 Hebrew characters detected! Found ${hebrewMatches.length} Hebrew characters in UTF-8 content`);
        logger.debug(`🔤 Hebrew character samples: ${hebrewMatches.slice(0, 10).join(', ')}`);
        logger.info('✅ Using UTF-8 encoding for Hebrew content');
        return utf8Content;
      } else {
        logger.debug('🔍 No Hebrew characters detected in UTF-8 content');
      }
      
      // Check if the UTF-8 content has replacement characters (�) which indicate encoding issues
      const replacementMatches = utf8Content.match(/\uFFFD/g);
      const hasReplacementChars = replacementMatches && replacementMatches.length > 0;
      
      if (hasReplacementChars) {
        logger.warn(`⚠️  Replacement characters detected in UTF-8! Found ${replacementMatches.length} replacement chars`);
        logger.warn('🔄 Trying Latin1 encoding as alternative...');
        
        const latin1Content = buffer.toString('latin1');
        logger.debug(`📝 Latin1 content preview (first 200 chars): ${latin1Content.substring(0, 200)}...`);
        
        // Check if latin1 version has Hebrew characters
        const latin1HebrewMatches = latin1Content.match(/[\u0590-\u05FF]/g);
        const latin1HasHebrew = latin1HebrewMatches && latin1HebrewMatches.length > 0;
        
        if (latin1HasHebrew) {
          logger.info(`🔤 Hebrew characters found in Latin1 version! Found ${latin1HebrewMatches.length} Hebrew characters`);
          logger.debug(`🔤 Hebrew character samples: ${latin1HebrewMatches.slice(0, 10).join(', ')}`);
          logger.info('✅ Using Latin1 encoding for Hebrew content');
          return latin1Content;
        } else {
          logger.debug('🔍 No Hebrew characters found in Latin1 version either');
        }
      } else {
        logger.debug('✅ No replacement characters detected in UTF-8 content');
      }
      
      // Default to UTF-8 if no issues detected
      logger.info('✅ Using default UTF-8 encoding (no encoding issues detected)');
      return utf8Content;
      
    } catch (error) {
      logger.error('❌ Error reading file with encoding detection:', error);
      logger.warn('🔄 Falling back to standard UTF-8 reading');
      // Fallback to standard UTF-8 reading
      return await fsPromises.readFile(filePath, 'utf-8');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractBookMetadata(opf: Record<string, any>): EPUBMetadata {
    logger.info('📖 Starting book metadata extraction from OPF');
    const metadata: EPUBMetadata = {};
    
    try {
      // Extract metadata from OPF package
      const metadataSection = opf.package?.metadata?.[0];
      logger.debug('📋 OPF metadata section structure:', JSON.stringify(metadataSection, null, 2));
      
      if (metadataSection) {
        // Extract title (dc:title)
        if (metadataSection['dc:title']?.[0]) {
          logger.debug('🏷️  Found dc:title entry:', metadataSection['dc:title'][0]);
          
          if (typeof metadataSection['dc:title'][0] === 'string') {
            metadata.title = metadataSection['dc:title'][0].trim();
            logger.info(`📚 Extracted title (string): "${metadata.title}"`);
          } else if (metadataSection['dc:title'][0]._) {
            metadata.title = metadataSection['dc:title'][0]._.trim();
            logger.info(`📚 Extracted title (object._): "${metadata.title}"`);
          } else {
            logger.warn('⚠️  dc:title found but could not extract string value');
          }
          
          // Check for Hebrew characters in title
          if (metadata.title) {
            const hebrewMatches = metadata.title.match(/[\u0590-\u05FF]/g);
            if (hebrewMatches && hebrewMatches.length > 0) {
              logger.info(`🔤 Hebrew title detected! Found ${hebrewMatches.length} Hebrew characters`);
              logger.debug(`🔤 Hebrew characters in title: ${hebrewMatches.join(', ')}`);
              logger.debug(`🔤 Title Unicode codepoints: ${Array.from(metadata.title).map(char => `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(', ')}`);
            } else {
              logger.debug('🔍 No Hebrew characters detected in title');
            }
          }
        } else {
          logger.warn('⚠️  No dc:title found in metadata section');
        }
        
        // Extract author (dc:creator)
        if (metadataSection['dc:creator']?.[0]) {
          logger.debug('👤 Found dc:creator entry:', metadataSection['dc:creator'][0]);
          
          if (typeof metadataSection['dc:creator'][0] === 'string') {
            metadata.author = metadataSection['dc:creator'][0].trim();
            logger.info(`👤 Extracted author (string): "${metadata.author}"`);
          } else if (metadataSection['dc:creator'][0]._) {
            metadata.author = metadataSection['dc:creator'][0]._.trim();
            logger.info(`👤 Extracted author (object._): "${metadata.author}"`);
          }
        }
        
        // Extract language (dc:language)
        if (metadataSection['dc:language']?.[0]) {
          logger.debug('🌐 Found dc:language entry:', metadataSection['dc:language'][0]);
          
          if (typeof metadataSection['dc:language'][0] === 'string') {
            metadata.language = metadataSection['dc:language'][0].trim();
            logger.info(`🌐 Extracted language (string): "${metadata.language}"`);
          } else if (metadataSection['dc:language'][0]._) {
            metadata.language = metadataSection['dc:language'][0]._.trim();
            logger.info(`🌐 Extracted language (object._): "${metadata.language}"`);
          }
        }
        
        // Extract publisher (dc:publisher)
        if (metadataSection['dc:publisher']?.[0]) {
          logger.debug('🏢 Found dc:publisher entry:', metadataSection['dc:publisher'][0]);
          
          if (typeof metadataSection['dc:publisher'][0] === 'string') {
            metadata.publisher = metadataSection['dc:publisher'][0].trim();
            logger.info(`🏢 Extracted publisher (string): "${metadata.publisher}"`);
          } else if (metadataSection['dc:publisher'][0]._) {
            metadata.publisher = metadataSection['dc:publisher'][0]._.trim();
            logger.info(`🏢 Extracted publisher (object._): "${metadata.publisher}"`);
          }
        }
        
        // Extract description (dc:description)
        if (metadataSection['dc:description']?.[0]) {
          logger.debug('📝 Found dc:description entry:', metadataSection['dc:description'][0]);
          
          if (typeof metadataSection['dc:description'][0] === 'string') {
            metadata.description = metadataSection['dc:description'][0].trim();
            logger.info(`📝 Extracted description (string): "${metadata.description?.substring(0, 100)}..."`);
          } else if (metadataSection['dc:description'][0]._) {
            metadata.description = metadataSection['dc:description'][0]._.trim();
            logger.info(`📝 Extracted description (object._): "${metadata.description?.substring(0, 100)}..."`);
          }
        }
      } else {
        logger.warn('⚠️  No metadata section found in OPF package');
      }
      
      logger.info('✅ EPUB metadata extraction completed:', {
        hasTitle: !!metadata.title,
        hasAuthor: !!metadata.author,
        hasLanguage: !!metadata.language,
        hasPublisher: !!metadata.publisher,
        hasDescription: !!metadata.description,
        title: metadata.title ? `"${metadata.title}"` : 'Not found',
        author: metadata.author ? `"${metadata.author}"` : 'Not found',
        language: metadata.language || 'Not found',
        publisher: metadata.publisher ? `"${metadata.publisher}"` : 'Not found'
      });
      
    } catch (error) {
      logger.error('❌ Error extracting EPUB metadata:', error);
    }
    
    return metadata;
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
      const chapterBreaks = breaksByChapter.get(pb.chapterNumber);
      if (chapterBreaks) {
        chapterBreaks.push(pb);
      }
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
