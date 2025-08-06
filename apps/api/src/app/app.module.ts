import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { S3Module } from './s3/s3.module';
import { QueueModule } from './queue/queue.module';
import { BooksModule } from './books/books.module';
import { LogsModule } from './logs/logs.module';
import { CorrelationModule } from './middleware/correlation.module';
import { CorrelationIdMiddleware } from './middleware/correlation.middleware';
import { StartupModule } from './startup/startup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    HealthModule,
    S3Module,
    QueueModule,
    BooksModule,
    LogsModule,
    CorrelationModule,
    StartupModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
