import { forwardRef, Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { TextFixesService } from './text-fixes.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { CorrectionLearningService } from './correction-learning.service';
import { ParagraphDelimiterService } from './paragraph-delimiter.service';
import { TextFixesController } from './text-fixes.controller';
import { QueueModule } from '../queue/queue.module';
import { S3Module } from '../s3/s3.module';
import { ParagraphLimitsConfig } from '../../config/paragraph-limits.config';

@Module({
  imports: [QueueModule, forwardRef(() => S3Module)],
  controllers: [BooksController, TextFixesController],
  providers: [BooksService, TextFixesService, BulkTextFixesService, CorrectionLearningService, ParagraphDelimiterService, ParagraphLimitsConfig],
  exports: [BooksService, TextFixesService, BulkTextFixesService, CorrectionLearningService, ParagraphDelimiterService],
})
export class BooksModule {}