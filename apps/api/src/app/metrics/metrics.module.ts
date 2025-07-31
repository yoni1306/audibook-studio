import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsService } from './metrics.service';
import { AnalyticsController } from './analytics.controller';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController, MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
