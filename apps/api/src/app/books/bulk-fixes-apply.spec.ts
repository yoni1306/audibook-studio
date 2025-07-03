import { Test, TestingModule } from '@nestjs/testing';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextFixesService } from './text-fixes.service';
import { FixTypeHandlerRegistry } from './fix-type-handlers/fix-type-handler-registry';
import { TextCorrectionRepository } from './text-correction.repository';
import { Logger } from '@nestjs/common';
import { FixType } from '@prisma/client';

describe('BulkTextFixesService - applyBulkFixes', () => {
  let service: BulkTextFixesService;
  let prismaService: PrismaService;
  let textFixesService: TextFixesService;

  // Mock data
  const mockBookId = 'book-123';
  const mockParagraphId = 'para-123';
  const mockParagraph = {
    id: mockParagraphId,
    content: 'זה טקסט עברי וגם יש כאן מילים נוספות וגם עוד טקסט.',
    pageId: 'page-1',
    orderIndex: 0,
    audioStatus: 'PENDING',
    audioS3Key: null,
    page: { pageNumber: 1 }
  };

  const mockTransaction = {
    paragraph: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    textFix: {
      create: jest.fn(),
    },
    textCorrection: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkTextFixesService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
        {
          provide: TextFixesService,
          useValue: {
            analyzeTextChanges: jest.fn(),
          },
        },
        {
          provide: FixTypeHandlerRegistry,
          useValue: {
            classifyCorrection: jest.fn().mockReturnValue({
              fixType: FixType.vowelization,
              confidence: 0.8,
              reason: 'Mock classification',
              matches: [],
              debugInfo: {
                totalHandlers: 1,
                matchingHandlers: 1,
                allMatches: [],
                validationPassed: true
              }
            }),
          },
        },
        {
          provide: TextCorrectionRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 'mock-correction-id',
              bookId: 'mock-book-id',
              paragraphId: 'mock-paragraph-id',
              originalWord: 'mock-original',
              correctedWord: 'mock-corrected',
              sentenceContext: 'mock context',
              fixType: FixType.vowelization,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BulkTextFixesService>(BulkTextFixesService);
    prismaService = module.get<PrismaService>(PrismaService);
    textFixesService = module.get<TextFixesService>(TextFixesService);

    // Setup transaction mock
    (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return await callback(mockTransaction);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Hebrew word matching and replacement', () => {
    it('should find and replace Hebrew words with niqqud correctly', async () => {
      // Arrange
      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(mockParagraph);
      mockTransaction.paragraph.update.mockResolvedValue(mockParagraph);
      textFixesService.analyzeTextChanges = jest.fn().mockReturnValue([
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          position: 15,
          fixType: 'spelling',
        },
      ]);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        data: {
          content: 'זה טקסט עברי וְגַם יש כאן מילים נוספות וְגַם עוד טקסט.',
        },
      });

      expect(result.totalParagraphsUpdated).toBe(1);
      expect(result.totalWordsFixed).toBe(2); // Two occurrences of 'וגם'
      expect(result.updatedParagraphs).toHaveLength(1);
      expect(result.updatedParagraphs[0].wordsFixed).toBe(2);
    });

    it('should not replace words that do not match exactly (niqqud sensitivity)', async () => {
      // Arrange
      const fixes = [
        {
          originalWord: 'וְגַם', // Looking for word WITH niqqud
          correctedWord: 'וגם',     // Replace with word WITHOUT niqqud
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(mockParagraph);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).not.toHaveBeenCalled();
      expect(result.totalParagraphsUpdated).toBe(0);
      expect(result.totalWordsFixed).toBe(0);
    });

    it('should handle multiple different word fixes in the same paragraph', async () => {
      // Arrange
      const paragraphWithMultipleWords = {
        ...mockParagraph,
        content: 'זה ספר טוב וגם יש כאן ספר נוסף.',
      };

      const fixes = [
        {
          originalWord: 'ספר',
          correctedWord: 'סֵפֶר',
          paragraphIds: [mockParagraphId],
        },
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(paragraphWithMultipleWords);
      mockTransaction.paragraph.update.mockResolvedValue(paragraphWithMultipleWords);
      textFixesService.analyzeTextChanges = jest.fn().mockReturnValue([
        { originalWord: 'ספר', correctedWord: 'סֵפֶר', position: 3, fixType: 'spelling' },
        { originalWord: 'ספר', correctedWord: 'סֵפֶר', position: 25, fixType: 'spelling' },
        { originalWord: 'וגם', correctedWord: 'וְגַם', position: 12, fixType: 'spelling' },
      ]);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        data: {
          content: 'זה סֵפֶר טוב וְגַם יש כאן סֵפֶר נוסף.',
        },
      });

      expect(result.totalParagraphsUpdated).toBe(1);
      expect(result.totalWordsFixed).toBe(3); // 2 occurrences of 'ספר' + 1 occurrence of 'וגם'
    });

    it('should handle word at beginning of text', async () => {
      // Arrange
      const paragraphStartingWithWord = {
        ...mockParagraph,
        content: 'וגם זה טקסט עברי.',
      };

      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(paragraphStartingWithWord);
      mockTransaction.paragraph.update.mockResolvedValue(paragraphStartingWithWord);
      textFixesService.analyzeTextChanges = jest.fn().mockReturnValue([
        { originalWord: 'וגם', correctedWord: 'וְגַם', position: 0, fixType: 'spelling' },
      ]);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        data: {
          content: 'וְגַם זה טקסט עברי.',
        },
      });

      expect(result.totalWordsFixed).toBe(1);
    });

    it('should handle word at end of text', async () => {
      // Arrange
      const paragraphEndingWithWord = {
        ...mockParagraph,
        content: 'זה טקסט עברי וגם',
      };

      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(paragraphEndingWithWord);
      mockTransaction.paragraph.update.mockResolvedValue(paragraphEndingWithWord);
      textFixesService.analyzeTextChanges = jest.fn().mockReturnValue([
        { originalWord: 'וגם', correctedWord: 'וְגַם', position: 13, fixType: 'spelling' },
      ]);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        data: {
          content: 'זה טקסט עברי וְגַם',
        },
      });

      expect(result.totalWordsFixed).toBe(1);
    });

    it('should handle words with punctuation', async () => {
      // Arrange
      const paragraphWithPunctuation = {
        ...mockParagraph,
        content: 'זה טקסט, וגם יש כאן סימני פיסוק. וגם עוד משפט!',
      };

      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(paragraphWithPunctuation);
      mockTransaction.paragraph.update.mockResolvedValue(paragraphWithPunctuation);
      textFixesService.analyzeTextChanges = jest.fn().mockReturnValue([
        { originalWord: 'וגם', correctedWord: 'וְגַם', position: 11, fixType: 'spelling' },
        { originalWord: 'וגם', correctedWord: 'וְגַם', position: 35, fixType: 'spelling' },
      ]);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        data: {
          content: 'זה טקסט, וְגַם יש כאן סימני פיסוק. וְגַם עוד משפט!',
        },
      });

      expect(result.totalWordsFixed).toBe(2);
    });

    it('should not replace partial word matches', async () => {
      // Arrange
      const paragraphWithPartialMatch = {
        ...mockParagraph,
        content: 'זה טקסט עם מילה וגמר שלא צריכה להשתנות.',
      };

      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(paragraphWithPartialMatch);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).not.toHaveBeenCalled();
      expect(result.totalWordsFixed).toBe(0);
    });

    it('should handle paragraph not found gracefully', async () => {
      // Arrange
      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: ['non-existent-id'],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).not.toHaveBeenCalled();
      expect(result.totalParagraphsUpdated).toBe(0);
      expect(result.totalWordsFixed).toBe(0);
    });

    it('should handle empty fixes array', async () => {
      // Act
      const result = await service.applyBulkFixes(mockBookId, []);

      // Assert
      expect(result.totalParagraphsUpdated).toBe(0);
      expect(result.totalWordsFixed).toBe(0);
      expect(result.updatedParagraphs).toHaveLength(0);
    });

    it('should only replace exact matches and preserve existing niqqud in other words', async () => {
      // Arrange
      const paragraphWithMixedNiqqud = {
        ...mockParagraph,
        content: 'כתבתי על קנדי גַם משום שהיה גיבור מלחמה וגם מפני שהביא את העולם אל סף מלחמה גרעינית.',
      };

      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      mockTransaction.paragraph.findUnique.mockResolvedValue(paragraphWithMixedNiqqud);
      mockTransaction.paragraph.update.mockResolvedValue(paragraphWithMixedNiqqud);
      textFixesService.analyzeTextChanges = jest.fn().mockReturnValue([
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          position: 44, // Position of 'וגם' in the sentence
          fixType: 'spelling',
        },
      ]);

      // Act
      const result = await service.applyBulkFixes(mockBookId, fixes);

      // Assert
      expect(mockTransaction.paragraph.findUnique).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        include: {
          page: {
            select: {
              pageNumber: true
            }
          }
        }
      });

      expect(mockTransaction.paragraph.update).toHaveBeenCalledWith({
        where: { id: mockParagraphId },
        data: {
          content: 'כתבתי על קנדי גַם משום שהיה גיבור מלחמה וְגַם מפני שהביא את העולם אל סף מלחמה גרעינית.',
        },
      });

      expect(result.totalParagraphsUpdated).toBe(1);
      expect(result.totalWordsFixed).toBe(1); // Only one occurrence of 'וגם' (without niqqud)
      expect(result.updatedParagraphs[0].wordsFixed).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle database transaction errors', async () => {
      // Arrange
      const fixes = [
        {
          originalWord: 'וגם',
          correctedWord: 'וְגַם',
          paragraphIds: [mockParagraphId],
        },
      ];

      (prismaService.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.applyBulkFixes(mockBookId, fixes)).rejects.toThrow('Database error');
    });
  });
});
