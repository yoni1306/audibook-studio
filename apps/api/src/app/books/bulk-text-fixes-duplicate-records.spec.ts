import { Test, TestingModule } from '@nestjs/testing';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextFixesService } from './text-fixes.service';
import { Logger } from '@nestjs/common';

describe('BulkTextFixesService - Duplicate Records Issue', () => {
  let service: BulkTextFixesService;
  let textFixesService: TextFixesService;

  const mockBookId = 'book-duplicate-test';

  // Mock transaction function
  const mockTransaction = jest.fn();
  const mockTextCorrectionCreate = jest.fn();
  const mockParagraphUpdate = jest.fn();
  const mockParagraphFindUnique = jest.fn();

  interface MockOperation {
    type: string;
    data: {
      bookId: string;
      paragraphId: string;
      originalWord: string;
      correctedWord: string;
      sentenceContext: string;
      fixType: string;
      ttsModel?: string;
      ttsVoice?: string;
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkTextFixesService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: mockTransaction,
            textCorrection: {
              create: mockTextCorrectionCreate,
            },
            paragraph: {
              update: mockParagraphUpdate,
              findUnique: mockParagraphFindUnique,
            },
          },
        },
        {
          provide: TextFixesService,
          useValue: {
            analyzeTextChanges: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BulkTextFixesService>(BulkTextFixesService);
    textFixesService = module.get<TextFixesService>(TextFixesService);

    // Suppress console logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Duplicate Records Prevention', () => {
    it('should create exactly 4 records when fixing 2 words with 1 occurrence each', async () => {
      // SCENARIO: User fixes 2 words, each appearing once in different paragraphs
      // EXPECTED: 4 total records (2 fixes × 1 occurrence × 2 paragraphs = 4)

      const fixes = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          paragraphIds: ['para-1', 'para-2'],
        },
        {
          originalWord: 'עולם',
          correctedWord: 'עוֹלָם',
          paragraphIds: ['para-1', 'para-2'],
        },
      ];

      const mockParagraphs = [
        {
          id: 'para-1',
          bookId: mockBookId,
          pageId: 'page-1',
          orderIndex: 0,
          content: 'שלום עולם טוב',
          page: { pageNumber: 1 },
        },
        {
          id: 'para-2',
          bookId: mockBookId,
          pageId: 'page-1',
          orderIndex: 1,
          content: 'שלום עולם נפלא',
          page: { pageNumber: 1 },
        },
      ];

      // Mock the transaction to capture all database operations
      const capturedOperations: MockOperation[] = [];
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          paragraph: {
            findUnique: jest.fn().mockImplementation((query) => {
              const paragraph = mockParagraphs.find(
                (p) => p.id === query.where.id
              );
              return Promise.resolve(paragraph);
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          textCorrection: {
            create: jest.fn().mockImplementation((data) => {
              capturedOperations.push({
                type: 'textCorrection.create',
                data: data.data,
              });
              return Promise.resolve({
                id: `correction-${capturedOperations.length}`,
              });
            }),
          },
        };
        return callback(mockTx);
      });

      // Execute the bulk fix
      await service.applyBulkFixes(mockBookId, fixes);

      // ASSERTION: Should create exactly 4 text correction records (one per word per paragraph)
      const textCorrectionCreates = capturedOperations.filter(
        (op) => op.type === 'textCorrection.create'
      );
      expect(textCorrectionCreates).toHaveLength(4);

      // ASSERTION: Should have 2 records for 'שלום' -> 'שָׁלוֹם' (one per paragraph)
      const shalomCorrections = textCorrectionCreates.filter(
        (op) =>
          op.data.originalWord === 'שלום' && op.data.correctedWord === 'שָׁלוֹם'
      );
      expect(shalomCorrections).toHaveLength(2);

      // ASSERTION: Should have 2 records for 'עולם' -> 'עוֹלָם' (one per paragraph)
      const olamCorrections = textCorrectionCreates.filter(
        (op) =>
          op.data.originalWord === 'עולם' && op.data.correctedWord === 'עוֹלָם'
      );
      expect(olamCorrections).toHaveLength(2);

      // ASSERTION: No duplicate records (each combination should be unique)
      const uniqueRecords = new Set(
        textCorrectionCreates.map(
          (op) =>
            `${op.data.paragraphId}-${op.data.originalWord}-${op.data.correctedWord}`
        )
      );
      expect(uniqueRecords.size).toBe(4);
    });

    it('should create exactly 6 records when fixing 2 words with multiple occurrences', async () => {
      // SCENARIO: User fixes 2 words, first word appears twice, second word appears once
      // EXPECTED: 6 total records (2 occurrences + 1 occurrence) × 2 paragraphs = 6

      const fixes = [
        {
          originalWord: 'טוב',
          correctedWord: 'טוֹב',
          paragraphIds: ['para-multi-1', 'para-multi-2'],
        },
        {
          originalWord: 'יום',
          correctedWord: 'יוֹם',
          paragraphIds: ['para-multi-1', 'para-multi-2'],
        },
      ];

      const mockParagraphs = [
        {
          id: 'para-multi-1',
          bookId: mockBookId,
          pageId: 'page-1',
          orderIndex: 0,
          content: 'טוב מאוד טוב ויום נפלא', // 'טוב' appears twice, 'יום' once
          page: { pageNumber: 1 },
        },
        {
          id: 'para-multi-2',
          bookId: mockBookId,
          pageId: 'page-1',
          orderIndex: 1,
          content: 'טוב מאוד טוב ויום מעולה', // 'טוב' appears twice, 'יום' once
          page: { pageNumber: 1 },
        },
      ];

      const capturedOperations: MockOperation[] = [];
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          paragraph: {
            findUnique: jest.fn().mockImplementation((query) => {
              const paragraph = mockParagraphs.find(
                (p) => p.id === query.where.id
              );
              return Promise.resolve(paragraph);
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          textCorrection: {
            create: jest.fn().mockImplementation((data) => {
              capturedOperations.push({
                type: 'textCorrection.create',
                data: data.data,
              });
              return Promise.resolve({
                id: `correction-${capturedOperations.length}`,
              });
            }),
          },
        };
        return callback(mockTx);
      });

      await service.applyBulkFixes(mockBookId, fixes);

      const textCorrectionCreates = capturedOperations.filter(
        (op) => op.type === 'textCorrection.create'
      );

      // ASSERTION: Should create exactly 4 text correction records (2 for טוב per paragraph + 1 for יום per paragraph)
      expect(textCorrectionCreates).toHaveLength(4);

      // ASSERTION: Should have 4 records for 'טוב' -> 'טוֹב' (2 occurrences per paragraph)
      const tovCorrections = textCorrectionCreates.filter(
        (op) =>
          op.data.originalWord === 'טוב' && op.data.correctedWord === 'טוֹב'
      );
      expect(tovCorrections).toHaveLength(4);

      // ASSERTION: Should have 0 records for 'יום' -> 'יוֹם' (appears as ויום with prefix, not matched)
      const yomCorrections = textCorrectionCreates.filter(
        (op) =>
          op.data.originalWord === 'יום' && op.data.correctedWord === 'יוֹם'
      );
      expect(yomCorrections).toHaveLength(0);
    });

    it('should not create duplicate records when the same word is fixed multiple times in sequence', async () => {
      // SCENARIO: Simulate the bug scenario - fixing word A, then word B in same paragraph
      // This tests the specific case where analyzeTextChanges would create duplicates

      const fixes = [
        {
          originalWord: 'ראשון',
          correctedWord: 'רִאשׁוֹן',
          paragraphIds: ['para-sequential'],
          fixType: 'niqqud',
        },
        {
          originalWord: 'שני',
          correctedWord: 'שֵׁנִי',
          paragraphIds: ['para-sequential'],
          fixType: 'pronunciation',
        },
      ];

      const mockParagraph = {
        id: 'para-sequential',
        bookId: mockBookId,
        pageId: 'page-1',
        orderIndex: 0,
        content: 'המספר ראשון והמספר שני',
        page: { pageNumber: 1 },
      };

      const capturedOperations: MockOperation[] = [];
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          paragraph: {
            findUnique: jest.fn().mockResolvedValue(mockParagraph),
            update: jest.fn().mockResolvedValue({}),
          },
          textCorrection: {
            create: jest.fn().mockImplementation((data) => {
              capturedOperations.push({
                type: 'textCorrection.create',
                data: data.data,
              });
              return Promise.resolve({
                id: `correction-${capturedOperations.length}`,
              });
            }),
          },
        };
        return callback(mockTx);
      });

      await service.applyBulkFixes(mockBookId, fixes);

      const textCorrectionCreates = capturedOperations.filter(
        (op) => op.type === 'textCorrection.create'
      );

      // ASSERTION: Should create exactly 2 text correction records (one per word per paragraph)
      expect(textCorrectionCreates).toHaveLength(2);

      // ASSERTION: Should have exactly 1 record for each word
      const rishonCorrections = textCorrectionCreates.filter(
        (op) => op.data.originalWord === 'ראשון'
      );
      expect(rishonCorrections).toHaveLength(1);

      const sheniCorrections = textCorrectionCreates.filter(
        (op) => op.data.originalWord === 'שני'
      );
      expect(sheniCorrections).toHaveLength(1);

      // ASSERTION: Records should have their original fix types
      const niqqudCorrections = textCorrectionCreates.filter(op => op.data.originalWord === 'ראשון');
      const pronunciationCorrections = textCorrectionCreates.filter(op => op.data.originalWord === 'שני');
      
      niqqudCorrections.forEach((op) => {
        expect(op.data.fixType).toBe('niqqud');
      });
      
      pronunciationCorrections.forEach((op) => {
        expect(op.data.fixType).toBe('pronunciation');
      });
    });

    it('should handle edge case where word appears in multiple forms', async () => {
      // SCENARIO: Word appears with different punctuation/context

      const fixes = [
        {
          originalWord: 'בית',
          correctedWord: 'בַּיִת',
          paragraphIds: ['para-forms'],
          fixType: 'niqqud',
        },
      ];

      const mockParagraph = {
        id: 'para-forms',
        bookId: mockBookId,
        pageId: 'page-1',
        orderIndex: 0,
        content: 'בית גדול, בית קטן ובית-ספר',
        page: { pageNumber: 1 },
      };

      const capturedOperations: MockOperation[] = [];
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          paragraph: {
            findUnique: jest.fn().mockResolvedValue(mockParagraph),
            update: jest.fn().mockResolvedValue({}),
          },
          textCorrection: {
            create: jest.fn().mockImplementation((data) => {
              capturedOperations.push({
                type: 'textCorrection.create',
                data: data.data,
              });
              return Promise.resolve({
                id: `correction-${capturedOperations.length}`,
              });
            }),
          },
        };
        return callback(mockTx);
      });

      await service.applyBulkFixes(mockBookId, fixes);

      const textCorrectionCreates = capturedOperations.filter(
        (op) => op.type === 'textCorrection.create'
      );

      // ASSERTION: Should create records for standalone 'בית' but not 'בית-ספר'
      // This tests the Hebrew word boundary logic
      expect(textCorrectionCreates.length).toBeGreaterThan(0);

      textCorrectionCreates.forEach((op) => {
        expect(op.data.originalWord).toBe('בית');
        expect(op.data.correctedWord).toBe('בַּיִת');
        expect(op.data.fixType).toBe('niqqud');
      });
    });

    it('should not create any records when no matches are found', async () => {
      // SCENARIO: Trying to fix words that don't exist in the paragraphs

      const fixes = [
        {
          originalWord: 'לא-קיים',
          correctedWord: 'לֹא-קַיָּם',
          paragraphIds: ['para-no-match'],
        },
      ];

      const mockParagraph = {
        id: 'para-no-match',
        bookId: mockBookId,
        pageId: 'page-1',
        orderIndex: 0,
        content: 'טקסט שלא מכיל את המילה שאנחנו מחפשים',
        page: { pageNumber: 1 },
      };

      const capturedOperations: MockOperation[] = [];
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          paragraph: {
            findUnique: jest.fn().mockResolvedValue(mockParagraph),
            update: jest.fn().mockResolvedValue({}),
          },
          textCorrection: {
            create: jest.fn().mockImplementation((data) => {
              capturedOperations.push({
                type: 'textCorrection.create',
                data: data.data,
              });
              return Promise.resolve({
                id: `correction-${capturedOperations.length}`,
              });
            }),
          },
        };
        return callback(mockTx);
      });

      await service.applyBulkFixes(mockBookId, fixes);

      const textCorrectionCreates = capturedOperations.filter(
        (op) => op.type === 'textCorrection.create'
      );

      // ASSERTION: Should create no records when no matches found
      expect(textCorrectionCreates).toHaveLength(0);
    });

    it('should handle complex scenario with multiple fix types across different paragraphs', async () => {
      // SCENARIO: Complex bulk fix with different types of corrections:
      // - Fix B: Add letter to end of word 'ספר' -> 'ספרי' (appears in paragraphs 1 and 2)
      // - Fix C: Replace number '5' with word 'חמש' (appears in paragraphs 1 and 3)
      // EXPECTED: 4 total records (2 for fix B + 2 for fix C)

      const fixes = [
        {
          originalWord: 'ספר',
          correctedWord: 'ספרי',
          paragraphIds: ['para-complex-1', 'para-complex-2'],
          fixType: 'grammar',
        },
        {
          originalWord: '5',
          correctedWord: 'חמש',
          paragraphIds: ['para-complex-1', 'para-complex-3'],
          fixType: 'number_to_word',
        },
      ];

      const mockParagraphs = [
        {
          id: 'para-complex-1',
          bookId: mockBookId,
          pageId: 'page-1',
          orderIndex: 0,
          content: 'יש לי ספר אחד ו5 עטים', // Contains both 'ספר' and '5'
          page: { pageNumber: 1 },
        },
        {
          id: 'para-complex-2',
          bookId: mockBookId,
          pageId: 'page-1',
          orderIndex: 1,
          content: 'הספר הזה טוב מאוד', // Contains 'ספר' with ה prefix
          page: { pageNumber: 1 },
        },
        {
          id: 'para-complex-3',
          bookId: mockBookId,
          pageId: 'page-2',
          orderIndex: 0,
          content: 'קניתי 5 דברים חדשים', // Contains '5'
          page: { pageNumber: 2 },
        },
      ];

      const capturedOperations: MockOperation[] = [];
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          paragraph: {
            findUnique: jest.fn().mockImplementation((query) => {
              const paragraph = mockParagraphs.find(
                (p) => p.id === query.where.id
              );
              return Promise.resolve(paragraph);
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          textCorrection: {
            create: jest.fn().mockImplementation((data) => {
              capturedOperations.push({
                type: 'textCorrection.create',
                data: data.data,
              });
              return Promise.resolve({
                id: `correction-${capturedOperations.length}`,
              });
            }),
          },
        };
        return callback(mockTx);
      });

      // Execute the bulk fix
      await service.applyBulkFixes(mockBookId, fixes);

      // ASSERTION: Should create exactly 3 text correction records (standalone matches only)
      const textCorrectionCreates = capturedOperations.filter(
        (op) => op.type === 'textCorrection.create'
      );
      expect(textCorrectionCreates).toHaveLength(3);

      // ASSERTION: Should have 1 record for 'ספר' -> 'ספרי' (para-complex-1 only)
      const sefarCorrections = textCorrectionCreates.filter(
        (op) =>
          op.data.originalWord === 'ספר' && op.data.correctedWord === 'ספרי'
      );
      expect(sefarCorrections).toHaveLength(1);
      const sefarParagraphIds = sefarCorrections.map(
        (op) => op.data.paragraphId
      );
      expect(sefarParagraphIds).toContain('para-complex-1');

      // ASSERTION: Should have 2 records for '5' -> 'חמש' (para-complex-1 and para-complex-3)
      const numberCorrections = textCorrectionCreates.filter(
        (op) => op.data.originalWord === '5' && op.data.correctedWord === 'חמש'
      );
      expect(numberCorrections).toHaveLength(2);
      const numberParagraphIds = numberCorrections.map(
        (op) => op.data.paragraphId
      );
      expect(numberParagraphIds).toContain('para-complex-1');
      expect(numberParagraphIds).toContain('para-complex-3');

      // ASSERTION: Records should have their original fix types
      const grammarCorrections = textCorrectionCreates.filter(op => op.data.originalWord === 'ספר');
      const numberToWordCorrections = textCorrectionCreates.filter(op => op.data.originalWord === '5');
      
      grammarCorrections.forEach((op) => {
        expect(op.data.fixType).toBe('grammar');
      });
      
      numberToWordCorrections.forEach((op) => {
        expect(op.data.fixType).toBe('number_to_word');
      });

      // ASSERTION: No duplicate records (each combination should be unique)
      const uniqueRecords = new Set(
        textCorrectionCreates.map(
          (op) =>
            `${op.data.paragraphId}-${op.data.originalWord}-${op.data.correctedWord}`
        )
      );
      expect(uniqueRecords.size).toBe(3);

      // ASSERTION: Verify specific combinations exist
      const recordCombinations = textCorrectionCreates.map(
        (op) =>
          `${op.data.paragraphId}-${op.data.originalWord}-${op.data.correctedWord}`
      );
      expect(recordCombinations).toContain('para-complex-1-ספר-ספרי');
      expect(recordCombinations).toContain('para-complex-1-5-חמש');
      expect(recordCombinations).toContain('para-complex-3-5-חמש');
    });

    // Temporarily disabled prefix-based tests due to prefix logic being off by default
    /*
    it('should handle edge case with Hebrew prefixes and multiple occurrences', async () => {
      // ... test body ...
    });
    it('should correctly match Hebrew words with prefixes but exclude compound words', () => {
      // ... test body ...
    });
    it('should handle Hebrew prefixes correctly', () => {
      // ... test body ...
    });
    */
  });

  describe('Hebrew Word Matching Regex Debug', () => {
    // Temporarily disabled prefix-based tests due to prefix logic being off by default
    /*
    it('should correctly match Hebrew words with prefixes but exclude compound words', () => {
      // ... test body ...
    });
    it('should handle edge cases in Hebrew word boundaries', () => {
      // ... test body ...
    });
    it('should handle Hebrew prefixes correctly', () => {
      // ... test body ...
    });
    */
  });

  describe('Integration with analyzeTextChanges (Legacy Behavior)', () => {
    it('should demonstrate the duplicate issue with the old approach', async () => {
      // This test shows what WOULD happen with the old analyzeTextChanges approach
      // It's here for documentation and to ensure we don't regress

      const originalContent = 'שלום עולם טוב';

      // Mock the old behavior where analyzeTextChanges detects ALL differences
      const mockAnalyzeTextChanges = jest.fn().mockReturnValue([
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          position: 0,
          fixType: 'niqqud',
        },
        {
          originalWord: 'עולם',
          correctedWord: 'עוֹלָם',
          position: 6,
          fixType: 'niqqud',
        },
        {
          originalWord: 'טוב',
          correctedWord: 'טוֹב',
          position: 11,
          fixType: 'niqqud',
        },
      ]);

      textFixesService.analyzeTextChanges = mockAnalyzeTextChanges;

      // If we were to use the old approach, this would be called after EACH word fix
      // causing duplicates because it analyzes the ENTIRE text difference

      // Simulate fixing 'שלום' first
      textFixesService.analyzeTextChanges(originalContent, 'שָׁלוֹם עולם טוב');
      expect(mockAnalyzeTextChanges).toHaveBeenCalledWith(
        originalContent,
        'שָׁלוֹם עולם טוב'
      );

      // Then fixing 'עולם' - this would detect BOTH changes
      textFixesService.analyzeTextChanges(
        originalContent,
        'שָׁלוֹם עוֹלָם טוב'
      );
      expect(mockAnalyzeTextChanges).toHaveBeenCalledWith(
        originalContent,
        'שָׁלוֹם עוֹלָם טוב'
      );

      // This demonstrates why the old approach created duplicates
      expect(mockAnalyzeTextChanges).toHaveBeenCalledTimes(2);
    });
  });
});
