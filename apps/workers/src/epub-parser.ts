import { Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { promisify } from 'util';

const logger = new Logger('EpubParser');

// Use require for epub since it doesn't have proper ES module support
const EPub = require('epub');

export async function parseEpub(epubPath: string): Promise<
  Array<{
    chapterNumber: number;
    orderIndex: number;
    content: string;
  }>
> {
  const paragraphs: Array<{
    chapterNumber: number;
    orderIndex: number;
    content: string;
  }> = [];

  try {
    logger.log(`Parsing EPUB file: ${epubPath}`);

    // Create epub instance
    const epub = new EPub(epubPath);

    // Parse the EPUB
    await new Promise<void>((resolve, reject) => {
      epub.parse();
      epub.on('end', () => resolve());
      epub.on('error', reject);
    });

    logger.log(`Book loaded: ${epub.metadata.title}`);

    let orderIndex = 0;

    // Process each chapter
    for (let i = 0; i < epub.flow.length; i++) {
      const chapter = epub.flow[i];

      try {
        // Get chapter content
        const chapterHtml = await promisify(epub.getChapter.bind(epub))(
          chapter.id
        );

        // Parse HTML content
        const dom = new JSDOM(chapterHtml);
        const document = dom.window.document;

        // Find all paragraphs
        const paragraphElements = document.querySelectorAll('p');

        paragraphElements.forEach((p) => {
          const text = p.textContent?.trim();
          if (text && text.length > 0) {
            paragraphs.push({
              chapterNumber: i + 1,
              orderIndex: orderIndex++,
              content: text,
            });
          }
        });

        // Also check for divs that might contain text
        const divElements = document.querySelectorAll('div');
        divElements.forEach((div) => {
          // Check if div has meaningful text content
          const hasOnlyTextNodes = Array.from(div.childNodes).every(
            (node) => node.nodeType === 3 || node.nodeName === 'BR'
          );

          if (hasOnlyTextNodes) {
            const text = div.textContent?.trim();
            if (text && text.length > 50) {
              // Minimum length to avoid headers
              paragraphs.push({
                chapterNumber: i + 1,
                orderIndex: orderIndex++,
                content: text,
              });
            }
          }
        });
      } catch (error) {
        logger.error(`Error processing chapter ${i}:`, error);
      }
    }

    logger.log(
      `Extracted ${paragraphs.length} paragraphs from ${epub.flow.length} chapters`
    );

    return paragraphs;
  } catch (error) {
    logger.error('Error parsing EPUB:', error);
    throw error;
  }
}
