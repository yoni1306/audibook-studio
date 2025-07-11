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
  });
});
