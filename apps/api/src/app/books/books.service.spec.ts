import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { NatsQueueService } from '../queue/nats-queue.service';
import { TextFixesService } from './text-fixes.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { S3Service } from '../s3/s3.service';
import { BookStatus, FixType } from '@prisma/client';

describe('BooksService', () => {
  let service: BooksService;
  let prismaService: jest.Mocked<PrismaService>;
  let queueService: jest.Mocked<NatsQueueService>;
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
        deleteMany: jest.fn(),
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
      analyzeTextChanges: jest.fn(),
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
          provide: NatsQueueService,
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
    queueService = module.get(NatsQueueService);
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
          processingMetadata: {
            diacriticsType: 'advanced',
            parsingMethod: 'page-based',
          },
          ttsModel: 'azure',
          ttsVoice: undefined,
          ttsSettings: undefined,
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
          processingMetadata: {
            diacriticsType: 'advanced',
            parsingMethod: 'page-based',
          },
          ttsModel: 'azure',
          ttsVoice: undefined,
          ttsSettings: undefined,
        },
      });
      expect(result).toEqual(expectedBook);
    });

    describe('TTS Configuration Support', () => {
      it('should create a book with custom TTS model and voice', async () => {
        const bookData = {
          title: 'Hebrew Book',
          author: 'Hebrew Author',
          s3Key: 'hebrew-book.epub',
          ttsModel: 'azure',
          ttsVoice: 'he-IL-AvriNeural',
          ttsSettings: { rate: 1.0, pitch: 1.0, volume: 1.0 },
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
            processingMetadata: {
              diacriticsType: 'advanced',
              parsingMethod: 'page-based',
            },
            ttsModel: 'azure',
            ttsVoice: 'he-IL-AvriNeural',
            ttsSettings: { rate: 1.0, pitch: 1.0, volume: 1.0 },
          },
        });
        expect(result).toEqual(expectedBook);
      });

      it('should create a book with different TTS providers', async () => {
        const testCases = [
          {
            ttsModel: 'azure',
            ttsVoice: 'en-US-AriaNeural',
            ttsSettings: { rate: 0.9, pitch: 1.1 },
          },
          {
            ttsModel: 'openai',
            ttsVoice: 'alloy',
            ttsSettings: { speed: 1.0 },
          },
          {
            ttsModel: 'elevenlabs',
            ttsVoice: 'rachel',
            ttsSettings: { stability: 0.8, similarity_boost: 0.7 },
          },
        ];

        for (const testCase of testCases) {
          const bookData = {
            title: `Test Book ${testCase.ttsModel}`,
            s3Key: `test-book-${testCase.ttsModel}.epub`,
            ...testCase,
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
              author: undefined,
              s3Key: bookData.s3Key,
              status: BookStatus.UPLOADING,
              processingMetadata: {
                diacriticsType: 'advanced',
                parsingMethod: 'page-based',
              },
              ttsModel: testCase.ttsModel,
              ttsVoice: testCase.ttsVoice,
              ttsSettings: testCase.ttsSettings,
            },
          });
          expect(result).toEqual(expectedBook);
        }
      });

      it('should default to azure TTS model when not specified', async () => {
        const bookData = {
          title: 'Default TTS Book',
          s3Key: 'default-tts-book.epub',
        };

        const expectedBook = {
          ...mockBook,
          ...bookData,
          status: BookStatus.UPLOADING,
          ttsModel: 'azure',
        };

        (prismaService.book.create as jest.Mock).mockResolvedValue(expectedBook);

        const result = await service.createBook(bookData);

        expect(prismaService.book.create).toHaveBeenCalledWith({
          data: {
            title: bookData.title,
            author: undefined,
            s3Key: bookData.s3Key,
            status: BookStatus.UPLOADING,
            processingMetadata: {
              diacriticsType: 'advanced',
              parsingMethod: 'page-based',
            },
            ttsModel: 'azure', // Should default to azure
            ttsVoice: undefined,
            ttsSettings: undefined,
          },
        });
        expect(result).toEqual(expectedBook);
      });

      it('should handle null TTS settings correctly', async () => {
        const bookData = {
          title: 'Null Settings Book',
          s3Key: 'null-settings-book.epub',
          ttsModel: 'azure',
          ttsVoice: 'en-US-AriaNeural',
          ttsSettings: null,
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
            author: undefined,
            s3Key: bookData.s3Key,
            status: BookStatus.UPLOADING,
            processingMetadata: {
              diacriticsType: 'advanced',
              parsingMethod: 'page-based',
            },
            ttsModel: 'azure',
            ttsVoice: 'en-US-AriaNeural',
            ttsSettings: null,
          },
        });
        expect(result).toEqual(expectedBook);
      });
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
          originalParagraph: {
            select: {
              content: true,
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

    it('should record text corrections even when user intends to "skip all" suggestions (demonstrates bug)', async () => {
      // This test demonstrates the current bug: when a user clicks "Skip All",
      // the frontend still calls updateParagraph, which triggers processParagraphUpdate,
      // which records text corrections in the database even though the user intended to skip them.
      
      const originalContent = 'שלום עולם';
      const updatedContent = 'שָׁלוֹם עולם'; // Hebrew with niqqud corrections
      
      const existingParagraph = {
        ...mockParagraph,
        content: originalContent,
      };
      
      const updatedParagraph = {
        ...mockParagraph,
        content: updatedContent,
        page: {
          ...mockPage,
          book: mockBook,
        },
        textCorrections: [],
      };
      
      // Mock text changes that would be detected
      const mockTextChanges = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          position: 0,
          fixType: FixType.vowelization,
        },
      ];
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(existingParagraph);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedParagraph);
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue(mockTextChanges);
      
      // Simulate the "skip all" scenario - user edits paragraph but intends to skip bulk suggestions
      const result = await service.updateParagraph(paragraphId, updatedContent, false);
      
      // Verify that updateParagraph was called (this is expected)
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { content: updatedContent },
        include: {
          page: {
            include: {
              book: true,
            },
          },
          originalParagraph: {
            select: {
              content: true,
            },
          },
          textCorrections: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      
      // BUG: This is the problem! processParagraphUpdate is called even when user intends to "skip all"
      // This method calls saveTextFixes which records corrections in the database
      expect(textFixesService.processParagraphUpdate).toHaveBeenCalledWith(
        paragraphId,
        originalContent,
        updatedContent
      );
      
      // The result includes textChanges, which means corrections were processed and will be recorded
      expect(result.textChanges).toEqual(mockTextChanges);
      
      // TODO: In the fix, we should add a parameter to updateParagraph like "recordCorrections: boolean"
      // When user clicks "Skip All", this should be false, preventing processParagraphUpdate from being called
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
                  originalParagraph: {
                    select: {
                      content: true,
                    },
                  },
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

  describe('revertParagraph', () => {
    const paragraphId = 'test-paragraph-id';
    const originalContent = 'This is the original paragraph content';
    const modifiedContent = 'This is the modified paragraph content';
    
    const mockOriginalParagraph = {
      content: originalContent
    };
    
    const mockExistingParagraph = {
      id: paragraphId,
      content: modifiedContent,
      orderIndex: 1,
      pageId: 'page-1',
      audioS3Key: null,
      audioStatus: 'PENDING',
      audioDuration: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      originalParagraph: mockOriginalParagraph,
      page: {
        bookId: 'book-1',
        book: {
          id: 'book-1',
          title: 'Test Book'
        }
      }
    };
    
    const mockUpdatedParagraph = {
      ...mockExistingParagraph,
      content: originalContent,
      updatedAt: new Date(),
      page: {
        ...mockExistingParagraph.page,
        bookId: 'book-1'
      }
    };
    
    const mockTextChanges = [{
      id: 'change-1',
      originalWord: 'modified',
      correctedWord: 'original',
      fixType: 'REVERT',
      sentenceContext: originalContent,
      paragraphId: paragraphId,
      bookId: 'book-1',
      createdAt: new Date(),
      updatedAt: new Date()
    }];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully revert paragraph to original content', async () => {
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue(mockTextChanges);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      const result = await service.revertParagraph(paragraphId, false);

      expect(prismaService.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: paragraphId },
        include: {
          originalParagraph: { select: { content: true } },
          page: { include: { book: true } }
        }
      });
      
      // Verify that text correction processing is NOT called for revert
      expect(textFixesService.processParagraphUpdate).not.toHaveBeenCalled();
      
      // Verify that text corrections are cleared
      expect(prismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: { paragraphId }
      });
      
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { content: originalContent },
        include: {
          page: {
            include: {
              book: true,
            },
          },
          originalParagraph: {
            select: {
              content: true,
            },
          },
          // textCorrections removed after deletion
        }
      });
      
      expect(queueService.addAudioGenerationJob).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...mockUpdatedParagraph,
        originalContent: originalContent,
        textChanges: [], // Empty array for revert
        textFixes: [], // Empty array after deletion
        bulkSuggestions: []
      });
    });

    it('should revert paragraph and queue audio generation when requested', async () => {
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue(mockTextChanges);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      const result = await service.revertParagraph(paragraphId, true);

      expect(queueService.addAudioGenerationJob).toHaveBeenCalledWith({
        paragraphId: paragraphId,
        bookId: 'book-1',
        content: originalContent
      });
      
      // Verify that text correction processing is NOT called for revert
      expect(textFixesService.processParagraphUpdate).not.toHaveBeenCalled();
      
      // Verify that text corrections are cleared
      expect(prismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: { paragraphId }
      });
      
      expect(result).toEqual({
        ...mockUpdatedParagraph,
        originalContent: originalContent,
        textChanges: [], // Empty array for revert
        textFixes: [], // Empty array after deletion
        bulkSuggestions: []
      });
    });

    it('should throw error when paragraph not found', async () => {
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.revertParagraph(paragraphId, false))
        .rejects
        .toThrow(`Paragraph not found with ID: ${paragraphId}`);
        
      expect(textFixesService.processParagraphUpdate).not.toHaveBeenCalled();
      expect(prismaService.paragraph.update).not.toHaveBeenCalled();
      expect(queueService.addAudioGenerationJob).not.toHaveBeenCalled();
    });

    it('should throw error when original content not available', async () => {
      const paragraphWithoutOriginal = {
        ...mockExistingParagraph,
        originalParagraph: null
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithoutOriginal);

      await expect(service.revertParagraph(paragraphId, false))
        .rejects
        .toThrow(`No original content available for paragraph: ${paragraphId}`);
        
      expect(textFixesService.processParagraphUpdate).not.toHaveBeenCalled();
      expect(prismaService.paragraph.update).not.toHaveBeenCalled();
    });

    it('should throw error when original content is empty', async () => {
      const paragraphWithEmptyOriginal = {
        ...mockExistingParagraph,
        originalParagraph: { content: '' }
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithEmptyOriginal);

      await expect(service.revertParagraph(paragraphId, false))
        .rejects
        .toThrow(`No original content available for paragraph: ${paragraphId}`);
    });

    it('should still clear text corrections when content is already at original state', async () => {
      const paragraphAlreadyOriginal = {
        ...mockExistingParagraph,
        content: originalContent // Same as original
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphAlreadyOriginal);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      const result = await service.revertParagraph(paragraphId, false);

      // CRITICAL: Even when content is already original, we must still clear text corrections
      expect(prismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: { paragraphId }
      });
      expect(prismaService.paragraph.update).toHaveBeenCalled();
      
      expect(result).toEqual({
        ...mockUpdatedParagraph,
        originalContent: originalContent,
        textChanges: [],
        textFixes: [], // Empty array after deletion
        bulkSuggestions: []
      });
      
      expect(textFixesService.processParagraphUpdate).not.toHaveBeenCalled();
      expect(queueService.addAudioGenerationJob).not.toHaveBeenCalled();
    });

    it('should handle database update errors gracefully', async () => {
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.paragraph.update as jest.Mock).mockRejectedValue(
        new Error('Database update failed')
      );

      await expect(service.revertParagraph(paragraphId, false))
        .rejects
        .toThrow('Database update failed');
        
      expect(queueService.addAudioGenerationJob).not.toHaveBeenCalled();
    });

    it('should handle queue service errors gracefully when audio generation requested', async () => {
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);
      (queueService.addAudioGenerationJob as jest.Mock).mockRejectedValue(
        new Error('Queue service error')
      );

      await expect(service.revertParagraph(paragraphId, true))
        .rejects
        .toThrow('Queue service error');
    });

    it('should handle paragraphs with special characters and unicode', async () => {
      const unicodeOriginal = 'שלום עולם! This is a test with émojis 🎉 and numbers 123.';
      const unicodeModified = 'שלום עולם! This is a modified test with émojis 🎉 and numbers 456.';
      
      const unicodeParagraph = {
        ...mockExistingParagraph,
        content: unicodeModified,
        originalParagraph: { content: unicodeOriginal }
      };
      
      const unicodeUpdated = {
        ...unicodeParagraph,
        content: unicodeOriginal
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(unicodeParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 4 });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(unicodeUpdated);

      const result = await service.revertParagraph(paragraphId, false);

      // Verify that text correction processing is NOT called for revert
      expect(textFixesService.processParagraphUpdate).not.toHaveBeenCalled();
      
      // Verify that text corrections are cleared
      expect(prismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: { paragraphId }
      });
      
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { content: unicodeOriginal },
        include: {
          page: {
            include: {
              book: true,
            },
          },
          originalParagraph: {
            select: {
              content: true,
            },
          },
          // textCorrections removed after deletion
        }
      });
      
      expect(result.content).toBe(unicodeOriginal);
    });
  });

  describe('Enhanced Revert Logic Tests', () => {
    const paragraphId = 'test-paragraph-id';
    const originalContent = 'This is the original paragraph content';
    const modifiedContent = 'This is the modified paragraph content';
    
    const mockExistingParagraph = {
      id: paragraphId,
      content: modifiedContent,
      orderIndex: 1,
      pageId: 'page-1',
      audioS3Key: null,
      audioStatus: 'PENDING',
      audioDuration: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      originalParagraph: {
        content: originalContent
      },
      page: {
        bookId: 'book-1',
        book: {
          id: 'book-1',
          title: 'Test Book'
        }
      }
    };
    
    const mockUpdatedParagraph = {
      ...mockExistingParagraph,
      content: originalContent,
      textCorrections: [],
      page: {
        ...mockExistingParagraph.page,
        bookId: 'book-1'
      }
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should NOT call textFixesService.processParagraphUpdate on revert', async () => {
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      await service.revertParagraph(paragraphId, false);

      // Critical test: textFixesService.processParagraphUpdate should NOT be called
      expect(textFixesService.processParagraphUpdate).not.toHaveBeenCalled();
    });

    it('should clear all text correction records when reverting', async () => {
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      await service.revertParagraph(paragraphId, false);

      // Verify text corrections are cleared
      expect(prismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: { paragraphId }
      });
    });

    it('should log the number of cleared text correction records', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      const deletedCount = 7;
      
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: deletedCount });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      await service.revertParagraph(paragraphId, false);

      // Verify logging
      expect(logSpy).toHaveBeenCalledWith(
        `Cleared ${deletedCount} text correction records for paragraph ${paragraphId}`
      );
    });

    it('should return empty textChanges array for revert action', async () => {
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      const result = await service.revertParagraph(paragraphId, false);

      // Verify empty textChanges (no corrections recorded for revert)
      expect(result.textChanges).toEqual([]);
    });

    it('should clear corrections even when zero records exist', async () => {
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      await service.revertParagraph(paragraphId, false);

      // Should still attempt to clear corrections
      expect(prismaService.textCorrection.deleteMany).toHaveBeenCalledWith({
        where: { paragraphId }
      });
    });

    it('should set audioGeneratedAt when reverting with audio generation', async () => {
      const mockDate = new Date('2025-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (prismaService.textCorrection.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.paragraph.update as jest.Mock)
        .mockResolvedValueOnce(mockUpdatedParagraph) // First call for content update
        .mockResolvedValueOnce({ ...mockUpdatedParagraph, audioGeneratedAt: mockDate }); // Second call for timestamp

      await service.revertParagraph(paragraphId, true);

      // Verify audioGeneratedAt is set when generating audio
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { audioGeneratedAt: mockDate }
      });
      
      // Verify audio generation is queued
      expect(queueService.addAudioGenerationJob).toHaveBeenCalledWith({
        paragraphId: mockUpdatedParagraph.id,
        bookId: mockUpdatedParagraph.page.bookId,
        content: mockUpdatedParagraph.content
      });
      
      jest.restoreAllMocks();
    });
  });

  describe('Audio Timestamp Logic Tests', () => {
    const paragraphId = 'test-paragraph-id';
    const originalContent = 'Original paragraph content';
    const newContent = 'Updated paragraph content';
    
    const mockExistingParagraph = {
      id: paragraphId,
      content: originalContent,
      orderIndex: 1,
      pageId: 'page-1',
      audioS3Key: null,
      audioStatus: 'PENDING',
      audioDuration: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const mockUpdatedParagraph = {
      ...mockExistingParagraph,
      content: newContent,
      page: {
        bookId: 'book-1',
        book: {
          id: 'book-1',
          title: 'Test Book'
        }
      },
      originalParagraph: {
        content: originalContent
      },
      textCorrections: []
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should set audioGeneratedAt when updating paragraph with audio generation', async () => {
      const mockDate = new Date('2025-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue([]);
      (bulkTextFixesService.findSimilarFixesInBook as jest.Mock).mockResolvedValue([]);
      (prismaService.paragraph.update as jest.Mock)
        .mockResolvedValueOnce(mockUpdatedParagraph) // First call for content update
        .mockResolvedValueOnce({ ...mockUpdatedParagraph, audioGeneratedAt: mockDate }); // Second call for timestamp

      await service.updateParagraph(paragraphId, newContent, true, true);

      // Verify audioGeneratedAt is set when generating audio
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { audioGeneratedAt: mockDate }
      });
      
      // Verify audio generation is queued
      expect(queueService.addAudioGenerationJob).toHaveBeenCalledWith({
        paragraphId: mockUpdatedParagraph.id,
        bookId: mockUpdatedParagraph.page.bookId,
        content: mockUpdatedParagraph.content
      });
      
      jest.restoreAllMocks();
    });

    it('should NOT set audioGeneratedAt when updating paragraph without audio generation', async () => {
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockExistingParagraph);
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue([]);
      (bulkTextFixesService.findSimilarFixesInBook as jest.Mock).mockResolvedValue([]);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(mockUpdatedParagraph);

      await service.updateParagraph(paragraphId, newContent, false, true);

      // Verify audioGeneratedAt is NOT set when not generating audio
      expect(prismaService.paragraph.update).toHaveBeenCalledTimes(1);
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { content: newContent },
        include: expect.any(Object)
      });
      
      // Verify audio generation is NOT queued
      expect(queueService.addAudioGenerationJob).not.toHaveBeenCalled();
    });

    it('should preserve existing audioGeneratedAt when updating without audio generation', async () => {
      const existingTimestamp = new Date('2024-12-01T10:00:00Z');
      const paragraphWithAudio = {
        ...mockExistingParagraph,
        audioGeneratedAt: existingTimestamp,
        audioS3Key: 'audio/test.mp3',
        audioStatus: 'READY'
      };
      
      const updatedWithPreservedTimestamp = {
        ...mockUpdatedParagraph,
        audioGeneratedAt: existingTimestamp
      };
      
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithAudio);
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue([]);
      (bulkTextFixesService.findSimilarFixesInBook as jest.Mock).mockResolvedValue([]);
      (prismaService.paragraph.update as jest.Mock).mockResolvedValue(updatedWithPreservedTimestamp);

      await service.updateParagraph(paragraphId, newContent, false, true);

      // Verify existing audioGeneratedAt is preserved in the returned paragraph
      // The DTO doesn't include audioGeneratedAt, but we can verify the mock was called correctly
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { content: newContent },
        include: expect.any(Object)
      });
      
      // Verify only content update was called (no timestamp update)
      expect(prismaService.paragraph.update).toHaveBeenCalledTimes(1);
    });

    it('should update audioGeneratedAt when regenerating audio for existing audio paragraph', async () => {
      const oldTimestamp = new Date('2024-12-01T10:00:00Z');
      const newTimestamp = new Date('2025-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => newTimestamp as any);
      
      const paragraphWithOldAudio = {
        ...mockExistingParagraph,
        audioGeneratedAt: oldTimestamp,
        audioS3Key: 'audio/test.mp3',
        audioStatus: 'READY'
      };
      
      // Setup mocks
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithOldAudio);
      (textFixesService.processParagraphUpdate as jest.Mock).mockResolvedValue([]);
      (bulkTextFixesService.findSimilarFixesInBook as jest.Mock).mockResolvedValue([]);
      (prismaService.paragraph.update as jest.Mock)
        .mockResolvedValueOnce(mockUpdatedParagraph)
        .mockResolvedValueOnce({ ...mockUpdatedParagraph, audioGeneratedAt: newTimestamp });

      await service.updateParagraph(paragraphId, newContent, true, true);

      // Verify audioGeneratedAt is updated to new timestamp
      expect(prismaService.paragraph.update).toHaveBeenCalledWith({
        where: { id: paragraphId },
        data: { audioGeneratedAt: newTimestamp }
      });
      
      jest.restoreAllMocks();
    });
  });

  describe('getParagraphDiff', () => {
    const paragraphId = 'test-paragraph-id';
    const originalContent = 'This is the original text from the book.';
    const currentContent = 'This is the modified text from the book.';
    
    const mockParagraph = {
      id: paragraphId,
      content: currentContent,
      originalParagraph: {
        content: originalContent
      }
    };

    const mockWordChanges = [
      {
        originalWord: 'original',
        correctedWord: 'modified',
        position: 3,
        fixType: 'word_replacement'
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully return diff data for a paragraph with changes', async () => {
      // Arrange
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockParagraph);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(mockWordChanges);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert
      expect(prismaService.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: paragraphId },
        select: {
          id: true,
          content: true,
          orderIndex: true,
          originalParagraphId: true,
          originalParagraph: {
            select: {
              id: true,
              content: true,
            },
          },
          page: {
            select: {
              id: true,
              pageNumber: true,
            },
          },
        },
      });

      expect(textFixesService.analyzeTextChanges).toHaveBeenCalledWith(
        originalContent,
        currentContent
      );

      expect(result).toEqual({
        changes: mockWordChanges,
        originalContent,
        currentContent,
        tokenDiff: expect.any(Array), // New tokenDiff field
      });
    });

    it('should return empty changes array when content is identical', async () => {
      // Arrange
      const identicalContent = 'Same content in both versions.';
      const paragraphWithSameContent = {
        ...mockParagraph,
        content: identicalContent,
        originalParagraph: {
          content: identicalContent
        }
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithSameContent);
      // Note: We don't mock textFixesService.analyzeTextChanges because it shouldn't be called

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert - textFixesService should NOT be called for identical content (optimization)
      expect(textFixesService.analyzeTextChanges).not.toHaveBeenCalled();

      expect(result).toEqual({
        changes: [],
        originalContent: identicalContent,
        currentContent: identicalContent,
        tokenDiff: [], // Empty array for identical content
      });
    });

    it('should correctly handle Hebrew text with duplicate words and deletions', async () => {
      const paragraphId = 'test-paragraph-hebrew';
      const originalContent = 'אנשים צועקים כל העת שהם רוצים ליצור עתיד טוב יותר. העתיד הוא תהום חסרת עניין. העבר לעומתו מלא חיים, מתגרה בנו בלי די, מאתגר ומעליב. בה בעת, מפתה אותנו לשנות או להרוס אותו. הסיבה היחידה שאנשים רוצים להיות אדוני העתיד היא על מנת לשנות את העבר. - מילן קונדרה פרולוג';
      const currentContent = 'העתיד הוא תהום חסרת עניין. העבר לעומתו מלא חיים, מתגרה בנו בלי די, מאתגר ומעליב. בה בעת, מפתה אותנו לשנות או להרוס אותו. הסיבה היחידה שאנשים רוצים להיות אדוני העתיד היא על מנת לשנות את העבר. - מילן קונדרה פרולוג';

      // Mock the paragraph with original content
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue({
        id: paragraphId,
        content: currentContent,
        originalParagraph: {
          content: originalContent,
        },
      });

      // Mock empty changes (no word modifications, just deletions)
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue([]);

      const result = await service.getParagraphDiff(paragraphId);

      // Verify the result structure
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('originalContent', originalContent);
      expect(result).toHaveProperty('currentContent', currentContent);
      expect(result).toHaveProperty('tokenDiff');
      expect(Array.isArray(result.tokenDiff)).toBe(true);

      // Verify that the first occurrence of "רוצים" is marked as removed
      const tokenDiff = result.tokenDiff;
      const rotzimTokens = tokenDiff.filter(token => token.text === 'רוצים');
      
      // Should have two occurrences: one removed, one unchanged
      expect(rotzimTokens).toHaveLength(2);
      expect(rotzimTokens[0].type).toBe('removed'); // First occurrence should be removed
      expect(rotzimTokens[1].type).toBe('unchanged'); // Second occurrence should be unchanged

      // Verify that deleted sentence words are marked as removed
      const deletedWords = ['אנשים', 'צועקים', 'כל', 'העת', 'שהם', 'ליצור', 'עתיד', 'טוב', 'יותר.'];
      deletedWords.forEach(word => {
        const wordTokens = tokenDiff.filter(token => token.text === word);
        expect(wordTokens.length).toBeGreaterThan(0);
        expect(wordTokens[0].type).toBe('removed');
      });
    });

    it('should handle complex Hebrew text differences', async () => {
      // Arrange
      const hebrewOriginal = 'שלום עולם! זה טקסט בעברית.';
      const hebrewCurrent = 'שלום עולם! זה טקסט מתוקן בעברית.';
      const hebrewParagraph = {
        ...mockParagraph,
        content: hebrewCurrent,
        originalParagraph: {
          content: hebrewOriginal
        }
      };
      
      const hebrewChanges = [
        {
          originalWord: 'טקסט',
          correctedWord: 'טקסט מתוקן',
          position: 2,
          fixType: 'word_addition'
        }
      ];
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(hebrewParagraph);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(hebrewChanges);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert
      expect(textFixesService.analyzeTextChanges).toHaveBeenCalledWith(
        hebrewOriginal,
        hebrewCurrent
      );

      expect(result.changes).toEqual(hebrewChanges);
      expect(result.originalContent).toBe(hebrewOriginal);
      expect(result.currentContent).toBe(hebrewCurrent);
    });

    it('should handle multiple word changes in a single paragraph', async () => {
      // Arrange
      const multiChangeOriginal = 'The quick brown fox jumps over the lazy dog.';
      const multiChangeCurrent = 'The fast red fox leaps over the sleepy cat.';
      const multiChangeParagraph = {
        ...mockParagraph,
        content: multiChangeCurrent,
        originalParagraph: {
          content: multiChangeOriginal
        }
      };
      
      const multipleChanges = [
        {
          originalWord: 'quick',
          correctedWord: 'fast',
          position: 1,
          fixType: 'word_replacement'
        },
        {
          originalWord: 'brown',
          correctedWord: 'red',
          position: 2,
          fixType: 'word_replacement'
        },
        {
          originalWord: 'jumps',
          correctedWord: 'leaps',
          position: 4,
          fixType: 'word_replacement'
        },
        {
          originalWord: 'lazy',
          correctedWord: 'sleepy',
          position: 7,
          fixType: 'word_replacement'
        },
        {
          originalWord: 'dog',
          correctedWord: 'cat',
          position: 8,
          fixType: 'word_replacement'
        }
      ];
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(multiChangeParagraph);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(multipleChanges);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert
      expect(result.changes).toHaveLength(5);
      expect(result.changes).toEqual(multipleChanges);
    });

    it('should throw error when paragraph is not found', async () => {
      // Arrange
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getParagraphDiff(paragraphId))
        .rejects
        .toThrow(`Paragraph not found with ID: ${paragraphId}`);

      expect(prismaService.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: paragraphId },
        select: {
          id: true,
          content: true,
          orderIndex: true,
          originalParagraphId: true,
          originalParagraph: {
            select: {
              id: true,
              content: true,
            },
          },
          page: {
            select: {
              id: true,
              pageNumber: true,
            },
          },
        },
      });

      expect(textFixesService.analyzeTextChanges).not.toHaveBeenCalled();
    });

    it('should throw error when original content is not available', async () => {
      // Arrange
      const paragraphWithoutOriginal = {
        ...mockParagraph,
        originalParagraph: null
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithoutOriginal);

      // Act & Assert
      await expect(service.getParagraphDiff(paragraphId))
        .rejects
        .toThrow(`No original content available for paragraph ${paragraphId}`);

      expect(textFixesService.analyzeTextChanges).not.toHaveBeenCalled();
    });

    it('should throw error when original content is empty', async () => {
      // Arrange
      const paragraphWithEmptyOriginal = {
        ...mockParagraph,
        originalParagraph: {
          content: null
        }
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithEmptyOriginal);

      // Act & Assert
      await expect(service.getParagraphDiff(paragraphId))
        .rejects
        .toThrow(`No original content available for paragraph ${paragraphId}`);

      expect(textFixesService.analyzeTextChanges).not.toHaveBeenCalled();
    });

    it('should handle edge case with empty current content', async () => {
      // Arrange
      const paragraphWithEmptyContent = {
        ...mockParagraph,
        content: ''
      };
      
      const deletionChanges = [
        {
          originalWord: 'This',
          correctedWord: '',
          position: 0,
          fixType: 'word_deletion'
        }
      ];
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithEmptyContent);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(deletionChanges);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert
      expect(textFixesService.analyzeTextChanges).toHaveBeenCalledWith(
        originalContent,
        ''
      );

      expect(result.currentContent).toBe('');
      expect(result.changes).toEqual(deletionChanges);
    });

    it('should generate accurate tokenDiff with proper token types', async () => {
      // Arrange - Test specific token types in diff
      const originalWithTypes = 'The quick brown fox jumps.';
      const currentWithTypes = 'The fast red fox leaps gracefully.';
      const paragraphWithTypes = {
        ...mockParagraph,
        content: currentWithTypes,
        originalParagraph: {
          content: originalWithTypes
        }
      };
      
      const typesChanges = [
        {
          originalWord: 'quick',
          correctedWord: 'fast',
          position: 1,
          fixType: 'word_replacement'
        },
        {
          originalWord: 'brown',
          correctedWord: 'red',
          position: 2,
          fixType: 'word_replacement'
        },
        {
          originalWord: 'jumps',
          correctedWord: 'leaps',
          position: 4,
          fixType: 'word_replacement'
        }
      ];
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithTypes);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(typesChanges);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert tokenDiff structure and types
      expect(result.tokenDiff).toBeDefined();
      expect(Array.isArray(result.tokenDiff)).toBe(true);
      
      // Check for different token types
      const tokenTypes = result.tokenDiff.map(token => token.type);
      expect(tokenTypes).toContain('unchanged'); // 'The', 'fox'
      expect(tokenTypes).toContain('removed'); // 'quick', 'brown', 'jumps'
      expect(tokenTypes).toContain('modified'); // 'fast', 'red', 'leaps'
      expect(tokenTypes).toContain('added'); // 'gracefully'
      
      // Verify specific token properties
      const unchangedTokens = result.tokenDiff.filter(t => t.type === 'unchanged');
      expect(unchangedTokens.length).toBeGreaterThan(0);
      unchangedTokens.forEach(token => {
        expect(token).toHaveProperty('text');
        expect(token).toHaveProperty('startPos');
        expect(token).toHaveProperty('endPos');
        expect(token.startPos).toBeLessThan(token.endPos);
      });
      
      const modifiedTokens = result.tokenDiff.filter(t => t.type === 'modified');
      modifiedTokens.forEach(token => {
        expect(token).toHaveProperty('originalText');
        expect(token).toHaveProperty('fixType');
        expect(token).toHaveProperty('changeId');
      });
    });

    it('should handle whitespace and punctuation correctly in tokenDiff', async () => {
      // Arrange - Test whitespace handling
      const originalWithSpaces = 'Hello,   world!   How are you?';
      const currentWithSpaces = 'Hi, world! How are you doing?';
      const paragraphWithSpaces = {
        ...mockParagraph,
        content: currentWithSpaces,
        originalParagraph: {
          content: originalWithSpaces
        }
      };
      
      const spacesChanges = [
        {
          originalWord: 'Hello,',
          correctedWord: 'Hi,',
          position: 0,
          fixType: 'word_replacement'
        }
      ];
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(paragraphWithSpaces);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(spacesChanges);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert whitespace preservation
      const whitespaceTokens = result.tokenDiff.filter(token => /^\s+$/.test(token.text));
      expect(whitespaceTokens.length).toBeGreaterThan(0);
      
      // Verify whitespace tokens have proper positions
      whitespaceTokens.forEach(token => {
        expect(token.startPos).toBeLessThan(token.endPos);
        expect(token.endPos - token.startPos).toBe(token.text.length);
      });
    });

    it('should handle edge content scenarios', async () => {
      // Test scenario: content to empty (valid original content exists)
      const contentToEmpty = {
        original: 'Content to be removed',
        current: '',
        description: 'content to empty'
      };
      
      const emptyCurrentParagraph = {
        ...mockParagraph,
        content: contentToEmpty.current,
        originalParagraph: {
          content: contentToEmpty.original
        }
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(emptyCurrentParagraph);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue([]);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert
      expect(result.tokenDiff).toBeDefined();
      expect(Array.isArray(result.tokenDiff)).toBe(true);
      expect(result.tokenDiff.length).toBeGreaterThan(0); // Should have removed tokens
      
      // Verify all tokens are marked as removed
      const removedTokens = result.tokenDiff.filter(token => token.type === 'removed');
      expect(removedTokens.length).toBeGreaterThan(0);
    });

    it('should throw error for missing original content', async () => {
      // Test scenarios where original content is missing (should throw error)
      const missingOriginalScenarios = [
        {
          originalParagraph: null,
          description: 'no original paragraph'
        },
        {
          originalParagraph: { content: null },
          description: 'null original content'
        },
        {
          originalParagraph: { content: '' },
          description: 'empty original content'
        }
      ];
      
      for (const scenario of missingOriginalScenarios) {
        const invalidParagraph = {
          ...mockParagraph,
          content: 'Some current content',
          originalParagraph: scenario.originalParagraph
        };
        
        (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(invalidParagraph);

        // Act & Assert
        await expect(service.getParagraphDiff(paragraphId))
          .rejects
          .toThrow(`No original content available for paragraph ${paragraphId}`);
      }
    });

    it('should handle special characters and Unicode correctly', async () => {
      // Arrange - Test Unicode and special characters
      const originalUnicode = 'Café naïve résumé 🎉 emoji test ñ';
      const currentUnicode = 'Coffee naive resume 🎊 emoji test n';
      const unicodeParagraph = {
        ...mockParagraph,
        content: currentUnicode,
        originalParagraph: {
          content: originalUnicode
        }
      };
      
      const unicodeChanges = [
        {
          originalWord: 'Café',
          correctedWord: 'Coffee',
          position: 0,
          fixType: 'word_replacement'
        },
        {
          originalWord: 'naïve',
          correctedWord: 'naive',
          position: 1,
          fixType: 'word_replacement'
        }
      ];
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(unicodeParagraph);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(unicodeChanges);

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert Unicode handling
      expect(result.tokenDiff).toBeDefined();
      const unicodeTokens = result.tokenDiff.filter(token => 
        /[\u00C0-\u017F\u1E00-\u1EFF\u0100-\u024F\uD83C-\uDBFF\uDC00-\uDFFF]/u.test(token.text)
      );
      expect(unicodeTokens.length).toBeGreaterThan(0);
      
      // Verify position calculations are correct for Unicode
      result.tokenDiff.forEach(token => {
        expect(token.startPos).toBeLessThan(token.endPos);
        expect(typeof token.startPos).toBe('number');
        expect(typeof token.endPos).toBe('number');
      });
    });

    it('should log appropriate messages during diff computation', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockParagraph);
      (textFixesService.analyzeTextChanges as jest.Mock).mockReturnValue(mockWordChanges);

      // Act
      await service.getParagraphDiff(paragraphId);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        `Found ${mockWordChanges.length} changes between original and current content for paragraph ${paragraphId}`
      );

      loggerSpy.mockRestore();
    });

    it('should return empty diff when content is identical', async () => {
      // Arrange - Test scenario after revert where content is identical
      const identicalContent = 'This content is exactly the same in both original and current.';
      const identicalParagraph = {
        ...mockParagraph,
        content: identicalContent,
        originalParagraph: {
          content: identicalContent
        }
      };
      
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(identicalParagraph);
      // Note: We don't need to mock textFixesService.analyzeTextChanges because it shouldn't be called

      // Act
      const result = await service.getParagraphDiff(paragraphId);

      // Assert
      expect(result.changes).toEqual([]);
      expect(result.tokenDiff).toEqual([]);
      expect(result.originalContent).toBe(identicalContent);
      expect(result.currentContent).toBe(identicalContent);
      
      // Verify that textFixesService.analyzeTextChanges was NOT called for identical content
      expect(textFixesService.analyzeTextChanges).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (prismaService.paragraph.findUnique as jest.Mock).mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.getParagraphDiff(paragraphId))
        .rejects
        .toThrow('Database connection failed');
    });

    it('should handle textFixesService throwing an error', async () => {
      // Arrange
      (prismaService.paragraph.findUnique as jest.Mock).mockResolvedValue(mockParagraph);
      (textFixesService.analyzeTextChanges as jest.Mock).mockImplementation(() => {
        throw new Error('Text analysis failed');
      });

      // Act & Assert
      await expect(service.getParagraphDiff(paragraphId))
        .rejects
        .toThrow('Text analysis failed');

      expect(textFixesService.analyzeTextChanges).toHaveBeenCalledWith(
        originalContent,
        currentContent
      );
    });
  });
});
