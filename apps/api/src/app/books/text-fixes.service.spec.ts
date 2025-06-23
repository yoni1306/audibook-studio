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
});
