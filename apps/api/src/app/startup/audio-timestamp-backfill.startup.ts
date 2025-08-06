import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartupLogicBase } from './startup-logic.base';

/**
 * Startup logic to backfill audioGeneratedAt timestamps for existing paragraphs
 * 
 * This runs automatically when the API service starts, but only if there are
 * paragraphs with READY audio status that are missing the audioGeneratedAt timestamp.
 */
@Injectable()
export class AudioTimestampBackfillStartup extends StartupLogicBase {
  constructor(prisma: PrismaService) {
    super(prisma, 'AudioTimestampBackfillStartup');
  }

  getName(): string {
    return 'Audio Timestamp Backfill Migration';
  }

  /**
   * Check if there are paragraphs that need audioGeneratedAt backfill
   */
  async shouldRun(): Promise<boolean> {
    try {
      const paragraphsNeedingUpdate = await this.prisma.paragraph.count({
        where: {
          audioStatus: 'READY',
          audioS3Key: { not: null },
          audioGeneratedAt: null,
        },
      });

      this.logger.log(`Found ${paragraphsNeedingUpdate} paragraphs needing audioGeneratedAt backfill`);
      
      return paragraphsNeedingUpdate > 0;
    } catch (error) {
      this.logger.error('Error checking if audio timestamp backfill is needed', error);
      return false;
    }
  }

  /**
   * Execute the audio timestamp backfill migration
   */
  async execute(): Promise<void> {
    this.logger.log('Starting audio timestamp backfill migration...');

    try {
      // Get count before update for reporting
      const beforeCount = await this.prisma.paragraph.count({
        where: {
          audioStatus: 'READY',
          audioS3Key: { not: null },
          audioGeneratedAt: null,
        },
      });

      this.logger.log(`Updating ${beforeCount} paragraphs with missing audioGeneratedAt timestamps`);

      // Perform the bulk update using raw SQL
      const updateResult = await this.prisma.$executeRaw`
        UPDATE "paragraphs" 
        SET "audioGeneratedAt" = "updatedAt" 
        WHERE "audioStatus" = 'READY' 
          AND "audioS3Key" IS NOT NULL 
          AND "audioGeneratedAt" IS NULL
      `;

      this.logger.log(`Successfully updated ${updateResult} paragraphs`);

      // Verify the update
      const afterCount = await this.prisma.paragraph.count({
        where: {
          audioStatus: 'READY',
          audioS3Key: { not: null },
          audioGeneratedAt: null,
        },
      });

      if (afterCount === 0) {
        this.logger.log('✅ All paragraphs now have audioGeneratedAt timestamps');
      } else {
        this.logger.warn(`⚠️ ${afterCount} paragraphs still missing audioGeneratedAt timestamps`);
      }

      // Report final statistics
      const totalReadyParagraphs = await this.prisma.paragraph.count({
        where: {
          audioStatus: 'READY',
          audioS3Key: { not: null },
        },
      });

      const paragraphsWithTimestamp = await this.prisma.paragraph.count({
        where: {
          audioStatus: 'READY',
          audioS3Key: { not: null },
          audioGeneratedAt: { not: null },
        },
      });

      const coverage = totalReadyParagraphs > 0 
        ? ((paragraphsWithTimestamp / totalReadyParagraphs) * 100).toFixed(1)
        : '0';

      this.logger.log(`📊 Final stats: ${paragraphsWithTimestamp}/${totalReadyParagraphs} paragraphs have timestamps (${coverage}% coverage)`);

    } catch (error) {
      this.logger.error('Error during audio timestamp backfill migration', error);
      throw error;
    }
  }
}
