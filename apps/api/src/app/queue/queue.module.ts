import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AudioProcessorService } from './audio-processor.service';
import { EpubProcessorService } from './epub-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsModule } from '../metrics/metrics.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: process.env['REDIS_URL'] ? {
        // Parse Redis URL to extract connection details
        host: new URL(process.env['REDIS_URL']).hostname,
        port: parseInt(new URL(process.env['REDIS_URL']).port) || 6379,
        password: new URL(process.env['REDIS_URL']).password || undefined,
        family: 0, // Enable dual-stack lookup for Railway IPv6 support
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null, // BullMQ requirement
        lazyConnect: true,
        connectTimeout: 60000,
        commandTimeout: 30000, // Increased for Railway network conditions
      } : {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'], 10) || 6379,
        family: 0, // Enable dual-stack lookup for Railway IPv6 support
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null, // BullMQ requirement
        lazyConnect: true,
        connectTimeout: 60000,
        commandTimeout: 30000, // Increased for Railway network conditions
      },
    }),
    BullModule.registerQueue({
      name: 'audio',
    }),
    BullModule.registerQueue({
      name: 'epub',
    }),
    PrismaModule,
    forwardRef(() => MetricsModule),
    forwardRef(() => S3Module),
  ],
  controllers: [QueueController],
  providers: [QueueService, AudioProcessorService, EpubProcessorService],
  exports: [QueueService],
})
export class QueueModule {}