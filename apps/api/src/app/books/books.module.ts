import { forwardRef, Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { TextFixesService } from './text-fixes.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { TextFixesController } from './text-fixes.controller';
import { QueueModule } from '../queue/queue.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [QueueModule, forwardRef(() => S3Module)],
  controllers: [BooksController, TextFixesController],
  providers: [BooksService, TextFixesService, BulkTextFixesService],
  exports: [BooksService, TextFixesService, BulkTextFixesService],
})
export class BooksModule {}