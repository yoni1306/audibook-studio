import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Base class for startup logic that runs when the API service starts
 * 
 * Implementing classes should:
 * 1. Override shouldRun() to define when the logic should execute
 * 2. Override execute() to define what the logic does
 * 3. Provide a descriptive name via getName()
 */
export abstract class StartupLogicBase {
  protected readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaService,
    loggerContext?: string
  ) {
    this.logger = new Logger(loggerContext || this.constructor.name);
  }

  /**
   * Get a descriptive name for this startup logic
   */
  abstract getName(): string;

  /**
   * Determine if this startup logic should run
   * @returns Promise<boolean> - true if the logic should execute
   */
  abstract shouldRun(): Promise<boolean>;

  /**
   * Execute the startup logic
   * @returns Promise<void>
   */
  abstract execute(): Promise<void>;

  /**
   * Run the startup logic with proper logging and error handling
   */
  async run(): Promise<void> {
    const name = this.getName();
    
    try {
      this.logger.log(`🔍 Checking if startup logic should run: ${name}`);
      
      const shouldExecute = await this.shouldRun();
      
      if (!shouldExecute) {
        this.logger.log(`⏭️ Skipping startup logic: ${name} (conditions not met)`);
        return;
      }

      this.logger.log(`🚀 Running startup logic: ${name}`);
      const startTime = Date.now();
      
      await this.execute();
      
      const duration = Date.now() - startTime;
      this.logger.log(`✅ Completed startup logic: ${name} (${duration}ms)`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to run startup logic: ${name}`, error);
      // Don't throw - we don't want startup logic failures to crash the service
      // Just log the error and continue
    }
  }
}
