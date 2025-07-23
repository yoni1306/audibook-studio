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
          ttsModel: undefined,
          ttsVoice: undefined,
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
            ttsModel: undefined,
            ttsVoice: undefined,
          }),
          expect.objectContaining({
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'עם',
            correctedWord: 'עם',
            aggregationKey: 'עם|עם',
            sentenceContext: 'זה טקסט עם שגיאה בעברית',
            fixType: FixType.disambiguation,
            ttsModel: undefined,
            ttsVoice: undefined,
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
            ttsModel: undefined,
            ttsVoice: undefined,
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
            ttsModel: undefined,
            ttsVoice: undefined,
          },
        ],
      });
    });
  });

  describe('classifyChange', () => {
    beforeEach(() => {
      // Reset mock before each test
      mockFixTypeRegistry.classifyCorrection.mockReset();
    });

    describe('Vowelization corrections', () => {
      it('should detect vowelization addition', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'vowelization',
          confidence: 0.9,
          reason: 'Added Hebrew niqqud marks',
          debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.9 }] }
        });

        const result = service['classifyChange']('שלום', 'שָׁלוֹם');
        expect(result).toBe(FixType.vowelization);
        expect(mockFixTypeRegistry.classifyCorrection).toHaveBeenCalledWith('שלום', 'שָׁלוֹם');
      });

      it('should detect vowelization removal', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'vowelization',
          confidence: 0.85,
          reason: 'Removed Hebrew niqqud marks',
          debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.85 }] }
        });

        const result = service['classifyChange']('שָׁלוֹם', 'שלום');
        expect(result).toBe(FixType.vowelization);
      });

      it('should detect vowelization correction', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'vowelization',
          confidence: 0.8,
          reason: 'Changed Hebrew niqqud marks',
          debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.8 }] }
        });

        const result = service['classifyChange']('שָׁלוֹם', 'שְׁלוֹם');
        expect(result).toBe(FixType.vowelization);
      });
    });

    describe('Disambiguation corrections', () => {
      it('should detect ambiguous word clarification', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.85,
          reason: 'Clarified ambiguous Hebrew word with context',
          debugInfo: { allMatches: [{ fixType: 'disambiguation', confidence: 0.85 }] }
        });

        const result = service['classifyChange']('בית', 'בַּיִת');
        expect(result).toBe(FixType.disambiguation);
      });

      it('should detect homograph disambiguation', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Disambiguated Hebrew homograph',
          debugInfo: { allMatches: [{ fixType: 'disambiguation', confidence: 0.9 }] }
        });

        const result = service['classifyChange']('מלך', 'מֶלֶךְ');
        expect(result).toBe(FixType.disambiguation);
      });
    });

    describe('Punctuation corrections', () => {
      it('should detect punctuation changes', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'punctuation',
          confidence: 0.8,
          reason: 'Added punctuation for narration flow',
          debugInfo: { allMatches: [{ fixType: 'punctuation', confidence: 0.8 }] }
        });

        const result = service['classifyChange']('שלום,', 'שלום.');
        expect(result).toBe(FixType.punctuation);
      });

      it('should detect pause mark addition', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'punctuation',
          confidence: 0.75,
          reason: 'Added pause marks for better narration rhythm',
          debugInfo: { allMatches: [{ fixType: 'punctuation', confidence: 0.75 }] }
        });

        const result = service['classifyChange']('שלום', 'שלום,');
        expect(result).toBe(FixType.punctuation);
      });
    });

    describe('Sentence break corrections', () => {
      it('should detect sentence splitting', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'sentence_break',
          confidence: 0.85,
          reason: 'Split long sentence for better narration flow',
          debugInfo: { allMatches: [{ fixType: 'sentence_break', confidence: 0.85 }] }
        });

        const result = service['classifyChange']('משפט ארוך מאוד', 'משפט ארוך. מאוד');
        expect(result).toBe(FixType.sentence_break);
      });
    });

    describe('Dialogue marking corrections', () => {
      it('should detect dialogue quotation marks', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'dialogue_marking',
          confidence: 0.9,
          reason: 'Added quotation marks for dialogue',
          debugInfo: { allMatches: [{ fixType: 'dialogue_marking', confidence: 0.9 }] }
        });

        const result = service['classifyChange']('אמר שלום', '"אמר שלום"');
        expect(result).toBe(FixType.dialogue_marking);
      });
    });

    describe('Expansion corrections', () => {
      it('should detect number expansion', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'expansion',
          confidence: 0.95,
          reason: 'Expanded number to readable Hebrew form',
          debugInfo: { allMatches: [{ fixType: 'expansion', confidence: 0.95 }] }
        });

        const result = service['classifyChange']('2', 'שתי');
        expect(result).toBe(FixType.expansion);
      });

      it('should detect currency expansion', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'expansion',
          confidence: 0.9,
          reason: 'Expanded currency to readable form',
          debugInfo: { allMatches: [{ fixType: 'expansion', confidence: 0.9 }] }
        });

        const result = service['classifyChange']('$5', 'חמישה דולר');
        expect(result).toBe(FixType.expansion);
      });

      it('should detect acronym expansion', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'expansion',
          confidence: 0.85,
          reason: 'Expanded acronym to full form',
          debugInfo: { allMatches: [{ fixType: 'expansion', confidence: 0.85 }] }
        });

        const result = service['classifyChange']('ארה"ב', 'ארצות הברית');
        expect(result).toBe(FixType.expansion);
      });
    });

    describe('Error handling', () => {
      it('should handle classification failure', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: null,
          confidence: 0,
          reason: 'No matching fix type found',
          debugInfo: { allMatches: [] }
        });

        const result = service['classifyChange']('unknown', 'change');
        expect(result).toBe(null);
      });

      it('should handle multiple matches error', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: null,
          confidence: 0,
          reason: 'Multiple fix types matched',
          debugInfo: { 
            allMatches: [
              { fixType: 'vowelization', confidence: 0.8 },
              { fixType: 'disambiguation', confidence: 0.75 }
            ] 
          }
        });

        const result = service['classifyChange']('ambiguous', 'change');
        expect(result).toBe(null);
      });
    });

    describe('Integration with analyzeTextChanges', () => {
      it('should use registry for classification in text analysis', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'punctuation',
          confidence: 0.7,
          reason: 'Removed trailing space',
          debugInfo: { allMatches: [{ fixType: 'punctuation', confidence: 0.7 }] }
        });

        const result = service['classifyChange']('שלום ', 'שלום');
        expect(result).toBe(FixType.punctuation);
      });
    });

    describe('Legacy test compatibility', () => {
      it('should handle Hebrew punctuation changes', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'punctuation',
          confidence: 0.8,
          reason: 'Changed Hebrew punctuation mark',
          debugInfo: { allMatches: [{ fixType: 'punctuation', confidence: 0.8 }] }
        });

        const result = service['classifyChange']('שלום׃', 'שלום!');
        expect(result).toBe(FixType.punctuation);
      });

      it('should handle combined vowelization and disambiguation', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'vowelization',
          confidence: 0.85,
          reason: 'Added vowelization for clarity',
          debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.85 }] }
        });

        const result = service['classifyChange']('שָׁלוֹם', 'שְׁלוֹם');
        expect(result).toBe(FixType.vowelization);
      });

      it('should handle complex Hebrew corrections', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.9,
          reason: 'Disambiguated Hebrew word with vowelization',
          debugInfo: { allMatches: [{ fixType: 'disambiguation', confidence: 0.9 }] }
        });

        const result = service['classifyChange']('שָׁלוֹם', 'שְׁלוֹט');
        expect(result).toBe(FixType.disambiguation);
      });

      it('should handle word with both vowelization and punctuation changes', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'vowelization',
          confidence: 0.8,
          reason: 'Added vowelization with punctuation adjustment',
          debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.8 }] }
        });

        const result = service['classifyChange']('שָׁלוֹם,', 'שְׁלוֹם.');
        expect(result).toBe(FixType.vowelization);
      });
    });

    describe('Non-Hebrew text corrections', () => {
      it('should handle non-Hebrew text with fallback classification', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: null,
          confidence: 0,
          reason: 'No Hebrew-specific fix type matched',
          debugInfo: { allMatches: [] }
        });

        const result = service['classifyChange']('hello', 'hallo');
        expect(result).toBe(null);
      });

      it('should handle expansion of non-Hebrew abbreviations', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'expansion',
          confidence: 0.7,
          reason: 'Expanded English abbreviation',
          debugInfo: { allMatches: [{ fixType: 'expansion', confidence: 0.7 }] }
        });

        const result = service['classifyChange']('Dr.', 'Doctor');
        expect(result).toBe(FixType.expansion);
      });

      it('should handle expansion when one word contains another', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'expansion',
          confidence: 0.8,
          reason: 'Expanded word with additional context',
          debugInfo: { allMatches: [{ fixType: 'expansion', confidence: 0.8 }] }
        });

        const result = service['classifyChange']('hello', 'hello world');
        expect(result).toBe(FixType.expansion);
      });

      it('should handle complete word replacement with no match', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: null,
          confidence: 0,
          reason: 'No specific fix type matched',
          debugInfo: { allMatches: [] }
        });

        const result = service['classifyChange']('hello', 'goodbye');
        expect(result).toBe(null);
      });

      it('should handle mixed text with numbers', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'expansion',
          confidence: 0.6,
          reason: 'Number correction in mixed text',
          debugInfo: { allMatches: [{ fixType: 'expansion', confidence: 0.6 }] }
        });

        const result = service['classifyChange']('test123', 'test124');
        expect(result).toBe(FixType.expansion);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty strings', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: null,
          confidence: 0,
          reason: 'Empty input strings',
          debugInfo: { allMatches: [] }
        });

        const result = service['classifyChange']('', '');
        expect(result).toBe(null);
      });

      it('should handle one empty string', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'expansion',
          confidence: 0.5,
          reason: 'Text addition from empty string',
          debugInfo: { allMatches: [{ fixType: 'expansion', confidence: 0.5 }] }
        });

        const result = service['classifyChange']('', 'שלום');
        expect(result).toBe(FixType.expansion);
      });

      it('should handle identical words', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: null,
          confidence: 0,
          reason: 'Identical words - no change needed',
          debugInfo: { allMatches: [] }
        });

        const result = service['classifyChange']('שלום', 'שלום');
        expect(result).toBe(null);
      });

      it('should handle mixed scripts', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.disambiguation,
          confidence: 0.8,
          reason: 'Hebrew word correction in mixed text',
          debugInfo: { allMatches: [{ fixType: 'disambiguation', confidence: 0.8 }] }
        });

        const result = service['classifyChange']('שלום hello', 'שלוט hello');
        expect(result).toBe(FixType.disambiguation);
      });

      it('should handle only vowel characters', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'vowelization',
          confidence: 0.9,
          reason: 'Pure vowel mark correction',
          debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.9 }] }
        });

        const result = service['classifyChange']('ָׁ', 'ְׁ');
        expect(result).toBe(FixType.vowelization);
      });

      it('should handle special Hebrew characters', () => {
        mockFixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: 'punctuation',
          confidence: 0.7,
          reason: 'Hebrew punctuation mark change',
          debugInfo: { allMatches: [{ fixType: 'punctuation', confidence: 0.7 }] }
        });

        const result = service['classifyChange']('א׳', 'א״');
        expect(result).toBe(FixType.punctuation);
      });
    });

    describe('Real-world Hebrew examples', () => {
      it('should classify common Hebrew corrections', () => {
        // Mock different fix types for different examples
        mockFixTypeRegistry.classifyCorrection
          .mockReturnValueOnce({
            fixType: FixType.disambiguation,
            confidence: 0.85,
            reason: 'Common Hebrew spelling correction',
            debugInfo: { allMatches: [{ fixType: 'disambiguation', confidence: 0.85 }] }
          })
          .mockReturnValueOnce({
            fixType: 'vowelization',
            confidence: 0.9,
            reason: 'Added vowelization for clarity',
            debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.9 }] }
          })
          .mockReturnValueOnce({
            fixType: 'vowelization',
            confidence: 0.85,
            reason: 'Corrected vowel marks',
            debugInfo: { allMatches: [{ fixType: 'vowelization', confidence: 0.85 }] }
          });

        // Common misspelling
        expect(service['classifyChange']('אמא', 'אימא')).toBe('disambiguation');
        
        // Niqqud addition for clarity
        expect(service['classifyChange']('ברא', 'בָּרָא')).toBe('vowelization');
        
        // Vowel correction
        expect(service['classifyChange']('בָּרָא', 'בָּרָה')).toBe('vowelization');
      });
    });
  });
});
