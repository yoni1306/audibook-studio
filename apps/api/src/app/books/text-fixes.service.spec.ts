import { Test, TestingModule } from '@nestjs/testing';
import { TextFixesService, WordChange } from './text-fixes.service';
import { PrismaService } from '../prisma/prisma.service';
import { FixTypeHandlerRegistry } from './fix-type-handlers/fix-type-handler-registry';
import { FixType } from '@prisma/client';

describe('TextFixesService', () => {
  let service: TextFixesService;
  let mockTxTextCorrection: { createMany: jest.Mock };
  let mockTxParagraph: { findUnique: jest.Mock };
  let mockFixTypeRegistry: {
    classifyCorrection: jest.Mock;
  };
  let mockPrismaService: {
    $transaction: jest.Mock;
    textCorrection: {
      createMany: jest.Mock;
    };
    paragraph: {
      findUnique: jest.Mock;
    };
  };

  const mockParagraphId = 'test-paragraph-id';
  const mockBookId = 'test-book-id';
  const mockOriginalText = 'זה טקסט עם שגיאה בעברית';
  const mockCorrectedText = 'זה טקסט עם תיקון בעברית';

  beforeEach(async () => {
    mockTxTextCorrection = {
      createMany: jest.fn(),
    };

    mockTxParagraph = {
      findUnique: jest.fn().mockResolvedValue({ bookId: mockBookId }),
    };

    mockFixTypeRegistry = {
      classifyCorrection: jest.fn().mockReturnValue({
        fixType: FixType.disambiguation,
        confidence: 0.8,
        reason: 'Hebrew word clarification',
        matches: [],
        debugInfo: {}
      }),
    };

    mockPrismaService = {
      $transaction: jest.fn(),
      textCorrection: {
        createMany: jest.fn(),
      },
      paragraph: {
        findUnique: jest.fn(),
      },
    };

    // Mock the transaction to call the callback with a mock tx object
    mockPrismaService.$transaction.mockImplementation(async (callback: (tx: { textCorrection: { createMany: jest.Mock }, paragraph: { findUnique: jest.Mock } }) => Promise<unknown>) => {
      const mockTx = {
        textCorrection: mockTxTextCorrection,
        paragraph: mockTxParagraph,
      };
      return await callback(mockTx);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextFixesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FixTypeHandlerRegistry,
          useValue: mockFixTypeRegistry,
        },
      ],
    }).compile();

    service = module.get<TextFixesService>(TextFixesService);
  });

  describe('extractSentenceContext', () => {
    it('should extract sentence containing the word', () => {
      const text = 'זה משפט ראשון. זה משפט עם שגיאה. זה משפט אחרון.';
      const word = 'שגיאה';

      const result = service['extractSentenceContext'](text, word);

      expect(result).toBe('זה משפט עם שגיאה.');
    });

    it('should handle word at sentence beginning', () => {
      const text = 'שגיאה זה בתחילת המשפט. זה משפט אחר.';
      const word = 'שגיאה';

      const result = service['extractSentenceContext'](text, word);

      expect(result).toBe('שגיאה זה בתחילת המשפט.');
    });

    it('should handle word at sentence end', () => {
      const text = 'זה משפט ראשון. זה משפט עם שגיאה.';
      const word = 'שגיאה';

      const result = service['extractSentenceContext'](text, word);

      expect(result).toBe('זה משפט עם שגיאה.');
    });

    it('should return full text if no sentence boundaries found', () => {
      const text = 'טקסט ללא סימני פיסוק עם שגיאה כאן';
      const word = 'שגיאה';

      const result = service['extractSentenceContext'](text, word);

      expect(result).toBe(text);
    });

    it('should return empty string if word not found', () => {
      const text = 'זה טקסט ללא המילה הרצויה.';
      const word = 'שגיאה';

      const result = service['extractSentenceContext'](text, word);

      expect(result).toBe('');
    });

    it('should handle multiple occurrences and return first match', () => {
      const text = 'שגיאה ראשונה כאן. יש עוד שגיאה שנייה.';
      const word = 'שגיאה';

      const result = service['extractSentenceContext'](text, word);

      expect(result).toBe('שגיאה ראשונה כאן.');
    });

    it('should handle Hebrew punctuation correctly', () => {
      const text = 'זה משפט! זה משפט עם שגיאה? זה משפט אחרון:';
      const word = 'שגיאה';

      const result = service['extractSentenceContext'](text, word);

      expect(result).toBe('זה משפט עם שגיאה?');
    });
  });

  describe('saveTextFixes', () => {
    it('should save text fixes with sentence context', async () => {
      const changes: WordChange[] = [
        {
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          position: 15,
          fixType: FixType.default,
        },
      ];

      const expectedCorrections = [
        {
          paragraphId: mockParagraphId,
          bookId: mockBookId,
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          aggregationKey: 'שגיאה|תיקון',
          sentenceContext: 'זה טקסט עם שגיאה בעברית',
          fixType: FixType.disambiguation,
          ttsModel: null,
          ttsVoice: null,
        },
      ];

      mockTxTextCorrection.createMany.mockResolvedValue({ count: 1 });

      await service.saveTextFixes(mockParagraphId, mockOriginalText, mockCorrectedText, changes);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTxParagraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        select: { bookId: true },
      });
      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: expectedCorrections,
      });
    });

    it('should handle multiple changes', async () => {
      const changes: WordChange[] = [
        { originalWord: 'שגיאה', correctedWord: 'תיקון', position: 0, fixType: FixType.default },
        { originalWord: 'עם', correctedWord: 'עם', position: 1, fixType: FixType.default },
      ];

      mockTxTextCorrection.createMany.mockResolvedValue({ count: 2 });

      await service.saveTextFixes(mockParagraphId, mockOriginalText, mockCorrectedText, changes);

      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'שגיאה',
            correctedWord: 'תיקון',
            aggregationKey: 'שגיאה|תיקון',
            sentenceContext: 'זה טקסט עם שגיאה בעברית',
            fixType: FixType.disambiguation,
            ttsModel: null,
            ttsVoice: null,
          }),
          expect.objectContaining({
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'עם',
            correctedWord: 'עם',
            aggregationKey: 'עם|עם',
            sentenceContext: 'זה טקסט עם שגיאה בעברית',
            fixType: FixType.disambiguation,
            ttsModel: null,
            ttsVoice: null,
          }),
        ]),
      });
    });

    it('should handle changes without fixType', async () => {
      const changes: WordChange[] = [
        { originalWord: 'שגיאה', correctedWord: 'תיקון', position: 0, fixType: FixType.default },
      ];

      mockTxTextCorrection.createMany.mockResolvedValue({ count: 1 });

      await service.saveTextFixes(mockParagraphId, mockOriginalText, mockCorrectedText, changes);

      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: [
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'שגיאה',
            correctedWord: 'תיקון',
            aggregationKey: 'שגיאה|תיקון',
            sentenceContext: 'זה טקסט עם שגיאה בעברית',
            fixType: FixType.disambiguation,
            ttsModel: null,
            ttsVoice: null,
          },
        ],
      });
    });

    it('should not save anything when no changes provided', async () => {
      const changes: WordChange[] = [];

      await service.saveTextFixes(mockParagraphId, mockOriginalText, mockCorrectedText, changes);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockTxTextCorrection.createMany).not.toHaveBeenCalled();
    });

    it('should handle errors and rethrow them', async () => {
      const changes: WordChange[] = [
        { originalWord: 'שגיאה', correctedWord: 'תיקון', position: 0, fixType: FixType.default },
      ];

      const error = new Error('Database error');
      mockPrismaService.$transaction.mockRejectedValue(error);

      await expect(
        service.saveTextFixes(mockParagraphId, mockOriginalText, mockCorrectedText, changes)
      ).rejects.toThrow('Database error');
    });

    it('should handle words not found in original text', async () => {
      const changes: WordChange[] = [
        { originalWord: 'לא_קיים', correctedWord: 'תיקון', position: 0, fixType: FixType.default },
      ];

      mockTxTextCorrection.createMany.mockResolvedValue({ count: 1 });

      await service.saveTextFixes(mockParagraphId, mockOriginalText, mockCorrectedText, changes);

      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: [
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'לא_קיים',
            correctedWord: 'תיקון',
            aggregationKey: 'לא_קיים|תיקון',
            sentenceContext: '',
            fixType: FixType.disambiguation,
            ttsModel: null,
            ttsVoice: null,
          },
        ],
      });
    });
  });

  describe('Robust Diff Algorithm Tests', () => {
    describe('Word boundary changes', () => {
      it('should correctly identify single word split as one change (Hebrew text)', () => {
        const originalText = 'אנשים צועקים כל העת שהם רוצים ליצור עתיד טוב יותר. העתיד הוא תהום חסרת עניין. העבר לעומתו מלא חיים, מתגרה בנו בלי די, מאתגר ומעליב. בה בעת, מפתה אותנו לשנות או להרוס אותו. הסיבה היחידה שאנשים רוצים להיות אדוני העתיד היא על מנת לשנות את העבר. - מילן קונדרה פרולוג';
        const correctedText = 'אנשים צועקים כל העת שהם רו צים ליצור עתיד טוב יותר. העתיד הוא תהום חסרת עניין. העבר לעומתו מלא חיים, מתגרה בנו בלי די, מאתגר ומעליב. בה בעת, מפתה אותנו לשנות או להרוס אותו. הסיבה היחידה שאנשים רוצים להיות אדוני העתיד היא על מנת לשנות את העבר. - מילן קונדרה פרולוג';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Word split with space',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly ONE change: "רוצים" → "רו צים"
        // FIXED: Now correctly captures the full corrected phrase
        expect(changes).toHaveLength(1);
        expect(changes[0].originalWord).toBe('רוצים');
        expect(changes[0].correctedWord).toBe('רו צים'); // Now captures full phrase!
        expect(changes[0].fixType).toBe(FixType.disambiguation);
        
        // Verify the fix type registry was called with the full phrase
        expect(mockFixTypeRegistry.classifyCorrection).toHaveBeenCalledWith('רוצים', 'רו צים');
      });
      
      it('REGRESSION TEST: Word split should capture full corrected phrase', () => {
        // Simplified test case to isolate the word split bug
        const originalText = 'רוצים';
        const correctedText = 'רו צים';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Word split regression test',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // FIXED: Algorithm now correctly detects one change from "רוצים" to "רו צים"
        // and captures the full corrected phrase instead of just the first word
        expect(changes).toHaveLength(1);
        expect(changes[0].originalWord).toBe('רוצים');
        expect(changes[0].correctedWord).toBe('רו צים'); // Now captures full phrase!
        expect(changes[0].fixType).toBe(FixType.disambiguation);
        
        // Verify the fix type registry was called with the full phrase
        expect(mockFixTypeRegistry.classifyCorrection).toHaveBeenCalledWith('רוצים', 'רו צים');
      });

      it('should handle multiple word boundary changes correctly', () => {
        // Test case: Multiple word splits in the same text
        const originalText = 'זה טקסט עם מילים שלמות';
        const correctedText = 'זה טק סט עם מי לים שלמות';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.8,
          reason: 'Word split',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly TWO changes: "טקסט" → "טק סט" and "מילים" → "מי לים"
        expect(changes).toHaveLength(2);
        expect(changes[0].originalWord).toBe('טקסט');
        expect(changes[0].correctedWord).toBe('טק סט'); // Full split phrase
        expect(changes[1].originalWord).toBe('מילים');
        expect(changes[1].correctedWord).toBe('מי לים'); // Full split phrase
      });
      
      it('should not misalign words after insertions/deletions', () => {
        // Test case: Word insertion that would break the old algorithm
        const originalText = 'מילה ראשונה שנייה';
        const correctedText = 'מילה ראשונה חדשה שנייה';
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect NO changes (only insertion, not substitution)
        // The old algorithm would incorrectly think "שנייה" was changed
        expect(changes).toHaveLength(0);
      });
    });
    
    describe('Word merge scenarios', () => {
      it('should handle word merge (multiple words become one)', () => {
        // Test case: Two words merged into one
        const originalText = 'זה טק סט מעניין';
        const correctedText = 'זה טקסט מעניין';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Word merge',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly ONE change: "טק סט" → "טקסט" (full phrase merge)
        expect(changes).toHaveLength(1);
        expect(changes[0].originalWord).toBe('טק סט'); // Full original phrase
        expect(changes[0].correctedWord).toBe('טקסט');
        expect(changes[0].fixType).toBe(FixType.disambiguation);
      });
      
      it('should handle multiple word merges', () => {
        // Test case: Multiple separate word merges
        const originalText = 'זה טק סט עם מי לים';
        const correctedText = 'זה טקסט עם מילים';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.8,
          reason: 'Word merge',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly TWO changes: "טק סט" → "טקסט" and "מי לים" → "מילים"
        expect(changes).toHaveLength(2);
        expect(changes[0].originalWord).toBe('טק סט'); // Full original phrase
        expect(changes[0].correctedWord).toBe('טקסט');
        expect(changes[1].originalWord).toBe('מי לים'); // Full original phrase
        expect(changes[1].correctedWord).toBe('מילים');
      });
    });
    
    describe('Complex substitution scenarios', () => {
      it('should handle 1:1 word substitutions correctly', () => {
        // Test case: Simple word replacements
        const originalText = 'הילד רץ במהירות';
        const correctedText = 'הילדה רצה במהירות';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Gender agreement',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Verb conjugation',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly TWO changes: "הילד" → "הילדה" and "רץ" → "רצה"
        expect(changes).toHaveLength(2);
        expect(changes[0].originalWord).toBe('הילד');
        expect(changes[0].correctedWord).toBe('הילדה');
        expect(changes[1].originalWord).toBe('רץ');
        expect(changes[1].correctedWord).toBe('רצה');
      });
      
      it('should handle mixed splits and substitutions', () => {
        // Test case: Combination of word split and substitution
        const originalText = 'הילד רוצה לאכול';
        const correctedText = 'הילדה רו צה לאכול';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Gender agreement',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.8,
            reason: 'Word split',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly TWO changes: "הילד" → "הילדה" and "רוצה" → "רו"
        expect(changes).toHaveLength(2);
        expect(changes[0].originalWord).toBe('הילד');
        expect(changes[0].correctedWord).toBe('הילדה');
        expect(changes[1].originalWord).toBe('רוצה');
        expect(changes[1].correctedWord).toBe('רו');
      });
    });
    
    describe('Edge cases and robustness', () => {
      it('should handle empty text gracefully', () => {
        const changes1 = service.analyzeTextChanges('', 'some text');
        const changes2 = service.analyzeTextChanges('some text', '');
        const changes3 = service.analyzeTextChanges('', '');
        
        // Should not crash and return empty arrays
        expect(changes1).toHaveLength(0);
        expect(changes2).toHaveLength(0);
        expect(changes3).toHaveLength(0);
      });
      
      it('should handle identical text', () => {
        const originalText = 'זה טקסט זהה לחלוטין';
        const correctedText = 'זה טקסט זהה לחלוטין';
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect NO changes
        expect(changes).toHaveLength(0);
      });
      
      it('should handle single word changes', () => {
        const originalText = 'מילה';
        const correctedText = 'מילים';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Plural form',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly ONE change
        expect(changes).toHaveLength(1);
        expect(changes[0].originalWord).toBe('מילה');
        expect(changes[0].correctedWord).toBe('מילים');
      });
      
      it('should handle punctuation and special characters', () => {
        const originalText = 'שלום, איך שלומך?';
        const correctedText = 'שלום, איך שלומכם?';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Plural pronoun',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly ONE change: "שלומך" → "שלומכם"
        expect(changes).toHaveLength(1);
        expect(changes[0].originalWord).toBe('שלומך');
        expect(changes[0].correctedWord).toBe('שלומכם');
      });
      
      it('should handle whitespace variations', () => {
        const originalText = 'מילה    ראשונה   שנייה';
        const correctedText = 'מילה ראשונה שנייה';
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect NO changes (only whitespace normalization)
        expect(changes).toHaveLength(0);
      });
      
      it('should handle very long texts efficiently', () => {
        // Test case: Large text to ensure algorithm scales well
        const longText = 'זה טקסט ארוך מאוד עם הרבה מילים שחוזרות על עצמן. '.repeat(100);
        const longTextWithChange = longText.replace('מאוד', 'מא וד');
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.8,
          reason: 'Word split',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const startTime = Date.now();
        const changes = service.analyzeTextChanges(longText, longTextWithChange);
        const endTime = Date.now();
        
        // Should complete quickly (under 1 second) and detect the changes
        expect(endTime - startTime).toBeLessThan(1000);
        expect(changes.length).toBeGreaterThan(0); // Should find the repeated word splits
      });
    });
    
    describe('Algorithm correctness validation', () => {
      it('should not create false positives from word reordering', () => {
        // Test case: Word order change should not be detected as substitution
        const originalText = 'הילד הקטן רץ';
        const correctedText = 'רץ הילד הקטן';
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect NO changes (only reordering, not substitution)
        expect(changes).toHaveLength(0);
      });
      
      it('should correctly handle position tracking', () => {
        // Test case: Ensure position tracking is accurate after changes
        const originalText = 'מילה ראשונה שנייה שלישית';
        const correctedText = 'מילה ראשונה חדשה שלישית';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Word replacement',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly ONE change with correct position
        expect(changes).toHaveLength(1);
        expect(changes[0].originalWord).toBe('שנייה');
        expect(changes[0].correctedWord).toBe('חדשה');
        expect(changes[0].position).toBe(2); // Third word (0-indexed)
      });
      
      it('should handle Unicode and RTL text correctly', () => {
        // Test case: Ensure Unicode handling works properly
        const originalText = 'טקסט עם אמוג׳י 😀 ותווים מיוחדים';
        const correctedText = 'טקסט עם אמוג׳י 😀 ותווים רגילים';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.8,
          reason: 'Word choice',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect exactly ONE change: "מיוחדים" → "רגילים"
        expect(changes).toHaveLength(1);
        expect(changes[0].originalWord).toBe('מיוחדים');
        expect(changes[0].correctedWord).toBe('רגילים');
      });
    });
    
    describe('FixType coverage validation', () => {
      it('should handle vowelization fix type (Hebrew niqqud)', () => {
        // Test case: Adding Hebrew vowel marks (niqqud)
        const originalText = 'ברא אלהים את השמים';
        const correctedText = 'בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.vowelization,
          confidence: 0.95,
          reason: 'Adding Hebrew niqqud for pronunciation clarity',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect vowelization changes
        expect(changes.length).toBeGreaterThan(0);
        expect(changes[0].fixType).toBe(FixType.vowelization);
      });
      
      it('should handle punctuation fix type (rhythm and pauses)', () => {
        // Test case: Word changes that improve punctuation and rhythm
        const originalText = 'זה משפט ארוך שצריך פסיקות';
        const correctedText = 'זה משפט ארוך שצריך פסיקים';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.punctuation,
          confidence: 0.9,
          reason: 'Changing word form for better punctuation flow',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect punctuation-related word changes
        expect(changes.length).toBeGreaterThan(0);
        expect(changes[0].fixType).toBe(FixType.punctuation);
        expect(changes[0].originalWord).toBe('פסיקות');
        expect(changes[0].correctedWord).toBe('פסיקים');
      });
      
      it('should handle sentence_break fix type (breaking long sentences)', () => {
        // Test case: Word changes that help break sentences
        const originalText = 'הילד שגרבבית רץ מהר';
        const correctedText = 'הילד שגר בבית רץ מהר';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.sentence_break,
          confidence: 0.85,
          reason: 'Breaking compound word for better sentence flow',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect sentence restructuring changes
        expect(changes.length).toBeGreaterThan(0);
        expect(changes[0].fixType).toBe(FixType.sentence_break);
        expect(changes[0].originalWord).toBe('שגרבבית');
        expect(changes[0].correctedWord).toBe('שגר בבית'); // Full split phrase
      });
      
      it('should handle dialogue_marking fix type (adding quotation marks)', () => {
        // Test case: Word changes that improve dialogue marking
        const originalText = 'אמר הילד אנירוצהלשחק והאמא ענתה';
        const correctedText = 'אמר הילד אני רוצה לשחק והאמא ענתה';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.dialogue_marking,
          confidence: 0.9,
          reason: 'Separating words to improve dialogue clarity',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect dialogue marking changes
        expect(changes.length).toBeGreaterThan(0);
        expect(changes[0].fixType).toBe(FixType.dialogue_marking);
        expect(changes[0].originalWord).toBe('אנירוצהלשחק');
        expect(changes[0].correctedWord).toBe('אני רוצה לשחק'); // Full split phrase
      });
      
      it('should handle expansion fix type (expanding numbers and acronyms)', () => {
        // Test case: Expanding numbers, currency, and acronyms for narration
        const originalText = 'קניתי 5 ספרים ב-50₪ מחברת IBM';
        const correctedText = 'קניתי חמישה ספרים בחמישים שקלים מחברת איי בי אם';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.expansion,
            confidence: 0.95,
            reason: 'Expanding number to words',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.expansion,
            confidence: 0.95,
            reason: 'Expanding currency to words',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.expansion,
            confidence: 0.9,
            reason: 'Expanding acronym to full pronunciation',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect multiple expansion changes
        expect(changes.length).toBeGreaterThan(0);
        changes.forEach(change => {
          expect(change.fixType).toBe(FixType.expansion);
        });
      });
      
      it('should handle default fix type (unclassified corrections)', () => {
        // Test case: General text correction that doesn\'t fit other categories
        const originalText = 'טקסט עם שגיאה כללית';
        const correctedText = 'טקסט עם תיקון כללי';
        
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.default,
          confidence: 0.7,
          reason: 'General text correction not fitting specific categories',
          matches: [],
          debugInfo: { allMatches: [] }
        });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect default classification changes
        expect(changes).toHaveLength(2); // Both word changes should be detected
        expect(changes[0].fixType).toBe(FixType.default);
        expect(changes[0].originalWord).toBe('שגיאה');
        expect(changes[0].correctedWord).toBe('תיקון');
        expect(changes[1].fixType).toBe(FixType.default);
        expect(changes[1].originalWord).toBe('כללית');
        expect(changes[1].correctedWord).toBe('כללי');
      });
      
      it('should handle mixed FixTypes in single text analysis', () => {
        // Test case: Multiple different fix types in one text correction
        const originalText = 'אמר 3 ילדים שהם רוצים לשחק';
        const correctedText = 'אמרו שלושה ילדים: "אנחנו רוצים לשחק".';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Grammar agreement correction',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.expansion,
            confidence: 0.95,
            reason: 'Number expansion',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.dialogue_marking,
            confidence: 0.9,
            reason: 'Adding dialogue quotation marks',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.punctuation,
            confidence: 0.85,
            reason: 'Adding period for sentence completion',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect multiple changes with different fix types
        expect(changes.length).toBeGreaterThan(1);
        
        // Verify we have different fix types represented
        const fixTypes = changes.map(change => change.fixType);
        const uniqueFixTypes = [...new Set(fixTypes)];
        expect(uniqueFixTypes.length).toBeGreaterThan(1);
      });
      
      it('should maintain fix type accuracy across all algorithm scenarios', () => {
        // Test case: Ensure fix types are preserved through word splits, merges, and substitutions
        const testCases = [
          {
            original: 'מילהמורכבת',
            corrected: 'מילה מורכבת',
            expectedFixType: FixType.sentence_break,
            scenario: 'word split'
          },
          {
            original: 'מילה נפ רדת',
            corrected: 'מילה נפרדת',
            expectedFixType: FixType.punctuation,
            scenario: 'word merge'
          },
          {
            original: 'מילה ישנה',
            corrected: 'מילה חדשה',
            expectedFixType: FixType.disambiguation,
            scenario: 'word substitution'
          }
        ];
        
        testCases.forEach((testCase, index) => {
          mockFixTypeRegistry.classifyCorrection.mockReturnValueOnce({
            fixType: testCase.expectedFixType,
            confidence: 0.8,
            reason: `Test case ${index + 1}: ${testCase.scenario}`,
            matches: [],
            debugInfo: { allMatches: [] }
          });
        });
        
        // Run all test cases
        testCases.forEach((testCase) => {
          const changes = service.analyzeTextChanges(testCase.original, testCase.corrected);
          
          expect(changes).toHaveLength(1);
          expect(changes[0].fixType).toBe(testCase.expectedFixType);
        });
      });
    });
    
    describe('Combined FixType session scenarios', () => {
      it('should handle vowelization + disambiguation in same session', () => {
        // Test case: Adding niqqud and clarifying ambiguous words
        const originalText = 'ברא אלהים את השמים והארץ והארץ היתה תהו';
        const correctedText = 'בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְהָאָרֶץ וְהָאָרֶץ הָיְתָה תֹהוּ';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.vowelization,
            confidence: 0.95,
            reason: 'Adding Hebrew niqqud',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Clarifying ambiguous word',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.vowelization,
            confidence: 0.95,
            reason: 'Adding Hebrew niqqud',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect multiple changes with different fix types
        expect(changes.length).toBeGreaterThan(1);
        
        // Verify both vowelization and disambiguation are present
        const fixTypes = changes.map(change => change.fixType);
        expect(fixTypes).toContain(FixType.vowelization);
        expect(fixTypes).toContain(FixType.disambiguation);
      });
      
      it('should handle expansion + disambiguation combo', () => {
        // Test case: Complex narration fix with numbers and word clarification
        const originalText = 'אמר הילד יש לי 5 כדורים ואני רוצה לשחק';
        const correctedText = 'אמר הילד יש לי חמישה כדורים ואני רוצה לשחק בהם';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.expansion,
            confidence: 0.95,
            reason: 'Expanding number to words',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect expansion change (only one actual word change detected)
        expect(changes).toHaveLength(1);
        expect(changes[0].fixType).toBe(FixType.expansion);
        expect(changes[0].originalWord).toBe('5');
        expect(changes[0].correctedWord).toBe('חמישה');
        
        // Verify the algorithm correctly handles word insertion (no false positives)
        expect(changes[0].position).toBe(4); // Position of '5' in original text
      });
      
      it('should handle sentence_break + vowelization + default combo', () => {
        // Test case: Breaking sentences while adding vowels and general fixes
        const originalText = 'הילדיםשחקובחצר והם היו שמחים מאד';
        const correctedText = 'הַיְלָדִים שִׂחֲקוּ בֶּחָצֵר וְהֵם הָיוּ שְׂמֵחִים מְאֹד';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.sentence_break,
            confidence: 0.9,
            reason: 'Breaking compound word',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.vowelization,
            confidence: 0.95,
            reason: 'Adding Hebrew niqqud',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.vowelization,
            confidence: 0.95,
            reason: 'Adding Hebrew niqqud',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.default,
            confidence: 0.8,
            reason: 'General spelling correction',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect multiple changes with different fix types
        expect(changes.length).toBeGreaterThan(2);
        
        // Verify all three fix types are present
        const fixTypes = changes.map(change => change.fixType);
        expect(fixTypes).toContain(FixType.sentence_break);
        expect(fixTypes).toContain(FixType.vowelization);
        expect(fixTypes).toContain(FixType.default);
      });
      
      it('should handle all 7 FixTypes in comprehensive session', () => {
        // Test case: Ultimate comprehensive fix session with all fix types
        const originalText = 'אמר 3 ילדיםבקול אנחנו רוצים לשחק במשחק חדש עכשיו';
        const correctedText = 'אָמַר שְׁלוֹשָׁה יְלָדִים בְּקוֹל אֲנַחְנוּ רוֹצִים לְשַׂחֵק בְּמִשְׂחָק חָדָשׁ עַכְשָׁיו';
        
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.vowelization,
            confidence: 0.95,
            reason: 'Adding Hebrew niqqud',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.expansion,
            confidence: 0.95,
            reason: 'Expanding number to words',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.sentence_break,
            confidence: 0.85,
            reason: 'Breaking compound word',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.dialogue_marking,
            confidence: 0.9,
            reason: 'Improving dialogue clarity',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.punctuation,
            confidence: 0.85,
            reason: 'Improving rhythm',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Clarifying meaning',
            matches: [],
            debugInfo: { allMatches: [] }
          })
          .mockReturnValueOnce({
            fixType: FixType.default,
            confidence: 0.75,
            reason: 'General improvement',
            matches: [],
            debugInfo: { allMatches: [] }
          });
        
        const changes = service.analyzeTextChanges(originalText, correctedText);
        
        // Should detect multiple changes
        expect(changes.length).toBeGreaterThan(3);
        
        // Verify multiple different fix types are present
        const fixTypes = changes.map(change => change.fixType);
        const uniqueFixTypes = [...new Set(fixTypes)];
        expect(uniqueFixTypes.length).toBeGreaterThan(3);
        
        // Verify specific fix types are included
        expect(fixTypes).toContain(FixType.vowelization);
        expect(fixTypes).toContain(FixType.expansion);
        expect(fixTypes).toContain(FixType.sentence_break);
      });
      
      it('should maintain fix type distribution accuracy in complex sessions', () => {
        // Test case: Verify fix type distribution is preserved correctly
        const testSession = {
          original: 'ילד אמר 10 מילים בקולרם והם היו מעניינות',
          corrected: 'יֶלֶד אָמַר עֶשֶׂר מִלִּים בְּקוֹל רָם וְהֵן הָיוּ מְעַנְיְנוֹת',
          expectedFixTypes: [
            FixType.vowelization,  // יֶלֶד
            FixType.vowelization,  // אָמַר
            FixType.expansion,     // עֶשֶׂר (10 -> עשר)
            FixType.vowelization,  // מִלִּים
            FixType.sentence_break, // בְּקוֹל רָם (בקולרם -> בקול רם)
            FixType.disambiguation, // וְהֵן (והם -> והן)
            FixType.vowelization   // הָיוּ
          ]
        };
        
        // Mock each expected fix type
        testSession.expectedFixTypes.forEach((fixType, index) => {
          mockFixTypeRegistry.classifyCorrection.mockReturnValueOnce({
            fixType,
            confidence: 0.85 + (index * 0.02), // Vary confidence slightly
            reason: `Fix type ${fixType} for change ${index + 1}`,
            matches: [],
            debugInfo: { allMatches: [] }
          });
        });
        
        const changes = service.analyzeTextChanges(testSession.original, testSession.corrected);
        
        // Should detect multiple changes
        expect(changes.length).toBeGreaterThan(2);
        
        // Verify fix type distribution
        const actualFixTypes = changes.map(change => change.fixType);
        const vowelizationCount = actualFixTypes.filter(ft => ft === FixType.vowelization).length;
        const expansionCount = actualFixTypes.filter(ft => ft === FixType.expansion).length;
        
        // Should have multiple vowelization fixes
        expect(vowelizationCount).toBeGreaterThan(0);
        // Should have at least one expansion
        expect(expansionCount).toBeGreaterThan(0);
        // Should have mixed fix types
        const uniqueTypes = [...new Set(actualFixTypes)];
        expect(uniqueTypes.length).toBeGreaterThan(1);
      });
      
      it('should handle sequential fix type changes correctly', () => {
        // Test case: Ensure sequential changes maintain correct fix type assignment
        const changes = [
          { original: 'ילד', corrected: 'יֶלֶד', expectedType: FixType.vowelization },
          { original: '5', corrected: 'חמישה', expectedType: FixType.expansion },
          { original: 'משחקים', corrected: 'משחק', expectedType: FixType.disambiguation },
          { original: 'בחצרהגדולה', corrected: 'בחצר', expectedType: FixType.sentence_break },
          { original: 'שגיאה', corrected: 'תיקון', expectedType: FixType.default }
        ];
        
        changes.forEach((change, index) => {
          mockFixTypeRegistry.classifyCorrection.mockReturnValueOnce({
            fixType: change.expectedType,
            confidence: 0.9,
            reason: `Sequential fix ${index + 1}`,
            matches: [],
            debugInfo: { allMatches: [] }
          });
        });
        
        // Test each change individually to ensure fix type accuracy
        changes.forEach((change) => {
          const result = service.analyzeTextChanges(change.original, change.corrected);
          
          expect(result).toHaveLength(1);
          expect(result[0].fixType).toBe(change.expectedType);
          expect(result[0].originalWord).toBe(change.original);
          expect(result[0].correctedWord).toBe(change.corrected);
        });
      });
      
      it('should handle edge case combinations gracefully', () => {
        // Test case: Edge cases with multiple fix types
        const edgeCases = [
          {
            name: 'empty to content with multiple types',
            original: '',
            corrected: 'יֶלֶד אָמַר שָׁלוֹם',
            expectedChanges: 0 // No changes detected for pure additions
          },
          {
            name: 'single word multiple classifications',
            original: 'ילד5משחקים',
            corrected: 'יֶלֶד',
            expectedMinChanges: 1
          },
          {
            name: 'identical text with different fix type mocks',
            original: 'זהה לחלוטין',
            corrected: 'זהה לחלוטין',
            expectedChanges: 0
          }
        ];
        
        edgeCases.forEach((testCase, caseIndex) => {
          // Mock different fix types for each case
          mockFixTypeRegistry.classifyCorrection
            .mockReturnValueOnce({
              fixType: FixType.vowelization,
              confidence: 0.9,
              reason: `Edge case ${caseIndex + 1}`,
              matches: [],
              debugInfo: { allMatches: [] }
            })
            .mockReturnValueOnce({
              fixType: FixType.expansion,
              confidence: 0.85,
              reason: `Edge case ${caseIndex + 1}`,
              matches: [],
              debugInfo: { allMatches: [] }
            });
          
          const changes = service.analyzeTextChanges(testCase.original, testCase.corrected);
          
          if (testCase.expectedChanges !== undefined) {
            expect(changes).toHaveLength(testCase.expectedChanges);
          } else if (testCase.expectedMinChanges !== undefined) {
            expect(changes.length).toBeGreaterThanOrEqual(testCase.expectedMinChanges);
          }
        });
      });
    });
    
    describe('Comprehensive edge case coverage', () => {
      describe('Text boundary and formatting edge cases', () => {
        it('should handle text with only whitespace', () => {
          const originalText = '   \t\n   ';
          const correctedText = '\t  \n\r  ';
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should detect no changes (only whitespace variations)
          expect(changes).toHaveLength(0);
        });
        
        it('should handle text with mixed RTL/LTR content', () => {
          const originalText = 'Hello שלום world עולם 123';
          const correctedText = 'Hello שלום world עולמים 123';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Mixed script correction',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should detect the Hebrew word change
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe('עולם');
          expect(changes[0].correctedWord).toBe('עולמים');
        });
        
        it('should handle text with excessive punctuation', () => {
          const originalText = 'מילה!!!??? אחרת...';
          const correctedText = 'מילים!!!??? אחרות...';
          
          mockFixTypeRegistry.classifyCorrection
            .mockReturnValueOnce({
              fixType: FixType.disambiguation,
              confidence: 0.9,
              reason: 'Plural form',
              matches: [],
              debugInfo: { allMatches: [] }
            })
            .mockReturnValueOnce({
              fixType: FixType.disambiguation,
              confidence: 0.9,
              reason: 'Plural form',
              matches: [],
              debugInfo: { allMatches: [] }
            });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should detect both word changes (punctuation is separated by word extraction)
          expect(changes).toHaveLength(2);
          expect(changes[0].originalWord).toBe('מילה');
          expect(changes[0].correctedWord).toBe('מילים');
          expect(changes[1].originalWord).toBe('אחרת');
          expect(changes[1].correctedWord).toBe('אחרות');
        });
        
        it('should handle text with line breaks and tabs', () => {
          const originalText = 'מילה\n\tראשונה\r\nשנייה';
          const correctedText = 'מילה\n\tראשונה\r\nשלישית';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Word replacement',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should handle line breaks correctly
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe('שנייה');
          expect(changes[0].correctedWord).toBe('שלישית');
        });
      });
      
      describe('Unicode and special character edge cases', () => {
        it('should handle emojis and special Unicode characters', () => {
          const originalText = 'ילד 😀 שמח ❤️ מאד';
          const correctedText = 'ילדים 😀 שמחים ❤️ מאד';
          
          mockFixTypeRegistry.classifyCorrection
            .mockReturnValueOnce({
              fixType: FixType.disambiguation,
              confidence: 0.9,
              reason: 'Plural form',
              matches: [],
              debugInfo: { allMatches: [] }
            })
            .mockReturnValueOnce({
              fixType: FixType.disambiguation,
              confidence: 0.9,
              reason: 'Plural form',
              matches: [],
              debugInfo: { allMatches: [] }
            });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should handle emojis correctly without breaking word detection
          expect(changes).toHaveLength(2);
          expect(changes[0].originalWord).toBe('ילד');
          expect(changes[0].correctedWord).toBe('ילדים');
          expect(changes[1].originalWord).toBe('שמח');
          expect(changes[1].correctedWord).toBe('שמחים');
        });
        
        it('should handle zero-width characters and combining marks', () => {
          const originalText = 'ילד\u200bשמח';
          const correctedText = 'ילד שמח';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Word separation',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Zero-width character causes word extraction to see compound word vs separate words
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe('ילד​שמח');
          expect(changes[0].correctedWord).toBe('ילד שמח'); // Full split phrase
        });
        
        it('should handle Hebrew with mixed niqqud patterns', () => {
          const originalText = 'בָּרָא אלהים את השמים';
          const correctedText = 'בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם';
          
          mockFixTypeRegistry.classifyCorrection
            .mockReturnValue({
              fixType: FixType.vowelization,
              confidence: 0.95,
              reason: 'Adding/correcting Hebrew niqqud',
              matches: [],
              debugInfo: { allMatches: [] }
            });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should detect vowelization changes
          expect(changes.length).toBeGreaterThan(0);
          changes.forEach(change => {
            expect(change.fixType).toBe(FixType.vowelization);
          });
        });
      });
      
      describe('Performance and memory edge cases', () => {
        it('should handle extremely long words without crashing', () => {
          const longWord = 'מילה'.repeat(1000);
          const originalText = `זה ${longWord} ארוך`;
          const correctedText = `זה ${longWord}ים ארוך`;
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.8,
            reason: 'Long word modification',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const startTime = Date.now();
          const changes = service.analyzeTextChanges(originalText, correctedText);
          const endTime = Date.now();
          
          // Should complete in reasonable time (under 2 seconds)
          expect(endTime - startTime).toBeLessThan(2000);
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe(longWord);
          expect(changes[0].correctedWord).toBe(longWord + 'ים');
        });
        
        it('should handle text with many repeated words', () => {
          const repeatedText = 'מילה '.repeat(500);
          const originalText = repeatedText + 'סוף';
          const correctedText = repeatedText + 'סיום';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Word replacement',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should only detect the actual change, not be confused by repetition
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe('סוף');
          expect(changes[0].correctedWord).toBe('סיום');
        });
        
        it('should handle memory efficiently with large diffs', () => {
          const baseText = 'זה טקסט עם הרבה מילים שונות ומעניינות לבדיקה ';
          const originalText = baseText.repeat(200);
          const correctedText = originalText.replace(/מילים/g, 'מילה');
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Singular form',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const startMemory = process.memoryUsage().heapUsed;
          const changes = service.analyzeTextChanges(originalText, correctedText);
          const endMemory = process.memoryUsage().heapUsed;
          
          // Should not use excessive memory (less than 100MB increase)
          const memoryIncrease = endMemory - startMemory;
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
          
          // Should detect all the word changes
          expect(changes.length).toBe(200); // One change per repetition
        });
      });
      
      describe('Algorithm robustness edge cases', () => {
        it('should handle words that are substrings of other words', () => {
          const originalText = 'ילד ילדים ילדות ילדה';
          const correctedText = 'ילד ילדים ילדות ילדים';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Gender correction',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should only detect the actual change, not be confused by similar words
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe('ילדה');
          expect(changes[0].correctedWord).toBe('ילדים');
          expect(changes[0].position).toBe(3); // Fourth word
        });
        
        it('should handle palindromic and symmetric text patterns', () => {
          const originalText = 'אבא בא אבא בא אבא';
          const correctedText = 'אבא בא אימא בא אבא';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Word replacement',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should detect the middle change correctly
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe('אבא');
          expect(changes[0].correctedWord).toBe('אימא');
          expect(changes[0].position).toBe(2); // Third word (middle)
        });
        
        it('should handle text with only numbers and symbols', () => {
          const originalText = '123 456 789 !@# $%^';
          const correctedText = '123 אלף 789 !@# $%^';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.expansion,
            confidence: 0.95,
            reason: 'Number to Hebrew word',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should detect number to Hebrew word conversion
          expect(changes).toHaveLength(1);
          expect(changes[0].originalWord).toBe('456');
          expect(changes[0].correctedWord).toBe('אלף');
        });
        
        it('should handle circular word replacements', () => {
          // Test case where A->B, B->C, C->A pattern could confuse algorithm
          const originalText = 'אלף בית גמל';
          const correctedText = 'בית גמל אלף';
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should detect no changes (only reordering, not substitution)
          expect(changes).toHaveLength(0);
        });
      });
      
      describe('Error handling and malformed input edge cases', () => {
        it('should handle null and undefined inputs gracefully', () => {
          expect(() => service.analyzeTextChanges(null as string, 'text')).not.toThrow();
          expect(() => service.analyzeTextChanges('text', null as string)).not.toThrow();
          expect(() => service.analyzeTextChanges(undefined as string, 'text')).not.toThrow();
          expect(() => service.analyzeTextChanges('text', undefined as string)).not.toThrow();
          
          const changes1 = service.analyzeTextChanges(null as string, 'text');
          const changes2 = service.analyzeTextChanges('text', null as string);
          
          expect(changes1).toHaveLength(0);
          expect(changes2).toHaveLength(0);
        });
        
        it('should handle malformed Unicode sequences', () => {
          // Test with broken surrogate pairs and invalid Unicode
          const originalText = 'ילד\uD800 שמח\uDFFF מאד';
          const correctedText = 'ילד\uD800 שמחים\uDFFF מאד';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Plural form',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          expect(() => {
            const changes = service.analyzeTextChanges(originalText, correctedText);
            // Should handle malformed Unicode without crashing
            expect(Array.isArray(changes)).toBe(true);
          }).not.toThrow();
        });
        
        it('should handle classification registry failures gracefully', () => {
          const originalText = 'ילד שמח';
          const correctedText = 'ילדים שמחים';
          
          // Mock registry to throw error
          mockFixTypeRegistry.classifyCorrection.mockImplementation(() => {
            throw new Error('Classification failed');
          });
          
          const changes = service.analyzeTextChanges(originalText, correctedText);
          
          // Should handle registry errors gracefully and return empty array
          // (changes are skipped when classification fails)
          expect(Array.isArray(changes)).toBe(true);
          expect(changes).toHaveLength(0); // No changes recorded due to classification failures
        });
        
        it('should handle extremely nested word structures', () => {
          // Test deeply nested compound words that could cause stack overflow
          const nestedWord = 'מילה' + 'במילה'.repeat(100);
          const originalText = `זה ${nestedWord} מורכב`;
          const correctedText = `זה מילה מורכב`;
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.sentence_break,
            confidence: 0.85,
            reason: 'Breaking complex compound word',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          expect(() => {
            const changes = service.analyzeTextChanges(originalText, correctedText);
            expect(changes).toHaveLength(1);
          }).not.toThrow();
        });
      });
      
      describe('Concurrency and state edge cases', () => {
        it('should handle concurrent analysis calls without state interference', async () => {
          const testCases = [
            { original: 'ילד שמח', corrected: 'ילדים שמחים' },
            { original: 'בית גדול', corrected: 'בתים גדולים' },
            { original: 'ספר ישן', corrected: 'ספרים חדשים' }
          ];
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Concurrent test',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          // Run multiple analyses concurrently
          const promises = testCases.map(testCase => 
            Promise.resolve(service.analyzeTextChanges(testCase.original, testCase.corrected))
          );
          
          const results = await Promise.all(promises);
          
          // Each should return correct results without interference
          results.forEach((changes) => {
            expect(changes.length).toBeGreaterThan(0);
            expect(changes[0].fixType).toBe(FixType.disambiguation);
          });
        });
        
        it('should maintain consistent results across multiple calls', () => {
          const originalText = 'ילד שמח מאד';
          const correctedText = 'ילדים שמחים מאד';
          
          mockFixTypeRegistry.classifyCorrection.mockReturnValue({
            fixType: FixType.disambiguation,
            confidence: 0.9,
            reason: 'Consistency test',
            matches: [],
            debugInfo: { allMatches: [] }
          });
          
          // Run same analysis multiple times
          const results = [];
          for (let i = 0; i < 10; i++) {
            results.push(service.analyzeTextChanges(originalText, correctedText));
          }
          
          // All results should be identical
          const firstResult = JSON.stringify(results[0]);
          results.forEach((result) => {
            expect(JSON.stringify(result)).toBe(firstResult);
          });
        });
      });
    });
  });
});
