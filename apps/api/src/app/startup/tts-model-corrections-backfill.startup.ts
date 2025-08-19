import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartupLogicBase } from './startup-logic.base';

/**
 * Startup logic to backfill TTS model information for existing text corrections
 * 
 * This runs automatically when the API service starts, but only if there are
 * text corrections with null ttsModel that need to be updated with their book's TTS model.
 */
@Injectable()
export class TtsModelCorrectionsBackfillStartup extends StartupLogicBase {
  constructor(prisma: PrismaService) {
    super(prisma, 'TtsModelCorrectionsBackfillStartup');
  }

  getName(): string {
    return 'TTS Model Corrections Backfill Migration';
  }

  /**
   * Check if there are text corrections that need TTS model backfill
   */
  async shouldRun(): Promise<boolean> {
    try {
      const correctionsNeedingUpdate = await this.prisma.textCorrection.count({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
          book: {
            ttsModel: {
              not: null,
            },
          },
        },
      });

      this.logger.log(`Found ${correctionsNeedingUpdate} text corrections needing TTS model backfill`);
      
      return correctionsNeedingUpdate > 0;
    } catch (error) {
      this.logger.error('Error checking if TTS model corrections backfill is needed', error);
      return false;
    }
  }

  /**
   * Execute the TTS model corrections backfill migration
   */
  async execute(): Promise<void> {
    this.logger.log('Starting TTS model corrections backfill migration...');

    try {
      // Get count before update for reporting
      const countBefore = await this.prisma.textCorrection.count({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
          book: {
            ttsModel: {
              not: null,
            },
          },
        },
      });

      // Get all corrections that need updating with their book's TTS model
      const correctionsToUpdate = await this.prisma.textCorrection.findMany({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
          book: {
            ttsModel: {
              not: null,
            },
          },
        },
        include: {
          book: {
            select: {
              id: true,
              ttsModel: true,
              ttsVoice: true,
            },
          },
        },
      });

      this.logger.log(`Found ${correctionsToUpdate.length} corrections to update with book TTS models`);

      // Update corrections in batches to avoid overwhelming the database
      const batchSize = 100;
      let updatedCount = 0;

      for (let i = 0; i < correctionsToUpdate.length; i += batchSize) {
        const batch = correctionsToUpdate.slice(i, i + batchSize);
        
        // Update each correction in the batch
        const updatePromises = batch.map(correction => 
          this.prisma.textCorrection.update({
            where: { id: correction.id },
            data: {
              ttsModel: correction.book.ttsModel,
              ttsVoice: correction.book.ttsVoice,
            },
          })
        );

        await Promise.all(updatePromises);
        updatedCount += batch.length;
        
        this.logger.log(`Updated batch ${Math.floor(i / batchSize) + 1}: ${updatedCount}/${correctionsToUpdate.length} corrections`);
      }

      this.logger.log(
        `✅ TTS model corrections backfill completed: ${updatedCount} corrections updated (${countBefore} found)`
      );

      // Verify the update worked
      const remainingCount = await this.prisma.textCorrection.count({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
          book: {
            ttsModel: {
              not: null,
            },
          },
        },
      });

      if (remainingCount > 0) {
        this.logger.warn(`⚠️ ${remainingCount} corrections still have null/empty ttsModel after migration`);
      } else {
        this.logger.log('🎉 All corrections now have TTS model information where their book has a TTS model');
      }

    } catch (error) {
      this.logger.error('❌ Failed to execute TTS model corrections backfill migration', error);
      throw error;
    }
  }
}
