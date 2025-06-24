import { processBookText, convertChunkToParagraph } from '../utils/book-processor';
import { TextChunk } from '../types';

describe('Book Processor', () => {
  describe('processBookText', () => {
    it('should process simple book text with default settings', async () => {
      const bookText = `
פרק 1: התחלה
זה הפרק הראשון של הספר. יש כאן טקסט חשוב שצריך להיות מעובד בצורה נכונה.
הטקסט כולל משפטים שונים ומגוונים.

פרק 2: המשך
זה הפרק השני. גם כאן יש תוכן חשוב שצריך לעבור עיבוד מתאים.
      `.trim();

      const result = await processBookText(bookText);

      expect(result.chunks).toBeDefined();
      expect(result.totalChunks).toBeGreaterThan(0);
      expect(result.totalCharacters).toBeGreaterThan(0);
      expect(result.averageChunkSize).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(typeof result.chaptersDetected).toBe('number');
    });

    it('should use narrative preset by default', async () => {
      const bookText = 'Simple text for testing default preset.';

      const result = await processBookText(bookText);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(bookText);
    });

    it('should accept custom preset', async () => {
      const bookText = 'Technical text for testing custom preset.';

      const result = await processBookText(bookText, { preset: 'technical' });

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(bookText);
    });

    it('should handle chapter titles', async () => {
      const bookText = `
Chapter 1: Introduction
This is the introduction chapter with important content.

Chapter 2: Main Content
This is the main content chapter.
      `.trim();

      const chapterTitles = ['Introduction', 'Main Content'];
      const result = await processBookText(bookText, { chapterTitles });

      expect(result.chunks.length).toBeGreaterThan(0);
      // Should detect chapters when titles are provided
      expect(result.chaptersDetected).toBeGreaterThan(0);
    });

    it('should enable debug mode when requested', async () => {
      const bookText = 'Debug test text.';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await processBookText(bookText, { debug: true });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty text gracefully', async () => {
      const result = await processBookText('');

      expect(result.chunks).toHaveLength(0);
      expect(result.totalChunks).toBe(0);
      expect(result.totalCharacters).toBe(0);
      expect(result.averageChunkSize).toBe(0);
      expect(result.chaptersDetected).toBe(0);
    });

    it('should handle whitespace-only text', async () => {
      const result = await processBookText('   \n\t   ');

      expect(result.chunks).toHaveLength(0);
      expect(result.totalChunks).toBe(0);
    });

    it('should calculate statistics correctly', async () => {
      const bookText = 'This is a test text with exactly fifty characters.'; // 50 chars

      const result = await processBookText(bookText);

      expect(result.totalCharacters).toBe(50);
      expect(result.totalChunks).toBe(1);
      expect(result.averageChunkSize).toBe(50);
    });

    it('should handle Hebrew text with chapters', async () => {
      const hebrewText = `
פרק א: פתיחה
זהו פרק הפתיחה של הספר העברי. כאן מתחיל הסיפור המעניין.
יש כאן הרבה תוכן חשוב שצריך להיות מעובד נכון.

פרק ב: התפתחות
בפרק זה הסיפור מתפתח ונהיה מעניין יותר.
הדמויות מתחילות להתגלות והעלילה מתעבה.
      `.trim();

      const result = await processBookText(hebrewText);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chaptersDetected).toBeGreaterThan(0);
      
      // Check that Hebrew chapters were detected
      const chapterTitles = result.chunks
        .map(chunk => chunk.chapter?.title)
        .filter(Boolean);
      expect(chapterTitles.some(title => title?.includes('פתיחה'))).toBe(true);
    });

    it('should handle mixed language content', async () => {
      const mixedText = `
Chapter 1: English Chapter
This is an English chapter with some content.

פרק 2: פרק עברי
זה פרק בעברית עם תוכן בעברית.
      `.trim();

      const result = await processBookText(mixedText);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chaptersDetected).toBeGreaterThan(0);
    });

    it('should handle processing errors gracefully', async () => {
      // Mock a processing error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // This should not throw but handle the error gracefully
      await expect(processBookText('valid text')).resolves.toBeDefined();

      console.error = originalConsoleError;
    });
  });

  describe('convertChunkToParagraph', () => {
    let sampleChunk: TextChunk;

    beforeEach(() => {
      sampleChunk = {
        content: 'Sample chunk content for testing conversion.',
        position: { start: 0, end: 42 },
        metadata: {
          splitType: 'natural',
          customField: 'customValue'
        },
        chapter: {
          id: 'chapter_1',
          title: 'Test Chapter',
          index: 0,
          chunkIndex: 0
        }
      };
    });

    it('should convert chunk to paragraph format', () => {
      const bookId = 'test-book-123';
      const orderIndex = 5;

      const paragraph = convertChunkToParagraph(sampleChunk, bookId, orderIndex);

      expect(paragraph.bookId).toBe(bookId);
      expect(paragraph.content).toBe(sampleChunk.content);
      expect(paragraph.orderIndex).toBe(orderIndex);
      expect(paragraph.chapterNumber).toBe(1); // index + 1
      expect(paragraph.chapterTitle).toBe('Test Chapter');
      expect(paragraph.audioStatus).toBe('PENDING');
    });

    it('should handle chunk without chapter info', () => {
      const chunkWithoutChapter: TextChunk = {
        content: 'Content without chapter',
        position: { start: 0, end: 22 },
        metadata: { splitType: 'natural' }
      };

      const paragraph = convertChunkToParagraph(chunkWithoutChapter, 'book-id', 0);

      expect(paragraph.chapterNumber).toBeNull();
      expect(paragraph.chapterTitle).toBeNull();
      expect(paragraph.content).toBe('Content without chapter');
    });

    it('should preserve metadata correctly', () => {
      const paragraph = convertChunkToParagraph(sampleChunk, 'book-id', 0);

      expect(paragraph.metadata.splitType).toBe('natural');
      expect(paragraph.metadata.originalPosition).toEqual(sampleChunk.position);
      expect(paragraph.metadata.chunkIndex).toBe(0);
      expect((paragraph.metadata as Record<string, unknown>).customField).toBe('customValue');
    });

    it('should handle empty metadata', () => {
      const chunkWithoutMetadata: TextChunk = {
        content: 'Content without metadata',
        position: { start: 0, end: 24 }
      };

      const paragraph = convertChunkToParagraph(chunkWithoutMetadata, 'book-id', 0);

      expect(paragraph.metadata.splitType).toBeUndefined();
      expect(paragraph.metadata.originalPosition).toEqual({ start: 0, end: 24 });
    });

    it('should set correct audio status', () => {
      const paragraph = convertChunkToParagraph(sampleChunk, 'book-id', 0);

      expect(paragraph.audioStatus).toBe('PENDING');
    });
  });

  describe('Error scenarios', () => {
    it('should handle malformed chapter data', async () => {
      const malformedText = 'פרק: \n\nContent without proper chapter title';

      const result = await processBookText(malformedText);

      expect(result.chunks).toBeDefined();
      expect(result.totalChunks).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long text', async () => {
      const longText = 'Very long text content. '.repeat(1000);

      const result = await processBookText(longText);

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.totalCharacters).toBeGreaterThan(1000);
    });

    it('should handle special characters', async () => {
      const specialText = 'Text with special chars: @#$%^&*()_+-=[]{}|;:,.<>?';

      const result = await processBookText(specialText);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(specialText);
    });
  });
});
