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
  paragraphs: ParsedParagraph[];
}

export interface ParsedParagraph {
  orderIndex: number;
  content: string;
}

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
  paragraphMinLengthChars?: number;
  paragraphTargetLengthChars?: number;
  paragraphTargetLengthWords?: number;
  paragraphMaxLengthChars?: number;
}

export class PageBasedEPUBParser {
  private readonly defaultOptions: Required<PageBasedParserOptions> = {
    pageBreakDetection: {
      targetPageSizeChars: 2000,
      minPageSizeChars: 500,
      maxPageSizeChars: 5000,
      includeExplicit: true,
      includeStructural: true,
      includeStylistic: true,
      includeSemantic: true,
      includeComputed: false,
      minConfidence: 0.6,
    },
    paragraphMinLengthChars: 50,
    paragraphTargetLengthChars: 750,
    paragraphTargetLengthWords: 150,
    paragraphMaxLengthChars: 5000,
  };

  constructor(private options: PageBasedParserOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
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
    // Extract text from various elements
    const textElements = document.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, div, section'
    );

    let fullText = '';
    textElements.forEach((element) => {
      const elementText = this.extractTextFromElement(element, document);
      if (elementText.length >= this.options.paragraphMinLengthChars) {
        fullText += elementText + '\n\n';
      }
    });

    return fullText.trim();
  }

  private extractTextFromElement(element: Element, document: Document): string {
    // Simple recursive text extraction that works in Node.js
    const extractTextRecursively = (node: Node): string => {
      let text = '';
      
      if (node.nodeType === 3) { // TEXT_NODE
        const content = node.textContent?.trim();
        if (content && content.length > 0) {
          text += content + ' ';
        }
      } else if (node.nodeType === 1) { // ELEMENT_NODE
        // Skip script and style elements
        const tagName = (node as Element).tagName?.toLowerCase();
        if (tagName !== 'script' && tagName !== 'style') {
          for (let i = 0; i < node.childNodes.length; i++) {
            text += extractTextRecursively(node.childNodes[i]);
          }
        }
      }
      
      return text;
    };

    return extractTextRecursively(element).trim();
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

  private wouldExceedMax(currentText: string, additionalText: string): boolean {
    const totalLength = currentText.length + additionalText.length + 1; // +1 for space
    return totalLength > this.options.paragraphMaxLengthChars;
  }

  private extractParagraphsFromText(text: string, basePosition: number): ParsedParagraph[] {
    logger.debug(`📝 Starting target-based paragraph extraction`, {
      textLength: text.length,
      basePosition,
      textPreview: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
      targetChars: this.options.paragraphTargetLengthChars,
      targetWords: this.options.paragraphTargetLengthWords,
      minLength: this.options.paragraphMinLengthChars,
      maxLength: this.options.paragraphMaxLengthChars
    });

    const paragraphs: ParsedParagraph[] = [];
    
    // Split by double newlines to get initial paragraph-like chunks
    const initialChunks = text.split(/\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length >= this.options.paragraphMinLengthChars);
    
    logger.debug(`📊 Initial text split`, {
      totalChunks: text.split(/\n\s*\n/).length,
      validChunks: initialChunks.length,
      filteredOutCount: text.split(/\n\s*\n/).length - initialChunks.length
    });

    // Combine chunks to reach target size, respecting sentence boundaries
    let currentParagraph = '';
    let chunkIndex = 0;

    while (chunkIndex < initialChunks.length) {
      const chunk = initialChunks[chunkIndex];
      
      // If current paragraph is empty, start with this chunk
      if (currentParagraph === '') {
        currentParagraph = chunk;
        chunkIndex++;
        continue;
      }

      // Check if adding this chunk would exceed max limits
      if (this.wouldExceedMax(currentParagraph, chunk)) {
        // Before finalizing, check if we can complete the current sentence
        if (!this.endsWithCompleteSentence(currentParagraph)) {
          const sentenceBoundary = this.findLastSentenceBoundary(currentParagraph);
          if (sentenceBoundary > 0) {
            // Split at the last complete sentence
            const completePart = currentParagraph.substring(0, sentenceBoundary).trim();
            const incompletePart = currentParagraph.substring(sentenceBoundary).trim();
            
            logger.debug(`📝 Splitting at sentence boundary to avoid mid-sentence break`, {
              originalLength: currentParagraph.length,
              completePartLength: completePart.length,
              incompletePartLength: incompletePart.length
            });
            
            // Save the complete part
            this.finalizeParagraph(completePart, paragraphs);
            
            // Start new paragraph with incomplete part + current chunk
            currentParagraph = incompletePart + '\n\n' + chunk;
            chunkIndex++;
            continue;
          }
        }
        
        // No sentence boundary found or paragraph already ends with complete sentence
        this.finalizeParagraph(currentParagraph, paragraphs);
        currentParagraph = chunk;
        chunkIndex++;
        continue;
      }

      // Check if current paragraph already meets target size
      if (this.meetsTargetSize(currentParagraph)) {
        // We've reached target, but check if we're in the middle of a sentence
        if (this.endsWithCompleteSentence(currentParagraph)) {
          // Complete sentence - safe to finalize
          this.finalizeParagraph(currentParagraph, paragraphs);
          currentParagraph = chunk;
          chunkIndex++;
          continue;
        } else {
          // In middle of sentence - try to add next chunk if it won't exceed max
          if (!this.wouldExceedMax(currentParagraph, chunk)) {
            logger.debug(`📝 Adding chunk to complete sentence despite meeting target size`, {
              currentLength: currentParagraph.length,
              chunkLength: chunk.length,
              endsWithSentence: this.endsWithCompleteSentence(currentParagraph + '\n\n' + chunk)
            });
            
            currentParagraph += '\n\n' + chunk;
            chunkIndex++;
            continue;
          } else {
            // Would exceed max - split at sentence boundary if possible
            const sentenceBoundary = this.findLastSentenceBoundary(currentParagraph);
            if (sentenceBoundary > 0) {
              const completePart = currentParagraph.substring(0, sentenceBoundary).trim();
              const incompletePart = currentParagraph.substring(sentenceBoundary).trim();
              
              this.finalizeParagraph(completePart, paragraphs);
              currentParagraph = incompletePart + '\n\n' + chunk;
              chunkIndex++;
              continue;
            } else {
              // No good split point - finalize as is
              this.finalizeParagraph(currentParagraph, paragraphs);
              currentParagraph = chunk;
              chunkIndex++;
              continue;
            }
          }
        }
      }

      // Add chunk to current paragraph
      currentParagraph += '\n\n' + chunk;
      chunkIndex++;
    }

    // Don't forget the last paragraph
    if (currentParagraph.trim().length > 0) {
      this.finalizeParagraph(currentParagraph, paragraphs);
    }

    logger.info(`📄 Target-based paragraph extraction completed`, {
      totalParagraphs: paragraphs.length,
      averageChars: paragraphs.length > 0 ? Math.round(paragraphs.reduce((sum, p) => sum + p.content.length, 0) / paragraphs.length) : 0,
      averageWords: paragraphs.length > 0 ? Math.round(paragraphs.reduce((sum, p) => sum + this.countWords(p.content), 0) / paragraphs.length) : 0,
      paragraphsEndingWithSentence: paragraphs.filter(p => this.endsWithCompleteSentence(p.content)).length,
      paragraphStats: paragraphs.map(p => ({
        chars: p.content.length,
        words: this.countWords(p.content),
        meetsTarget: this.meetsTargetSize(p.content),
        endsWithSentence: this.endsWithCompleteSentence(p.content)
      }))
    });

    return paragraphs;
  }

  /**
   * Check if text ends with a complete sentence
   */
  private endsWithCompleteSentence(text: string): boolean {
    const trimmed = text.trim();
    // Check if text ends with sentence-ending punctuation
    return /[.!?]["']?$/.test(trimmed);
  }

  /**
   * Find the last complete sentence boundary in text
   */
  private findLastSentenceBoundary(text: string): number {
    const trimmed = text.trim();
    // Find the last sentence-ending punctuation
    const match = trimmed.match(/.*[.!?]["']?/);
    return match ? match[0].length : -1;
  }

  /**
   * Check if adding more text would exceed maximum limits
   */

  /**
   * Finalize a paragraph and add it to the list, splitting if necessary
   */
  private finalizeParagraph(paragraphText: string, paragraphs: ParsedParagraph[]): void {
    const trimmed = paragraphText.trim();
    
    // Calculate thresholds
    const targetChars = this.options.paragraphTargetLengthChars;
    const targetWords = this.options.paragraphTargetLengthWords;
    const maxChars = this.options.paragraphMaxLengthChars;
    
    // Split threshold: 2x target size or approaching max
    const splitThresholdChars = Math.min(targetChars * 2, maxChars * 0.8);
    const splitThresholdWords = targetWords * 2;
    
    const currentChars = trimmed.length;
    const currentWords = this.countWords(trimmed);
    
    if (currentChars <= splitThresholdChars && currentWords <= splitThresholdWords) {
      // Paragraph is within reasonable limits, add as-is
      paragraphs.push({
        orderIndex: paragraphs.length,
        content: trimmed,
      });
      
      logger.debug(`✅ Added paragraph ${paragraphs.length}`, {
        chars: currentChars,
        words: currentWords,
        meetsTarget: this.meetsTargetSize(trimmed),
        endsWithSentence: this.endsWithCompleteSentence(trimmed),
        withinSplitThreshold: true
      });
    } else {
      // Paragraph significantly exceeds target, split it at sentence boundaries
      logger.info(`✂️ Splitting oversized paragraph`, {
        chars: currentChars,
        words: currentWords,
        targetChars,
        targetWords,
        splitThresholdChars,
        splitThresholdWords,
        reason: currentChars > splitThresholdChars ? 'chars' : 'words'
      });
      
      const splitParagraphs = this.splitLongParagraph(trimmed);
      splitParagraphs.forEach(splitText => {
        paragraphs.push({
          orderIndex: paragraphs.length,
          content: splitText,
        });
        
        logger.debug(`➕ Added split paragraph ${paragraphs.length}`, {
          chars: splitText.length,
          words: this.countWords(splitText),
          endsWithSentence: this.endsWithCompleteSentence(splitText)
        });
      });
    }
  }

  private splitLongParagraph(text: string): string[] {
    logger.debug(`🔪 Starting long paragraph split`, {
      textLength: text.length,
      targetLength: this.options.paragraphTargetLengthChars,
      maxLength: this.options.paragraphMaxLengthChars,
      textPreview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
    });

    const result: string[] = [];
    let currentChunk = '';
    
    // Split by sentences - keep punctuation with the sentence
    // Look for sentence endings followed by whitespace and capital letter or Hebrew letter
    const sentenceRegex = /[.!?]+["']?\s+(?=[A-Z\u05D0-\u05EA])/g;
    const sentences: string[] = [];
    
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      // Include the sentence with its ending punctuation
      const sentence = text.substring(lastIndex, match.index + match[0].length - match[0].match(/\s+$/)[0].length).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length - match[0].match(/\s+$/)[0].length;
    }
    
    // Add the last sentence (from last match to end of text)
    if (lastIndex < text.length) {
      const lastSentence = text.substring(lastIndex).trim();
      if (lastSentence.length > 0) {
        sentences.push(lastSentence);
      }
    }
    
    // If no sentences were found, treat the whole text as one sentence
    if (sentences.length === 0) {
      sentences.push(text.trim());
    }
    
    logger.debug(`📝 Text split into sentences`, {
      totalSentences: sentences.length,
      averageWordLength: sentences.length > 0 ? Math.round(sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length) : 0,
      sentencePreviews: sentences.slice(0, 5).map(s => s.trim().substring(0, 80) + '...')
    });
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      
      logger.debug(`🔍 Processing sentence ${i + 1}/${sentences.length}`, {
        sentenceLength: sentence.length,
        currentChunkLength: currentChunk.length,
        wouldExceedTarget: (currentChunk + ' ' + sentence).length > this.options.paragraphTargetLengthChars,
        wouldExceedMax: (currentChunk + ' ' + sentence).length > this.options.paragraphMaxLengthChars,
        sentencePreview: sentence.substring(0, 100) + (sentence.length > 100 ? '...' : '')
      });
      
      if (currentChunk.length === 0) {
        // First sentence in chunk
        currentChunk = sentence;
        logger.debug(`🆕 Started new chunk with sentence`, {
          chunkLength: currentChunk.length
        });
      } else {
        const combinedLength = (currentChunk + ' ' + sentence).length;
        const combinedWords = this.countWords(currentChunk + ' ' + sentence);
        
        // Check if adding this sentence would exceed our target thresholds
        const exceedsTargetChars = combinedLength > this.options.paragraphTargetLengthChars;
        const exceedsTargetWords = combinedWords > this.options.paragraphTargetLengthWords;
        const exceedsMax = combinedLength > this.options.paragraphMaxLengthChars;
        
        if (exceedsMax || (exceedsTargetChars && exceedsTargetWords && currentChunk.length >= this.options.paragraphMinLengthChars)) {
          // Save current chunk and start new one
          logger.info(`💾 Saving chunk (target threshold reached)`, {
            chunkLength: currentChunk.length,
            chunkWords: this.countWords(currentChunk),
            targetChars: this.options.paragraphTargetLengthChars,
            targetWords: this.options.paragraphTargetLengthWords,
            reason: exceedsMax ? 'max_exceeded' : 'target_exceeded',
            chunkPreview: currentChunk.substring(0, 100) + '...'
          });
          
          result.push(currentChunk);
          currentChunk = sentence;
          
          logger.debug(`🆕 Started new chunk after split`, {
            newChunkLength: currentChunk.length,
            totalChunksSoFar: result.length
          });
        } else {
          currentChunk += ' ' + sentence;
          logger.debug(`➕ Added sentence to current chunk`, {
            newChunkLength: currentChunk.length,
            newChunkWords: this.countWords(currentChunk),
            remainingTargetCapacity: this.options.paragraphTargetLengthChars - currentChunk.length
          });
        }
      }
    }
    
    // Add the last chunk
    if (currentChunk.length > 0) {
      result.push(currentChunk);
      logger.debug(`💾 Added final chunk`, {
        chunkLength: currentChunk.length,
        chunkWords: this.countWords(currentChunk),
        totalChunks: result.length
      });
    }

    logger.info(`✅ Long paragraph split completed`, {
      originalLength: text.length,
      originalWords: this.countWords(text),
      splitInto: result.length,
      chunkLengths: result.map(chunk => chunk.length),
      chunkWords: result.map(chunk => this.countWords(chunk)),
      averageChunkLength: result.length > 0 ? Math.round(result.reduce((sum, chunk) => sum + chunk.length, 0) / result.length) : 0,
      averageChunkWords: result.length > 0 ? Math.round(result.reduce((sum, chunk) => sum + this.countWords(chunk), 0) / result.length) : 0,
      allChunksWithinTarget: result.every(chunk => 
        chunk.length <= this.options.paragraphTargetLengthChars * 1.5 && 
        this.countWords(chunk) <= this.options.paragraphTargetLengthWords * 1.5
      )
    });

    return result;
  }

  private splitByWords(text: string): string[] {
    logger.debug(`🔤 Starting word-based splitting (fallback)`, {
      textLength: text.length,
      maxLength: this.options.paragraphMaxLengthChars,
      textPreview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
    });

    const words = text.split(/\s+/);
    const result: string[] = [];
    let currentChunk = '';
    
    logger.debug(`📝 Text split into words`, {
      totalWords: words.length,
      averageWordLength: words.length > 0 ? Math.round(words.reduce((sum, word) => sum + word.length, 0) / words.length) : 0
    });
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testChunk = currentChunk.length === 0 ? word : currentChunk + ' ' + word;
      
      if (testChunk.length <= this.options.paragraphMaxLengthChars) {
        currentChunk = testChunk;
        
        if (i % 50 === 0) { // Log every 50 words to avoid spam
          logger.debug(`📝 Added word ${i + 1}/${words.length}`, {
            currentChunkLength: currentChunk.length,
            remainingCapacity: this.options.paragraphMaxLengthChars - currentChunk.length
          });
        }
      } else {
        // Save current chunk and start new one
        if (currentChunk.length > 0) {
          result.push(currentChunk);
          logger.debug(`💾 Saved word-based chunk`, {
            chunkLength: currentChunk.length,
            totalChunksSoFar: result.length,
            chunkPreview: currentChunk.substring(0, 100) + '...'
          });
        }
        currentChunk = word;
      }
    }
    
    // Add the last chunk
    if (currentChunk.length > 0) {
      result.push(currentChunk);
      logger.debug(`💾 Added final word-based chunk`, {
        chunkLength: currentChunk.length,
        totalChunks: result.length
      });
    }

    logger.info(`✅ Word-based splitting completed`, {
      originalLength: text.length,
      splitInto: result.length,
      chunkLengths: result.map(chunk => chunk.length),
      averageChunkLength: result.length > 0 ? Math.round(result.reduce((sum, chunk) => sum + chunk.length, 0) / result.length) : 0,
      allChunksWithinLimit: result.every(chunk => chunk.length <= this.options.paragraphMaxLengthChars)
    });

    return result;
  }

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
