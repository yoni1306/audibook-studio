import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Test the sentence context extraction functionality
 */
async function testSentenceContext() {
  console.log('🧪 Testing sentence context extraction...');
  
  try {
    // Find a paragraph to test with
    const paragraph = await prisma.paragraph.findFirst({
      where: {
        content: {
          not: '',
        },
      },
      select: {
        id: true,
        content: true,
        chapterNumber: true,
        orderIndex: true,
        book: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!paragraph) {
      console.log('❌ No paragraphs found to test with');
      return;
    }

    console.log(`📖 Testing with paragraph from "${paragraph.book.title}" (Chapter ${paragraph.chapterNumber}, Order ${paragraph.orderIndex})`);
    console.log(`📝 Content preview: "${paragraph.content.substring(0, 100)}..."`);

    // Extract a word from the content to test with
    const words = paragraph.content.match(/[\u0590-\u05FF]+/g) || []; // Hebrew words
    if (words.length === 0) {
      console.log('❌ No Hebrew words found in paragraph');
      return;
    }

    const testWord = words[Math.floor(words.length / 2)]; // Pick a word from the middle
    console.log(`🎯 Testing with word: "${testWord}"`);

    // Test the sentence context extraction by making a POST request to record correction
    const testCorrection = {
      originalWord: testWord,
      correctedWord: testWord + '_CORRECTED',
      contextSentence: 'This will be replaced by the API',
      paragraphId: paragraph.id,
      fixType: 'test',
    };

    console.log('📤 Making API request to record correction...');
    
    const response = await fetch('http://localhost:3333/api/books/record-correction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCorrection),
    });

    if (!response.ok) {
      console.log(`❌ API request failed: ${response.status} ${response.statusText}`);
      return;
    }

    const result = await response.json();
    console.log('✅ Correction recorded successfully:', result);

    // Now fetch the correction to see if sentence context was extracted
    const savedCorrection = await prisma.textCorrection.findUnique({
      where: { id: result.id },
      select: {
        originalWord: true,
        correctedWord: true,
        sentenceContext: true,
        fixType: true,
      },
    });

    if (savedCorrection) {
      console.log('📊 Saved correction details:');
      console.log(`   Original: "${savedCorrection.originalWord}"`);
      console.log(`   Corrected: "${savedCorrection.correctedWord}"`);
      console.log(`   Context: "${savedCorrection.sentenceContext}"`);
      console.log(`   Fix Type: "${savedCorrection.fixType}"`);
      
      if (savedCorrection.sentenceContext && savedCorrection.sentenceContext.length > 0) {
        console.log('✅ Sentence context extraction is working!');
      } else {
        console.log('❌ Sentence context is still empty');
      }
    }

    // Clean up the test correction
    await prisma.textCorrection.delete({
      where: { id: result.id },
    });
    console.log('🧹 Test correction cleaned up');

  } catch (error) {
    console.error('💥 Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSentenceContext();
