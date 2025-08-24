import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartupLogicBase } from './base/startup-logic.base';
import { AudioTimestampBackfillStartup } from './logic/audio-timestamp-backfill.startup';
import { TtsModelDefaultStartup } from './logic/tts-model-default.startup';

/**
 * Service that manages and executes startup logic when the API service starts
 * 
 * This service:
 * 1. Registers all startup logic classes
 * 2. Runs them in sequence during module initialization
 * 3. Provides centralized logging and error handling
 */
@Injectable()
export class StartupService implements OnModuleInit {
  private readonly logger = new Logger(StartupService.name);
  private startupLogics: StartupLogicBase[] = [];

  constructor(private readonly prisma: PrismaService) {
    // Register all startup logic classes here
    this.registerStartupLogic();
  }

  /**
   * Register all startup logic classes
   * Add new startup logic classes to this method
   */
  private registerStartupLogic(): void {
    this.startupLogics.push(
      new AudioTimestampBackfillStartup(this.prisma),
      new TtsModelDefaultStartup(this.prisma)
      // Add more startup logic classes here as needed
    );
  }

  /**
   * Called when the module is initialized - runs all startup logic
   */
  async onModuleInit(): Promise<void> {
    if (this.startupLogics.length === 0) {
      this.logger.log('No startup logic registered');
      return;
    }

    this.logger.log(`🚀 Running ${this.startupLogics.length} startup logic(s)...`);
    const startTime = Date.now();

    let successCount = 0;
    let failureCount = 0;

    for (const startupLogic of this.startupLogics) {
      try {
        await startupLogic.run();
        successCount++;
      } catch (error) {
        failureCount++;
        this.logger.error(`Failed to run startup logic: ${startupLogic.getName()}`, error);
        // Continue with other startup logic even if one fails
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `✅ Startup logic completed: ${successCount} succeeded, ${failureCount} failed (${duration}ms total)`
    );

    if (failureCount > 0) {
      this.logger.warn(`⚠️ ${failureCount} startup logic(s) failed - check logs above for details`);
    }
  }

  /**
   * Get all registered startup logic names (useful for debugging)
   */
  getRegisteredStartupLogics(): string[] {
    return this.startupLogics.map(logic => logic.getName());
  }
}
