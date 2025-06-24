import { Controller, Post, Body, Logger, InternalServerErrorException } from '@nestjs/common';
import { S3Service } from './s3.service';
import { BooksService } from '../books/books.service';
import { QueueService } from '../queue/queue.service';

@Controller('s3')
export class S3Controller {
  private readonly logger = new Logger(S3Controller.name);

  constructor(
    private s3Service: S3Service,
    private booksService: BooksService,
    private queueService: QueueService
  ) {}

  @Post('presigned-upload')
  async getPresignedUploadUrl(
    @Body() body: { filename: string; contentType: string; chapterTitles?: string[] }
  ) {
    try {
      const { filename, contentType, chapterTitles } = body;
      const key = `raw/${Date.now()}-${filename}`;

      this.logger.log(`📤 [API] Generating presigned URL for ${filename}`);
      if (chapterTitles && chapterTitles.length > 0) {
        this.logger.log(`📚 [API] User provided ${chapterTitles.length} chapter titles`);
      }

      // Get presigned URL
      const result = await this.s3Service.getPresignedUploadUrl(key, contentType);

      // Create book record with chapter titles
      const book = await this.booksService.createBook({
        title: filename.replace('.epub', ''),
        s3Key: key,
        chapterTitles: chapterTitles || [],
      });

      this.logger.log(`📚 [API] Created book ${book.id} for file ${key}`);

      // Start async file monitoring and job queueing
      this.monitorAndQueueJob(book.id, key).catch((error) => {
        this.logger.error(
          `💥 [API] Failed to monitor and queue job for book ${book.id}:`,
          error
        );
      });

      return {
        uploadUrl: result.url,
        key: result.key,
        bookId: book.id,
        filename,
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

  private async monitorAndQueueJob(bookId: string, s3Key: string) {
    this.logger.log(`👀 [API] Starting to monitor file ${s3Key} for book ${bookId}`);

    try {
      // Wait for file to be available in S3
      const fileAvailable = await this.s3Service.waitForFile(s3Key);

      if (fileAvailable) {
        // File is ready, queue the parsing job
        await this.queueService.addEpubParsingJob({
          bookId,
          s3Key,
        });
        this.logger.log(`✅ [API] Successfully queued parsing job for book ${bookId}`);
      } else {
        // File never became available, update book status to ERROR
        await this.booksService.updateBookStatus(bookId, 'ERROR' as any);
        this.logger.error(`❌ [API] File never became available for book ${bookId}`);
      }
    } catch (error) {
      this.logger.error(`💥 [API] Error monitoring and queueing job for book ${bookId}: ${error.message}`, error.stack);
      // Update book status to ERROR if monitoring fails
      try {
        await this.booksService.updateBookStatus(bookId, 'ERROR' as any);
      } catch (updateError) {
        this.logger.error(`💥 [API] Failed to update book status to ERROR for book ${bookId}: ${updateError.message}`);
      }
    }
  }
}
