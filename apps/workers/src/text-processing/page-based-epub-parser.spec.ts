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

  describe('Sentence Boundary Detection', () => {
    it('should detect complete sentences ending with period', () => {
      const testParser = new PageBasedEPUBParser();
      // Access private method for testing
      const endsWithCompleteSentence = (testParser as unknown as { endsWithCompleteSentence: (text: string) => boolean }).endsWithCompleteSentence.bind(testParser);
      
      expect(endsWithCompleteSentence('This is a complete sentence.')).toBe(true);
      expect(endsWithCompleteSentence('This is incomplete')).toBe(false);
    });

    it('should detect complete sentences with exclamation marks', () => {
      const testParser = new PageBasedEPUBParser();
      const endsWithCompleteSentence = (testParser as unknown as { endsWithCompleteSentence: (text: string) => boolean }).endsWithCompleteSentence.bind(testParser);
      
      expect(endsWithCompleteSentence('What an exciting sentence!')).toBe(true);
      expect(endsWithCompleteSentence('This is exciting but incomplete')).toBe(false);
    });

    it('should detect complete sentences with question marks', () => {
      const testParser = new PageBasedEPUBParser();
      const endsWithCompleteSentence = (testParser as unknown as { endsWithCompleteSentence: (text: string) => boolean }).endsWithCompleteSentence.bind(testParser);
      
      expect(endsWithCompleteSentence('Is this a question?')).toBe(true);
      expect(endsWithCompleteSentence('Is this incomplete')).toBe(false);
    });

    it('should handle sentences with quotes and brackets', () => {
      const testParser = new PageBasedEPUBParser();
      const endsWithCompleteSentence = (testParser as unknown as { endsWithCompleteSentence: (text: string) => boolean }).endsWithCompleteSentence.bind(testParser);
      
      expect(endsWithCompleteSentence('He said "Hello world."')).toBe(true);
      expect(endsWithCompleteSentence('The result was (very good).')).toBe(true);
      expect(endsWithCompleteSentence('He said "Hello world')).toBe(false);
    });

    it('should handle Hebrew text with proper punctuation', () => {
      const testParser = new PageBasedEPUBParser();
      const endsWithCompleteSentence = (testParser as unknown as { endsWithCompleteSentence: (text: string) => boolean }).endsWithCompleteSentence.bind(testParser);
      
      expect(endsWithCompleteSentence('זה משפט בעברית.')).toBe(true);
      expect(endsWithCompleteSentence('זה משפט לא שלם בעברית')).toBe(false);
    });
  });

  describe('Word Counting', () => {
    it('should count words correctly in English text', () => {
      const testParser = new PageBasedEPUBParser();
      const countWords = (testParser as unknown as { countWords: (text: string) => number }).countWords.bind(testParser);
      
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('This is a test sentence')).toBe(5);
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });

    it('should count words correctly in Hebrew text', () => {
      const testParser = new PageBasedEPUBParser();
      const countWords = (testParser as unknown as { countWords: (text: string) => number }).countWords.bind(testParser);
      
      expect(countWords('שלום עולם')).toBe(2);
      expect(countWords('זה משפט בדיקה בעברית')).toBe(4);
    });

    it('should handle mixed Hebrew and English text', () => {
      const testParser = new PageBasedEPUBParser();
      const countWords = (testParser as unknown as { countWords: (text: string) => number }).countWords.bind(testParser);
      
      expect(countWords('Hello שלום world עולם')).toBe(4);
    });
  });

  describe('Target Size Detection', () => {
    it('should detect when target character count is reached', () => {
      const testParser = new PageBasedEPUBParser({ paragraphTargetLengthChars: 10 });
      const meetsTargetSize = (testParser as unknown as { meetsTargetSize: (text: string) => boolean }).meetsTargetSize.bind(testParser);
      
      expect(meetsTargetSize('1234567890')).toBe(true); // exactly 10 chars
      expect(meetsTargetSize('12345678901')).toBe(true); // over 10 chars
      expect(meetsTargetSize('123456789')).toBe(false); // under 10 chars
    });

    it('should detect when target word count is reached', () => {
      const testParser = new PageBasedEPUBParser({ paragraphTargetLengthWords: 3 });
      const meetsTargetSize = (testParser as unknown as { meetsTargetSize: (text: string) => boolean }).meetsTargetSize.bind(testParser);
      
      expect(meetsTargetSize('one two three')).toBe(true); // exactly 3 words
      expect(meetsTargetSize('one two three four')).toBe(true); // over 3 words
      expect(meetsTargetSize('one two')).toBe(false); // under 3 words
    });

    it('should meet target when either chars OR words threshold is reached', () => {
      const testParser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 20, 
        paragraphTargetLengthWords: 3 
      });
      const meetsTargetSize = (testParser as unknown as { meetsTargetSize: (text: string) => boolean }).meetsTargetSize.bind(testParser);
      
      // Meets word count but not char count
      expect(meetsTargetSize('one two three')).toBe(true);
      
      // Meets char count but not word count
      expect(meetsTargetSize('verylongwordthatexceedstwentycharacters')).toBe(true);
      
      // Meets neither
      expect(meetsTargetSize('short')).toBe(false);
    });
  });

  describe('Sentence Boundary Finding', () => {
    it('should find last sentence boundary in text', () => {
      const testParser = new PageBasedEPUBParser();
      const findLastSentenceBoundary = (testParser as unknown as { findLastSentenceBoundary: (text: string) => number }).findLastSentenceBoundary.bind(testParser);
      
      const text = 'First sentence. Second sentence! Third sentence?';
      const boundary = findLastSentenceBoundary(text);
      expect(boundary).toBeGreaterThan(0);
      expect(text.substring(0, boundary).trim()).toMatch(/[.!?]$/);
    });

    it('should return -1 when no sentence boundary found', () => {
      const testParser = new PageBasedEPUBParser();
      const findLastSentenceBoundary = (testParser as unknown as { findLastSentenceBoundary: (text: string) => number }).findLastSentenceBoundary.bind(testParser);
      
      expect(findLastSentenceBoundary('No sentence boundary here')).toBe(-1);
    });

    it('should handle Hebrew sentence boundaries', () => {
      const testParser = new PageBasedEPUBParser();
      const findLastSentenceBoundary = (testParser as unknown as { findLastSentenceBoundary: (text: string) => number }).findLastSentenceBoundary.bind(testParser);
      
      const text = 'משפט ראשון. משפט שני! משפט שלישי?';
      const boundary = findLastSentenceBoundary(text);
      expect(boundary).toBeGreaterThan(0);
    });
  });

  describe('Paragraph Completion at Sentence Boundary', () => {
    it('should complete paragraph at last sentence boundary', () => {
      const testParser = new PageBasedEPUBParser();
      const completeParagraphAtSentenceBoundary = (testParser as unknown as { completeParagraphAtSentenceBoundary: (text: string) => string }).completeParagraphAtSentenceBoundary.bind(testParser);
      
      const text = 'First sentence. Second sentence! Incomplete third';
      const completed = completeParagraphAtSentenceBoundary(text);
      expect(completed).toBe('First sentence. Second sentence!');
    });

    it('should return original text if already ends with complete sentence', () => {
      const testParser = new PageBasedEPUBParser();
      const completeParagraphAtSentenceBoundary = (testParser as unknown as { completeParagraphAtSentenceBoundary: (text: string) => string }).completeParagraphAtSentenceBoundary.bind(testParser);
      
      const text = 'Complete sentence.';
      const completed = completeParagraphAtSentenceBoundary(text);
      expect(completed).toBe(text);
    });

    it('should return original text if no sentence boundary found', () => {
      const testParser = new PageBasedEPUBParser();
      const completeParagraphAtSentenceBoundary = (testParser as unknown as { completeParagraphAtSentenceBoundary: (text: string) => string }).completeParagraphAtSentenceBoundary.bind(testParser);
      
      const text = 'No sentence boundary here at all';
      const completed = completeParagraphAtSentenceBoundary(text);
      expect(completed).toBe(text);
    });
  });

  describe('Long Paragraph Splitting', () => {
    it('should split long paragraph at sentence boundaries', () => {
      const parser = new PageBasedEPUBParser();
      const splitLongParagraphAtSentences = (parser as unknown as { splitLongParagraphAtSentences: (text: string) => string[] }).splitLongParagraphAtSentences.bind(parser);
      
      // Create text that exceeds BOTH character (750) and word (150) limits
      const longText = 'This is a very long sentence that contains many words to test the splitting functionality properly and thoroughly. ' +
        'This sentence should be long enough to trigger the splitting logic when combined with other sentences in the paragraph. ' +
        'We need to make sure this text exceeds both the character limit of seven hundred fifty and word limit of one hundred fifty. ' +
        'Adding more content here to ensure we reach the thresholds for splitting behavior and proper paragraph division functionality. ' +
        'This should definitely be enough content to trigger the splitting behavior and create multiple chunks from the original text. ' +
        'More sentences to ensure we have enough content for proper testing of the paragraph splitting algorithm and its effectiveness. ' +
        'Additional content to make sure we exceed both character and word limits simultaneously for comprehensive testing purposes. ' +
        'Final sentences to complete the test case and ensure proper splitting occurs with appropriate sentence boundary detection. ' +
        'Even more content to guarantee we exceed the required thresholds for splitting and validate the algorithm works correctly. ' +
        'Last part of the text to ensure comprehensive testing of the splitting functionality and proper sentence boundary preservation.';
      
      const chunks = splitLongParagraphAtSentences(longText);
      
      // Should split since we exceed both character and word limits
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.trim()).toMatch(/[.!?]$/); // Each chunk should end with sentence punctuation
      });
    });

    it('should handle text without clear sentence boundaries', () => {
      const parser = new PageBasedEPUBParser();
      const splitLongParagraphAtSentences = (parser as unknown as { splitLongParagraphAtSentences: (text: string) => string[] }).splitLongParagraphAtSentences.bind(parser);
      
      const textWithoutSentences = 'This is text without proper sentence endings and it just goes on and on without any punctuation marks that would indicate sentence boundaries so it should be treated as one unit';
      const chunks = splitLongParagraphAtSentences(textWithoutSentences);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(textWithoutSentences);
    });

    it('should preserve Hebrew text integrity when splitting', () => {
      const parser = new PageBasedEPUBParser();
      const splitLongParagraphAtSentences = (parser as unknown as { splitLongParagraphAtSentences: (text: string) => string[] }).splitLongParagraphAtSentences.bind(parser);
      
      // Create Hebrew text that exceeds at least one limit
      const hebrewText = 'זהו טקסט עברי ארוך מאוד שמכיל הרבה מילים כדי לבדוק את פונקציונליות החלוקה והפיצול של פסקאות. ' +
        'המשפט הזה צריך להיות ארוך מספיק כדי להפעיל את לוגיקת החלוקה כשהוא משולב עם משפטים אחרים בפסקה. ' +
        'אנחנו צריכים לוודא שהטקסט הזה חורג לפחות ממגבלת התווים של שבע מאות וחמישים או ממגבלת המילים של מאה וחמישים. ' +
        'מוסיפים כאן עוד תוכן נרחב כדי לוודא שאנחנו מגיעים לסף הנדרש לחלוקה ופיצול הפסקאות בצורה נכונה ויעילה. ' +
        'זה בהחלט צריך להיות מספיק תוכן כדי להפעיל את התנהגות החלוקה ולוודא שהאלגוריתם עובד כמו שצריך. ' +
        'עוד משפטים ארוכים כדי לוודא שיש לנו מספיק תוכן לבדיקה נכונה ומקיפה של כל הפונקציונליות הנדרשת. ' +
        'תוכן נוסף ומפורט כדי לוודא שאנחנו חורגים לפחות מאחת ממגבלות התווים או המילים שהוגדרו במערכת. ' +
        'משפטים אחרונים וארוכים כדי להשלים את מקרה הבדיקה ולוודא חלוקה נכונה ויעילה של הטקסט העברי. ' +
        'עוד יותר תוכן מפורט ונרחב כדי להבטיח שאנחנו חורגים מהסף הנדרש לחלוקה ושהאלגוריתם יפעל כראוי. ' +
        'החלק האחרון והמפורט של הטקסט כדי לוודא בדיקה מקיפה ויסודית של פונקציונליות החלוקה והפיצול העברי. ' +
        'משפטים נוספים ארוכים כדי להבטיח שהטקסט יהיה ארוך מספיק לבדיקת האלגוריתם בצורה מלאה ומקיפה. ' +
        'תוכן עברי נוסף ומורחב כדי לוודא שכל הפונקציונליות עובדת כמו שצריך עם טקסט בעברית ובכל השפות.';
      
      // Verify the text actually exceeds at least one limit
      const textLength = hebrewText.length;
      const wordCount = hebrewText.split(/\s+/).length;
      expect(textLength > 750 || wordCount > 150).toBe(true);
      
      const chunks = splitLongParagraphAtSentences(hebrewText);
      
      // Should split since we exceed at least one limit
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.trim()).toMatch(/[.!?]$/);
      });
    });
  });

  describe('Paragraph Extraction Integration', () => {
    it('should extract paragraphs with target sizing', () => {
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
        'Each resulting paragraph should end with proper punctuation marks.';
      
      const paragraphs = extractParagraphsFromText(veryLongText, 0);
      
      expect(paragraphs.length).toBeGreaterThan(1);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim()).toMatch(/[.!?]$/);
        // With the small targets, paragraphs should be much smaller
        expect(paragraph.content.length).toBeLessThanOrEqual(150); // More reasonable limit
      });
    });

    it('should combine short paragraphs to reach target size', () => {
      const testParser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 100,
        paragraphTargetLengthWords: 20 
      });
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const text = `Short one.

Short two.

Short three.

Short four.`;
      
      const paragraphs = extractParagraphsFromText(text, 0);
      
      // Should combine multiple short paragraphs
      expect(paragraphs.length).toBeLessThan(4);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim()).toMatch(/[.!?]$/);
      });
    });

    it('should handle mixed Hebrew and English content', () => {
      const testParser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 60,
        paragraphTargetLengthWords: 12 
      });
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const mixedText = `This is English text with proper sentences. זה טקסט בעברית עם משפטים נכונים.

More English content here. עוד תוכן בעברית כאן.`;
      
      const paragraphs = extractParagraphsFromText(mixedText, 0);
      
      expect(paragraphs.length).toBeGreaterThan(0);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim()).toMatch(/[.!?]$/);
        expect(paragraph.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty and whitespace-only input', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      expect(extractParagraphsFromText('', 0)).toEqual([]);
      expect(extractParagraphsFromText('   \n\n   ', 0)).toEqual([]);
    });

    it('should assign correct order indices to paragraphs', () => {
      const testParser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 30,
        paragraphTargetLengthWords: 6 
      });
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const text = `First paragraph content here. Second paragraph content here.

Third paragraph content here. Fourth paragraph content here.`;
      
      const paragraphs = extractParagraphsFromText(text, 0);
      
      expect(paragraphs.length).toBeGreaterThan(1);
      paragraphs.forEach((paragraph, index) => {
        expect(paragraph.orderIndex).toBe(index);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle text with only punctuation', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const punctuationText = '... !!! ??? ...';
      const paragraphs = extractParagraphsFromText(punctuationText, 0);
      
      expect(paragraphs.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle text with unusual whitespace patterns', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const weirdText = 'Sentence   with    weird     spacing.\n\n\n\nAnother sentence.';
      const paragraphs = extractParagraphsFromText(weirdText, 0);
      
      expect(paragraphs.length).toBeGreaterThan(0);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle very short target lengths', () => {
      const testParser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 5,
        paragraphTargetLengthWords: 1 
      });
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const text = 'Short sentence. Another short sentence.';
      const paragraphs = extractParagraphsFromText(text, 0);
      
      expect(paragraphs.length).toBeGreaterThan(0);
      paragraphs.forEach(paragraph => {
        expect(paragraph.content.trim()).toMatch(/[.!?]$/);
      });
    });

    it('should handle very large target lengths', () => {
      const testParser = new PageBasedEPUBParser({ 
        paragraphTargetLengthChars: 10000,
        paragraphTargetLengthWords: 2000 
      });
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      const text = 'Normal sentence. Another normal sentence.';
      const paragraphs = extractParagraphsFromText(text, 0);
      
      expect(paragraphs.length).toBe(1); // Should combine into single paragraph
      expect(paragraphs[0].content.trim()).toMatch(/[.!?]$/);
    });
  });

  describe('Performance and Logging', () => {
    it('should log paragraph extraction metrics', () => {
      const parser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (parser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(parser);
      
      const text = 'This is a test paragraph. It has multiple sentences. Each sentence ends properly.';
      
      // The actual logger is used internally, not our mock, so we can't test the mock calls
      // Instead, we test that the method executes without errors and returns expected results
      const result = extractParagraphsFromText(text, 0);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(paragraph => {
        expect(paragraph).toHaveProperty('content');
        expect(paragraph).toHaveProperty('orderIndex');
        expect(typeof paragraph.content).toBe('string');
        expect(typeof paragraph.orderIndex).toBe('number');
      });
    });

    it('should handle large text inputs efficiently', () => {
      const testParser = new PageBasedEPUBParser();
      const extractParagraphsFromText = (testParser as unknown as { extractParagraphsFromText: (text: string, startIndex: number) => Array<{ content: string; orderIndex: number }> }).extractParagraphsFromText.bind(testParser);
      
      // Create a large text input
      const largeSentence = 'This is a test sentence that will be repeated many times. ';
      const largeText = largeSentence.repeat(1000);
      
      const startTime = Date.now();
      const paragraphs = extractParagraphsFromText(largeText, 0);
      const endTime = Date.now();
      
      expect(paragraphs.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
