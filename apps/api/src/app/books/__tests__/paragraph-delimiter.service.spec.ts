import { Test, TestingModule } from '@nestjs/testing';
import { ParagraphDelimiterService } from '../paragraph-delimiter.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AudioStatus } from '@prisma/client';
import { ParagraphLimitsConfig } from '../../../config/paragraph-limits.config';

// Mock the logger
jest.mock('@audibook/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
}));

describe('ParagraphDelimiterService', () => {
  let service: ParagraphDelimiterService;
  let prismaService: PrismaService;

  const mockBook = {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    status: 'READY',
    createdAt: new Date(),
    updatedAt: new Date(),
    paragraphs: [
      {
        id: 'para-1',
        content: 'First paragraph content. Second sentence here.',
        chapterNumber: 1,
        orderIndex: 1,
        bookId: 'book-1',
        audioStatus: AudioStatus.READY,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'para-2', 
        content: 'Another paragraph with more text. Multiple sentences included.',
        chapterNumber: 1,
        orderIndex: 2,
        bookId: 'book-1',
        audioStatus: AudioStatus.READY,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'para-3',
        content: 'Third paragraph content goes here. Final sentence.',
        chapterNumber: 2,
        orderIndex: 3,
        bookId: 'book-1',
        audioStatus: AudioStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParagraphDelimiterService,
        {
          provide: PrismaService,
          useValue: {
            book: {
              findUnique: jest.fn(),
            },
            paragraph: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ParagraphLimitsConfig,
          useValue: {
            getMinCharacters: jest.fn().mockReturnValue(1700),
            getMaxCharacters: jest.fn().mockReturnValue(8000),
            getMinWords: jest.fn().mockReturnValue(300),
            getMaxWords: jest.fn().mockReturnValue(1800),
            getLimits: jest.fn().mockReturnValue({
              minCharacters: 1700,
              maxCharacters: 8000,
              minWords: 300,
              maxWords: 1800,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ParagraphDelimiterService>(ParagraphDelimiterService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('previewParagraphDelimiter', () => {
    beforeEach(() => {
      // Default mock - will be overridden in specific tests
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBook);
    });

    it('should split paragraphs by literal string delimiter', async () => {
      const result = await service.previewParagraphDelimiter('book-1', '. ');

      expect(result.originalParagraphCount).toBe(3); // 3 paragraphs in mockBook
      expect(result.newParagraphCount).toBe(6); // Each paragraph has 2 sentences
      expect(result.previewParagraphs).toHaveLength(6);
      
      // Check that all preview paragraphs are marked as new and in chapter 1
      result.previewParagraphs.forEach(p => {
        expect(p.isNew).toBe(true);
        expect(p.chapterNumber).toBe(1);
      });
    });

    it('should handle newline delimiter correctly', async () => {
      // Mock paragraphs with newline content
      const paragraphsWithNewlines = [
        {
          ...mockBook.paragraphs[0],
          content: 'Line one\nLine two\nLine three',
        },
        {
          ...mockBook.paragraphs[1], 
          content: 'Another line\nSecond line here',
        },
      ];
      
      const bookWithNewlines = {
        ...mockBook,
        paragraphs: paragraphsWithNewlines,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithNewlines);

      const result = await service.previewParagraphDelimiter('book-1', '\\n');
                               
      expect(result.originalParagraphCount).toBe(2); // 2 paragraphs in mock
      expect(result.newParagraphCount).toBe(4); // 3 + 2 lines, but merged content affects split
      expect(result.previewParagraphs).toHaveLength(4);
        
      // Verify content is split correctly
      expect(result.previewParagraphs[0].content).toBe('Line one');
      expect(result.previewParagraphs[1].content).toBe('Line two');
      expect(result.previewParagraphs[2].content).toBe('Line three Another line');
    });

    it('should handle tab delimiter correctly', async () => {
      const content = 'First paragraph\tSecond paragraph\tThird paragraph';
      
      // Mock the book with tab-separated content
      const mockBook = {
        id: 'book-1',
        title: 'Test Book',
        paragraphs: [
          {
            id: 'para-1',
            content,
            chapterNumber: 1,
            orderIndex: 1,
          }
        ]
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBook);

      const result = await service.previewParagraphDelimiter('book-1', '\t');

      // With strict enforcement, small paragraphs should be merged
      expect(result.newParagraphCount).toBe(1); // All merged into one due to strict minimum enforcement
      expect(result.previewParagraphs).toHaveLength(1);
      expect(result.previewParagraphs[0].content).toBe('First paragraph Second paragraph Third paragraph');
    });

    it('should handle regex delimiter correctly', async () => {
      const paragraphsWithNumbers = [
        {
          ...mockBook.paragraphs[0],
          content: 'Item 1: First item. Item 2: Second item. Item 3: Third item.',
        },
      ];
      
      const bookWithNumbers = {
        ...mockBook,
        paragraphs: paragraphsWithNumbers,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithNumbers);

      const result = await service.previewParagraphDelimiter('book-1', 'Item \\d+: ');

      expect(result.originalParagraphCount).toBe(1); // 1 paragraph in mock
      expect(result.newParagraphCount).toBe(1); // No split since it's literal match, not regex
      expect(result.previewParagraphs).toHaveLength(1);
      
      // Should remain as one paragraph since literal match doesn't find the pattern
      expect(result.previewParagraphs[0].content).toBe('Item 1: First item. Item 2: Second item. Item 3: Third item.');
    });

    it('should handle Hebrew text with delimiter', async () => {
      const hebrewParagraphs = [
        {
          ...mockBook.paragraphs[0],
          content: 'פסקה ראשונה כאן. פסקה שנייה כאן. פסקה שלישית כאן.',
        },
      ];
      
      const bookWithHebrew = {
        ...mockBook,
        paragraphs: hebrewParagraphs,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithHebrew);

      const result = await service.previewParagraphDelimiter('book-1', '. ');

      expect(result.originalParagraphCount).toBe(1); // 1 paragraph in mock
      expect(result.newParagraphCount).toBe(3);
      expect(result.previewParagraphs).toHaveLength(3);
      
      expect(result.previewParagraphs[0].content).toBe('פסקה ראשונה כאן');
      expect(result.previewParagraphs[1].content).toBe('פסקה שנייה כאן');
      expect(result.previewParagraphs[2].content).toBe('פסקה שלישית כאן.');
    });

    it('should filter out empty paragraphs after splitting', async () => {
      const paragraphsWithEmpty = [
        {
          ...mockBook.paragraphs[0],
          content: 'Content here.. Empty next. More content.',
        },
      ];
      
      const bookWithEmpty = {
        ...mockBook,
        paragraphs: paragraphsWithEmpty,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithEmpty);

      const result = await service.previewParagraphDelimiter('book-1', '. ');

      expect(result.originalParagraphCount).toBe(1); // 1 paragraph in mock
      expect(result.newParagraphCount).toBe(3); // Empty paragraph should be filtered out
      expect(result.previewParagraphs).toHaveLength(3);
      
      // Verify empty content is filtered out
      result.previewParagraphs.forEach(p => {
        expect(p.content.trim()).not.toBe('');
      });
      
      expect(result.previewParagraphs[0].content).toBe('Content here.');
      expect(result.previewParagraphs[1].content).toBe('Empty next');
      expect(result.previewParagraphs[2].content).toBe('More content.');
    });

    it('should handle book with no paragraphs', async () => {
      const bookWithNoParagraphs = {
        ...mockBook,
        paragraphs: [], // Empty paragraphs array
      };
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithNoParagraphs);

      // The service should return empty result, not throw error
      const result = await service.previewParagraphDelimiter('book-1', '. ');
      
      expect(result.originalParagraphCount).toBe(0);
      expect(result.newParagraphCount).toBe(0);
      expect(result.previewParagraphs).toHaveLength(0);
    });

    it('should split Hebrew text with *** delimiter in middle paragraph', async () => {
      const hebrewParagraphsWithDelimiter = [
        {
          ...mockBook.paragraphs[0],
          id: 'para-1',
          content: 'זהו הפסקה הראשונה בעברית עם תוכן חשוב ומעניין',
          orderIndex: 1,
        },
        {
          ...mockBook.paragraphs[1],
          id: 'para-2', 
          content: 'פסקה שנייה בעברית שמכילה יותר טקסט ומסתיימת בסימן מיוחד***',
          orderIndex: 2,
        },
        {
          ...mockBook.paragraphs[2],
          id: 'para-3',
          content: 'פסקה שלישית ואחרונה בעברית עם תוכן נוסף',
          orderIndex: 3,
        },
      ];
      
      const bookWithHebrewDelimiter = {
        ...mockBook,
        paragraphs: hebrewParagraphsWithDelimiter,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithHebrewDelimiter);

      const result = await service.previewParagraphDelimiter('book-1', '***');

      // Should have 2 paragraphs after splitting by ***
      expect(result.originalParagraphCount).toBe(3);
      expect(result.newParagraphCount).toBe(2);
      expect(result.previewParagraphs).toHaveLength(2);
      
      // First paragraph should contain merged content before ***
      expect(result.previewParagraphs[0].content).toBe(
        'זהו הפסקה הראשונה בעברית עם תוכן חשוב ומעניין פסקה שנייה בעברית שמכילה יותר טקסט ומסתיימת בסימן מיוחד'
      );
      
      // Second paragraph should contain content after ***
      expect(result.previewParagraphs[1].content).toBe(
        'פסקה שלישית ואחרונה בעברית עם תוכן נוסף'
      );
      
      // Both should be in chapter 1 with correct order
      expect(result.previewParagraphs[0].chapterNumber).toBe(1);
      expect(result.previewParagraphs[0].orderIndex).toBe(1);
      expect(result.previewParagraphs[1].chapterNumber).toBe(1);
      expect(result.previewParagraphs[1].orderIndex).toBe(2);
    });

    it('should show all paragraphs in preview (no limit)', async () => {
      // Create a large number of paragraphs to test that all are returned
      const manyParagraphs = Array.from({ length: 50 }, (_, i) => ({
        ...mockBook.paragraphs[0],
        id: `para-${i + 1}`,
        content: `Paragraph ${i + 1} content. Second sentence ${i + 1}.`,
        orderIndex: i + 1,
      }));
      
      const bookWithManyParagraphs = {
        ...mockBook,
        paragraphs: manyParagraphs,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithManyParagraphs);

      const result = await service.previewParagraphDelimiter('book-1', '. ');

      expect(result.originalParagraphCount).toBe(50);
      expect(result.newParagraphCount).toBe(100); // Each splits into 2
      expect(result.previewParagraphs).toHaveLength(100); // All paragraphs returned, no limit
      
      // Verify all paragraphs are included
      expect(result.previewParagraphs[0].content).toBe('Paragraph 1 content');
      expect(result.previewParagraphs[1].content).toBe('Second sentence 1');
    });

    it('should split long paragraphs that exceed character or word limits', async () => {
      // Create a very long paragraph that exceeds both character and word limits
      const longContent = 'This is a very long sentence. '.repeat(300); // ~9000 characters, ~1800 words
      const longParagraphs = [
        {
          ...mockBook.paragraphs[0],
          content: longContent,
        },
      ];
      
      const bookWithLongParagraph = {
        ...mockBook,
        paragraphs: longParagraphs,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithLongParagraph);

      const result = await service.previewParagraphDelimiter('book-1', '. ');

      expect(result.originalParagraphCount).toBe(1);
      // Should be split into multiple paragraphs due to length limits
      expect(result.newParagraphCount).toBeGreaterThan(1);
      expect(result.previewParagraphs.length).toBeGreaterThan(1);
      
      // Verify each resulting paragraph is within limits (using mocked config values)
      result.previewParagraphs.forEach(paragraph => {
        expect(paragraph.content.length).toBeLessThanOrEqual(8000);
        const wordCount = paragraph.content.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(1800);
      });
      
      // Verify all paragraphs have proper metadata
      result.previewParagraphs.forEach((paragraph, index) => {
        expect(paragraph.chapterNumber).toBe(1);
        expect(paragraph.orderIndex).toBe(index + 1);
        expect(paragraph.isNew).toBe(true);
      });
    });

    it('should merge extremely small paragraphs (strict minimum enforcement)', async () => {
      // Create extremely small paragraphs 
      const tinyContent1 = 'A'; // 1 character, 1 word (below thresholds)
      const tinyContent2 = 'B.'; // 2 characters, 1 word (below thresholds)
      const tinyParagraphs = [
        {
          ...mockBook.paragraphs[0],
          content: tinyContent1,
        },
        {
          ...mockBook.paragraphs[1],
          content: tinyContent2,
        },
      ];
      
      const bookWithTinyParagraphs = {
        ...mockBook,
        paragraphs: tinyParagraphs,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithTinyParagraphs);

      const result = await service.previewParagraphDelimiter('book-1', '|'); // Use a delimiter that won't be found

      expect(result.originalParagraphCount).toBe(2);
      // Should be merged into 1 paragraph since both are below minimum limits
      expect(result.newParagraphCount).toBe(1);
      expect(result.previewParagraphs.length).toBe(1);
      
      // Verify the merged content contains both original paragraphs
      expect(result.previewParagraphs[0].content).toBe('A B.');
    });

    it('should merge paragraphs below minimum limits (strict enforcement)', async () => {
      // Create small paragraphs that are below minimum limits
      const smallContent1 = 'A small paragraph.'; // Below 1700 chars and 300 words
      const smallContent2 = 'Another small one.'; // Below 1700 chars and 300 words
      const smallParagraphs = [
        {
          ...mockBook.paragraphs[0],
          content: smallContent1,
        },
        {
          ...mockBook.paragraphs[1],
          content: smallContent2,
        },
      ];
      
      const bookWithSmallParagraphs = {
        ...mockBook,
        paragraphs: smallParagraphs,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithSmallParagraphs);

      const result = await service.previewParagraphDelimiter('book-1', '|'); // Use a delimiter that won't be found

      expect(result.originalParagraphCount).toBe(2);
      // Should be merged into 1 paragraph since both are below minimum limits
      expect(result.newParagraphCount).toBe(1);
      expect(result.previewParagraphs.length).toBe(1);
      
      // Verify the merged content contains both original paragraphs
      expect(result.previewParagraphs[0].content).toBe('A small paragraph. Another small one.');
    });

    it('should merge delimiter-split paragraphs if they are below minimum limits', async () => {
      // Create content that will be split by delimiter into small paragraphs below minimum limits
      const contentWithDelimiter = 'Small paragraph one.|Small paragraph two.|Small paragraph three.';
      const paragraphsWithDelimiter = [
        {
          ...mockBook.paragraphs[0],
          content: contentWithDelimiter,
        },
      ];
      
      const bookWithDelimiterContent = {
        ...mockBook,
        paragraphs: paragraphsWithDelimiter,
      };
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithDelimiterContent);

      const result = await service.previewParagraphDelimiter('book-1', '|'); // Split by | delimiter

      expect(result.originalParagraphCount).toBe(1);
      // With strict enforcement, all small paragraphs should be merged back into one
      expect(result.newParagraphCount).toBe(1);
      expect(result.previewParagraphs.length).toBe(1);
      
      // Verify all content is merged
      expect(result.previewParagraphs[0].content).toBe('Small paragraph one. Small paragraph two. Small paragraph three.');
    });
  });

  describe('applyParagraphDelimiter', () => {
    beforeEach(() => {
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBook);
      (prismaService.paragraph.findMany as jest.Mock).mockResolvedValue(mockBook.paragraphs);
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          book: {
            findUnique: jest.fn().mockResolvedValue(mockBook),
          },
          paragraph: {
            deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
            createMany: jest.fn().mockResolvedValue({ count: 6 }),
          },
        });
      });
    });

    it('should apply delimiter and create new paragraphs', async () => {
      const result = await service.applyParagraphDelimiter('book-1', '. ');

      expect(result.originalParagraphCount).toBe(3);
      expect(result.newParagraphCount).toBe(6);
      
      // Verify transaction was called
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should handle apply operation errors', async () => {
      (prismaService.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.applyParagraphDelimiter('book-1', '. ')
      ).rejects.toThrow('Database error');
    });
  });

  describe('splitByDelimiter', () => {
    it('should split by literal string', () => {
      const result = service['splitByDelimiter']('one. two. three', '. ');
      expect(result).toEqual(['one', 'two', 'three']);
    });

    it('should handle escaped characters', () => {
      const result = service['splitByDelimiter']('line1\nline2\nline3', '\\n');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle regex patterns', () => {
      const result = service['splitByDelimiter']('item1: content item2: more', 'item\\d+: ');
      expect(result).toEqual(['item1: content item2: more']); // Literal match, not regex
    });

    it('should filter empty strings', () => {
      const result = service['splitByDelimiter']('start.. middle.. end', '. ');
      expect(result).toEqual(['start.', 'middle.', 'end']); // Correct expected result
    });
  });
});
