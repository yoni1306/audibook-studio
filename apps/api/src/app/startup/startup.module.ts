import { Module } from '@nestjs/common';
import { StartupService } from './startup.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Module for startup logic that runs when the API service initializes
 * 
 * This module provides:
 * - StartupService that manages and runs all startup logic
 * - Base classes for implementing new startup logic
 * - Automatic execution during application startup
 */
@Module({
  imports: [PrismaModule],
  providers: [StartupService],
  exports: [StartupService],
})
export class StartupModule {}
