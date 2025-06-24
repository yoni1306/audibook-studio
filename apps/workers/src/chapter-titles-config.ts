/**
 * Manual chapter titles configuration
 * 
 * This file allows you to manually specify chapter titles for books
 * where automatic detection might not work well or where you want
 * to use custom titles for better TTS processing.
 */

export interface BookChapterConfig {
  bookId: string;
  bookTitle: string;
  chapterTitles: string[];
}

/**
 * Example configurations for different books
 */
export const BOOK_CHAPTER_CONFIGS: BookChapterConfig[] = [
  {
    bookId: 'sample-hebrew-book-1',
    bookTitle: 'ספר דוגמה בעברית',
    chapterTitles: [
      'פרק ראשון: התחלה',
      'פרק שני: התפתחות',
      'פרק שלישי: שיא',
      'פרק רביעי: פתרון',
      'פרק חמישי: סיום'
    ]
  },
  {
    bookId: 'mixed-language-book',
    bookTitle: 'Mixed Language Book',
    chapterTitles: [
      'Chapter 1: Introduction',
      'פרק ב: הרקע',
      'Chapter 3: Development',
      'פרק ד: המשך',
      'Chapter 5: Conclusion'
    ]
  }
];

/**
 * Get chapter titles for a specific book
 */
export function getChapterTitles(bookId: string): string[] | undefined {
  const config = BOOK_CHAPTER_CONFIGS.find(config => config.bookId === bookId);
  return config?.chapterTitles;
}

/**
 * Add or update chapter titles for a book
 */
export function setChapterTitles(bookId: string, bookTitle: string, chapterTitles: string[]): void {
  const existingIndex = BOOK_CHAPTER_CONFIGS.findIndex(config => config.bookId === bookId);
  
  const newConfig: BookChapterConfig = {
    bookId,
    bookTitle,
    chapterTitles
  };
  
  if (existingIndex >= 0) {
    BOOK_CHAPTER_CONFIGS[existingIndex] = newConfig;
  } else {
    BOOK_CHAPTER_CONFIGS.push(newConfig);
  }
}

/**
 * Example usage in EPUB parsing:
 * 
 * ```typescript
 * import { parseEpub } from './epub-parser';
 * import { getChapterTitles } from './chapter-titles-config';
 * 
 * const bookId = 'my-hebrew-book';
 * const manualChapterTitles = getChapterTitles(bookId);
 * 
 * const paragraphs = await parseEpub('/path/to/book.epub', {
 *   preset: 'narrative',
 *   manualChapterTitles,
 *   debug: true
 * });
 * ```
 */
