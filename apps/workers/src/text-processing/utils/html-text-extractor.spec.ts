import { JSDOM } from 'jsdom';
import { HTMLTextExtractor } from './html-text-extractor';

describe('HTMLTextExtractor', () => {
  let extractor: HTMLTextExtractor;
  let document: Document;

  beforeEach(() => {
    extractor = new HTMLTextExtractor();
  });

  const createDocument = (html: string): Document => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
    return dom.window.document;
  };

  describe('extractTextChunks', () => {
    it('should extract text from simple paragraph elements', () => {
      document = createDocument(`
        <p>First paragraph</p>
        <p>Second paragraph</p>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['First paragraph', 'Second paragraph']);
    });

    it('should extract text from various heading elements', () => {
      document = createDocument(`
        <h1>Main Title</h1>
        <h2>Subtitle</h2>
        <h3>Section Header</h3>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Main Title', 'Subtitle', 'Section Header']);
    });

    it('should avoid duplication from nested elements', () => {
      document = createDocument(`
        <div>
          <p>Nested paragraph text</p>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should only extract once from the leaf element (p), not from both div and p
      expect(chunks).toEqual(['Nested paragraph text']);
      expect(chunks).toHaveLength(1);
    });

    it('should handle complex nested structures without duplication', () => {
      document = createDocument(`
        <section>
          <article>
            <div>
              <p>Deep nested text</p>
            </div>
          </article>
        </section>
        <div>
          <h2>Another section</h2>
          <p>More content</p>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Deep nested text', 'Another section', 'More content']);
      expect(chunks).toHaveLength(3);
    });

    it('should extract from multiple leaf elements in same parent', () => {
      document = createDocument(`
        <div>
          <p>First leaf</p>
          <p>Second leaf</p>
          <h3>Third leaf</h3>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['First leaf', 'Second leaf', 'Third leaf']);
    });

    it('should handle inline elements when includeInlineElements is true', () => {
      extractor = new HTMLTextExtractor({ includeInlineElements: true });
      document = createDocument(`
        <div>
          <span>Inline text</span>
          <em>Emphasized text</em>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should extract from the div (leaf major element) which contains all the inline text
      expect(chunks).toEqual(['Inline text Emphasized text']);
    });

    it('should handle standalone inline elements when includeInlineElements is true', () => {
      extractor = new HTMLTextExtractor({ includeInlineElements: true });
      document = createDocument(`
        <body>
          <span>Standalone inline text</span>
          <em>Another standalone inline</em>
        </body>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should extract from standalone inline elements since no major elements are present
      expect(chunks).toEqual(['Standalone inline text', 'Another standalone inline']);
    });

    it('should exclude inline elements when includeInlineElements is false', () => {
      extractor = new HTMLTextExtractor({ includeInlineElements: false });
      document = createDocument(`
        <div>
          <p>Block text</p>
          <span>Inline text</span>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Block text']);
    });

    it('should remove script and style elements by default', () => {
      document = createDocument(`
        <p>Visible text</p>
        <script>console.log('hidden');</script>
        <style>body { color: red; }</style>
        <p>More visible text</p>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Visible text', 'More visible text']);
    });

    it('should respect custom excluded elements', () => {
      extractor = new HTMLTextExtractor({ excludeElements: ['script', 'style', 'nav'] });
      document = createDocument(`
        <p>Main content</p>
        <nav>Navigation menu</nav>
        <p>More content</p>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Main content', 'More content']);
    });

    it('should handle empty elements gracefully', () => {
      document = createDocument(`
        <p></p>
        <div>   </div>
        <p>Real content</p>
        <h1></h1>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Real content']);
    });

    it('should handle mixed content with text nodes and elements', () => {
      document = createDocument(`
        <div>
          Some direct text
          <p>Paragraph text</p>
          More direct text
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should extract from the paragraph (leaf) and handle direct text appropriately
      expect(chunks).toContain('Paragraph text');
    });

    it('should handle list items correctly', () => {
      document = createDocument(`
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        <ol>
          <li>Numbered item</li>
        </ol>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['First item', 'Second item', 'Numbered item']);
    });

    it('should handle blockquotes and other semantic elements', () => {
      document = createDocument(`
        <blockquote>Quoted text</blockquote>
        <main>
          <p>Main content</p>
        </main>
        <article>
          <h2>Article title</h2>
        </article>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Quoted text', 'Main content', 'Article title']);
    });

    it('should return empty array for document with no text content', () => {
      document = createDocument(`
        <div></div>
        <script>console.log('test');</script>
        <style>body { margin: 0; }</style>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual([]);
    });

    it('should handle deeply nested inline formatting', () => {
      document = createDocument(`
        <p>
          <strong>
            <em>
              <span>Deeply nested text</span>
            </em>
          </strong>
        </p>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should extract once from the paragraph (leaf major element)
      expect(chunks).toEqual(['Deeply nested text']);
    });

    it('should preserve text spacing and formatting', () => {
      document = createDocument(`
        <p>Text with   multiple   spaces</p>
        <p>Text with
        line breaks</p>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should normalize whitespace but preserve meaningful content
      expect(chunks[0]).toContain('multiple');
      expect(chunks[1]).toContain('line breaks');
      expect(chunks).toHaveLength(2);
    });
  });

  describe('extractFullText', () => {
    it('should combine all text chunks with double newlines', () => {
      document = createDocument(`
        <p>First paragraph</p>
        <p>Second paragraph</p>
        <h1>Heading</h1>
      `);

      const fullText = extractor.extractFullText(document);

      expect(fullText).toBe('First paragraph\n\nSecond paragraph\n\nHeading');
    });

    it('should handle empty document', () => {
      document = createDocument('<div></div>');

      const fullText = extractor.extractFullText(document);

      expect(fullText).toBe('');
    });

    it('should avoid duplication in full text extraction', () => {
      document = createDocument(`
        <div>
          <p>Nested content</p>
        </div>
      `);

      const fullText = extractor.extractFullText(document);

      expect(fullText).toBe('Nested content');
      // Ensure text doesn't appear twice
      expect(fullText.split('Nested content')).toHaveLength(2);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed HTML gracefully', () => {
      document = createDocument(`
        <p>Unclosed paragraph
        <div>Unclosed div
        <p>Another paragraph</p>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should still extract meaningful content despite malformed HTML
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(chunk => chunk.includes('paragraph'))).toBe(true);
    });

    it('should handle documents with only whitespace', () => {
      document = createDocument(`
        <p>   </p>
        <div>
          
        </div>
        <h1>    </h1>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual([]);
    });

    it('should handle special characters and Unicode', () => {
      document = createDocument(`
        <p>Hebrew text: שלום עולם</p>
        <p>Emoji: 🌟✨</p>
        <p>Special chars: &amp; &lt; &gt;</p>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toContain('שלום עולם');
      expect(chunks[1]).toContain('🌟✨');
      expect(chunks[2]).toContain('& < >');
    });

    it('should handle very large nested structures efficiently', () => {
      // Create a deeply nested structure
      let html = '<div>';
      for (let i = 0; i < 50; i++) {
        html += `<div><section><article>`;
      }
      html += '<p>Deep content</p>';
      for (let i = 0; i < 50; i++) {
        html += '</article></section></div>';
      }
      html += '</div>';

      document = createDocument(html);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toEqual(['Deep content']);
    });
  });

  describe('configuration options', () => {
    it('should use default options when none provided', () => {
      const defaultExtractor = new HTMLTextExtractor();
      document = createDocument(`
        <p>Text</p>
        <span>Standalone inline</span>
        <script>Hidden</script>
      `);

      const chunks = defaultExtractor.extractTextChunks(document);

      expect(chunks).toContain('Text');
      expect(chunks).toContain('Standalone inline'); // standalone inline elements extracted when includeInlineElements defaults to true
      expect(chunks).not.toContain('Hidden'); // script excluded by default
    });

    it('should merge provided options with defaults', () => {
      const customExtractor = new HTMLTextExtractor({
        excludeElements: ['script', 'style', 'footer']
      });
      document = createDocument(`
        <p>Main text</p>
        <footer>Footer text</footer>
        <script>Script text</script>
      `);

      const chunks = customExtractor.extractTextChunks(document);

      expect(chunks).toEqual(['Main text']);
    });
  });

  describe('real-world EPUB scenarios', () => {
    it('should handle typical EPUB chapter structure', () => {
      document = createDocument(`
        <html>
          <head><title>Chapter 1</title></head>
          <body>
            <div class="chapter">
              <h1>Chapter Title</h1>
              <div class="content">
                <p>First paragraph of the chapter.</p>
                <p>Second paragraph with <em>emphasis</em> and <strong>bold</strong> text.</p>
                <blockquote>
                  <p>A quoted passage from another source.</p>
                </blockquote>
                <p>Final paragraph of the chapter.</p>
              </div>
            </div>
          </body>
        </html>
      `);

      const chunks = extractor.extractTextChunks(document);

      // Should extract from leaf elements: h1, each p, and the p inside blockquote
      expect(chunks).toEqual([
        'Chapter Title',
        'First paragraph of the chapter.',
        'Second paragraph with emphasis and bold text.',
        'A quoted passage from another source.',
        'Final paragraph of the chapter.'
      ]);
    });

    it('should handle EPUB with navigation and content mixed', () => {
      document = createDocument(`
        <div class="navigation">
          <ul>
            <li><a href="#ch1">Chapter 1</a></li>
            <li><a href="#ch2">Chapter 2</a></li>
          </ul>
        </div>
        <div class="content">
          <h1 id="ch1">Chapter 1</h1>
          <p>Chapter content here.</p>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);

      expect(chunks).toContain('Chapter 1');
      expect(chunks).toContain('Chapter 1'); // From navigation
      expect(chunks).toContain('Chapter 2');
      expect(chunks).toContain('Chapter content here.');
    });

    it('should exclude anchor elements containing only reference numbers but keep meaningful anchor text', () => {
      document = createDocument(`
        <div>
          <p>This is some text with a footnote reference<a href="#footnote1"><sup>7</sup></a> and another one<a href="#footnote2"><sup>8</sup></a>.</p>
          <p>Here is a paragraph with a <a href="#chapter1">Chapter 1</a> link that should be kept.</p>
          <p>Another reference<a href="#ref3">9</a> without superscript but still just a number.</p>
          <p>And a link to <a href="#section">Section A</a> which is meaningful text.</p>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);
      const fullText = chunks.join(' ');
      
      // Should exclude standalone footnote reference numbers (7, 8, 9)
      // But should keep "Chapter 1" since it's meaningful text
      expect(fullText).not.toMatch(/\b7\b/); // Standalone 7
      expect(fullText).not.toMatch(/\b8\b/); // Standalone 8  
      expect(fullText).not.toMatch(/\b9\b/); // Standalone 9
      
      // Should keep meaningful anchor text
      expect(fullText).toContain('Chapter 1');
      expect(fullText).toContain('Section A');
      
      // Should keep the main text content
      expect(fullText).toContain('This is some text with a footnote reference');
      expect(fullText).toContain('and another one');
      expect(fullText).toContain('Here is a paragraph with a');
      expect(fullText).toContain('link that should be kept');
      expect(fullText).toContain('Another reference');
      expect(fullText).toContain('without superscript but still just a number');
      expect(fullText).toContain('And a link to');
      expect(fullText).toContain('which is meaningful text');
    });

    it('should exclude Hebrew EPUB footnote references but keep chapter navigation links', () => {
      document = createDocument(`
        <div>
          <p class="runningtext">טענה מרחיקת לכת זו נבחנה במחקרים שונים. באחד מהם התבקשו המשתתפים לכתוב מאמר קצר על אירוע משמעותי בחייהם, כמו הלימודים באוניברסיטה.<a href="HamapalaHachamishit-Y-29.xhtml#_idTextAnchor008"><sup class="superscript _idGenCharOverride-1">9</sup></a> לאחר מכן, מחצית המשתתפים התבקשו לתאר את כל הדרכים שבהן היתה יכולה חוויית הלימודים להשתבש לחלוטין.</p>
          <p class="runningtext">חוקרים השוו בין קבוצות שהתבקשו לשחק בתסריטים אלטרנטיביים למאורעות שהובילו ללידתם, מצד אחד, ולבחירתו של ברק אובמה לנשיאות ארצות הברית, כאירוע קרוב בחייהם, מצד אחר.<a href="HamapalaHachamishit-Y-29.xhtml#_idTextAnchor009"><sup class="superscript _idGenCharOverride-1">10</sup></a> שתי הקבוצות ענו אחר כך על שאלון.</p>
          <div class="navigation">
            <ul>
              <li><a href="#chapter1">פרק ראשון</a></li>
              <li><a href="#chapter2">פרק שני</a></li>
            </ul>
          </div>
          <p>חוקרים בחנו כיצד ניתן להשפיע על הזיכרון תוך שמהרהרים במצבי "אילו" אלטרנטיביים.<a href="HamapalaHachamishit-Y-29.xhtml#_idTextAnchor011"><sup class="superscript _idGenCharOverride-1">13</sup></a> התוצאות הראו שכאשר מעלים זיכרון מחדש.</p>
          <p>השאלה שעלתה ממחקרים אלה היתה: מה גורם לסימולציה של עבר אלטרנטיבי להפוך למועילה או למזיקה? חוקרים בפסיכותרפיה מצאו כי הדמיון משפיע בשינוי זיכרונות מזיקים.<a href=""><sup class="superscript _idGenCharOverride-1">12</sup></a> הם זיהו דרכים שבהן יכול מטפל לעזור למטופל.</p>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);
      const fullText = chunks.join(' ');
      
      // Should exclude Hebrew EPUB footnote reference numbers (9, 10, 12, 13)
      expect(fullText).not.toMatch(/\b9\b/);
      expect(fullText).not.toMatch(/\b10\b/);
      expect(fullText).not.toMatch(/\b12\b/);
      expect(fullText).not.toMatch(/\b13\b/);
      
      // Should keep meaningful Hebrew navigation anchor text
      expect(fullText).toContain('פרק ראשון');
      expect(fullText).toContain('פרק שני');
      
      // Should keep the main Hebrew text content
      expect(fullText).toContain('טענה מרחיקת לכת זו נבחנה במחקרים שונים');
      expect(fullText).toContain('באחד מהם התבקשו המשתתפים לכתוב מאמר קצר');
      expect(fullText).toContain('כמו הלימודים באוניברסיטה');
      expect(fullText).toContain('לאחר מכן, מחצית המשתתפים התבקשו לתאר');
      expect(fullText).toContain('חוקרים השוו בין קבוצות');
      expect(fullText).toContain('שתי הקבוצות ענו אחר כך על שאלון');
      expect(fullText).toContain('חוקרים בחנו כיצד ניתן להשפיע על הזיכרון');
      expect(fullText).toContain('התוצאות הראו שכאשר מעלים זיכרון מחדש');
      expect(fullText).toContain('השאלה שעלתה ממחקרים אלה היתה');
      expect(fullText).toContain('הם זיהו דרכים שבהן יכול מטפל לעזור למטופל');
      
      // Verify that the footnote numbers are completely absent from the extracted text
      expect(fullText).not.toContain('9 לאחר מכן'); // Should not have the number before the continuation
      expect(fullText).not.toContain('10 שתי הקבוצות'); // Should not have the number before the continuation
      expect(fullText).not.toContain('12 הם זיהו'); // Should not have the number before the continuation
      expect(fullText).not.toContain('13 התוצאות'); // Should not have the number before the continuation
    });

    it('should handle empty anchors and fallback text extraction', () => {
      document = createDocument(`
        <div>
          <p>Text with <a href="#empty"></a> empty anchor.</p>
          <p>Text with <a href="#whitespace">   </a> whitespace-only anchor.</p>
          <p>Text with <a href="#null"></a> truly empty anchor.</p>
        </div>
      `);

      const chunks = extractor.extractTextChunks(document);
      const fullText = chunks.join(' ');
      
      // Should exclude empty anchors completely
      expect(fullText).toContain('Text with');
      expect(fullText).toContain('empty anchor.');
      expect(fullText).toContain('whitespace-only anchor.');
      expect(fullText).toContain('truly empty anchor.');
      
      // Should not contain any empty or whitespace content from anchors
      expect(fullText).not.toMatch(/\s{3,}/); // No excessive whitespace
      
      // Verify the text flows naturally without gaps from empty anchors
      expect(fullText).toMatch(/Text with\s+empty anchor\./); 
      expect(fullText).toMatch(/Text with\s+whitespace-only anchor\./); 
      expect(fullText).toMatch(/Text with\s+truly empty anchor\./); 
    });

    it('should exclude anchors with null or undefined text content', () => {
      // Create a document and manually modify anchor to have no text content
      document = createDocument(`
        <div>
          <p>Before <a href="#test" id="testAnchor">original</a> after.</p>
        </div>
      `);

      // Manually clear the text content to simulate null/undefined scenario
      const anchor = document.getElementById('testAnchor');
      if (anchor) {
        anchor.textContent = '';
      }

      const chunks = extractor.extractTextChunks(document);
      const fullText = chunks.join(' ');
      
      // Should exclude the empty anchor
      expect(fullText).toContain('Before');
      expect(fullText).toContain('after.');
      expect(fullText).not.toContain('original');
      expect(fullText).toMatch(/Before\s+after\./); 
    });

    it('should use fallback text extraction when no structured content found', () => {
      // Create a document with only body text and no structured elements
      document = createDocument(`
        <body>Just some plain text in the body without any structured elements.</body>
      `);

      const chunks = extractor.extractTextChunks(document);
      
      // Should fall back to body text extraction
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Just some plain text in the body without any structured elements.');
    });
  });
});
