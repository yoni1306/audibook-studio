import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment-specific .env file
const envFile =
  process.env['NODE_ENV'] === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { createLogger } from '@audibook/logger';
import { WinstonModule } from 'nest-winston';

// Set service name for logging
process.env['SERVICE_NAME'] = 'audibook-api';

async function bootstrap() {

  const logger = createLogger('API');

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env['PORT'] || 3333;

  await app.listen(port);

  logger.info('Application started', {
    port,
    prefix: globalPrefix,
    url: `http://localhost:${port}/${globalPrefix}`,
  });
}

bootstrap();
