import { Controller, Post, Body, Logger } from '@nestjs/common';
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
    @Body() body: { filename: string; contentType: string }
  ) {
    const { filename, contentType } = body;
    const key = `raw/${Date.now()}-${filename}`;

    this.logger.log(`Generating presigned URL for ${filename}`);

    // Get presigned URL
    const result = await this.s3Service.getPresignedUploadUrl(key, contentType);

    // Create book record
    const book = await this.booksService.createBook({
      title: filename.replace('.epub', ''),
      s3Key: key,
    });

    this.logger.log(`Created book ${book.id} for file ${key}`);

    // Start async file monitoring and job queueing
    this.monitorAndQueueJob(book.id, key).catch((error) => {
      this.logger.error(
        `Failed to monitor and queue job for book ${book.id}:`,
        error
      );
    });

    return {
      uploadUrl: result.url,
      key: result.key,
      bookId: book.id,
    };
  }

  private async monitorAndQueueJob(bookId: string, s3Key: string) {
    this.logger.log(`Starting to monitor file ${s3Key} for book ${bookId}`);

    // Wait for file to be available in S3
    const fileAvailable = await this.s3Service.waitForFile(s3Key);

    if (fileAvailable) {
      // File is ready, queue the parsing job
      await this.queueService.addEpubParsingJob({
        bookId,
        s3Key,
      });
      this.logger.log(`Successfully queued parsing job for book ${bookId}`);
    } else {
      // File never became available, update book status to ERROR
      await this.booksService.updateBookStatus(bookId, 'ERROR' as any);
      this.logger.error(`File never became available for book ${bookId}`);
    }
  }
}
