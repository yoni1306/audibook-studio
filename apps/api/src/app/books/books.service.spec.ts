import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { TextFixesService } from './text-fixes.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { S3Service } from '../s3/s3.service';
import { BookStatus } from '@prisma/client';

describe('BooksService', () => {
  let service: BooksService;
  let prismaService: jest.Mocked<PrismaService>;
  let queueService: jest.Mocked<QueueService>;
  let textFixesService: jest.Mocked<TextFixesService>;
  let bulkTextFixesService: jest.Mocked<BulkTextFixesService>;

  const mockBook = {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    s3Key: 'test-book.epub',
    status: BookStatus.READY,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPage = {
    id: 'page-1',
    pageNumber: 1,
    bookId: 'book-1',
    audioS3Key: null,
    audioStatus: 'PENDING',
    audioDuration: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockParagraph = {
    id: 'paragraph-1',
    content: 'Test paragraph content',
    orderIndex: 1,
    pageId: 'page-1',
    audioS3Key: 'audio/book-1/page-1.mp3',
    audioStatus: 'READY',
    audioDuration: 3.5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTextCorrection = {
    id: 'correction-1',
    originalWord: 'original',
    correctedWord: 'corrected',
    fixType: 'MANUAL',
    sentenceContext: 'Test sentence context',
    paragraphId: 'paragraph-1',
    bookId: 'book-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      book: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      paragraph: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      textCorrection: {
        findMany: jest.fn(),
      },
    };

    const mockQueueService = {
      addAudioGenerationJob: jest.fn(),
    };

    const mockTextFixesService = {
      processParagraphUpdate: jest.fn(),
      getParagraphFixes: jest.fn(),
      getBookFixes: jest.fn(),
      getFixesStatistics: jest.fn(),
      findSimilarFixes: jest.fn(),
    };

    const mockS3Service = {
      deleteFile: jest.fn(),
      deleteFolder: jest.fn(),
    };

    const mockBulkTextFixesService = {
      findSimilarFixesInBook: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: TextFixesService,
          useValue: mockTextFixesService,
        },
        {
          provide: BulkTextFixesService,
          useValue: mockBulkTextFixesService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    prismaService = module.get(PrismaService);
    queueService = module.get(QueueService);
    textFixesService = module.get(TextFixesService);
    bulkTextFixesService = module.get(BulkTextFixesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBook', () => {
    it('should create a book with UPLOADING status', async () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        s3Key: 'test-book.epub',
      };

      const expectedBook = {
        ...mockBook,
        ...bookData,
        status: BookStatus.UPLOADING,
      };

      (prismaService.book.create as jest.Mock).mockResolvedValue(expectedBook);

      const result = await service.createBook(bookData);

      expect(prismaService.book.create).toHaveBeenCalledWith({
        data: {
          title: bookData.title,
          author: bookData.author,
          s3Key: bookData.s3Key,
          status: BookStatus.UPLOADING,
        },
      });
      expect(result).toEqual(expectedBook);
    });

    it('should create a book without author', async () => {
      const bookData = {
        title: 'Test Book',
        s3Key: 'test-book.epub',
      };

      const expectedBook = {
        ...mockBook,
        ...bookData,
        author: undefined,
        status: BookStatus.UPLOADING,
      };

      (prismaService.book.create as jest.Mock).mockResolvedValue(expectedBook);

      const result = await service.createBook(bookData);

      expect(prismaService.book.create).toHaveBeenCalledWith({
        data: {
          title: bookData.title,
          author: undefined,
          s3Key: bookData.s3Key,
          status: BookStatus.UPLOADING,
        },
      });
      expect(result).toEqual(expectedBook);
    });
  });

  describe('updateBookStatus', () => {
    it('should update book status', async () => {
      const bookId = 'book-1';
      const newStatus = BookStatus.READY;
      const updatedBook = { ...mockBook, status: newStatus };

      (prismaService.book.update as jest.Mock).mockResolvedValue(updatedBook);

      const result = await service.updateBookStatus(bookId, newStatus);

      expect(prismaService.book.update).toHaveBeenCalledWith({
        where: { id: bookId },
        data: { status: newStatus },
      });
      expect(result).toEqual(updatedBook);
    });
  });

  describe('updateParagraph', () => {
    const paragraphId = 'paragraph-1';
    const newContent = 'Updated paragraph content';

    beforeEach(() => {
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue([]);
    });

    it('should update paragraph content without generating audio', async () => {
      const existingParagraph = { ...mockParagraph };
      const updatedParagraph = {
        ...mockParagraph,
        content: newContent,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);

      const result = await service.updateParagraph(paragraphId, newContent, false);

      expect(prismaService.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: paragraphId },
      });
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { content: newContent },
        include: {
          page: {
            include: {
              book: true,
            },
          },
          textCorrections: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      expect(queueService.addAudioGenerationJob).not.toHaveBeenCalled();
      expect(result).toEqual({ ...updatedParagraph, textChanges: [], bulkSuggestions: [] });
    });

    it('should update paragraph content and generate audio when requested', async () => {
      const existingParagraph = { ...mockParagraph };
      const updatedParagraph = {
        ...mockParagraph,
        content: newContent,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);

      const result = await service.updateParagraph(paragraphId, newContent, true);

      expect(queueService.addAudioGenerationJob).toHaveBeenCalledWith({
        paragraphId: paragraphId,
        bookId: mockBook.id,
        content: newContent,
      });
      expect(result).toEqual({ ...updatedParagraph, textChanges: [], bulkSuggestions: [] });
    });

    it('should send full paragraph text for audio generation - long content', async () => {
      const longContent = 'זהו פסקה ארוכה מאוד שמכילה הרבה טקסט עברי. ' +
        'הפסקה הזו נועדה לבדוק שהטקסט המלא נשלח ליצירת אודיו, ' +
        'גם כאשר הוא ארוך מאוד ומכיל תווים מיוחדים כמו ניקוד וסימני פיסוק. ' +
        'חשוב לוודא שלא חסר שום חלק מהטקסט בתהליך יצירת האודיו, ' +
        'כי זה יכול לגרום לבעיות בהשמעה ובהבנת התוכן. ' +
        'בנוסף, הטקסט כולל מספרים כמו 123 ו-456, ' +
        'וגם סימני פיסוק שונים כמו נקודות, פסיקים, סימני שאלה? וסימני קריאה! ' +
        'כל אלה צריכים להיות כלולים בטקסט שנשלח ליצירת האודיו.';
      
      const existingParagraph = { ...mockParagraph, content: 'Original content' };
      const updatedParagraph = {
        ...mockParagraph,
        content: longContent,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);

      const result = await service.updateParagraph(paragraphId, longContent, true);

      // Verify that the EXACT full content is sent for audio generation
      expect(queueService.addAudioGenerationJob).toHaveBeenCalledWith({
        paragraphId: paragraphId,
        bookId: mockBook.id,
        content: longContent, // Full content, not truncated
      });
      
      // Verify the content length is preserved
      const audioJobCall = (queueService.addAudioGenerationJob as jest.Mock).mock.calls[0][0];
      expect(audioJobCall.content).toHaveLength(longContent.length);
      expect(audioJobCall.content).toBe(longContent);
      
      expect(result).toEqual({ ...updatedParagraph, textChanges: [], bulkSuggestions: [] });
    });

    it('should generate bulk suggestions when text changes are detected', async () => {
      const existingParagraph = { ...mockParagraph, content: 'Original content with word' };
      const newContent = 'Updated content with correction';
      const updatedParagraph = {
        ...mockParagraph,
        content: newContent,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };

      // Mock text changes detected
      const mockTextChanges = [
        {
          originalWord: 'word',
          correctedWord: 'correction',
          position: 20,
          fixType: 'MANUAL' as const,
          sentenceContext: 'Original content with word',
        },
      ];

      // Mock bulk suggestions response
      const mockBulkSuggestions = [
        {
          originalWord: 'word',
          correctedWord: 'correction',
          fixType: 'MANUAL' as const,
          paragraphs: [
            {
              id: 'paragraph-2',
              previewBefore: 'Another word here',
              previewAfter: 'Another correction here',
              occurrences: 1,
            },
            {
              id: 'paragraph-3',
              previewBefore: 'Yet another word',
              previewAfter: 'Yet another correction',
              occurrences: 1,
            },
          ],
        },
      ];

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue(mockTextChanges);
      (bulkTextFixesService.findSimilarFixesInBook as jest.Mock).mockResolvedValue(mockBulkSuggestions);

      const result = await service.updateParagraph(paragraphId, newContent, false);

      // Verify text changes were processed
      expect(textFixesService.processParagraphUpdate).toHaveBeenCalledWith(
        paragraphId,
        existingParagraph.content,
        newContent
      );

      // Verify bulk suggestions service was called with correct parameters
      expect(bulkTextFixesService.findSimilarFixesInBook).toHaveBeenCalledWith(
        mockBook.id,
        paragraphId,
        mockTextChanges
      );
      
      // Verify the response includes the mapped bulk suggestions
      expect(result.textChanges).toEqual(mockTextChanges);
      expect(result.bulkSuggestions).toHaveLength(1);
      expect(result.bulkSuggestions[0]).toEqual({
        originalWord: 'word',
        correctedWord: 'correction',
        fixType: 'MANUAL',
        paragraphIds: ['paragraph-2', 'paragraph-3'],
        count: 2, // Sum of occurrences from both paragraphs
        previewBefore: 'Another word here', // First paragraph's preview
        previewAfter: 'Another correction here',
        occurrences: [
          {
            paragraphId: 'paragraph-2',
            previewBefore: 'Another word here',
            previewAfter: 'Another correction here',
          },
          {
            paragraphId: 'paragraph-3',
            previewBefore: 'Yet another word',
            previewAfter: 'Yet another correction',
          },
        ],
        paragraphs: mockBulkSuggestions[0].paragraphs,
      });
    });

    it('should send full paragraph text for audio generation - mixed languages', async () => {
      const mixedContent = 'This is English text mixed with Hebrew: שלום עולם! ' +
        'And some numbers: 123, 456.78, and special characters: @#$%^&*()[]{}|;:,.<>? ' +
        'More Hebrew: זהו טקסט מעורב עם אנגלית ומספרים ותווים מיוחדים. ' +
        'Final English part with punctuation!';
      
      const existingParagraph = { ...mockParagraph, content: 'Original content' };
      const updatedParagraph = {
        ...mockParagraph,
        content: mixedContent,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);

      const result = await service.updateParagraph(paragraphId, mixedContent, true);

      // Verify that the EXACT mixed content is sent for audio generation
      expect(queueService.addAudioGenerationJob).toHaveBeenCalledWith({
        paragraphId: paragraphId,
        bookId: mockBook.id,
        content: mixedContent, // Full mixed content preserved
      });
      
      // Verify no content modification or encoding issues
      const audioJobCall = (queueService.addAudioGenerationJob as jest.Mock).mock.calls[0][0];
      expect(audioJobCall.content).toContain('שלום עולם');
      expect(audioJobCall.content).toContain('This is English');
      expect(audioJobCall.content).toContain('123, 456.78');
      expect(audioJobCall.content).toContain('@#$%^&*()[]{}|;:,.<>?');
      
      expect(result).toEqual({ ...updatedParagraph, textChanges: [], bulkSuggestions: [] });
    });

    it('should send full paragraph text for audio generation - with niqqud', async () => {
      const hebrewWithNiqqud = 'שָׁלוֹם עוֹלָם! זֶה טֶקְסְט עִבְרִי עִם נִקּוּד מָלֵא. ' +
        'הַנִּקּוּד חָשׁוּב לְיִצִירַת אוּדְיוֹ נָכוֹן וּמְדֻיָּק. ' +
        'כָּל הַתַּוִּים הַמְּיֻחָדִים צְרִיכִים לְהִשָּׁמֵר בַּטֶּקְסְט הַמְּלֵא.';
      
      const existingParagraph = { ...mockParagraph, content: 'Original content' };
      const updatedParagraph = {
        ...mockParagraph,
        content: hebrewWithNiqqud,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);

      const result = await service.updateParagraph(paragraphId, hebrewWithNiqqud, true);

      // Verify that Hebrew with niqqud is fully preserved
      expect(queueService.addAudioGenerationJob).toHaveBeenCalledWith({
        paragraphId: paragraphId,
        bookId: mockBook.id,
        content: hebrewWithNiqqud, // Full content with niqqud preserved
      });
      
      // Verify niqqud characters are preserved
      const audioJobCall = (queueService.addAudioGenerationJob as jest.Mock).mock.calls[0][0];
      expect(audioJobCall.content).toContain('שָׁלוֹם'); // Contains niqqud
      expect(audioJobCall.content).toContain('נִקּוּד'); // Contains niqqud
      expect(audioJobCall.content).toContain('מְּיֻחָדִים'); // Contains complex niqqud
      
      expect(result).toEqual({ ...updatedParagraph, textChanges: [], bulkSuggestions: [] });
    });

    it('should track text changes when content differs', async () => {
      const existingParagraph = { ...mockParagraph, content: 'Old content' };
      const updatedParagraph = {
        ...mockParagraph,
        content: newContent,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };
      const textChanges = [{ type: 'replacement', from: 'Old', to: 'Updated' }];

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue(textChanges);

      const result = await service.updateParagraph(paragraphId, newContent, false);

      expect(textFixesService.processParagraphUpdate).toHaveBeenCalledWith(
        paragraphId,
        'Old content',
        newContent
      );
      expect(result).toEqual({ ...updatedParagraph, textChanges, bulkSuggestions: [] });
    });

    it('should throw error when paragraph not found', async () => {
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updateParagraph(paragraphId, newContent)).rejects.toThrow(
        `Paragraph not found with ID: ${paragraphId}`
      );
    });
  });

  describe('getBook', () => {
    it('should return book with flattened paragraphs from pages', async () => {
      const bookWithPages = {
        ...mockBook,
        pages: [
          {
            ...mockPage,
            paragraphs: [
              {
                ...mockParagraph,
                textCorrections: [mockTextCorrection],
              },
            ],
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithPages);

      const result = await service.getBook('book-1');

      expect(prismaService.book.findUnique).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        include: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            include: {
              paragraphs: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  textCorrections: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                  },
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        ...mockBook,
        pages: bookWithPages.pages,
        paragraphs: [
          {
            ...mockParagraph,
            pageNumber: mockPage.pageNumber,
            pageId: mockPage.id,
            textCorrections: [mockTextCorrection],
          },
        ],
      });
      
      // Verify pages are also included
      expect(result?.pages).toHaveLength(1);
      expect(result?.pages[0]).toMatchObject({
        audioS3Key: null,
        audioStatus: 'PENDING',
        audioDuration: null,
      });
    });

    it('should return null when book not found', async () => {
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getBook('non-existent-book');

      expect(result).toBeNull();
    });

    it('should handle book with multiple pages and paragraphs', async () => {
      const bookWithMultiplePages = {
        ...mockBook,
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            bookId: 'book-1',
            paragraphs: [
              { ...mockParagraph, id: 'para-1', orderIndex: 1, textCorrections: [] },
              { ...mockParagraph, id: 'para-2', orderIndex: 2, textCorrections: [] },
            ],
          },
          {
            id: 'page-2',
            pageNumber: 2,
            bookId: 'book-1',
            paragraphs: [
              { ...mockParagraph, id: 'para-3', orderIndex: 1, textCorrections: [] },
            ],
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithMultiplePages);

      const result = await service.getBook('book-1');

      expect(result.paragraphs).toHaveLength(3);
      expect(result.paragraphs[0]).toEqual({
        ...mockParagraph,
        id: 'para-1',
        orderIndex: 1,
        pageNumber: 1,
        pageId: 'page-1',
        textCorrections: [],
      });
      expect(result.paragraphs[2]).toEqual({
        ...mockParagraph,
        id: 'para-3',
        orderIndex: 1,
        pageNumber: 2,
        pageId: 'page-2',
        textCorrections: [],
      });
    });

    it('should return book with audio metadata in flattened paragraphs', async () => {
      const bookWithPages = {
        ...mockBook,
        pages: [
          {
            ...mockPage,
            paragraphs: [
              {
                ...mockParagraph,
                textCorrections: [mockTextCorrection],
              },
            ],
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithPages);

      const result = await service.getBook('book-1');

      expect(result).toMatchObject({
        ...mockBook,
        paragraphs: [
          {
            ...mockParagraph,
            pageNumber: mockPage.pageNumber,
            pageId: mockPage.id,
            audioStatus: 'READY',
            audioS3Key: 'audio/book-1/page-1.mp3',
            audioDuration: 3.5,
            textCorrections: [mockTextCorrection],
          },
        ],
      });
      
      // Verify pages are also included
      expect(result?.pages).toHaveLength(1);
      expect(result?.pages[0]).toMatchObject({
        audioS3Key: null,
        audioStatus: 'PENDING',
        audioDuration: null,
      });
    });

    it('should return book with pending audio status when no audio generated', async () => {
      const paragraphWithoutAudio = {
        ...mockParagraph,
        audioStatus: 'PENDING',
        audioS3Key: null,
        audioDuration: null,
      };

      const bookWithPages = {
        ...mockBook,
        pages: [
          {
            ...mockPage,
            paragraphs: [paragraphWithoutAudio],
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithPages);

      const result = await service.getBook('book-1');

      expect(result).toMatchObject({
        ...mockBook,
        paragraphs: [
          {
            ...paragraphWithoutAudio,
            pageNumber: mockPage.pageNumber,
            pageId: mockPage.id,
            audioDuration: null,
            audioS3Key: null,
            audioStatus: "PENDING",
          },
        ],
      });
      
      // Verify pages are also included
      expect(result?.pages).toHaveLength(1);
      expect(result?.pages[0]).toMatchObject({
        audioS3Key: null,
        audioStatus: 'PENDING',
        audioDuration: null,
      });
    });

    it('should handle mixed audio statuses across paragraphs', async () => {
      const paragraphWithAudio = {
        ...mockParagraph,
        id: 'paragraph-1',
        audioStatus: 'READY',
        audioS3Key: 'audio/book-1/page-1.mp3',
        audioDuration: 3.5,
      };

      const paragraphWithoutAudio = {
        ...mockParagraph,
        id: 'paragraph-2',
        orderIndex: 2,
        audioStatus: 'PENDING',
        audioS3Key: null,
        audioDuration: null,
      };

      const bookWithPages = {
        ...mockBook,
        pages: [
          {
            ...mockPage,
            paragraphs: [paragraphWithAudio, paragraphWithoutAudio],
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(bookWithPages);

      const result = await service.getBook('book-1');

      expect(result?.paragraphs).toHaveLength(2);
      expect(result?.paragraphs[0].audioStatus).toBe('READY');
      expect(result?.paragraphs[0].audioS3Key).toBe('audio/book-1/page-1.mp3');
      expect(result?.paragraphs[0].audioDuration).toBe(3.5);
      expect(result?.paragraphs[1].audioStatus).toBe('PENDING');
      expect(result?.paragraphs[1].audioS3Key).toBeNull();
      expect(result?.paragraphs[1].audioDuration).toBeNull();
    });
  });

  describe('getAllBooks', () => {
    it('should return all books with page counts', async () => {
      const booksWithCounts = [
        {
          ...mockBook,
          _count: { pages: 5 },
        },
      ];

      (prismaService.book.findMany as jest.Mock).mockResolvedValue(booksWithCounts);

      const result = await service.getAllBooks();

      expect(prismaService.book.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { pages: true, textCorrections: true },
          },
        },
      });
      expect(result).toEqual(booksWithCounts);
    });

    it('should return empty array when no books exist', async () => {
      (prismaService.book.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAllBooks();

      expect(result).toEqual([]);
    });
  });

  describe('getParagraph', () => {
    it('should return paragraph with page and book relations', async () => {
      const paragraphWithRelations = {
        ...mockParagraph,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [mockTextCorrection],
      };

      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithRelations);

      const result = await service.getParagraph('paragraph-1');

      expect(prismaService.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: 'paragraph-1' },
        include: {
          page: {
            include: {
              book: true,
            },
          },
          textCorrections: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      expect(result).toEqual(paragraphWithRelations);
    });

    it('should return null when paragraph not found', async () => {
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getParagraph('non-existent-paragraph');

      expect(result).toBeNull();
    });
  });

  describe('text fixes delegation methods', () => {
    it('should delegate getParagraphTextFixes to TextFixesService', async () => {
      const mockFixes = [
        {
          ...mockTextCorrection,
          paragraph: {
            page: { pageNumber: 1 },
            orderIndex: 1,
          },
        },
      ];
      (textFixesService.getParagraphFixes as jest.Mock).mockResolvedValue(mockFixes);

      const result = await service.getParagraphTextFixes('paragraph-1');

      expect(textFixesService.getParagraphFixes).toHaveBeenCalledWith('paragraph-1');
      expect(result).toEqual(mockFixes);
    });

    it('should delegate getBookTextFixes to TextFixesService', async () => {
      const mockFixes = [
        {
          ...mockTextCorrection,
          paragraph: {
            page: { pageNumber: 1 },
            orderIndex: 1,
          },
        },
      ];
      (textFixesService.getBookFixes as jest.Mock).mockResolvedValue(mockFixes);

      const result = await service.getBookTextFixes('book-1');

      expect(textFixesService.getBookFixes).toHaveBeenCalledWith('book-1');
      expect(result).toEqual(mockFixes);
    });

    it('should delegate getTextFixesStatistics to TextFixesService', async () => {
      const mockStats = {
        totalFixes: 10,
        fixesByType: [
          { fixType: 'MANUAL', _count: { id: 5 } },
          { fixType: 'AUTOMATIC', _count: { id: 5 } },
        ],
        mostCorrectedWords: [
          { originalWord: 'test', _count: { id: 3 } },
        ],
      };
      (textFixesService.getFixesStatistics as jest.Mock).mockResolvedValue(mockStats);

      const result = await service.getTextFixesStatistics();

      expect(textFixesService.getFixesStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should delegate findSimilarFixes to TextFixesService', async () => {
      const mockSimilarFixes = [
        {
          originalWord: 'similar',
          correctedWord: 'corrected',
          fixType: 'MANUAL',
          count: 2,
        },
      ];
      (textFixesService.findSimilarFixes as jest.Mock).mockResolvedValue(mockSimilarFixes);

      const result = await service.findSimilarFixes('test', 5);

      expect(textFixesService.findSimilarFixes).toHaveBeenCalledWith('test', 5);
      expect(result).toEqual(mockSimilarFixes);
    });

    it('should use default limit for findSimilarFixes', async () => {
      const mockSimilarFixes = [
        {
          originalWord: 'similar',
          correctedWord: 'corrected',
          fixType: 'MANUAL',
          count: 2,
        },
      ];
      (textFixesService.findSimilarFixes as jest.Mock).mockResolvedValue(mockSimilarFixes);

      await service.findSimilarFixes('test');

      expect(textFixesService.findSimilarFixes).toHaveBeenCalledWith('test', 10);
    });
  });

  describe('getAllWordFixes', () => {
    it('should return formatted text corrections with relations', async () => {
      const mockCorrections = [
        {
          ...mockTextCorrection,
          book: mockBook,
          paragraph: {
            id: 'paragraph-1',
            content: 'Test paragraph content',
          },
        },
      ];

      const expectedResult = [
        {
          id: mockTextCorrection.id,
          originalWord: mockTextCorrection.originalWord,
          correctedWord: mockTextCorrection.correctedWord,
          fixType: mockTextCorrection.fixType,
          createdAt: mockTextCorrection.createdAt,
          paragraph: {
            id: 'paragraph-1',
            content: 'Test paragraph content',
            book: mockBook,
          },
        },
      ];

      (prismaService.textCorrection.findMany as jest.Mock).mockResolvedValue(mockCorrections);

      const result = await service.getAllWordFixes();

      expect(prismaService.textCorrection.findMany).toHaveBeenCalledWith({
        include: {
          book: {
            select: {
              id: true,
              title: true,
            },
          },
          paragraph: {
            select: {
              id: true,
              content: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should return empty array when no corrections exist', async () => {
      (prismaService.textCorrection.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAllWordFixes();

      expect(result).toEqual([]);
    });
  });

  describe('getCompletedParagraphs', () => {
    const mockBookId = 'test-book-id';
    const mockCompletedParagraph1 = {
      id: 'paragraph-1',
      content: 'This is the first completed paragraph.',
      orderIndex: 1,
      audioStatus: 'COMPLETED',
      audioDuration: 5.2,
    };
    const mockCompletedParagraph2 = {
      id: 'paragraph-2',
      content: 'This is the second completed paragraph.',
      orderIndex: 2,
      audioStatus: 'COMPLETED',
      audioDuration: 3.8,
    };
    const mockCompletedParagraph3 = {
      id: 'paragraph-3',
      content: 'This is a completed paragraph on page 2.',
      orderIndex: 1,
      audioStatus: 'COMPLETED',
      audioDuration: 4.1,
    };

    const mockBookWithCompletedParagraphs = {
      id: mockBookId,
      title: 'Test Book Title',
      pages: [
        {
          id: 'page-1',
          pageNumber: 1,
          paragraphs: [mockCompletedParagraph1, mockCompletedParagraph2],
        },
        {
          id: 'page-2',
          pageNumber: 2,
          paragraphs: [mockCompletedParagraph3],
        },
      ],
    };

    it('should return completed paragraphs organized by page', async () => {
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithCompletedParagraphs);

      const result = await service.getCompletedParagraphs(mockBookId);

      expect(prismaService.book.findUnique).toHaveBeenCalledWith({
        where: { id: mockBookId },
        include: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            include: {
              paragraphs: {
                where: { completed: true },
                orderBy: { orderIndex: 'asc' },
                select: {
                  id: true,
                  content: true,
                  orderIndex: true,
                  audioStatus: true,
                  audioDuration: true,
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        bookId: mockBookId,
        bookTitle: 'Test Book Title',
        pages: [
          {
            pageId: 'page-1',
            pageNumber: 1,
            completedParagraphs: [mockCompletedParagraph1, mockCompletedParagraph2],
          },
          {
            pageId: 'page-2',
            pageNumber: 2,
            completedParagraphs: [mockCompletedParagraph3],
          },
        ],
        totalCompletedParagraphs: 3,
      });
    });

    it('should filter out pages with no completed paragraphs', async () => {
      const mockBookWithMixedPages = {
        id: mockBookId,
        title: 'Test Book Title',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            paragraphs: [mockCompletedParagraph1], // Has completed paragraphs
          },
          {
            id: 'page-2',
            pageNumber: 2,
            paragraphs: [], // No completed paragraphs
          },
          {
            id: 'page-3',
            pageNumber: 3,
            paragraphs: [mockCompletedParagraph3], // Has completed paragraphs
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithMixedPages);

      const result = await service.getCompletedParagraphs(mockBookId);

      expect(result.pages).toHaveLength(2); // Only pages with completed paragraphs
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[1].pageNumber).toBe(3);
      expect(result.totalCompletedParagraphs).toBe(2);
    });

    it('should handle book with no completed paragraphs', async () => {
      const mockBookWithNoCompletedParagraphs = {
        id: mockBookId,
        title: 'Test Book Title',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            paragraphs: [], // No completed paragraphs
          },
          {
            id: 'page-2',
            pageNumber: 2,
            paragraphs: [], // No completed paragraphs
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithNoCompletedParagraphs);

      const result = await service.getCompletedParagraphs(mockBookId);

      expect(result).toEqual({
        bookId: mockBookId,
        bookTitle: 'Test Book Title',
        pages: [],
        totalCompletedParagraphs: 0,
      });
    });

    it('should return null when book not found', async () => {
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getCompletedParagraphs(mockBookId);

      expect(result).toBeNull();
      expect(prismaService.book.findUnique).toHaveBeenCalledWith({
        where: { id: mockBookId },
        include: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            include: {
              paragraphs: {
                where: { completed: true },
                orderBy: { orderIndex: 'asc' },
                select: {
                  id: true,
                  content: true,
                  orderIndex: true,
                  audioStatus: true,
                  audioDuration: true,
                },
              },
            },
          },
        },
      });
    });

    it('should maintain correct paragraph order within pages', async () => {
      const mockBookWithOrderedParagraphs = {
        id: mockBookId,
        title: 'Test Book Title',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            paragraphs: [
              { ...mockCompletedParagraph2, orderIndex: 1 },
              { id: 'paragraph-4', content: 'Third paragraph', orderIndex: 2, audioStatus: 'COMPLETED', audioDuration: 2.5 },
              { ...mockCompletedParagraph1, orderIndex: 3 },
            ],
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithOrderedParagraphs);

      const result = await service.getCompletedParagraphs(mockBookId);

      expect(result.pages[0].completedParagraphs).toHaveLength(3);
      expect(result.pages[0].completedParagraphs[0].orderIndex).toBe(1); // Should be ordered by orderIndex
      expect(result.pages[0].completedParagraphs[1].orderIndex).toBe(2);
      expect(result.pages[0].completedParagraphs[2].orderIndex).toBe(3);
    });

    it('should maintain correct page order', async () => {
      const mockBookWithOrderedPages = {
        id: mockBookId,
        title: 'Test Book Title',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            paragraphs: [mockCompletedParagraph1],
          },
          {
            id: 'page-2',
            pageNumber: 2,
            paragraphs: [mockCompletedParagraph2],
          },
          {
            id: 'page-3',
            pageNumber: 3,
            paragraphs: [mockCompletedParagraph3],
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithOrderedPages);

      const result = await service.getCompletedParagraphs(mockBookId);

      expect(result.pages).toHaveLength(3);
      expect(result.pages[0].pageNumber).toBe(1); // Should be ordered by pageNumber
      expect(result.pages[1].pageNumber).toBe(2);
      expect(result.pages[2].pageNumber).toBe(3);
    });

    it('should calculate total completed paragraphs correctly', async () => {
      const mockBookWithVariousParagraphs = {
        id: mockBookId,
        title: 'Test Book Title',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            paragraphs: [mockCompletedParagraph1, mockCompletedParagraph2], // 2 paragraphs
          },
          {
            id: 'page-2',
            pageNumber: 2,
            paragraphs: [], // 0 paragraphs (filtered out)
          },
          {
            id: 'page-3',
            pageNumber: 3,
            paragraphs: [mockCompletedParagraph3], // 1 paragraph
          },
        ],
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithVariousParagraphs);

      const result = await service.getCompletedParagraphs(mockBookId);

      expect(result.totalCompletedParagraphs).toBe(3); // 2 + 0 + 1 = 3
      expect(result.pages).toHaveLength(2); // Only pages with paragraphs
    });

    it('should only select required paragraph fields', async () => {
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithCompletedParagraphs);

      await service.getCompletedParagraphs(mockBookId);

      expect(prismaService.book.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            pages: {
              orderBy: { pageNumber: 'asc' },
              include: {
                paragraphs: {
                  where: { completed: true },
                  orderBy: { orderIndex: 'asc' },
                  select: {
                    id: true,
                    content: true,
                    orderIndex: true,
                    audioStatus: true,
                    audioDuration: true,
                  },
                },
              },
            },
          },
        })
      );
    });

    it('should log appropriate messages', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithCompletedParagraphs);

      await service.getCompletedParagraphs(mockBookId);

      expect(logSpy).toHaveBeenCalledWith(`🔍 Getting completed paragraphs for book: ${mockBookId}`);
      expect(logSpy).toHaveBeenCalledWith(`✅ Found 3 completed paragraphs across 2 pages for book: ${mockBookId}`);
      
      logSpy.mockRestore();
    });

    it('should log when book not found', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(null);

      await service.getCompletedParagraphs(mockBookId);

      expect(logSpy).toHaveBeenCalledWith(`🔍 Getting completed paragraphs for book: ${mockBookId}`);
      expect(logSpy).toHaveBeenCalledWith(`📚 Book not found: ${mockBookId}`);
      
      logSpy.mockRestore();
    });
  });
});
