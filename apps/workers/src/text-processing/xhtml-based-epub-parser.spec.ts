// Jest globals are available without import
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { XHTMLBasedEPUBParser, XHTMLParserOptions } from './xhtml-based-epub-parser';

describe('XHTMLBasedEPUBParser', () => {
  let parser: XHTMLBasedEPUBParser;
  let testEpubPath: string;

  beforeEach(async () => {
    parser = new XHTMLBasedEPUBParser();
    // Use the real EPUB file provided by the user
    testEpubPath = path.join(__dirname, '../../../../test_book.epub');
    
    // Verify the test EPUB file exists
    try {
      await fsPromises.access(testEpubPath);
    } catch {
      throw new Error(`Test EPUB file not found at: ${testEpubPath}`);
    }
  });

  afterEach(async () => {
    // No cleanup needed since we're using a real EPUB file
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const defaultParser = new XHTMLBasedEPUBParser();
      expect(defaultParser).toBeDefined();
    });

    it('should merge provided options with defaults', () => {
      const options: XHTMLParserOptions = {
        paragraphTargetLengthChars: 500,
        minParagraphLength: 10,
        includeEmptyPages: false,
      };
      const customParser = new XHTMLBasedEPUBParser(options);
      expect(customParser).toBeDefined();
    });
  });

  describe('parseEpub', () => {
    it('should parse real EPUB file successfully', async () => {
      const result = await parser.parseEpub(testEpubPath);
      
      expect(result).toBeDefined();
      expect(result.pages).toBeDefined();
      // test_book.epub contains 43 XHTML files, tzayedet_halila_5.xhtml is truly empty (expect 42 pages)
      expect(result.pages.length).toBe(42);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalPages).toBe(42);
      expect(result.metadata.totalPages).toBe(result.pages.length);
      expect(result.metadata.totalParagraphs).toBeGreaterThan(0);
      expect(result.metadata.averageParagraphsPerPage).toBeGreaterThan(0);
      
      // Verify pages have content
      result.pages.forEach((page) => {
        expect(page.pageNumber).toBeDefined();
        expect(page.fileName).toBeDefined();
        expect(page.filePath).toBeDefined();
        expect(page.paragraphs).toBeDefined();
        expect(Array.isArray(page.paragraphs)).toBe(true);
        expect(page.paragraphs.length).toBeGreaterThan(0);
      });
    });

    it('should extract text content from XHTML files', async () => {
      const result = await parser.parseEpub(testEpubPath);

      expect(result.pages.length).toBeGreaterThan(0);
      
      // Verify that pages contain actual text content
      const pagesWithContent = result.pages.filter(page => 
        page.paragraphs.length > 0 && page.paragraphs.some(p => p.content.trim().length > 0)
      );
      expect(pagesWithContent.length).toBeGreaterThan(0);
    });

    it('should handle parser options correctly', async () => {
      const customParser = new XHTMLBasedEPUBParser({
        includeEmptyPages: true,
        minParagraphLength: 10,
        paragraphTargetLengthWords: 50
      });

      const result = await customParser.parseEpub(testEpubPath);

      expect(result.pages).toBeDefined();
      expect(result.metadata.totalPages).toBe(result.pages.length);
    });

    it('should provide accurate metadata', async () => {
      const result = await parser.parseEpub(testEpubPath);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalPages).toBeGreaterThan(0);
      expect(result.metadata.totalPages).toBe(result.pages.length);
      expect(typeof result.metadata.totalPages).toBe('number');
    });

    it('should handle different parser configurations', async () => {
      const customParser = new XHTMLBasedEPUBParser({
        includeEmptyPages: false,
        minParagraphLength: 5,
        paragraphTargetLengthWords: 30
      });

      const result = await customParser.parseEpub(testEpubPath);

      expect(result.pages).toBeDefined();
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.metadata.totalPages).toBe(result.pages.length);
    });

    it('should handle file ordering correctly', async () => {
      const result = await parser.parseEpub(testEpubPath);

      expect(result.pages.length).toBeGreaterThan(0);
      
      // Verify pages are ordered (each page should have a valid page number)
      result.pages.forEach((page, index) => {
        expect(page.pageNumber).toBe(index + 1);
      });
    });

    it('should extract content from various HTML elements', async () => {
      const result = await parser.parseEpub(testEpubPath);

      expect(result.pages.length).toBeGreaterThan(0);
      
      // Verify that at least some pages have content
      const pagesWithContent = result.pages.filter(page => 
        page.paragraphs.length > 0 && page.paragraphs.some(p => p.content && p.content.trim().length > 0)
      );
      expect(pagesWithContent.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle non-existent EPUB files', async () => {
      const nonExistentPath = '/path/to/non-existent.epub';
      
      await expect(parser.parseEpub(nonExistentPath)).rejects.toThrow(/ENOENT|no such file/);
    }, 10000); // 10 second timeout

    it('should handle invalid EPUB files', async () => {
      const invalidEpubPath = path.join(__dirname, '../../../../package.json');
      
      await expect(parser.parseEpub(invalidEpubPath)).rejects.toThrow();
    });
  });
});
