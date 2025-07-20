import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { CorrectionLearningService } from './correction-learning.service';
import { TextCorrectionRepository } from './text-correction.repository';
import { S3Service } from '../s3/s3.service';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';

describe('BooksController - Delete Book', () => {
  let controller: BooksController;
  let booksService: jest.Mocked<BooksService>;

  beforeEach(async () => {
    const mockBooksService = {
      deleteBook: jest.fn(),
    };

    const mockBulkTextFixesService = {};
    const mockCorrectionLearningService = {};
    const mockTextCorrectionRepository = {};
    const mockS3Service = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: mockBooksService,
        },
        {
          provide: BulkTextFixesService,
          useValue: mockBulkTextFixesService,
        },
        {
          provide: CorrectionLearningService,
          useValue: mockCorrectionLearningService,
        },
        {
          provide: TextCorrectionRepository,
          useValue: mockTextCorrectionRepository,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);
    booksService = module.get(BooksService);

    // Mock the logger to avoid console output during tests
    jest.spyOn(controller['logger'], 'log').mockImplementation();
    jest.spyOn(controller['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteBook', () => {
    it('should successfully delete a book and return success response', async () => {
      // Arrange
      const bookId = 'book-123';
      booksService.deleteBook.mockResolvedValue();

      // Act
      const result = await controller.deleteBook(bookId);

      // Assert
      expect(booksService.deleteBook).toHaveBeenCalledWith(bookId);
      expect(result).toEqual({
        message: 'Book deleted successfully',
        bookId: bookId,
        timestamp: expect.any(String),
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when book is not found', async () => {
      // Arrange
      const bookId = 'non-existent-book';
      const notFoundError = new Error('Book not found: non-existent-book');
      booksService.deleteBook.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(controller.deleteBook(bookId)).rejects.toThrow(NotFoundException);

      try {
        await controller.deleteBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.getResponse()).toEqual({
          error: 'Not Found',
          message: `Book with ID ${bookId} not found`,
          statusCode: 404,
          timestamp: expect.any(String),
        });
      }

      expect(booksService.deleteBook).toHaveBeenCalledWith(bookId);
    });

    it('should throw InternalServerErrorException for database errors', async () => {
      // Arrange
      const bookId = 'book-123';
      const dbError = new Error('Database connection failed');
      booksService.deleteBook.mockRejectedValue(dbError);

      // Act & Assert
      await expect(controller.deleteBook(bookId)).rejects.toThrow(InternalServerErrorException);

      try {
        await controller.deleteBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.getResponse()).toEqual({
          error: 'Internal Server Error',
          message: 'Failed to delete book',
          statusCode: 500,
          timestamp: expect.any(String),
        });
      }

      expect(booksService.deleteBook).toHaveBeenCalledWith(bookId);
    });

    it('should throw InternalServerErrorException for S3 errors', async () => {
      // Arrange
      const bookId = 'book-123';
      const s3Error = new Error('S3 deletion failed');
      booksService.deleteBook.mockRejectedValue(s3Error);

      // Act & Assert
      await expect(controller.deleteBook(bookId)).rejects.toThrow(InternalServerErrorException);

      try {
        await controller.deleteBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.getResponse()).toEqual({
          error: 'Internal Server Error',
          message: 'Failed to delete book',
          statusCode: 500,
          timestamp: expect.any(String),
        });
      }

      expect(booksService.deleteBook).toHaveBeenCalledWith(bookId);
    });

    it('should log appropriate messages during deletion process', async () => {
      // Arrange
      const bookId = 'book-123';
      booksService.deleteBook.mockResolvedValue();

      const logSpy = jest.spyOn(controller['logger'], 'log');

      // Act
      await controller.deleteBook(bookId);

      // Assert
      expect(logSpy).toHaveBeenCalledWith(`🗑️ [API] Deleting book: ${bookId}`);
      expect(logSpy).toHaveBeenCalledWith(`✅ [API] Book deleted successfully: ${bookId}`);
    });

    it('should log error messages when deletion fails', async () => {
      // Arrange
      const bookId = 'book-123';
      const error = new Error('Deletion failed');
      booksService.deleteBook.mockRejectedValue(error);

      const errorSpy = jest.spyOn(controller['logger'], 'error');

      // Act & Assert
      await expect(controller.deleteBook(bookId)).rejects.toThrow(InternalServerErrorException);

      expect(errorSpy).toHaveBeenCalledWith(`❌ [API] Failed to delete book ${bookId}:`, 'Deletion failed');
    });

    it('should handle empty or invalid book IDs', async () => {
      // Arrange
      const invalidBookId = '';
      const error = new Error('Book not found: ');
      booksService.deleteBook.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.deleteBook(invalidBookId)).rejects.toThrow(NotFoundException);

      expect(booksService.deleteBook).toHaveBeenCalledWith(invalidBookId);
    });

    it('should handle UUID format book IDs correctly', async () => {
      // Arrange
      const uuidBookId = '550e8400-e29b-41d4-a716-446655440000';
      booksService.deleteBook.mockResolvedValue();

      // Act
      const result = await controller.deleteBook(uuidBookId);

      // Assert
      expect(booksService.deleteBook).toHaveBeenCalledWith(uuidBookId);
      expect(result.bookId).toBe(uuidBookId);
    });

    it('should differentiate between not found and other errors correctly', async () => {
      // Arrange - Test "Book not found" error
      const bookId1 = 'not-found-book';
      const notFoundError = new Error('Book not found: not-found-book');
      booksService.deleteBook.mockRejectedValueOnce(notFoundError);

      // Act & Assert - Should throw NotFoundException
      await expect(controller.deleteBook(bookId1)).rejects.toThrow(NotFoundException);

      // Arrange - Test other error
      const bookId2 = 'other-error-book';
      const otherError = new Error('Some other error occurred');
      booksService.deleteBook.mockRejectedValueOnce(otherError);

      // Act & Assert - Should throw InternalServerErrorException
      await expect(controller.deleteBook(bookId2)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
