import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as yauzl from 'yauzl';
import { JSDOM } from 'jsdom';
import { parseStringPromise } from 'xml2js';
import { createLogger } from '@audibook/logger';
import { ParagraphProcessor, ProcessedParagraph } from './utils/paragraph-processor';
import { HTMLTextExtractor } from './utils/html-text-extractor';
import { DEFAULT_EPUB_PARSER_CONFIG } from '../config/epub-parser-config';

const logger = createLogger('XHTMLBasedEpubParser');

export interface XHTMLPage {
  pageNumber: number;
  fileName: string;
  filePath: string;
  sourceChapter: number;
  startPosition: number;
  endPosition: number;
  paragraphs: ProcessedParagraph[];
}

// Using ProcessedParagraph from shared utility

export interface XHTMLParseResult {
  pages: XHTMLPage[];
  metadata: {
    totalPages: number;
    totalParagraphs: number;
    averageParagraphsPerPage: number;
    xhtmlFiles: string[];
  };
  bookMetadata?: {
    title?: string;
    author?: string;
    language?: string;
    publisher?: string;
    publishedDate?: string;
    description?: string;
    identifier?: string;
  };
}

export interface XHTMLParserOptions {
  paragraphTargetLengthChars?: number;
  paragraphTargetLengthWords?: number;
  includeEmptyPages?: boolean;
  minParagraphLength?: number;
}

export class XHTMLBasedEPUBParser {
  private readonly defaultOptions: Required<XHTMLParserOptions> = {
    paragraphTargetLengthChars: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthChars,
    paragraphTargetLengthWords: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthWords,
    includeEmptyPages: false,
    minParagraphLength: 10,
  };
  
  private readonly paragraphProcessor: ParagraphProcessor;
  private readonly htmlTextExtractor: HTMLTextExtractor;

  constructor(private options: XHTMLParserOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    this.paragraphProcessor = new ParagraphProcessor({
      paragraphTargetLengthChars: this.options.paragraphTargetLengthChars,
      paragraphTargetLengthWords: this.options.paragraphTargetLengthWords,
    });
    this.htmlTextExtractor = new HTMLTextExtractor();
  }

  async parseEpub(epubPath: string): Promise<XHTMLParseResult> {
    logger.info(`Starting XHTML-based EPUB parsing: ${epubPath}`);
    
    const tempDir = path.join('/tmp', `epub-xhtml-${Date.now()}`);
    
    try {
      // Extract EPUB
      await this.extractEpub(epubPath, tempDir);
      
      // Find all XHTML files
      const xhtmlFiles = await this.findXHTMLFiles(tempDir);
      
      // Sort files alphabetically
      const sortedFiles = this.sortFilesAlphabetically(xhtmlFiles);
      
      // Parse each XHTML file as a page
      const pages = await this.parseXHTMLFiles(tempDir, sortedFiles);
      
      // Clean up
      await this.cleanup(tempDir);
      
      const totalParagraphs = pages.reduce((sum, page) => sum + page.paragraphs.length, 0);
      
      const result: XHTMLParseResult = {
        pages,
        metadata: {
          totalPages: pages.length,
          totalParagraphs,
          averageParagraphsPerPage: pages.length > 0 ? totalParagraphs / pages.length : 0,
          xhtmlFiles: sortedFiles.map(f => f.fileName),
        }
      };

      logger.info('XHTML-based EPUB parsing completed', {
        totalPages: result.metadata.totalPages,
        totalParagraphs: result.metadata.totalParagraphs,
        averageParagraphsPerPage: result.metadata.averageParagraphsPerPage,
        xhtmlFiles: result.metadata.xhtmlFiles.length
      });
      
      return result;
      
    } catch (error) {
      await this.cleanup(tempDir);
      logger.error('XHTML-based EPUB parsing failed:', error);
      throw error;
    }
  }

  private async extractEpub(epubPath: string, extractPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      yauzl.open(epubPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            const dirPath = path.join(extractPath, entry.fileName);
            fsSync.mkdirSync(dirPath, { recursive: true });
            zipfile.readEntry();
          } else {
            // File entry
            const filePath = path.join(extractPath, entry.fileName);
            const dirPath = path.dirname(filePath);
            fsSync.mkdirSync(dirPath, { recursive: true });
            
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);
              
              const writeStream = fsSync.createWriteStream(filePath);
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => {
                zipfile.readEntry();
              });
              
              writeStream.on('error', reject);
              readStream.on('error', reject);
            });
          }
        });
        
        zipfile.on('end', resolve);
        zipfile.on('error', reject);
      });
    });
  }

  private async findXHTMLFiles(tempDir: string): Promise<Array<{ fileName: string; filePath: string }>> {
    logger.debug('Finding all XHTML files in EPUB');
    
    const xhtmlFiles: Array<{ fileName: string; filePath: string }> = [];
    
    // Recursively search for XHTML files
    const searchDirectory = async (dirPath: string): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip META-INF directory as it contains metadata, not content
          if (entry.name !== 'META-INF') {
            await searchDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const isXHTML = ext === '.xhtml' || ext === '.html' || ext === '.htm';
          
          if (isXHTML) {
            // Add all XHTML files
            xhtmlFiles.push({
              fileName: entry.name,
              filePath: fullPath
            });
            logger.debug(`Found XHTML file: ${entry.name}`);
          }
        }
      }
    };
    
    await searchDirectory(tempDir);
    
    logger.info(`Found ${xhtmlFiles.length} XHTML files`);
    return xhtmlFiles;
  }

  private isContentFile(content: string): boolean {
    // Check if the file contains actual readable content
    // Skip files that are primarily CSS, JavaScript, or empty
    const dom = new JSDOM(content, { contentType: 'application/xhtml+xml' });
    const document = dom.window.document;
    
    // Remove script and style elements
    document.querySelectorAll('script, style').forEach((el) => el.remove());
    
    // Extract text content
    const textContent = document.body?.textContent?.trim() || '';
    
    // Consider it a content file if it has any meaningful text (lowered threshold)
    // This includes cover pages, TOC, and short chapters
    const hasContent = textContent.length > 10;
    
    if (!hasContent) {
      logger.debug(`File filtered out - text content length: ${textContent.length}`);
    }
    
    return hasContent;
  }

  private sortFilesAlphabetically(files: Array<{ fileName: string; filePath: string }>): Array<{ fileName: string; filePath: string }> {
    logger.debug('Sorting XHTML files alphabetically');
    
    const sorted = [...files].sort((a, b) => {
      // Natural sort that handles numbers correctly (e.g., file1.xhtml comes before file10.xhtml)
      return a.fileName.localeCompare(b.fileName, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });
    
    logger.debug('File order:', sorted.map(f => f.fileName));
    return sorted;
  }

  private async parseXHTMLFiles(
    tempDir: string, 
    sortedFiles: Array<{ fileName: string; filePath: string }>
  ): Promise<XHTMLPage[]> {
    logger.debug(`Parsing ${sortedFiles.length} XHTML files as pages`);
    
    const pages: XHTMLPage[] = [];
    let pageNumber = 1;
    
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      
      try {
        logger.debug(`Processing file ${i + 1}: ${file.fileName}`);
        
        const content = await fs.readFile(file.filePath, 'utf-8');
        const paragraphs = await this.extractParagraphsFromXHTML(content, file.fileName);
        
        // Include all files, even those with minimal content (only skip truly empty files with 0 paragraphs)
        if (paragraphs.length === 0) {
          logger.debug(`Skipping truly empty XHTML file: ${file.fileName}`);
        } else {
          pages.push({
            pageNumber,
            sourceChapter: pageNumber, // For XHTML-based parsing, each file is its own "chapter"
            startPosition: 0, // XHTML files don't have position ranges, so use default
            endPosition: 0, // XHTML files don't have position ranges, so use default
            fileName: file.fileName,
            filePath: file.filePath,
            paragraphs
          });
          
          logger.debug(`Page ${pageNumber} (${file.fileName}): ${paragraphs.length} paragraphs`);
          pageNumber++;
        }
        
      } catch (error) {
        logger.error(`Error processing XHTML file ${file.fileName}:`, error);
        
        // Skip error cases (don't create pages for files that can't be processed)
        // Note: pageNumber is not incremented for error cases
      }
    }
    
    logger.info(`Successfully parsed ${pages.length} pages from ${sortedFiles.length} XHTML files`);
    return pages;
  }

  private async extractParagraphsFromXHTML(content: string, fileName: string): Promise<ProcessedParagraph[]> {
    const paragraphs: ProcessedParagraph[] = [];
    
    try {
      // Parse HTML/XHTML content
      const dom = new JSDOM(content, { contentType: 'application/xhtml+xml' });
      const document = dom.window.document;

      // Use shared HTML text extractor to avoid duplication from nested elements
      const textChunks = this.htmlTextExtractor.extractTextChunks(document);
      
      // Use shared paragraph processor for consistent results
      const processedParagraphs = this.paragraphProcessor.processTextChunks(textChunks);
      paragraphs.push(...processedParagraphs);

      // Log detailed information about paragraph extraction
      logger.debug(`Extracted ${paragraphs.length} paragraphs from ${fileName}`);
      if (paragraphs.length === 0) {
        const rawTextLength = content.length;
        const bodyTextLength = document.body?.textContent?.trim()?.length || 0;
        logger.warn(`File ${fileName} resulted in 0 paragraphs - raw content: ${rawTextLength} chars, body text: ${bodyTextLength} chars`);
      }

    } catch (error) {
      logger.error(`Critical error extracting paragraphs from ${fileName}:`, error);
      // Don't silently fail - rethrow the error so the calling method can handle it properly
      throw new Error(`Failed to parse XHTML file ${fileName}: ${error.message}`);
    }

    return paragraphs;
  }



  // Custom splitting methods removed - now using shared ParagraphProcessor utility

  private async extractBookMetadata(tempDir: string): Promise<XHTMLParseResult['bookMetadata']> {
    try {
      // Find the OPF file
      const opfPath = await this.findOPFFile(tempDir);
      if (!opfPath) {
        logger.warn('No OPF file found - skipping metadata extraction');
        return undefined;
      }

      // Read and parse the OPF file
      const opfContent = await fs.readFile(opfPath, 'utf-8');
      const opfData = await parseStringPromise(opfContent);

      // Extract metadata from the OPF
      const metadata = opfData?.package?.metadata?.[0];
      if (!metadata) {
        logger.warn('No metadata section found in OPF file');
        return undefined;
      }

      const bookMetadata: XHTMLParseResult['bookMetadata'] = {};

      // Extract title
      if (metadata['dc:title']) {
        const titleEntry = Array.isArray(metadata['dc:title']) ? metadata['dc:title'][0] : metadata['dc:title'];
        bookMetadata.title = typeof titleEntry === 'string' ? titleEntry : titleEntry._;
      }

      // Extract author
      if (metadata['dc:creator']) {
        const creatorEntry = Array.isArray(metadata['dc:creator']) ? metadata['dc:creator'][0] : metadata['dc:creator'];
        bookMetadata.author = typeof creatorEntry === 'string' ? creatorEntry : creatorEntry._;
      }

      // Extract language
      if (metadata['dc:language']) {
        const languageEntry = Array.isArray(metadata['dc:language']) ? metadata['dc:language'][0] : metadata['dc:language'];
        bookMetadata.language = typeof languageEntry === 'string' ? languageEntry : languageEntry._;
      }

      // Extract publisher
      if (metadata['dc:publisher']) {
        const publisherEntry = Array.isArray(metadata['dc:publisher']) ? metadata['dc:publisher'][0] : metadata['dc:publisher'];
        bookMetadata.publisher = typeof publisherEntry === 'string' ? publisherEntry : publisherEntry._;
      }

      // Extract published date
      if (metadata['dc:date']) {
        const dateEntry = Array.isArray(metadata['dc:date']) ? metadata['dc:date'][0] : metadata['dc:date'];
        bookMetadata.publishedDate = typeof dateEntry === 'string' ? dateEntry : dateEntry._;
      }

      // Extract description
      if (metadata['dc:description']) {
        const descriptionEntry = Array.isArray(metadata['dc:description']) ? metadata['dc:description'][0] : metadata['dc:description'];
        bookMetadata.description = typeof descriptionEntry === 'string' ? descriptionEntry : descriptionEntry._;
      }

      // Extract identifier
      if (metadata['dc:identifier']) {
        const identifierEntry = Array.isArray(metadata['dc:identifier']) ? metadata['dc:identifier'][0] : metadata['dc:identifier'];
        bookMetadata.identifier = typeof identifierEntry === 'string' ? identifierEntry : identifierEntry._;
      }

      logger.info('Book metadata extracted from EPUB OPF', {
        hasTitle: !!bookMetadata.title,
        hasAuthor: !!bookMetadata.author,
        hasLanguage: !!bookMetadata.language,
        hasPublisher: !!bookMetadata.publisher,
        title: bookMetadata.title,
        author: bookMetadata.author
      });

      return bookMetadata;
    } catch (error) {
      logger.error('Failed to extract book metadata from EPUB OPF:', error);
      return undefined;
    }
  }

  private async findOPFFile(tempDir: string): Promise<string | null> {
    try {
      // First, try to find container.xml to get the OPF path
      const containerPath = path.join(tempDir, 'META-INF', 'container.xml');
      try {
        const containerContent = await fs.readFile(containerPath, 'utf-8');
        const containerData = await parseStringPromise(containerContent);
        const rootfiles = containerData?.container?.rootfiles?.[0]?.rootfile;
        if (rootfiles && rootfiles.length > 0) {
          const opfPath = rootfiles[0].$?.['full-path'];
          if (opfPath) {
            const fullOpfPath = path.join(tempDir, opfPath);
            try {
              await fs.access(fullOpfPath);
              return fullOpfPath;
            } catch {
              logger.warn(`OPF file not found at specified path: ${fullOpfPath}`);
            }
          }
        }
      } catch {
        logger.debug('Could not read container.xml, falling back to search');
      }

      // Fallback: search for .opf files
      const searchForOPF = async (dir: string): Promise<string | null> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isFile() && entry.name.endsWith('.opf')) {
            return fullPath;
          } else if (entry.isDirectory()) {
            const found = await searchForOPF(fullPath);
            if (found) return found;
          }
        }
        
        return null;
      };

      return await searchForOPF(tempDir);
    } catch (error) {
      logger.error('Error finding OPF file:', error);
      return null;
    }
  }

  private async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      logger.debug(`Cleaned up temp directory: ${tempDir}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to clean up temp directory: ${errorMessage}`);
    }
  }
}

// ... (rest of the code remains the same)
export async function parseEpubAsXHTMLPages(
  epubPath: string, 
  options: XHTMLParserOptions = {}
): Promise<XHTMLPage[]> {
  const parser = new XHTMLBasedEPUBParser(options);
  const result = await parser.parseEpub(epubPath);
  return result.pages;
}
