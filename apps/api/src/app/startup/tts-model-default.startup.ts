import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartupLogicBase } from './startup-logic.base';

/**
 * Startup logic to set default TTS model for books that don't have one specified
 * 
 * This runs automatically when the API service starts, but only if there are
 * books with null/empty ttsModel that need to be updated to the default 'azure' model.
 */
@Injectable()
export class TtsModelDefaultStartup extends StartupLogicBase {
  constructor(prisma: PrismaService) {
    super(prisma, 'TtsModelDefaultStartup');
  }

  getName(): string {
    return 'TTS Model Default Migration';
  }

  /**
   * Check if there are books that need default TTS model assignment
   */
  async shouldRun(): Promise<boolean> {
    try {
      const booksNeedingUpdate = await this.prisma.book.count({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
        },
      });

      this.logger.log(`Found ${booksNeedingUpdate} books needing default TTS model assignment`);
      
      return booksNeedingUpdate > 0;
    } catch (error) {
      this.logger.error('Error checking if TTS model default assignment is needed', error);
      return false;
    }
  }

  /**
   * Execute the TTS model default assignment migration
   */
  async execute(): Promise<void> {
    this.logger.log('Starting TTS model default assignment migration...');

    try {
      // Get count before update for reporting
      const countBefore = await this.prisma.book.count({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
        },
      });

      // Update books with null or empty ttsModel to use 'azure' as default
      const updateResult = await this.prisma.book.updateMany({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
        },
        data: {
          ttsModel: 'azure',
        },
      });

      this.logger.log(
        `✅ TTS model default assignment completed: ${updateResult.count} books updated (${countBefore} found)`
      );

      // Verify the update worked
      const remainingCount = await this.prisma.book.count({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
        },
      });

      if (remainingCount > 0) {
        this.logger.warn(`⚠️ ${remainingCount} books still have null/empty ttsModel after migration`);
      } else {
        this.logger.log('🎉 All books now have a TTS model assigned');
      }

    } catch (error) {
      this.logger.error('❌ Failed to execute TTS model default assignment migration', error);
      throw error;
    }
  }
}
