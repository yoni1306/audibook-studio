import { Test, TestingModule } from '@nestjs/testing';
import { TextFixesService } from './text-fixes.service';
import { PrismaService } from '../prisma/prisma.service';
import { FixTypeHandlerRegistry } from './fix-type-handlers/fix-type-handler-registry';
import { FixType } from '@prisma/client';

describe('TextFixesService - TTS Integration', () => {
  let service: TextFixesService;
  let prismaService: jest.Mocked<PrismaService>;
  let fixTypeRegistry: jest.Mocked<FixTypeHandlerRegistry>;

  const mockBookId = 'test-book-id';
  const mockParagraphId = 'test-paragraph-id';

  beforeEach(async () => {
    const mockPrismaService = {
      $transaction: jest.fn(),
    };

    const mockFixTypeRegistry = {
      classifyCorrection: jest.fn(),
    };

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
    prismaService = module.get(PrismaService);
    fixTypeRegistry = module.get(FixTypeHandlerRegistry);
  });

  describe('TTS Model Integration in Text Corrections', () => {
    it('should store Azure TTS model information with text corrections', async () => {
      const mockTxParagraph = {
        findUnique: jest.fn().mockResolvedValue({ bookId: mockBookId }),
      };

      const mockTxBook = {
        findUnique: jest.fn().mockResolvedValue({
          ttsModel: 'azure',
          ttsVoice: 'he-IL-AvriNeural',
        }),
      };

      const mockTxTextCorrection = {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          textCorrection: mockTxTextCorrection,
          paragraph: mockTxParagraph,
          book: mockTxBook,
        } as any;
        return await callback(mockTx as any);
      });

      fixTypeRegistry.classifyCorrection.mockReturnValue({
        fixType: FixType.disambiguation,
        confidence: 0.9,
        reason: 'Test classification',
        matches: [],
        debugInfo: {
          totalHandlers: 1,
          matchingHandlers: 1,
          allMatches: [],
          validationPassed: true,
        },
      });

      const originalText = 'שלום עולם';
      const correctedText = 'שלום עולם מתוקן';
      const changes = [
        {
          originalWord: 'עולם',
          correctedWord: 'עולם מתוקן',
          fixType: FixType.disambiguation,
          position: 0,
        },
      ];

      await service.saveTextFixes(mockParagraphId, originalText, correctedText, changes);

      expect(mockTxBook.findUnique).toHaveBeenCalledWith({
        where: { id: mockBookId },
        select: { ttsModel: true, ttsVoice: true },
      });

      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: [
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'עולם',
            correctedWord: 'עולם מתוקן',
            aggregationKey: 'עולם|עולם מתוקן',
            sentenceContext: originalText,
            fixType: FixType.disambiguation,
            ttsModel: 'azure',
            ttsVoice: 'he-IL-AvriNeural',
          },
        ],
      });
    });

    it('should handle missing TTS model information gracefully', async () => {
      const mockTxParagraph = {
        findUnique: jest.fn().mockResolvedValue({ bookId: mockBookId }),
      };

      const mockTxBook = {
        findUnique: jest.fn().mockResolvedValue({
          ttsModel: null,
          ttsVoice: null,
        }),
      };

      const mockTxTextCorrection = {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          textCorrection: mockTxTextCorrection,
          paragraph: mockTxParagraph,
          book: mockTxBook,
        } as any;
        return await callback(mockTx as any);
      });

      fixTypeRegistry.classifyCorrection.mockReturnValue({
        fixType: FixType.default,
        confidence: 1.0,
        reason: 'Manual correction',
        matches: [],
        debugInfo: {
          totalHandlers: 1,
          matchingHandlers: 1,
          allMatches: [],
          validationPassed: true,
        },
      });

      const originalText = 'Test text';
      const correctedText = 'Corrected text';
      const changes = [
        {
          originalWord: 'Test',
          correctedWord: 'Corrected',
          fixType: FixType.default,
          position: 0,
        },
      ];

      await service.saveTextFixes(mockParagraphId, originalText, correctedText, changes);

      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: [
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'Test',
            correctedWord: 'Corrected',
            aggregationKey: 'Test|Corrected',
            sentenceContext: originalText,
            fixType: FixType.default,
            ttsModel: null,
            ttsVoice: null,
          },
        ],
      });
    });

    it('should handle multiple corrections with consistent TTS model information', async () => {
      const mockTxParagraph = {
        findUnique: jest.fn().mockResolvedValue({ bookId: mockBookId }),
      };

      const mockTxBook = {
        findUnique: jest.fn().mockResolvedValue({
          ttsModel: 'azure',
          ttsVoice: 'he-IL-HilaNeural',
        }),
      };

      const mockTxTextCorrection = {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          textCorrection: mockTxTextCorrection,
          paragraph: mockTxParagraph,
          book: mockTxBook,
        };
        return await callback(mockTx as any);
      });

      fixTypeRegistry.classifyCorrection.mockReturnValue({
        fixType: FixType.vowelization,
        confidence: 0.95,
        reason: 'Hebrew vowelization',
        matches: [],
        debugInfo: {
          totalHandlers: 1,
          matchingHandlers: 1,
          allMatches: [],
          validationPassed: true,
        },
      });

      const originalText = 'שלום עולם יפה';
      const correctedText = 'שָׁלוֹם עוֹלָם יָפֶה';
      const changes = [
        {
          originalWord: 'שלום',
          correctedWord: 'שָׁלוֹם',
          fixType: FixType.vowelization,
          position: 0,
        },
        {
          originalWord: 'עולם',
          correctedWord: 'עוֹלָם',
          fixType: FixType.vowelization,
          position: 5,
        },
        {
          originalWord: 'יפה',
          correctedWord: 'יָפֶה',
          fixType: FixType.vowelization,
          position: 10,
        },
      ];

      await service.saveTextFixes(mockParagraphId, originalText, correctedText, changes);

      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: [
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'שלום',
            correctedWord: 'שָׁלוֹם',
            aggregationKey: 'שלום|שָׁלוֹם',
            sentenceContext: originalText,
            fixType: FixType.vowelization,
            ttsModel: 'azure',
            ttsVoice: 'he-IL-HilaNeural',
          },
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'עולם',
            correctedWord: 'עוֹלָם',
            aggregationKey: 'עולם|עוֹלָם',
            sentenceContext: originalText,
            fixType: FixType.vowelization,
            ttsModel: 'azure',
            ttsVoice: 'he-IL-HilaNeural',
          },
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'יפה',
            correctedWord: 'יָפֶה',
            aggregationKey: 'יפה|יָפֶה',
            sentenceContext: originalText,
            fixType: FixType.vowelization,
            ttsModel: 'azure',
            ttsVoice: 'he-IL-HilaNeural',
          },
        ],
      });
    });

    it('should handle book lookup failure gracefully', async () => {
      const mockTxParagraph = {
        findUnique: jest.fn().mockResolvedValue({ bookId: mockBookId }),
      };

      const mockTxBook = {
        findUnique: jest.fn().mockResolvedValue(null), // Book not found
      };

      const mockTxTextCorrection = {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          textCorrection: mockTxTextCorrection,
          paragraph: mockTxParagraph,
          book: mockTxBook,
        };
        return await callback(mockTx as any);
      });

      fixTypeRegistry.classifyCorrection.mockReturnValue({
        fixType: FixType.default,
        confidence: 1.0,
        reason: 'Manual correction',
        matches: [],
        debugInfo: {
          totalHandlers: 1,
          matchingHandlers: 1,
          allMatches: [],
          validationPassed: true,
        },
      });

      const originalText = 'Test text';
      const correctedText = 'Corrected text';
      const changes = [
        {
          originalWord: 'Test',
          correctedWord: 'Corrected',
          fixType: FixType.default,
          position: 0,
        },
      ];

      await service.saveTextFixes(mockParagraphId, originalText, correctedText, changes);

      expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
        data: [
          {
            paragraphId: mockParagraphId,
            bookId: mockBookId,
            originalWord: 'Test',
            correctedWord: 'Corrected',
            aggregationKey: 'Test|Corrected',
            sentenceContext: originalText,
            fixType: FixType.default,
            ttsModel: null,
            ttsVoice: null,
          },
        ],
      });
    });
  });

  describe('TTS Model Traceability', () => {
    it('should ensure TTS model information is preserved across correction workflows', async () => {
      // This test ensures that the TTS model used for generating audio
      // is properly tracked with each text correction for audit purposes
      const testCases = [
        {
          ttsModel: 'azure',
          ttsVoice: 'en-US-AriaNeural',
          language: 'English',
        },
        {
          ttsModel: 'azure',
          ttsVoice: 'he-IL-AvriNeural',
          language: 'Hebrew',
        },
        {
          ttsModel: 'openai',
          ttsVoice: 'alloy',
          language: 'English',
        },
        {
          ttsModel: 'elevenlabs',
          ttsVoice: 'rachel',
          language: 'English',
        },
      ];

      for (const testCase of testCases) {
        const mockTxParagraph = {
          findUnique: jest.fn().mockResolvedValue({ bookId: mockBookId }),
        };

        const mockTxBook = {
          findUnique: jest.fn().mockResolvedValue({
            ttsModel: testCase.ttsModel,
            ttsVoice: testCase.ttsVoice,
          }),
        };

        const mockTxTextCorrection = {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        };

        prismaService.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            textCorrection: mockTxTextCorrection,
            paragraph: mockTxParagraph,
            book: mockTxBook,
          };
          return await callback(mockTx as any);
        });

        fixTypeRegistry.classifyCorrection.mockReturnValue({
          fixType: FixType.default,
          confidence: 1.0,
          reason: `${testCase.language} correction`,
          matches: [],
          debugInfo: {
          totalHandlers: 1,
          matchingHandlers: 1,
          allMatches: [],
          validationPassed: true,
        },
        });

        const changes = [
          {
            originalWord: 'original',
            correctedWord: 'corrected',
            fixType: FixType.default,
            position: 0,
          },
        ];

        await service.saveTextFixes(mockParagraphId, 'original text', 'corrected text', changes);

        // Verify that the TTS model information is correctly stored
        expect(mockTxTextCorrection.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              ttsModel: testCase.ttsModel,
              ttsVoice: testCase.ttsVoice,
            }),
          ]),
        });

        // Reset mocks for next iteration
        jest.clearAllMocks();
      }
    });
  });
});
