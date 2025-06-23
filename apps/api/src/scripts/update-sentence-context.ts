import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Extract sentence context around a word in the text
 */
function extractSentenceContext(text: string, word: string): string {
  if (!text || !word) return '';
  
  // Find the word in the text (case insensitive)
  const wordIndex = text.toLowerCase().indexOf(word.toLowerCase());
  if (wordIndex === -1) return '';
  
  // Find sentence boundaries (periods, exclamation marks, question marks)
  const sentenceEnders = /[.!?]/g;
  let start = 0;
  let end = text.length;
  
  // Find the start of the sentence (look backwards from word position)
  for (let i = wordIndex - 1; i >= 0; i--) {
    if (sentenceEnders.test(text[i])) {
      start = i + 1;
      break;
    }
  }
  
  // Find the end of the sentence (look forwards from word position)
  sentenceEnders.lastIndex = 0; // Reset regex
  for (let i = wordIndex; i < text.length; i++) {
    if (sentenceEnders.test(text[i])) {
      end = i + 1;
      break;
    }
  }
  
  // Extract and clean the sentence
  const sentence = text.substring(start, end).trim();
  return sentence || text.substring(Math.max(0, wordIndex - 50), Math.min(text.length, wordIndex + 50)).trim();
}

async function updateSentenceContext() {
  console.log('🔧 Starting sentence context update...');
  
  try {
    // Find all text corrections with empty sentence context
    const corrections = await prisma.textCorrection.findMany({
      where: {
        OR: [
          { sentenceContext: '' },
          { sentenceContext: null },
        ],
      },
      include: {
        paragraph: {
          select: {
            content: true,
          },
        },
      },
    });

    console.log(`📊 Found ${corrections.length} corrections with empty sentence context`);

    if (corrections.length === 0) {
      console.log('✅ No corrections need updating');
      return;
    }

    let updated = 0;
    let failed = 0;

    // Update each correction with proper sentence context
    for (const correction of corrections) {
      try {
        const sentenceContext = extractSentenceContext(
          correction.paragraph.content,
          correction.originalWord
        );

        if (sentenceContext) {
          await prisma.textCorrection.update({
            where: { id: correction.id },
            data: { sentenceContext },
          });
          updated++;
          
          if (updated % 10 === 0) {
            console.log(`📈 Updated ${updated}/${corrections.length} corrections...`);
          }
        } else {
          console.log(`⚠️  Could not extract context for correction ${correction.id} (word: "${correction.originalWord}")`);
          failed++;
        }
      } catch (error) {
        console.error(`💥 Error updating correction ${correction.id}:`, error);
        failed++;
      }
    }

    console.log(`✅ Update complete!`);
    console.log(`📊 Updated: ${updated} corrections`);
    console.log(`❌ Failed: ${failed} corrections`);

  } catch (error) {
    console.error('💥 Error during sentence context update:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateSentenceContext();
