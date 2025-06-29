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
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';

// Set service name for logging
process.env['SERVICE_NAME'] = 'audibook-api';

async function bootstrap() {
  const logger = createLogger('API');

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? [
          process.env.WEB_URL, // Your production web URL
          'https://audibook.app', // Your domain
        ].filter(Boolean)
      : true, // Allow all origins in development
    credentials: true,
  });

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('Audibook API')
    .setDescription('The Audibook API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  
  // Write OpenAPI spec to file for type generation (local file only)
  fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  
  // Note: HTTP endpoints for OpenAPI spec removed to enforce local file usage
  // This prevents discrepancies between HTTP endpoint and local file

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env['PORT'] || 3333;

  await app.listen(port);

  logger.info('Application started', {
    port,
    prefix: globalPrefix,
    url: `http://localhost:${port}/${globalPrefix}`,
    openApiSpec: './openapi.json (local file only)',
  });
}

bootstrap();