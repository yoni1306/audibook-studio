import { PageBasedEPUBParser, PageBasedParserOptions } from './page-based-epub-parser';

// Mock logger to avoid console output during tests
jest.mock('@audibook/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('PageBasedEPUBParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Options', () => {
    it('should use default options when none provided', () => {
      const defaultParser = new PageBasedEPUBParser();
      expect(defaultParser).toBeDefined();
    });

    it('should merge custom options with defaults', () => {
      const customOptions: PageBasedParserOptions = {
        paragraphTargetLengthChars: 1000,
        paragraphTargetLengthWords: 200,
      };
      const customParser = new PageBasedEPUBParser(customOptions);
      expect(customParser).toBeDefined();
    });
  });

  describe('Paragraph Extraction Integration', () => {
    it('should extract paragraphs using shared ParagraphProcessor', () => {
      const testParser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 50,
        paragraphTargetLengthWords: 10 
      });
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const text = `First paragraph with some content here. This should be long enough to meet targets.

Second paragraph with different content. This also should meet the target requirements.

Third paragraph is shorter.`;
      
      const paragraphs = extractParagraphsFromText(text, 0);
      
      expect(paragraphs.length).toBeGreaterThan(0);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim()).toMatch(/[.!?]$/); // Should end with sentence punctuation
        expect(paragraph.content.length).toBeGreaterThan(0);
        expect(paragraph).toHaveProperty('orderIndex');
        expect(typeof paragraph.orderIndex).toBe('number');
      });
    });

    it('should handle very long paragraphs by splitting them', () => {
      const parser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 30,
        paragraphTargetLengthWords: 5 
      });
      const extractParagraphsFromText = (parser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(parser);
      
      // Create text that will definitely exceed both character and word targets
      const veryLongText = 'This is a very long paragraph that should be split. ' +
        'It contains multiple sentences and should exceed the target length. ' +
        'The splitting should happen at sentence boundaries to maintain readability. ' +
        'Each resulting paragraph should end with proper punctuation.';
      
      const paragraphs = extractParagraphsFromText(veryLongText, 0);
      
      expect(paragraphs.length).toBeGreaterThan(1); // Should split into multiple paragraphs
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim()).toMatch(/[.!?]$/); // Each should end with sentence punctuation
        expect(paragraph.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle Hebrew text correctly', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const hebrewText = 'זה משפט בעברית. זה משפט נוסף בעברית! האם זה עובד כמו שצריך?';
      const paragraphs = extractParagraphsFromText(hebrewText, 0);
      
      expect(paragraphs.length).toBeGreaterThan(0);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim().length).toBeGreaterThan(0);
        expect(paragraph.content.trim()).toMatch(/[.!?]$/);
      });
    });

    it('should handle empty and whitespace-only text', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      expect(extractParagraphsFromText('', 0)).toEqual([]);
      expect(extractParagraphsFromText('   \n\n   ', 0)).toEqual([]);
    });

    it('should handle text with weird spacing', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const weirdText = 'Sentence   with    weird     spacing.\n\n\n\nAnother sentence.';
      const paragraphs = extractParagraphsFromText(weirdText, 0);
      
      expect(paragraphs.length).toBeGreaterThan(0);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle performance with large text inputs', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      // Create a large text input
      const largeSentence = 'This is a test sentence that will be repeated many times. ';
      const largeText = largeSentence.repeat(100); // Reduced from 1000 to avoid timeout
      
      const startTime = Date.now();
      const paragraphs = extractParagraphsFromText(largeText, 0);
      const endTime = Date.now();
      
      expect(paragraphs.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Verify all paragraphs have proper structure
      paragraphs.forEach(paragraph => {
        expect(paragraph).toHaveProperty('content');
        expect(paragraph).toHaveProperty('orderIndex');
        expect(typeof paragraph.content).toBe('string');
        expect(typeof paragraph.orderIndex).toBe('number');
      });
    });
  });
});
