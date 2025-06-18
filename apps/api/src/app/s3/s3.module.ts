import { forwardRef, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { S3Controller } from './s3.controller';
import { BooksModule } from '../books/books.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => BooksModule), QueueModule],
  controllers: [S3Controller],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
