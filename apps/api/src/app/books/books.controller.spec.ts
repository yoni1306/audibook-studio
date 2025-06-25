import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { CorrectionLearningService } from './correction-learning.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { 
  RecordCorrectionDto, 
  GetAllCorrectionsDto
} from './dto/correction-learning.dto';

describe('BooksController', () => {
  let controller: BooksController;

  const mockCorrectionLearningService = {
    getFixTypes: jest.fn(),
    recordCorrection: jest.fn(),
    getAllCorrections: jest.fn(),
  };

  const mockBooksService = {
    // Add mock methods as needed
  };

  const mockBulkTextFixesService = {
    // Add mock methods as needed
  };

  const mockPrismaService = {
    // Add mock methods as needed
  };

  const mockS3Service = {
    // Add mock methods as needed
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: mockBooksService,
        },
        {
          provide: CorrectionLearningService,
          useValue: mockCorrectionLearningService,
        },
        {
          provide: BulkTextFixesService,
          useValue: mockBulkTextFixesService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFixTypes', () => {
    it('should return fix types successfully', async () => {
      const mockFixTypes = ['substitution', 'insertion', 'deletion', 'manual'];
      mockCorrectionLearningService.getFixTypes.mockResolvedValue({ fixTypes: mockFixTypes });

      const result = await controller.getFixTypes();

      expect(result).toEqual({
        fixTypes: mockFixTypes,
        timestamp: expect.any(String),
      });
      expect(mockCorrectionLearningService.getFixTypes).toHaveBeenCalledTimes(1);
    });

    it('should handle empty fix types', async () => {
      mockCorrectionLearningService.getFixTypes.mockResolvedValue({ fixTypes: [] });

      const result = await controller.getFixTypes();

      expect(result).toEqual({
        fixTypes: [],
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Database error');
      mockCorrectionLearningService.getFixTypes.mockRejectedValue(mockError);

      await expect(controller.getFixTypes()).rejects.toThrow('Failed to get fix types');
    });
  });

  describe('recordCorrection', () => {
    const mockCorrectionDto: RecordCorrectionDto = {
      originalWord: 'שגיאה',
      correctedWord: 'תיקון',
      contextSentence: 'זה המשפט עם שגיאה בתוכו.',
      paragraphId: 'test-paragraph-id',
      fixType: 'substitution',
    };

    const mockCreatedCorrection = {
      id: 'test-correction-id',
      paragraphId: 'test-paragraph-id',
      originalWord: 'שגיאה',
      correctedWord: 'תיקון',
      sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
      fixType: 'substitution',
      createdAt: new Date('2025-06-22T10:00:00.000Z'),
      updatedAt: new Date('2025-06-22T10:00:00.000Z'),
    };

    it('should record correction with complete input data', async () => {
      mockCorrectionLearningService.recordCorrection.mockResolvedValue(mockCreatedCorrection);

      const result = await controller.recordCorrection(mockCorrectionDto);

      expect(mockCorrectionLearningService.recordCorrection).toHaveBeenCalledWith({
        originalWord: 'שגיאה',
        correctedWord: 'תיקון',
        contextSentence: 'זה המשפט עם שגיאה בתוכו.',
        paragraphId: 'test-paragraph-id',
        fixType: 'substitution',
      });

      expect(result).toEqual({
        id: 'test-correction-id',
        originalWord: 'שגיאה',
        correctedWord: 'תיקון',
        message: 'Correction recorded successfully',
        timestamp: expect.any(String),
      });
    });

    it('should handle correction without fixType', async () => {
      const dtoWithoutFixType = {
        originalWord: 'שגיאה',
        correctedWord: 'תיקון',
        contextSentence: 'זה המשפט עם שגיאה בתוכו.',
        paragraphId: 'test-paragraph-id',
      };

      const correctionWithoutFixType = {
        ...mockCreatedCorrection,
        fixType: undefined,
      };

      mockCorrectionLearningService.recordCorrection.mockResolvedValue(correctionWithoutFixType);

      const result = await controller.recordCorrection(dtoWithoutFixType);

      expect(mockCorrectionLearningService.recordCorrection).toHaveBeenCalledWith({
        originalWord: 'שגיאה',
        correctedWord: 'תיקון',
        contextSentence: 'זה המשפט עם שגיאה בתוכו.',
        paragraphId: 'test-paragraph-id',
        fixType: undefined,
      });

      expect(result.id).toBe('test-correction-id');
      expect(result.message).toBe('Correction recorded successfully');
      expect(result.timestamp).toBeDefined();
    });

    it('should validate required fields are passed through', async () => {
      mockCorrectionLearningService.recordCorrection.mockResolvedValue(mockCreatedCorrection);

      await controller.recordCorrection(mockCorrectionDto);

      const serviceCall = mockCorrectionLearningService.recordCorrection.mock.calls[0][0];
      
      expect(serviceCall).toHaveProperty('originalWord');
      expect(serviceCall).toHaveProperty('correctedWord');
      expect(serviceCall).toHaveProperty('contextSentence');
      expect(serviceCall).toHaveProperty('paragraphId');
      expect(serviceCall.originalWord).toBe('שגיאה');
      expect(serviceCall.correctedWord).toBe('תיקון');
      expect(serviceCall.contextSentence).toBe('זה המשפט עם שגיאה בתוכו.');
      expect(serviceCall.paragraphId).toBe('test-paragraph-id');
    });

    it('should handle empty context sentence', async () => {
      const dtoWithEmptyContext = {
        ...mockCorrectionDto,
        contextSentence: '',
      };

      const correctionWithEmptyContext = {
        ...mockCreatedCorrection,
        sentenceContext: '',
      };

      mockCorrectionLearningService.recordCorrection.mockResolvedValue(correctionWithEmptyContext);

      const result = await controller.recordCorrection(dtoWithEmptyContext);

      expect(mockCorrectionLearningService.recordCorrection).toHaveBeenCalledWith(
        expect.objectContaining({
          contextSentence: '',
        })
      );

      expect(result.id).toBe('test-correction-id');
      expect(result.timestamp).toBeDefined();
    });

    it('should handle service errors and rethrow them', async () => {
      const mockError = new Error('Database connection failed');
      mockCorrectionLearningService.recordCorrection.mockRejectedValue(mockError);

      await expect(controller.recordCorrection(mockCorrectionDto)).rejects.toThrow(
        'Failed to record correction'
      );
    });

    it('should return proper response structure', async () => {
      mockCorrectionLearningService.recordCorrection.mockResolvedValue(mockCreatedCorrection);

      const result = await controller.recordCorrection(mockCorrectionDto);

      // Verify response structure matches RecordCorrectionResponseDto
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('originalWord');
      expect(result).toHaveProperty('correctedWord');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.id).toBe('string');
      expect(typeof result.originalWord).toBe('string');
      expect(typeof result.correctedWord).toBe('string');
      expect(typeof result.message).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('getAllCorrections', () => {
    const mockCorrectionsResponse = {
      corrections: [
        {
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          originalWord: 'שגיאה1',
          correctedWord: 'תיקון1',
          sentenceContext: 'משפט עם שגיאה1.',
          fixType: 'substitution',
          createdAt: new Date('2025-06-22T10:00:00.000Z'),
          updatedAt: new Date('2025-06-22T10:00:00.000Z'),
          paragraph: {
            id: 'paragraph-1',
            orderIndex: 1,
            chapterNumber: 1,
            book: {
              id: 'book-1',
              title: 'Test Book',
            },
          },
          bookTitle: 'Test Book',
        },
        {
          id: 'correction-2',
          paragraphId: 'paragraph-2',
          originalWord: 'שגיאה2',
          correctedWord: 'תיקון2',
          sentenceContext: 'משפט עם שגיאה2.',
          fixType: 'insertion',
          createdAt: new Date('2025-06-22T11:00:00.000Z'),
          updatedAt: new Date('2025-06-22T11:00:00.000Z'),
          paragraph: {
            id: 'paragraph-2',
            orderIndex: 2,
            chapterNumber: 2,
            book: {
              id: 'book-1',
              title: 'Test Book',
            },
          },
          bookTitle: 'Test Book',
        },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    };

    it('should return paginated corrections with complete data structure', async () => {
      const dto: GetAllCorrectionsDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockCorrectionsResponse);

      const result = await controller.getAllCorrections(dto);

      expect(mockCorrectionLearningService.getAllCorrections).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        ...mockCorrectionsResponse,
        timestamp: expect.any(String),
      });
    });

    it('should pass through all filter parameters', async () => {
      const dto: GetAllCorrectionsDto = {
        page: 2,
        limit: 5,
        bookId: 'book-1',
        fixType: 'substitution',
        sortBy: 'originalWord',
        sortOrder: 'asc',
      };

      mockCorrectionLearningService.getAllCorrections.mockResolvedValue({
        ...mockCorrectionsResponse,
        page: 2,
        corrections: [mockCorrectionsResponse.corrections[0]],
      });

      const result = await controller.getAllCorrections(dto);

      expect(mockCorrectionLearningService.getAllCorrections).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        bookId: 'book-1',
        fixType: 'substitution',
        sortBy: 'originalWord',
        sortOrder: 'asc',
      });

      expect(result.page).toBe(2);
      expect(result.timestamp).toBeDefined();
    });

    it('should verify complete correction data structure in response', async () => {
      const dto: GetAllCorrectionsDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockCorrectionsResponse);

      const result = await controller.getAllCorrections(dto);

      // Verify response structure
      expect(result).toHaveProperty('corrections');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('totalPages');
      expect(result).toHaveProperty('timestamp');

      // Verify each correction has complete structure
      result.corrections.forEach(correction => {
        expect(correction).toHaveProperty('id');
        expect(correction).toHaveProperty('paragraphId');
        expect(correction).toHaveProperty('originalWord');
        expect(correction).toHaveProperty('correctedWord');
        expect(correction).toHaveProperty('sentenceContext');
        expect(correction).toHaveProperty('fixType');
        expect(correction).toHaveProperty('createdAt');
        expect(correction).toHaveProperty('updatedAt');
        
        // Verify paragraph structure includes chapterNumber
        expect(correction.paragraph).toHaveProperty('id');
        expect(correction.paragraph).toHaveProperty('orderIndex');
        expect(correction.paragraph).toHaveProperty('chapterNumber');
        expect(correction).toHaveProperty('bookTitle');
        expect(typeof correction.bookTitle).toBe('string');
      });
    });

    it('should handle empty results', async () => {
      const dto: GetAllCorrectionsDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const emptyResponse = {
        corrections: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };

      mockCorrectionLearningService.getAllCorrections.mockResolvedValue(emptyResponse);

      const result = await controller.getAllCorrections(dto);

      expect(result).toEqual({
        ...emptyResponse,
        timestamp: expect.any(String),
      });
      expect(result.corrections).toHaveLength(0);
    });

    it('should handle service errors', async () => {
      const dto: GetAllCorrectionsDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const mockError = new Error('Database query failed');
      mockCorrectionLearningService.getAllCorrections.mockRejectedValue(mockError);

      await expect(controller.getAllCorrections(dto)).rejects.toThrow(
        'Failed to get corrections'
      );
    });

    it('should validate sentence context is included in response', async () => {
      const dto: GetAllCorrectionsDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockCorrectionsResponse);

      const result = await controller.getAllCorrections(dto);

      result.corrections.forEach(correction => {
        expect(correction).toHaveProperty('sentenceContext');
        expect(typeof correction.sentenceContext).toBe('string');
        // Verify sentence context is not undefined or null
        expect(correction.sentenceContext).toBeDefined();
      });
    });

    describe('API Response Structure Tests', () => {
      it('should return corrections with exact structure expected by frontend', async () => {
        const mockServiceResponse = {
          corrections: [
            {
              id: 'correction-1',
              paragraphId: 'paragraph-1',
              bookId: 'book-1',
              originalWord: 'שגיאה',
              correctedWord: 'תיקון',
              sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
              fixType: 'substitution',
              createdAt: new Date('2025-06-22T10:00:00.000Z'),
              updatedAt: new Date('2025-06-22T10:00:00.000Z'),
              bookTitle: 'ספר בדיקה',
              paragraph: {
                id: 'paragraph-1',
                orderIndex: 5,
                pageId: 'page-1',
                pageNumber: 3,
              },
            },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        };

        mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockServiceResponse);

        const dto: GetAllCorrectionsDto = { page: 1, limit: 10 };
        const result = await controller.getAllCorrections(dto);

        // Verify top-level response structure
        expect(result).toHaveProperty('corrections');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('page');
        expect(result).toHaveProperty('totalPages');
        expect(result).toHaveProperty('timestamp');

        // Verify correction structure matches frontend Correction interface
        const correction = result.corrections[0];
        expect(correction).toEqual({
          id: 'correction-1',
          paragraphId: 'paragraph-1',
          bookId: 'book-1',
          originalWord: 'שגיאה',
          correctedWord: 'תיקון',
          sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
          fixType: 'substitution',
          createdAt: new Date('2025-06-22T10:00:00.000Z'),
          updatedAt: new Date('2025-06-22T10:00:00.000Z'),
          bookTitle: 'ספר בדיקה', // Direct property, not nested
          paragraph: {
            id: 'paragraph-1',
            orderIndex: 5,
            pageId: 'page-1',
            pageNumber: 3, // Flattened from nested structure
          },
        });

        // Ensure no nested book object exists
        expect(correction).not.toHaveProperty('book');
        expect(correction.paragraph).not.toHaveProperty('page');
      });

      it('should preserve all required fields for frontend table display', async () => {
        const mockServiceResponse = {
          corrections: [
            {
              id: 'correction-1',
              paragraphId: 'paragraph-1',
              bookId: 'book-1',
              originalWord: 'שגיאה',
              correctedWord: 'תיקון',
              sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
              fixType: 'substitution',
              createdAt: new Date('2025-06-22T10:00:00.000Z'),
              updatedAt: new Date('2025-06-22T10:00:00.000Z'),
              bookTitle: 'ספר בדיקה',
              paragraph: {
                id: 'paragraph-1',
                orderIndex: 5,
                pageId: 'page-1',
                pageNumber: 3,
              },
            },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        };

        mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockServiceResponse);

        const result = await controller.getAllCorrections({ page: 1, limit: 10 });
        const correction = result.corrections[0];

        // Fields required for DataGrid columns
        expect(correction).toHaveProperty('originalWord');
        expect(correction).toHaveProperty('correctedWord');
        expect(correction).toHaveProperty('sentenceContext');
        expect(correction).toHaveProperty('bookTitle'); // For book column
        expect(correction).toHaveProperty('bookId'); // For navigation links
        expect(correction).toHaveProperty('createdAt');

        // Fields required for location column and navigation
        expect(correction.paragraph).toHaveProperty('pageId'); // For page navigation
        expect(correction.paragraph).toHaveProperty('pageNumber'); // For display
        expect(correction.paragraph).toHaveProperty('orderIndex'); // For paragraph navigation

        // Verify data types match frontend expectations
        expect(typeof correction.bookTitle).toBe('string');
        expect(typeof correction.bookId).toBe('string');
        expect(typeof correction.paragraph.pageNumber).toBe('number');
        expect(typeof correction.paragraph.orderIndex).toBe('number');
      });

      it('should handle null fixType correctly for frontend display', async () => {
        const mockServiceResponse = {
          corrections: [
            {
              id: 'correction-1',
              paragraphId: 'paragraph-1',
              bookId: 'book-1',
              originalWord: 'שגיאה',
              correctedWord: 'תיקון',
              sentenceContext: 'זה המשפט עם שגיאה בתוכו.',
              fixType: null, // Test null fixType
              createdAt: new Date('2025-06-22T10:00:00.000Z'),
              updatedAt: new Date('2025-06-22T10:00:00.000Z'),
              bookTitle: 'ספר בדיקה',
              paragraph: {
                id: 'paragraph-1',
                orderIndex: 5,
                pageId: 'page-1',
                pageNumber: 3,
              },
            },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        };

        mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockServiceResponse);

        const result = await controller.getAllCorrections({ page: 1, limit: 10 });
        const correction = result.corrections[0];

        expect(correction.fixType).toBeNull();
        expect(correction).toHaveProperty('fixType'); // Property should exist
      });

      it('should maintain consistent response structure across multiple corrections', async () => {
        const mockServiceResponse = {
          corrections: [
            {
              id: 'correction-1',
              paragraphId: 'paragraph-1',
              bookId: 'book-1',
              originalWord: 'שגיאה',
              correctedWord: 'תיקון',
              sentenceContext: 'משפט ראשון',
              fixType: 'substitution',
              createdAt: new Date('2025-06-22T10:00:00.000Z'),
              updatedAt: new Date('2025-06-22T10:00:00.000Z'),
              bookTitle: 'ספר ראשון',
              paragraph: { id: 'paragraph-1', orderIndex: 1, pageId: 'page-1', pageNumber: 1 },
            },
            {
              id: 'correction-2',
              paragraphId: 'paragraph-2',
              bookId: 'book-2',
              originalWord: 'טעות',
              correctedWord: 'נכון',
              sentenceContext: 'משפט שני',
              fixType: 'manual',
              createdAt: new Date('2025-06-22T11:00:00.000Z'),
              updatedAt: new Date('2025-06-22T11:00:00.000Z'),
              bookTitle: 'ספר שני',
              paragraph: { id: 'paragraph-2', orderIndex: 3, pageId: 'page-2', pageNumber: 2 },
            },
          ],
          total: 2,
          page: 1,
          totalPages: 1,
        };

        mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockServiceResponse);

        const result = await controller.getAllCorrections({ page: 1, limit: 10 });

        expect(result.corrections).toHaveLength(2);

        // Verify each correction has consistent structure
        result.corrections.forEach((correction, index) => {
          const expectedBookTitles = ['ספר ראשון', 'ספר שני'];
          const expectedPageNumbers = [1, 2];

          expect(correction.bookTitle).toBe(expectedBookTitles[index]);
          expect(correction.paragraph.pageNumber).toBe(expectedPageNumbers[index]);

          // Verify structure consistency
          expect(correction).toHaveProperty('id');
          expect(correction).toHaveProperty('bookId');
          expect(correction).toHaveProperty('bookTitle');
          expect(correction.paragraph).toHaveProperty('id');
          expect(correction.paragraph).toHaveProperty('orderIndex');
          expect(correction.paragraph).toHaveProperty('pageId');
          expect(correction.paragraph).toHaveProperty('pageNumber');

          // Ensure no nested objects
          expect(correction).not.toHaveProperty('book');
          expect(correction.paragraph).not.toHaveProperty('page');
        });
      });

      it('should add timestamp to response for frontend logging', async () => {
        const mockServiceResponse = {
          corrections: [],
          total: 0,
          page: 1,
          totalPages: 0,
        };

        mockCorrectionLearningService.getAllCorrections.mockResolvedValue(mockServiceResponse);

        const result = await controller.getAllCorrections({ page: 1, limit: 10 });

        expect(result).toHaveProperty('timestamp');
        expect(typeof result.timestamp).toBe('string');
        expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      });
    });
  });
});
