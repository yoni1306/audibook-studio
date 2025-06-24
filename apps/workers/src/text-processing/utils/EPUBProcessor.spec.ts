import { EPUBProcessor } from './EPUBProcessor';
import * as fs from 'fs/promises';
import * as cheerio from 'cheerio';

describe('EPUBProcessor', () => {
  let processor: EPUBProcessor;
  let tempDir: string;

  beforeEach(() => {
    processor = new EPUBProcessor('test.epub', {
      targetPageSize: 1000,
      preserveFormatting: false,
    });
    tempDir = '/tmp/epub-test-' + Date.now();
  });

  afterEach(async () => {
    // Clean up temp files if they exist
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Hebrew content processing with headings and paragraphs', () => {
    it('should correctly combine h2 headings with following paragraphs when content is related', async () => {
      // Test data representing the HTML pages from the EPUB
      const htmlPages = [
        // Section 1: מבוא
        `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="he" dir="rtl">
          <head>
            <title>מבוא</title>
          </head>
          <body>
            <h2>מבוא</h2>
            <p>רילוקיישן<br>אוסף מתוך מדוריו של רון מיברג<br>מעריב 2010–2025<br>(לעמוד הקרדיטים)<br>זכויות יוצרים בטורים של רון מיברג אשר התפרסמו ברבות השנים במעריב שייכות ל"מעריב" מקבוצת הג'רוזלם פוסט.<br>"יצירה עברית" מודה ל"מעריב" על השימוש בטורים למטרות הוצאת ספר זה.<br>פרולוג</p>
          </body>
        </html>`,
        
        // Section 2: שער ראשון
        `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="he" dir="rtl">
          <head>
            <title>שער ראשון: מקום אחר</title>
          </head>
          <body>
            <h2>שער ראשון: מקום אחר</h2>
            <p>שער ראשון: מקום אחר<br>ארווין קרויץ, הבלדה על הגרמני המבולבל<br>אוכל בניו אינגלנד, חרפה בצלחת<br>מאפיית מיברג, שלח לחמך<br>אחים בדרכים, האם פריז בוערת<br>פיטר לוגר, שלאג ד'אשתקד<br>מרלין קרפנטר, תענית שתיקה ב"פלאזה"</p>
          </body>
        </html>`
      ];

      // Expected paragraph content after processing
      const expectedParagraphs = [
        // First paragraph: מבוא section - heading and paragraph should be combined
        `מבוא רילוקיישן אוסף מתוך מדוריו של רון מיברג מעריב 2010–2025 (לעמוד הקרדיטים) זכויות יוצרים בטורים של רון מיברג אשר התפרסמו ברבות השנים במעריב שייכות ל"מעריב" מקבוצת הג'רוזלם פוסט. "יצירה עברית" מודה ל"מעריב" על השימוש בטורים למטרות הוצאת ספר זה. פרולוג`,
        
        // Second paragraph: שער ראשון section - heading and paragraph should be combined
        `שער ראשון: מקום אחר שער ראשון: מקום אחר ארווין קרויץ, הבלדה על הגרמני המבולבל אוכל בניו אינגלנד, חרפה בצלחת מאפיית מיברג, שלח לחמך אחים בדרכים, האם פריז בוערת פיטר לוגר, שלאג ד'אשתקד מרלין קרפנטר, תענית שתיקה ב"פלאזה"`
      ];

      // Process each HTML page and collect the resulting pages
      const allPages: any[] = [];
      let currentOffset = 0;
      let pageNumber = 1;

      for (let i = 0; i < htmlPages.length; i++) {
        const html = htmlPages[i];
        
        // Create a mock chapter object
        const mockChapter = {
          title: `Chapter ${i + 1}`,
          href: `section${i + 1}.xhtml`,
          content: html
        };

        // Use the public method to paginate this chapter
        const pages = await processor.paginateChapter(
          mockChapter,
          currentOffset,
          pageNumber
        );

        allPages.push(...pages);
        
        // Update offset and page number for next chapter
        if (pages.length > 0) {
          const lastPage = pages[pages.length - 1];
          currentOffset = lastPage.endOffset;
          pageNumber += pages.length;
        }
      }

      // Verify we got the expected number of pages
      expect(allPages).toHaveLength(2);

      // Verify the content of each page matches expected paragraphs
      for (let i = 0; i < expectedParagraphs.length; i++) {
        const page = allPages[i];
        const expectedContent = expectedParagraphs[i];
        
        // Normalize whitespace for comparison
        const normalizedPageContent = page.content.replace(/\s+/g, ' ').trim();
        const normalizedExpectedContent = expectedContent.replace(/\s+/g, ' ').trim();
        
        expect(normalizedPageContent).toBe(normalizedExpectedContent);
        
        // Verify page metadata
        expect(page.pageNumber).toBe(i + 1);
        expect(page.sourceFile).toBe(`section${i + 1}.xhtml`);
        expect(page.startOffset).toBeGreaterThanOrEqual(0);
        expect(page.endOffset).toBeGreaterThan(page.startOffset);
      }
    });

    it('should correctly extract and combine heading and paragraph text', () => {
      const html = `
        <html>
          <body>
            <h2>שער ראשון: מקום אחר</h2>
            <p>שער ראשון: מקום אחר<br>ארווין קרויץ, הבלדה על הגרמני המבולבל<br>אוכל בניו אינגלנד, חרפה בצלחת</p>
          </body>
        </html>
      `;

      const $ = cheerio.load(html);
      
      // Test the extractText method
      const h2Element = $('h2').first();
      const pElement = $('p').first();
      
      const h2Text = (processor as any).extractText(h2Element);
      const pText = (processor as any).extractText(pElement);
      
      expect(h2Text.trim()).toBe('שער ראשון: מקום אחר');
      expect(pText.trim()).toBe('שער ראשון: מקום אחר ארווין קרויץ, הבלדה על הגרמני המבולבל אוכל בניו אינגלנד, חרפה בצלחת');
    });

    it('should detect when headings should not trigger page breaks', () => {
      const html = `
        <html>
          <body>
            <h2>שער ראשון: מקום אחר</h2>
            <p>שער ראשון: מקום אחר<br>ארווין קרויץ, הבלדה על הגרמני המבולבל</p>
          </body>
        </html>
      `;

      const $ = cheerio.load(html);
      const h2Element = $('h2').first();
      
      // Test the hasPageBreak method
      const shouldBreak = (processor as any).hasPageBreak(h2Element);
      
      // This heading contains "שער" which is a Hebrew section keyword, 
      // so it should potentially trigger a break
      expect(shouldBreak).toBe(true);
      
      // But in the context of the paginateChapter logic,
      // it should be kept with the following content due to the relationship detection
    });

    it('should correctly identify headings', () => {
      const html = `
        <html>
          <body>
            <h1>כותרת ראשית</h1>
            <h2>שער ראשון: מקום אחר</h2>
            <h3>תת כותרת</h3>
            <p>פסקה רגילה</p>
            <div>דיב רגיל</div>
          </body>
        </html>
      `;

      const $ = cheerio.load(html);
      
      // Test the isHeading method
      expect((processor as any).isHeading($('h1').first())).toBe(true);
      expect((processor as any).isHeading($('h2').first())).toBe(true);
      expect((processor as any).isHeading($('h3').first())).toBe(true);
      expect((processor as any).isHeading($('p').first())).toBe(false);
      expect((processor as any).isHeading($('div').first())).toBe(false);
    });

    it('should extract page blocks in correct order', () => {
      const html = `
        <html>
          <body>
            <h2>מבוא</h2>
            <p>פסקה ראשונה עם תוכן משמעותי</p>
            <h2>שער ראשון: מקום אחר</h2>
            <p>פסקה שנייה עם תוכן משמעותי נוסף</p>
          </body>
        </html>
      `;

      const $ = cheerio.load(html);
      const blocks = (processor as any).extractPageBlocks($);
      
      // Now headings are included regardless of length since they're structurally important
      expect(blocks).toHaveLength(4);
      
      // Verify the order and content of blocks
      const blockTexts = blocks.map((block: any) => (processor as any).extractText(block).trim());
      
      expect(blockTexts[0]).toBe('מבוא');
      expect(blockTexts[1]).toBe('פסקה ראשונה עם תוכן משמעותי');
      expect(blockTexts[2]).toBe('שער ראשון: מקום אחר');
      expect(blockTexts[3]).toBe('פסקה שנייה עם תוכן משמעותי נוסף');
    });
  });

  describe('Page break detection', () => {
    it('should detect Hebrew section keywords', () => {
      const testCases = [
        { html: '<h2>פרק ראשון</h2>', shouldBreak: true },
        { html: '<h2>שער שני</h2>', shouldBreak: true },
        { html: '<h2>חלק שלישי</h2>', shouldBreak: true },
        { html: '<h1>Chapter One</h1>', shouldBreak: true },
        { html: '<h2>Part Two</h2>', shouldBreak: true },
        { html: '<h3>כותרת קצרה</h3>', shouldBreak: false }, // h3 not in break list
        { html: '<h2>כותרת קצרה</h2>', shouldBreak: false }, // no keywords and short
      ];

      testCases.forEach(({ html, shouldBreak }) => {
        const $ = cheerio.load(html);
        const element = $('h1, h2, h3').first();
        const result = (processor as any).hasPageBreak(element);
        
        expect(result).toBe(shouldBreak);
      });
    });

    it('should detect explicit page break styles and classes', () => {
      const testCases = [
        { html: '<div style="page-break-before: always;">Content</div>', shouldBreak: true },
        { html: '<div style="break-after: page;">Content</div>', shouldBreak: true },
        { html: '<div class="page-break chapter-start">Content</div>', shouldBreak: true },
        { html: '<div class="chapter">Content</div>', shouldBreak: true },
        { html: '<div class="normal">Content</div>', shouldBreak: false },
      ];

      testCases.forEach(({ html, shouldBreak }) => {
        const $ = cheerio.load(html);
        const element = $('div').first();
        const result = (processor as any).hasPageBreak(element);
        
        expect(result).toBe(shouldBreak);
      });
    });
  });
});
