import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsService } from './metrics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
