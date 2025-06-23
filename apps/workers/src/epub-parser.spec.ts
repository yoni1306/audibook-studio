import { parseEpubContent, EpubChapter } from './epub-parser';

// Mock the logger to avoid console output during tests
jest.mock('@audibook/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('EPUB Parser - parseEpubContent Function Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to create mock chapter data
  const createMockChapter = (chapterNumber: number, content: string): EpubChapter => ({
    chapterNumber,
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter ${chapterNumber}</title>
</head>
<body>
  ${content}
</body>
</html>`,
  });

  it('should parse numbered lists correctly', () => {
    const chapters = [
      createMockChapter(1, `
        <h1>Introduction</h1>
        <p>This chapter covers the basics.</p>
        <ol>
          <li>First important point</li>
          <li>Second important point</li>
          <li>Third important point</li>
        </ol>
        <p>End of chapter.</p>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(4);
    expect(result[0].content).toBe('Introduction');
    expect(result[1].content).toBe('This chapter covers the basics.');
    expect(result[2].content).toBe('1. First important point\n2. Second important point\n3. Third important point');
    expect(result[3].content).toBe('End of chapter.');
    
    // Verify chapter numbers and order
    result.forEach((paragraph, index) => {
      expect(paragraph.chapterNumber).toBe(1);
      expect(paragraph.orderIndex).toBe(index);
    });
  });

  it('should parse unordered lists correctly', () => {
    const chapters = [
      createMockChapter(1, `
        <h2>Features</h2>
        <ul>
          <li>Easy to use</li>
          <li>Fast performance</li>
          <li>Great support</li>
        </ul>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Features');
    expect(result[1].content).toBe('• Easy to use\n• Fast performance\n• Great support');
  });

  it('should handle mixed content with multiple lists', () => {
    const chapters = [
      createMockChapter(1, `
        <h1>Chapter Title</h1>
        <p>Introduction paragraph</p>
        <ol>
          <li>Step one</li>
          <li>Step two</li>
        </ol>
        <p>Middle paragraph</p>
        <ul>
          <li>Bullet one</li>
          <li>Bullet two</li>
        </ul>
        <p>Conclusion paragraph</p>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(6);
    expect(result[0].content).toBe('Chapter Title');
    expect(result[1].content).toBe('Introduction paragraph');
    expect(result[2].content).toBe('1. Step one\n2. Step two');
    expect(result[3].content).toBe('Middle paragraph');
    expect(result[4].content).toBe('• Bullet one\n• Bullet two');
    expect(result[5].content).toBe('Conclusion paragraph');
  });

  it('should handle multiple chapters correctly', () => {
    const chapters = [
      createMockChapter(1, `
        <h1>First Chapter</h1>
        <ol>
          <li>Chapter 1 item 1</li>
          <li>Chapter 1 item 2</li>
        </ol>
      `),
      createMockChapter(2, `
        <h1>Second Chapter</h1>
        <ul>
          <li>Chapter 2 bullet 1</li>
          <li>Chapter 2 bullet 2</li>
        </ul>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(4);
    
    // Chapter 1 content
    expect(result[0].content).toBe('First Chapter');
    expect(result[0].chapterNumber).toBe(1);
    expect(result[1].content).toBe('1. Chapter 1 item 1\n2. Chapter 1 item 2');
    expect(result[1].chapterNumber).toBe(1);
    
    // Chapter 2 content
    expect(result[2].content).toBe('Second Chapter');
    expect(result[2].chapterNumber).toBe(2);
    expect(result[3].content).toBe('• Chapter 2 bullet 1\n• Chapter 2 bullet 2');
    expect(result[3].chapterNumber).toBe(2);
  });

  it('should handle empty list items gracefully', () => {
    const chapters = [
      createMockChapter(1, `
        <ol>
          <li>First item</li>
          <li></li>
          <li>   </li>
          <li>Fourth item</li>
        </ol>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('1. First item\n2. Fourth item');
  });

  it('should handle lists with HTML formatting', () => {
    const chapters = [
      createMockChapter(1, `
        <ol>
          <li><strong>Bold item</strong></li>
          <li><em>Italic item</em> with <span>span content</span></li>
          <li>Item with <a href="#">link</a></li>
        </ol>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('1. Bold item\n2. Italic item with span content\n3. Item with link');
  });

  it('should handle Hebrew text in lists', () => {
    const chapters = [
      createMockChapter(1, `
        <p>פסקה לפני הרשימה</p>
        <ol>
          <li>פריט ראשון</li>
          <li>פריט שני</li>
          <li>פריט שלישי</li>
        </ol>
        <ul>
          <li>נקודה ראשונה</li>
          <li>נקודה שנייה</li>
        </ul>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('פסקה לפני הרשימה');
    expect(result[1].content).toBe('1. פריט ראשון\n2. פריט שני\n3. פריט שלישי');
    expect(result[2].content).toBe('• נקודה ראשונה\n• נקודה שנייה');
  });

  it('should handle complex nested structures', () => {
    const chapters = [
      createMockChapter(1, `
        <section>
          <h2>Section Title</h2>
          <div>
            <p>Introduction text</p>
            <ol>
              <li>First step</li>
              <li>Second step</li>
            </ol>
          </div>
        </section>
      `)
    ];

    const result = parseEpubContent(chapters);

    // Should extract section title, paragraph, and numbered list
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.some(p => p.content === 'Section Title')).toBe(true);
    expect(result.some(p => p.content === 'Introduction text')).toBe(true);
    expect(result.some(p => p.content === '1. First step\n2. Second step')).toBe(true);
  });

  it('should handle lists within div elements', () => {
    const chapters = [
      createMockChapter(1, `
        <div>
          <p>Paragraph inside div</p>
          <ol>
            <li>Nested numbered item 1</li>
            <li>Nested numbered item 2</li>
          </ol>
        </div>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some(p => p.content === 'Paragraph inside div')).toBe(true);
    expect(result.some(p => p.content === '1. Nested numbered item 1\n2. Nested numbered item 2')).toBe(true);
  });

  it('should not duplicate list items when processing', () => {
    const chapters = [
      createMockChapter(1, `
        <p>Before list</p>
        <ol>
          <li>Item one</li>
          <li>Item two</li>
        </ol>
        <p>After list</p>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('Before list');
    expect(result[1].content).toBe('1. Item one\n2. Item two');
    expect(result[2].content).toBe('After list');

    // Verify no individual list items appear as separate results
    expect(result.some(r => r.content === 'Item one')).toBe(false);
    expect(result.some(r => r.content === 'Item two')).toBe(false);
  });

  it('should handle script and style elements removal', () => {
    const chapters = [
      createMockChapter(1, `
        <script>console.log('test');</script>
        <style>body { color: red; }</style>
        <p>Visible content</p>
        <ol>
          <li>List item</li>
        </ol>
      `)
    ];

    const result = parseEpubContent(chapters);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Visible content');
    expect(result[1].content).toBe('1. List item');
    
    // Verify script and style content is not included
    expect(result.some(r => r.content.includes('console.log'))).toBe(false);
    expect(result.some(r => r.content.includes('color: red'))).toBe(false);
  });
});
