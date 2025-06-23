import { Test, TestingModule } from '@nestjs/testing';
import { TextFixesService, WordChange } from './text-fixes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TextFixesService', () => {
  let service: TextFixesService;
  let mockTxTextCorrection: { createMany: jest.Mock };
  let mockTxParagraph: { findUnique: jest.Mock };
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
          fixType: 'substitution',
        },
      ];

      const expectedCorrections = [
        {
          paragraphId: mockParagraphId,
          bookId: mockBookId,
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה טקסט עם שגיאה בעברית',
          fixType: 'substitution',
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
        { originalWord: 'שגיאה', correctedWord: 'תיקון', position: 0, fixType: 'substitution' },
        { originalWord: 'עם', correctedWord: 'עם', position: 1, fixType: 'no-change' },
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
            sentenceContext: 'זה טקסט עם שגיאה בעברית',
            fixType: 'substitution',
          }),
          expect.objectContaining({
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'עם',
            correctedWord: 'עם',
            sentenceContext: 'זה טקסט עם שגיאה בעברית',
            fixType: 'no-change',
          }),
        ]),
      });
    });

    it('should handle changes without fixType', async () => {
      const changes: WordChange[] = [
        { originalWord: 'שגיאה', correctedWord: 'תיקון', position: 0 },
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
            sentenceContext: 'זה טקסט עם שגיאה בעברית',
            fixType: 'manual',
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
        { originalWord: 'שגיאה', correctedWord: 'תיקון', position: 0, fixType: 'substitution' },
      ];

      const error = new Error('Database error');
      mockPrismaService.$transaction.mockRejectedValue(error);

      await expect(
        service.saveTextFixes(mockParagraphId, mockOriginalText, mockCorrectedText, changes)
      ).rejects.toThrow('Database error');
    });

    it('should handle words not found in original text', async () => {
      const changes: WordChange[] = [
        { originalWord: 'לא_קיים', correctedWord: 'תיקון', position: 0, fixType: 'substitution' },
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
            sentenceContext: '',
            fixType: 'substitution',
          },
        ],
      });
    });
  });

  describe('classifyChange', () => {
    describe('Niqqud (Hebrew vowel marks) corrections', () => {
      it('should detect niqqud addition', () => {
        const result = service['classifyChange']('שלום', 'שָׁלוֹם');
        expect(result).toBe('niqqud_addition');
      });

      it('should detect niqqud removal', () => {
        const result = service['classifyChange']('שָׁלוֹם', 'שלום');
        expect(result).toBe('niqqud_removal');
      });

      it('should detect niqqud correction', () => {
        const result = service['classifyChange']('שָׁלוֹם', 'שְׁלוֹם');
        expect(result).toBe('niqqud_correction');
      });

      it('should detect complex niqqud changes', () => {
        const result = service['classifyChange']('בְּרֵאשִׁית', 'בְּרֵאשִׁיתָה');
        expect(result).toBe('hebrew_letter_fix'); // Added Hebrew letter ה at the end
      });

      it('should handle multiple niqqud marks', () => {
        const result = service['classifyChange']('הַמֶּלֶךְ', 'הַמֶּלֶךְ');
        expect(result).toBe('niqqud_correction'); // Base letters same, niqqud same -> niqqud_correction
      });
    });

    describe('Hebrew letter corrections', () => {
      it('should detect hebrew spelling correction with same letter count', () => {
        const result = service['classifyChange']('שלום', 'שלוט');
        expect(result).toBe('hebrew_spelling');
      });

      it('should detect hebrew letter addition', () => {
        const result = service['classifyChange']('שלמ', 'שלום');
        expect(result).toBe('hebrew_letter_fix');
      });

      it('should detect hebrew letter removal', () => {
        const result = service['classifyChange']('שלום', 'שלמ');
        expect(result).toBe('hebrew_letter_fix');
      });

      it('should handle complex hebrew word changes', () => {
        const result = service['classifyChange']('ספר', 'ספרים');
        expect(result).toBe('expansion_contraction'); // 'ספרים' contains 'ספר'
      });

      it('should handle mixed Hebrew and non-Hebrew', () => {
        const result = service['classifyChange']('שלום123', 'שלוט123');
        expect(result).toBe('hebrew_spelling');
      });
    });

    describe('Punctuation corrections', () => {
      it('should detect punctuation changes', () => {
        const result = service['classifyChange']('שלום,', 'שלום.');
        expect(result).toBe('character_substitution'); // Same length, different punctuation
      });

      it('should detect spacing changes', () => {
        const result = service['classifyChange']('שלום ', 'שלום');
        expect(result).toBe('insertion_deletion'); // One character difference
      });

      it('should handle Hebrew punctuation', () => {
        const result = service['classifyChange']('שלום׃', 'שלום!');
        expect(result).toBe('character_substitution'); // Same length
      });
    });

    describe('Combined Hebrew corrections', () => {
      it('should prioritize niqqud over letter changes when base letters are same', () => {
        const result = service['classifyChange']('שָׁלוֹם', 'שְׁלוֹם');
        expect(result).toBe('niqqud_correction');
      });

      it('should detect letter changes when niqqud is also different', () => {
        const result = service['classifyChange']('שָׁלוֹם', 'שְׁלוֹט');
        expect(result).toBe('hebrew_spelling');
      });

      it('should handle word with both niqqud and punctuation changes', () => {
        const result = service['classifyChange']('שָׁלוֹם,', 'שְׁלוֹם.');
        expect(result).toBe('character_substitution'); // Same length, multiple changes
      });
    });

    describe('Non-Hebrew text corrections', () => {
      it('should detect character substitution for same length words', () => {
        const result = service['classifyChange']('hello', 'hallo');
        expect(result).toBe('character_substitution');
      });

      it('should detect insertion/deletion for single character difference', () => {
        const result = service['classifyChange']('hello', 'helo');
        expect(result).toBe('insertion_deletion');
      });

      it('should detect expansion/contraction when one word contains another', () => {
        const result = service['classifyChange']('hello', 'hello world');
        expect(result).toBe('expansion_contraction');
      });

      it('should default to substitution for complete word replacement', () => {
        const result = service['classifyChange']('hello', 'goodbye');
        expect(result).toBe('substitution');
      });

      it('should handle English with numbers', () => {
        const result = service['classifyChange']('test123', 'test124');
        expect(result).toBe('character_substitution');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty strings', () => {
        const result = service['classifyChange']('', '');
        expect(result).toBe('character_substitution'); // Same length (0)
      });

      it('should handle one empty string', () => {
        const result = service['classifyChange']('', 'שלום');
        expect(result).toBe('expansion_contraction'); // Empty string is contained in any string
      });

      it('should handle identical words', () => {
        const result = service['classifyChange']('שלום', 'שלום');
        expect(result).toBe('character_substitution'); // Same length
      });

      it('should handle mixed scripts', () => {
        const result = service['classifyChange']('שלום hello', 'שלוט hello');
        expect(result).toBe('hebrew_spelling');
      });

      it('should handle only niqqud characters', () => {
        const result = service['classifyChange']('ָׁ', 'ְׁ');
        expect(result).toBe('niqqud_correction'); // Base letters are same (empty), niqqud different
      });

      it('should handle special Hebrew characters', () => {
        const result = service['classifyChange']('א׳', 'א״');
        expect(result).toBe('character_substitution'); // Same length
      });
    });

    describe('Real-world Hebrew examples', () => {
      it('should classify common Hebrew corrections', () => {
        // Common misspelling
        expect(service['classifyChange']('אמא', 'אימא')).toBe('hebrew_letter_fix');
        
        // Niqqud addition for clarity
        expect(service['classifyChange']('ברא', 'בָּרָא')).toBe('niqqud_addition');
        
        // Vowel correction
        expect(service['classifyChange']('בָּרָא', 'בָּרָה')).toBe('hebrew_spelling');
        
        expect(service['classifyChange']('שלום,', 'שלום.')).toBe('character_substitution');
      });

      it('should handle biblical Hebrew with complex niqqud', () => {
        const result = service['classifyChange']('בְּרֵאשִׁית', 'בְּרֵאשִׁיתָה');
        expect(result).toBe('hebrew_letter_fix'); // Added one Hebrew letter (ה)
      });

      it('should handle modern Hebrew slang corrections', () => {
        const result = service['classifyChange']('יאללה', 'יאלה');
        expect(result).toBe('hebrew_letter_fix');
      });
    });
  });

});
