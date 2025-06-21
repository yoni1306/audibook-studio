import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  CORRELATION_ID_HEADER,
  getCorrelationId,
  withCorrelationId,
} from '@audibook/correlation';
import { createLogger } from '@audibook/logger';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private logger;

  constructor() {
    this.logger = createLogger('Correlation');
  }

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();

    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      withCorrelationId(correlationId, () => {
        this.logger.info('Request completed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          correlationId,
        });
      });
    });

    withCorrelationId(correlationId, () => {
      this.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        correlationId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      next();
    });
  }
}
