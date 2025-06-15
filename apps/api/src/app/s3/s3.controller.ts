import { Controller, Post, Body } from '@nestjs/common';
import { S3Service } from './s3.service';
import { BooksService } from '../books/books.service';
import { QueueService } from '../queue/queue.service';

@Controller('s3')
export class S3Controller {
  constructor(
    private s3Service: S3Service,
    private booksService: BooksService,
    private queueService: QueueService,
  ) {}

  @Post('presigned-upload')
  async getPresignedUploadUrl(
    @Body() body: { filename: string; contentType: string }
  ) {
    const { filename, contentType } = body;
    const key = `raw/${Date.now()}-${filename}`;
    
    const result = await this.s3Service.getPresignedUploadUrl(key, contentType);
    
    // Create book record
    const book = await this.booksService.createBook({
      title: filename.replace('.epub', ''),
      s3Key: key,
    });

    // Queue parsing job
    await this.queueService.addEpubParsingJob({
      bookId: book.id,
      s3Key: key,
    });
    
    return {
      uploadUrl: result.url,
      key: result.key,
      bookId: book.id,
    };
  }
}