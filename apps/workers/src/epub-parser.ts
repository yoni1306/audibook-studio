import { Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import * as fs from 'fs'; // Regular fs, not fs/promises
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { parseStringPromise } from 'xml2js';

const logger = new Logger('EpubParser');

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
    logger.log(`Parsing EPUB 3.0 file: ${epubPath}`);

    // Extract EPUB to temp directory
    const tempDir = path.join('/tmp', `epub-${Date.now()}`);
    await fsPromises.mkdir(tempDir, { recursive: true });

    // Unzip the EPUB
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(epubPath)
        .pipe(unzipper.Extract({ path: tempDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    logger.log(`Extracted EPUB to: ${tempDir}`);

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
    manifest.forEach((item: any) => {
      manifestMap.set(item.$.id, item.$.href);
    });

    let orderIndex = 0;

    // Process each spine item
    for (let chapterIndex = 0; chapterIndex < spine.length; chapterIndex++) {
      const itemId = spine[chapterIndex].$.idref;
      const href = manifestMap.get(itemId);

      if (!href) continue;

      const contentPath = path.join(opfDir, href);

      try {
        const content = await fsPromises.readFile(contentPath, 'utf-8');

        // Parse HTML/XHTML content
        const dom = new JSDOM(content, {
          contentType: 'application/xhtml+xml',
        });
        const document = dom.window.document;

        // Remove script and style elements
        document.querySelectorAll('script, style').forEach((el) => el.remove());

        // Extract text from various elements
        const textElements = document.querySelectorAll(
          'p, h1, h2, h3, h4, h5, h6, div, section'
        );

        textElements.forEach((element) => {
          // Get direct text content
          const texts: string[] = [];

          // Collect all text nodes
          const walker = document.createTreeWalker(
            element,
            dom.window.NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                const text = node.textContent?.trim();
                if (text && text.length > 0) {
                  return dom.window.NodeFilter.FILTER_ACCEPT;
                }
                return dom.window.NodeFilter.FILTER_SKIP;
              },
            }
          );

          let node;
          let currentText = '';
          while ((node = walker.nextNode())) {
            currentText += ' ' + node.textContent?.trim();
          }

          currentText = currentText.trim();

          // Only add if has substantial content
          if (currentText.length > 10) {
            // Split very long texts into smaller paragraphs
            if (currentText.length > 500) {
              const sentences = currentText.match(/[^.!?]+[.!?]+/g) || [
                currentText,
              ];
              let paragraph = '';

              sentences.forEach((sentence) => {
                paragraph += sentence + ' ';
                if (paragraph.length > 300) {
                  paragraphs.push({
                    chapterNumber: chapterIndex + 1,
                    orderIndex: orderIndex++,
                    content: paragraph.trim(),
                  });
                  paragraph = '';
                }
              });

              if (paragraph.trim().length > 10) {
                paragraphs.push({
                  chapterNumber: chapterIndex + 1,
                  orderIndex: orderIndex++,
                  content: paragraph.trim(),
                });
              }
            } else {
              paragraphs.push({
                chapterNumber: chapterIndex + 1,
                orderIndex: orderIndex++,
                content: currentText,
              });
            }
          }
        });
      } catch (error) {
        logger.error(
          `Error processing chapter ${chapterIndex} (${href}):`,
          error
        );
      }
    }

    // Clean up temp directory
    await fsPromises
      .rm(tempDir, { recursive: true, force: true })
      .catch(() => {});

    logger.log(
      `Extracted ${paragraphs.length} paragraphs from ${spine.length} chapters`
    );

    // If no paragraphs found, log the issue
    if (paragraphs.length === 0) {
      logger.error(
        'No paragraphs extracted. EPUB might have an unusual structure.'
      );
    }

    return paragraphs;
  } catch (error) {
    logger.error('Error parsing EPUB 3.0:', error);
    throw error;
  }
}
