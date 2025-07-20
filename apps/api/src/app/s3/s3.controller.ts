import { Controller, Post, Body, Logger, InternalServerErrorException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { BookStatus } from '@prisma/client';
import { S3Service } from './s3.service';
import { BooksService } from '../books/books.service';
import { QueueService } from '../queue/queue.service';
import { PresignedUploadResponseDto } from './dto/s3.dto';

@Controller('s3')
export class S3Controller {
  private readonly logger = new Logger(S3Controller.name);

  constructor(
    private s3Service: S3Service,
    private booksService: BooksService,
    private queueService: QueueService
  ) {}

  /**
   * Properly decode filename from multipart form data to handle Hebrew and other non-ASCII characters
   * This fixes the mojibake issue where Hebrew filenames get corrupted during upload
   */
  private decodeFilename(filename: string): string {
    try {
      // First, check if the filename is already properly encoded
      if (this.containsHebrewCharacters(filename)) {
        return filename; // Already properly decoded
      }

      // Try to decode from Latin1 to UTF-8 (common multipart encoding issue)
      const buffer = Buffer.from(filename, 'latin1');
      const decoded = buffer.toString('utf8');
      
      // Verify the decoding worked by checking for Hebrew characters or valid UTF-8
      if (this.containsHebrewCharacters(decoded) || this.isValidUTF8(decoded)) {
        this.logger.log(`📝 [S3] Successfully decoded filename: ${filename} -> ${decoded}`);
        return decoded;
      }

      // If decoding didn't help, return original
      return filename;
    } catch (error) {
      this.logger.warn(`⚠️ [S3] Failed to decode filename ${filename}: ${error.message}`);
      return filename; // Fallback to original
    }
  }

  /**
   * Check if string contains Hebrew characters (Unicode range U+0590-U+05FF)
   */
  private containsHebrewCharacters(text: string): boolean {
    return /[\u0590-\u05FF]/.test(text);
  }

  /**
   * Check if string is valid UTF-8 and doesn't contain replacement characters
   */
  private isValidUTF8(text: string): boolean {
    // Check for replacement characters that indicate encoding issues
    if (text.includes('\uFFFD') || text.includes('�')) {
      return false;
    }
    
    // Basic validation - if we can encode and decode without issues, it's likely valid
    try {
      const encoded = Buffer.from(text, 'utf8');
      const decoded = encoded.toString('utf8');
      return decoded === text;
    } catch {
      return false;
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file directly through API', description: 'Upload file through API proxy to S3, eliminating CORS issues' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiBody({
    description: 'File upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'EPUB file to upload'
        },
        parsingMethod: {
          type: 'string',
          enum: ['page-based', 'xhtml-based'],
          description: 'Method to use for parsing the EPUB'
        }
      },
      required: ['file']
    }
  })
  async uploadFile(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() body: { parsingMethod?: 'page-based' | 'xhtml-based' }
  ) {
    try {
      if (!file) {
        throw new InternalServerErrorException('No file provided');
      }

      const { parsingMethod = 'page-based' } = body;
      
      // Properly decode the filename to handle Hebrew and other non-ASCII characters
      const decodedFilename = this.decodeFilename(file.originalname);
      const key = `raw/${Date.now()}-${decodedFilename}`;

      this.logger.log(`📤 [API] Uploading file ${decodedFilename} directly through API (original: ${file.originalname})`);

      // Upload file directly to S3
      await this.s3Service.uploadFile(key, file.buffer, file.mimetype);

      // Create book record with properly decoded title
      const book = await this.booksService.createBook({
        title: decodedFilename.replace('.epub', ''),
        s3Key: key,
      });

      this.logger.log(`📚 [API] Created book ${book.id} for file ${key}`);

      // Queue parsing job immediately since file is already uploaded
      await this.queueService.addEpubParsingJob({
        bookId: book.id,
        s3Key: key,
        parsingMethod,
      });

      this.logger.log(`✅ [API] Successfully queued parsing job for book ${book.id}`);

      return {
        bookId: book.id,
        filename: decodedFilename, // Return the properly decoded filename
        key,
        message: 'File uploaded and parsing started',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error uploading file: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to upload file',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Post('presigned-upload')
  @ApiOperation({ summary: 'Get presigned upload URL', description: 'Generate a presigned URL for uploading files to S3' })
  @ApiResponse({ status: 200, description: 'Successfully generated presigned upload URL', type: PresignedUploadResponseDto })
  @ApiBody({
    description: 'File upload details',
    schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name of the file to upload' },
        contentType: { type: 'string', description: 'MIME type of the file' }
      },
      required: ['filename', 'contentType']
    }
  })
  async getPresignedUploadUrl(
    @Body() body: { filename: string; contentType: string; parsingMethod?: 'page-based' | 'xhtml-based' }
  ) {
    try {
      const { filename, contentType, parsingMethod = 'page-based' } = body;
      
      // Properly decode the filename to handle Hebrew and other non-ASCII characters
      const decodedFilename = this.decodeFilename(filename);
      const key = `raw/${Date.now()}-${decodedFilename}`;

      this.logger.log(`📤 [API] Generating presigned URL for ${decodedFilename} (original: ${filename})`);

      // Get presigned URL
      const result = await this.s3Service.getPresignedUploadUrl(key, contentType);

      // Create book record with properly decoded title
      const book = await this.booksService.createBook({
        title: decodedFilename.replace('.epub', ''),
        s3Key: key,
      });

      this.logger.log(`📚 [API] Created book ${book.id} for file ${key}`);

      // Start async file monitoring and job queueing
      this.monitorAndQueueJob(book.id, key, parsingMethod).catch((error) => {
        this.logger.error(
          `💥 [API] Failed to monitor and queue job for book ${book.id}:`,
          error
        );
      });

      return {
        uploadUrl: result.url,
        key: result.key,
        bookId: book.id,
        filename: decodedFilename, // Return the properly decoded filename
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error generating presigned upload URL: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to generate presigned upload URL',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async monitorAndQueueJob(bookId: string, s3Key: string, parsingMethod: 'page-based' | 'xhtml-based' = 'page-based') {
    this.logger.log(`👀 [API] Starting to monitor file ${s3Key} for book ${bookId}`);

    try {
      // Wait for file to be available in S3
      const fileAvailable = await this.s3Service.waitForFile(s3Key);

      if (fileAvailable) {
        // File is ready, queue the parsing job
        await this.queueService.addEpubParsingJob({
          bookId,
          s3Key,
          parsingMethod,
        });
        this.logger.log(`✅ [API] Successfully queued parsing job for book ${bookId}`);
      } else {
        // File never became available, update book status to ERROR
        await this.booksService.updateBookStatus(bookId, BookStatus.ERROR);
        this.logger.error(`❌ [API] File never became available for book ${bookId}`);
      }
    } catch (error) {
      this.logger.error(`💥 [API] Error monitoring and queueing job for book ${bookId}: ${error.message}`, error.stack);
      // Update book status to ERROR if monitoring fails
      try {
        await this.booksService.updateBookStatus(bookId, BookStatus.ERROR);
      } catch (updateError) {
        this.logger.error(`💥 [API] Failed to update book status to ERROR for book ${bookId}: ${updateError.message}`);
      }
    }
  }
}
