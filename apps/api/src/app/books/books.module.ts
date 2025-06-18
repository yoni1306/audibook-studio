import { forwardRef, Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { QueueModule } from '../queue/queue.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [QueueModule, forwardRef(() => S3Module)],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
