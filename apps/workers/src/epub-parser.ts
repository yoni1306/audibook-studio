import path from 'path';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import { parseStringPromise } from 'xml2js';
import { JSDOM } from 'jsdom';
import * as unzipper from 'unzipper';
import { createLogger } from '@audibook/logger';

const logger = createLogger('EpubParser');

export interface EpubChapter {
  chapterNumber: number;
  content: string;
}

export interface ParsedParagraph {
  chapterNumber: number;
  orderIndex: number;
  content: string;
}

/**
 * Parses EPUB content from chapter data and extracts paragraphs
 * This function handles the actual content parsing logic
 */
export function parseEpubContent(chapters: EpubChapter[]): ParsedParagraph[] {
  const paragraphs: ParsedParagraph[] = [];
  let orderIndex = 0;

  chapters.forEach((chapter) => {
    try {
      // Parse HTML/XHTML content
      const dom = new JSDOM(chapter.content, {
        contentType: 'application/xhtml+xml',
      });
      const document = dom.window.document;

      // Remove script and style elements
      document.querySelectorAll('script, style').forEach((el) => el.remove());

      // Find all content elements that should be processed as separate paragraphs
      const contentElements = document.querySelectorAll(
        'p, h1, h2, h3, h4, h5, h6, ol, ul'
      );

      contentElements.forEach((element) => {
        const text = extractTextFromElement(element);
        if (text && text.trim().length > 0) {
          // Split long paragraphs into smaller chunks
          const chunks = splitLongParagraph(text.trim());
          chunks.forEach((chunk) => {
            paragraphs.push({
              content: chunk,
              chapterNumber: chapter.chapterNumber,
              orderIndex: orderIndex++,
            });
          });
        }
      });
    } catch (error) {
      logger.error(`Error parsing chapter ${chapter.chapterNumber}:`, error);
    }
  });

  return paragraphs;
}

/**
 * Extracts text from a single element, handling lists specially
 */
function extractTextFromElement(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'ol') {
    // Ordered list - extract with numbering
    let listText = '';
    let itemNumber = 1;
    const listItems = element.querySelectorAll('li');
    
    listItems.forEach((li) => {
      const itemText = li.textContent?.trim();
      if (itemText && itemText.length > 0) {
        listText += `${itemNumber}. ${itemText}\n`;
        itemNumber++;
      }
    });
    
    return listText.trim();
  } else if (tagName === 'ul') {
    // Unordered list - extract with bullets
    let listText = '';
    const listItems = element.querySelectorAll('li');
    
    listItems.forEach((li) => {
      const itemText = li.textContent?.trim();
      if (itemText && itemText.length > 0) {
        listText += `• ${itemText}\n`;
      }
    });
    
    return listText.trim();
  } else {
    // Regular element - extract text content directly
    return element.textContent?.trim() || '';
  }
}

/**
 * Splits a long paragraph into smaller chunks
 */
function splitLongParagraph(paragraph: string): string[] {
  // Don't split list content - it has its own structure
  if (paragraph.includes('• ') || /^\d+\.\s/.test(paragraph)) {
    return [paragraph];
  }
  
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
  const chunks: string[] = [];
  let currentChunk = '';

  sentences.forEach((sentence) => {
    currentChunk += sentence + ' ';
    if (currentChunk.length > 300) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
  });

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Main function that extracts EPUB file and parses its content
 * This function handles file system operations and delegates parsing to parseEpubContent
 */
export async function parseEpub(epubPath: string): Promise<ParsedParagraph[]> {
  try {
    logger.info(`Parsing EPUB 3.0 file: ${epubPath}`);

    // Extract EPUB to temp directory
    const tempDir = path.join('/tmp', `epub-${Date.now()}`);
    await fsPromises.mkdir(tempDir, { recursive: true });

    // Unzip the EPUB using unzipper
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(epubPath)
        .pipe(unzipper.Extract({ path: tempDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    logger.info(`Extracted EPUB to: ${tempDir}`);

    // Read container.xml to find content.opf
    const containerPath = path.join(tempDir, 'META-INF', 'container.xml');
    const containerXml = await fsPromises.readFile(containerPath, 'utf-8');
    const container = await parseStringPromise(containerXml);

    const opfPath = container.container.rootfiles[0].rootfile[0].$['full-path'];
    const opfDir = path.dirname(path.join(tempDir, opfPath));
    const opfContent = await fsPromises.readFile(
      path.join(tempDir, opfPath),
      'utf-8'
    );
    const opf = await parseStringPromise(opfContent);

    // Get spine order (reading order)
    const spine = opf.package.spine[0].itemref;
    const manifest = opf.package.manifest[0].item;

    // Create manifest map
    const manifestMap = new Map();
    manifest.forEach((item: { $: { id: string; href: string } }) => {
      manifestMap.set(item.$.id, item.$.href);
    });

    // Extract chapter content
    const chapters: EpubChapter[] = [];
    for (let chapterIndex = 0; chapterIndex < spine.length; chapterIndex++) {
      const itemId = spine[chapterIndex].$.idref;
      const href = manifestMap.get(itemId);

      if (!href) continue;

      const contentPath = path.join(opfDir, href);

      try {
        const content = await fsPromises.readFile(contentPath, 'utf-8');
        chapters.push({
          chapterNumber: chapterIndex + 1,
          content,
        });
      } catch (error) {
        logger.error(
          `Error reading chapter ${chapterIndex} (${href}):`,
          error
        );
      }
    }

    // Clean up temp directory
    await fsPromises
      .rm(tempDir, { recursive: true, force: true })
      .catch((error) => {
        logger.error('Failed to clean up temp directory:', error);
      });

    // Parse the extracted chapters
    const paragraphs = parseEpubContent(chapters);

    logger.info(
      `Extracted ${paragraphs.length} paragraphs from ${spine.length} chapters`
    );

    // If no paragraphs found, log a warning
    if (paragraphs.length === 0) {
      logger.warn('No paragraphs found in EPUB file');
    }

    return paragraphs;
  } catch (error) {
    logger.error('Error parsing EPUB:', error);
    throw error;
  }
}
