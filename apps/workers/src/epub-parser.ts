import path from 'path';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import { parseStringPromise } from 'xml2js';
import { JSDOM } from 'jsdom';
import * as unzipper from 'unzipper';
import { createLogger } from '@audibook/logger';
import { processBookText, PresetName } from './text-processing';
import { getChapterTitles, setChapterTitles, type BookChapterConfig } from './chapter-titles-config';

const logger = createLogger('EpubParser');

export { getChapterTitles, setChapterTitles, type BookChapterConfig } from './chapter-titles-config';

export interface EpubParseOptions {
  preset?: PresetName;
  debug?: boolean;
  manualChapterTitles?: string[];
}

export interface EpubParagraph {
  chapterNumber: number;
  orderIndex: number;
  content: string;
  chapterTitle?: string;
  metadata?: Record<string, unknown>;
}

export async function parseEpub(
  epubPath: string, 
  options: EpubParseOptions = {}
): Promise<EpubParagraph[]> {
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

    const allChapterTexts: Array<{ chapterNumber: number; content: string; title?: string }> = [];

    // Process each spine item to extract full chapter content
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

        // Extract chapter title from h1, h2, or title elements
        let chapterTitle = '';
        if (options.manualChapterTitles && options.manualChapterTitles.length > chapterIndex) {
          chapterTitle = options.manualChapterTitles[chapterIndex];
        } else {
          const titleElement = document.querySelector('h1, h2, title');
          if (titleElement) {
            chapterTitle = titleElement.textContent?.trim() || '';
          }
        }

        // Extract all text content from the chapter
        const textElements = document.querySelectorAll(
          'p, h1, h2, h3, h4, h5, h6, div, section, span'
        );

        let chapterText = '';
        textElements.forEach((element) => {
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
          let elementText = '';
          while ((node = walker.nextNode())) {
            elementText += ' ' + node.textContent?.trim();
          }

          elementText = elementText.trim();
          if (elementText.length > 0) {
            chapterText += elementText + '\n';
          }
        });

        if (chapterText.trim().length > 10) {
          allChapterTexts.push({
            chapterNumber: chapterIndex + 1,
            content: chapterText.trim(),
            title: chapterTitle || `Chapter ${chapterIndex + 1}`
          });
        }
      } catch (error) {
        logger.error(
          `Error processing chapter ${chapterIndex} (${href}):`,
          error
        );
      }
    }

    // Combine all chapter texts for processing
    const fullBookText = allChapterTexts
      .map(chapter => `${chapter.title}\n\n${chapter.content}`)
      .join('\n\n');

    // Use manual chapter titles if provided, otherwise use extracted titles
    const chapterTitles = options.manualChapterTitles && options.manualChapterTitles.length > 0
      ? options.manualChapterTitles
      : allChapterTexts.map(chapter => chapter.title || '');

    // Process with Hebrew TTS Splitter
    logger.info('Processing book text with Hebrew TTS Splitter...');
    logger.info(`Using ${options.manualChapterTitles ? 'manual' : 'extracted'} chapter titles: ${chapterTitles.length} titles`);
    
    const processingResult = await processBookText(fullBookText, {
      preset: options.preset || 'narrative',
      chapterTitles,
      debug: options.debug || false
    });

    logger.info(`Hebrew TTS Splitter results:
      - Total chunks: ${processingResult.totalChunks}
      - Chapters detected: ${processingResult.chaptersDetected}
      - Average chunk size: ${processingResult.averageChunkSize} characters
      - Processing time: ${processingResult.processingTimeMs}ms`);

    // Convert chunks to paragraph format
    const paragraphs: EpubParagraph[] = processingResult.chunks.map((chunk, index) => ({
      chapterNumber: chunk.chapter?.index ? chunk.chapter.index + 1 : 1,
      orderIndex: index,
      content: chunk.content,
      chapterTitle: chunk.chapter?.title,
      metadata: {
        splitType: chunk.metadata?.splitType,
        originalPosition: chunk.position,
        chunkIndex: chunk.chapter?.chunkIndex,
        ...chunk.metadata
      }
    }));

    // Clean up temp directory
    await fsPromises
      .rm(tempDir, { recursive: true, force: true })
      .catch((error) => {
        logger.error('Failed to clean up temp directory:', error);
      });

    logger.info(
      `Extracted ${paragraphs.length} optimized paragraphs from ${spine.length} chapters using Hebrew TTS Splitter`
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
