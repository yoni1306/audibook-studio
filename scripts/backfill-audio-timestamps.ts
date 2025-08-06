#!/usr/bin/env tsx

/**
 * Migration script to backfill audioGeneratedAt timestamps for existing paragraphs
 * 
 * This script updates paragraphs that:
 * 1. Have audioStatus = 'READY' (meaning audio was successfully generated)
 * 2. Have audioS3Key (meaning audio file exists)
 * 3. Have audioGeneratedAt = null (missing timestamp)
 * 
 * For these paragraphs, it sets audioGeneratedAt = updatedAt as a reasonable approximation
 * of when the audio was generated.
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const prisma = new PrismaClient();

async function backfillAudioTimestamps() {
  console.log('🚀 Starting audio timestamp backfill migration...');
  
  try {
    // First, let's see how many paragraphs need updating
    const paragraphsNeedingUpdate = await prisma.paragraph.count({
      where: {
        audioStatus: 'READY',
        audioS3Key: { not: null },
        audioGeneratedAt: null,
      },
    });

    console.log(`📊 Found ${paragraphsNeedingUpdate} paragraphs that need audioGeneratedAt backfill`);

    if (paragraphsNeedingUpdate === 0) {
      console.log('✅ No paragraphs need updating. Migration complete!');
      return;
    }

    // Get detailed info about the paragraphs we're about to update
    const paragraphsToUpdate = await prisma.paragraph.findMany({
      where: {
        audioStatus: 'READY',
        audioS3Key: { not: null },
        audioGeneratedAt: null,
      },
      select: {
        id: true,
        audioS3Key: true,
        updatedAt: true,
        page: {
          select: {
            pageNumber: true,
            book: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    console.log('📋 Sample of paragraphs to update:');
    paragraphsToUpdate.slice(0, 5).forEach((p, index) => {
      console.log(`  ${index + 1}. Book: "${p.page.book.title}", Page: ${p.page.pageNumber}, Updated: ${p.updatedAt.toISOString()}`);
    });

    if (paragraphsToUpdate.length > 5) {
      console.log(`  ... and ${paragraphsToUpdate.length - 5} more`);
    }

    // Ask for confirmation
    console.log('\n⚠️  This will update audioGeneratedAt = updatedAt for all these paragraphs.');
    console.log('   This is a reasonable approximation but may not be 100% accurate.');
    
    // In a real migration, you might want to add a confirmation prompt
    // For now, we'll proceed automatically
    console.log('\n🔄 Proceeding with the update...');

    // Perform the update using raw SQL since Prisma doesn't support column-to-column updates in updateMany
    const updateResult = await prisma.$executeRaw`
      UPDATE "paragraphs" 
      SET "audioGeneratedAt" = "updatedAt" 
      WHERE "audioStatus" = 'READY' 
        AND "audioS3Key" IS NOT NULL 
        AND "audioGeneratedAt" IS NULL
    `;

    console.log(`✅ Successfully updated ${updateResult} paragraphs`);

    // Verify the update
    const remainingNullTimestamps = await prisma.paragraph.count({
      where: {
        audioStatus: 'READY',
        audioS3Key: { not: null },
        audioGeneratedAt: null,
      },
    });

    console.log(`📊 Remaining paragraphs with null audioGeneratedAt: ${remainingNullTimestamps}`);

    // Show some statistics
    const totalReadyParagraphs = await prisma.paragraph.count({
      where: {
        audioStatus: 'READY',
        audioS3Key: { not: null },
      },
    });

    const paragraphsWithTimestamp = await prisma.paragraph.count({
      where: {
        audioStatus: 'READY',
        audioS3Key: { not: null },
        audioGeneratedAt: { not: null },
      },
    });

    console.log('\n📈 Final Statistics:');
    console.log(`   Total paragraphs with READY audio: ${totalReadyParagraphs}`);
    console.log(`   Paragraphs with audioGeneratedAt: ${paragraphsWithTimestamp}`);
    console.log(`   Coverage: ${totalReadyParagraphs > 0 ? ((paragraphsWithTimestamp / totalReadyParagraphs) * 100).toFixed(1) : 0}%`);

    console.log('\n🎉 Audio timestamp backfill migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Handle the case where this script is run directly
if (require.main === module) {
  backfillAudioTimestamps()
    .then(() => {
      console.log('✅ Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { backfillAudioTimestamps };
