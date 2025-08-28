import { Module } from '@nestjs/common';
import { NatsQueueService } from './nats-queue.service';
import { NatsQueueController } from './nats-queue.controller';

@Module({
  controllers: [NatsQueueController],
  providers: [NatsQueueService],
  exports: [NatsQueueService],
})
export class QueueModule {}