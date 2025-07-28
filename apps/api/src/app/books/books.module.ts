import { forwardRef, Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { TextFixesService } from './text-fixes.service';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { CorrectionLearningService } from './correction-learning.service';
import { TextCorrectionRepository } from './text-correction.repository';
import { TextFixesController } from './text-fixes.controller';
import { QueueModule } from '../queue/queue.module';
import { S3Module } from '../s3/s3.module';
import { MetricsModule } from '../metrics/metrics.module';
import { FixTypeHandlerRegistry } from './fix-type-handlers/fix-type-handler-registry';
import { VowelizationHandler } from './fix-type-handlers/vowelization-handler';
import { DisambiguationHandler } from './fix-type-handlers/disambiguation-handler';
import { PunctuationHandler } from './fix-type-handlers/punctuation-handler';
import { SentenceBreakHandler } from './fix-type-handlers/sentence-break-handler';
import { DialogueMarkingHandler } from './fix-type-handlers/dialogue-marking-handler';
import { ExpansionHandler } from './fix-type-handlers/expansion-handler';

@Module({
  imports: [QueueModule, forwardRef(() => S3Module), MetricsModule],
  controllers: [BooksController, TextFixesController],
  providers: [
    BooksService,
    TextFixesService,
    BulkTextFixesService,
    CorrectionLearningService,
    TextCorrectionRepository,
    // Fix type handlers
    VowelizationHandler,
    DisambiguationHandler,
    PunctuationHandler,
    SentenceBreakHandler,
    DialogueMarkingHandler,
    ExpansionHandler,
    FixTypeHandlerRegistry,
  ],
  exports: [BooksService, TextFixesService, BulkTextFixesService, CorrectionLearningService, TextCorrectionRepository],
})
export class BooksModule {}