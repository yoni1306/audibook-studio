import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { S3Controller } from './s3.controller';
import { S3Service } from './s3.service';
import { BooksService } from '../books/books.service';
import { QueueService } from '../queue/queue.service';
import { BookStatus } from '@prisma/client';

describe('S3Controller', () => {
  let controller: S3Controller;
  let s3Service: jest.Mocked<S3Service>;
  let booksService: jest.Mocked<BooksService>;
  let queueService: jest.Mocked<QueueService>;

  const mockBook = {
    id: 'book-123',
    title: 'Test Book',
    author: 'Test Author',
    language: 'en',
    uploadedAt: new Date(),
    s3Key: 'raw/123456789-test.epub',
    status: BookStatus.UPLOADING,
    totalPages: 0,
    totalParagraphs: 0,
    processingMetadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockS3Service = {
      uploadFile: jest.fn(),
      getPresignedUploadUrl: jest.fn(),
      waitForFile: jest.fn(),
    };

    const mockBooksService = {
      createBook: jest.fn(),
      updateBookStatus: jest.fn(),
    };

    const mockQueueService = {
      addEpubParsingJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [S3Controller],
      providers: [
        { provide: S3Service, useValue: mockS3Service },
        { provide: BooksService, useValue: mockBooksService },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    controller = module.get<S3Controller>(S3Controller);
    s3Service = module.get(S3Service);
    booksService = module.get(BooksService);
    queueService = module.get(QueueService);
  });

  describe('Hebrew Filename Encoding', () => {
    describe('decodeFilename', () => {
      it('should return Hebrew filename unchanged if already properly encoded', () => {
        const hebrewFilename = 'ספר_עברי.epub';
        // Access private method for testing
        const result = (controller as unknown as { decodeFilename: (filename: string) => string }).decodeFilename(hebrewFilename);
        expect(result).toBe(hebrewFilename);
      });

      it('should decode corrupted Hebrew filename from Latin1 to UTF-8', () => {
        // Simulate corrupted Hebrew filename (Hebrew text encoded as Latin1)
        const hebrewText = 'ספר_עברי.epub';
        const corruptedFilename = Buffer.from(hebrewText, 'utf8').toString('latin1');
        
        const result = (controller as unknown as { decodeFilename: (filename: string) => string }).decodeFilename(corruptedFilename);
        expect(result).toBe(hebrewText);
      });

      it('should handle mixed Hebrew and English filenames', () => {
        const mixedFilename = 'My Book - ספר שלי.epub';
        const result = (controller as unknown as { decodeFilename: (filename: string) => string }).decodeFilename(mixedFilename);
        expect(result).toBe(mixedFilename);
      });

      it('should return original filename if decoding fails', () => {
        const filename = 'regular-book.epub';
        const result = (controller as unknown as { decodeFilename: (filename: string) => string }).decodeFilename(filename);
        expect(result).toBe(filename);
      });

      it('should handle empty or null filenames gracefully', () => {
        const controllerWithPrivate = controller as unknown as { decodeFilename: (filename: string | null | undefined) => string | null | undefined };
        expect(controllerWithPrivate.decodeFilename('')).toBe('');
        expect(controllerWithPrivate.decodeFilename(null)).toBe(null);
        expect(controllerWithPrivate.decodeFilename(undefined)).toBe(undefined);
      });
    });

    describe('containsHebrewCharacters', () => {
      it('should detect Hebrew characters', () => {
        const controllerWithPrivate = controller as unknown as { containsHebrewCharacters: (text: string) => boolean };
        expect(controllerWithPrivate.containsHebrewCharacters('ספר')).toBe(true);
        expect(controllerWithPrivate.containsHebrewCharacters('Hello ספר World')).toBe(true);
        expect(controllerWithPrivate.containsHebrewCharacters('שלום')).toBe(true);
      });

      it('should return false for non-Hebrew text', () => {
        const controllerWithPrivate = controller as unknown as { containsHebrewCharacters: (text: string) => boolean };
        expect(controllerWithPrivate.containsHebrewCharacters('English Book')).toBe(false);
        expect(controllerWithPrivate.containsHebrewCharacters('123456')).toBe(false);
        expect(controllerWithPrivate.containsHebrewCharacters('Book.epub')).toBe(false);
      });

      it('should handle empty strings', () => {
        const controllerWithPrivate = controller as unknown as { containsHebrewCharacters: (text: string) => boolean };
        expect(controllerWithPrivate.containsHebrewCharacters('')).toBe(false);
      });
    });

    describe('isValidUTF8', () => {
      it('should detect valid UTF-8 strings', () => {
        const controllerWithPrivate = controller as unknown as { isValidUTF8: (text: string) => boolean };
        expect(controllerWithPrivate.isValidUTF8('Hello World')).toBe(true);
        expect(controllerWithPrivate.isValidUTF8('ספר עברי')).toBe(true);
        expect(controllerWithPrivate.isValidUTF8('Mixed ספר Text')).toBe(true);
      });

      it('should detect invalid UTF-8 with replacement characters', () => {
        const controllerWithPrivate = controller as unknown as { isValidUTF8: (text: string) => boolean };
        expect(controllerWithPrivate.isValidUTF8('Text with \uFFFD replacement')).toBe(false);
        expect(controllerWithPrivate.isValidUTF8('Text with � replacement')).toBe(false);
      });

      it('should handle empty strings', () => {
        const controllerWithPrivate = controller as unknown as { isValidUTF8: (text: string) => boolean };
        expect(controllerWithPrivate.isValidUTF8('')).toBe(true);
      });
    });
  });

  describe('uploadFile', () => {
    const mockFile = {
      buffer: Buffer.from('test epub content'),
      originalname: 'test-book.epub',
      mimetype: 'application/epub+zip',
      size: 1024,
    };

    beforeEach(() => {
      s3Service.uploadFile.mockResolvedValue(undefined);
      booksService.createBook.mockResolvedValue(mockBook);
      queueService.addEpubParsingJob.mockResolvedValue(undefined);
    });

    it('should handle Hebrew filenames correctly in direct upload', async () => {
      const hebrewFile = {
        ...mockFile,
        originalname: 'ספר_עברי.epub',
      };

      const result = await controller.uploadFile(hebrewFile, { parsingMethod: 'page-based' });

      expect(booksService.createBook).toHaveBeenCalledWith({
        title: 'ספר_עברי',
        s3Key: expect.stringMatching(/^raw\/\d+-ספר_עברי\.epub$/),
      });

      expect(result.filename).toBe('ספר_עברי.epub');
      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        expect.stringMatching(/^raw\/\d+-ספר_עברי\.epub$/),
        hebrewFile.buffer,
        hebrewFile.mimetype
      );
    });

    it('should decode corrupted Hebrew filenames in direct upload', async () => {
      // Simulate corrupted Hebrew filename
      const hebrewText = 'ספר_עברי.epub';
      const corruptedFilename = Buffer.from(hebrewText, 'utf8').toString('latin1');
      
      const corruptedFile = {
        ...mockFile,
        originalname: corruptedFilename,
      };

      const result = await controller.uploadFile(corruptedFile, { parsingMethod: 'page-based' });

      expect(booksService.createBook).toHaveBeenCalledWith({
        title: 'ספר_עברי',
        s3Key: expect.stringMatching(/^raw\/\d+-ספר_עברי\.epub$/),
      });

      expect(result.filename).toBe('ספר_עברי.epub');
    });

    it('should handle mixed Hebrew and English filenames', async () => {
      const mixedFile = {
        ...mockFile,
        originalname: 'My Book - ספר שלי.epub',
      };

      const result = await controller.uploadFile(mixedFile, { parsingMethod: 'page-based' });

      expect(booksService.createBook).toHaveBeenCalledWith({
        title: 'My Book - ספר שלי',
        s3Key: expect.stringMatching(/^raw\/\d+-My Book - ספר שלי\.epub$/),
      });

      expect(result.filename).toBe('My Book - ספר שלי.epub');
    });

    it('should throw error when no file is provided', async () => {
      await expect(controller.uploadFile(null, { parsingMethod: 'page-based' }))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('should use default parsing method when not specified', async () => {
      await controller.uploadFile(mockFile, {});

      expect(queueService.addEpubParsingJob).toHaveBeenCalledWith({
        bookId: mockBook.id,
        s3Key: expect.any(String),
        parsingMethod: 'page-based',
      });
    });
  });

  describe('getPresignedUploadUrl', () => {
    const mockPresignedResult = {
      url: 'https://s3.amazonaws.com/presigned-url',
      key: 'raw/123456789-test.epub',
    };

    beforeEach(() => {
      s3Service.getPresignedUploadUrl.mockResolvedValue(mockPresignedResult);
      booksService.createBook.mockResolvedValue(mockBook);
      s3Service.waitForFile.mockResolvedValue(true);
      queueService.addEpubParsingJob.mockResolvedValue(undefined);
    });

    it('should handle Hebrew filenames correctly in presigned upload', async () => {
      const hebrewFilename = 'ספר_עברי.epub';
      
      const result = await controller.getPresignedUploadUrl({
        filename: hebrewFilename,
        contentType: 'application/epub+zip',
        parsingMethod: 'page-based',
      });

      expect(booksService.createBook).toHaveBeenCalledWith({
        title: 'ספר_עברי',
        s3Key: expect.stringMatching(/^raw\/\d+-ספר_עברי\.epub$/),
      });

      expect(result.filename).toBe('ספר_עברי.epub');
      expect(s3Service.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^raw\/\d+-ספר_עברי\.epub$/),
        'application/epub+zip'
      );
    });

    it('should decode corrupted Hebrew filenames in presigned upload', async () => {
      // Simulate corrupted Hebrew filename
      const hebrewText = 'ספר_עברי.epub';
      const corruptedFilename = Buffer.from(hebrewText, 'utf8').toString('latin1');
      
      const result = await controller.getPresignedUploadUrl({
        filename: corruptedFilename,
        contentType: 'application/epub+zip',
        parsingMethod: 'page-based',
      });

      expect(booksService.createBook).toHaveBeenCalledWith({
        title: 'ספר_עברי',
        s3Key: expect.stringMatching(/^raw\/\d+-ספר_עברי\.epub$/),
      });

      expect(result.filename).toBe('ספר_עברי.epub');
    });

    it('should handle mixed Hebrew and English filenames', async () => {
      const mixedFilename = 'My Book - ספר שלי.epub';
      
      const result = await controller.getPresignedUploadUrl({
        filename: mixedFilename,
        contentType: 'application/epub+zip',
        parsingMethod: 'xhtml-based',
      });

      expect(booksService.createBook).toHaveBeenCalledWith({
        title: 'My Book - ספר שלי',
        s3Key: expect.stringMatching(/^raw\/\d+-My Book - ספר שלי\.epub$/),
      });

      expect(result.filename).toBe('My Book - ספר שלי.epub');
    });

    it('should use default parsing method when not specified', async () => {
      await controller.getPresignedUploadUrl({
        filename: 'test.epub',
        contentType: 'application/epub+zip',
      });

      // Wait a bit for the async monitoring to potentially complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(queueService.addEpubParsingJob).toHaveBeenCalledWith({
        bookId: mockBook.id,
        s3Key: expect.any(String),
        parsingMethod: 'page-based',
      });
    });
  });

  describe('error handling', () => {
    it('should handle S3 upload errors gracefully', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.epub',
        mimetype: 'application/epub+zip',
        size: 1024,
      };

      s3Service.uploadFile.mockRejectedValue(new Error('S3 upload failed'));

      await expect(controller.uploadFile(mockFile, { parsingMethod: 'page-based' }))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('should handle book creation errors gracefully', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.epub',
        mimetype: 'application/epub+zip',
        size: 1024,
      };

      s3Service.uploadFile.mockResolvedValue(undefined);
      booksService.createBook.mockRejectedValue(new Error('Database error'));

      await expect(controller.uploadFile(mockFile, { parsingMethod: 'page-based' }))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('should handle presigned URL generation errors gracefully', async () => {
      s3Service.getPresignedUploadUrl.mockRejectedValue(new Error('S3 presigned URL failed'));

      await expect(controller.getPresignedUploadUrl({
        filename: 'test.epub',
        contentType: 'application/epub+zip',
      })).rejects.toThrow(InternalServerErrorException);
    });
  });
});
