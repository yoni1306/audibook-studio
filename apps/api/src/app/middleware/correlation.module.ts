import { Module } from '@nestjs/common';
import { CorrelationIdMiddleware } from './correlation.middleware';

@Module({
  providers: [CorrelationIdMiddleware],
  exports: [CorrelationIdMiddleware],
})
export class CorrelationModule {}
