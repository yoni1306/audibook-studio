#!/usr/bin/env ts-node

/**
 * Simple test script to verify queue processors are working
 * Run with: npx ts-node apps/api/src/app/queue/queue-test.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QueueService } from './queue.service';
import { Logger } from '@nestjs/common';

async function testQueueProcessors() {
  const logger = new Logger('QueueTest');
  
  try {
    logger.log('🚀 Starting queue processor test...');
    
    // Create the NestJS application
    const app = await NestFactory.createApplicationContext(AppModule);
    const queueService = app.get(QueueService);
    
    logger.log('✅ Application context created successfully');
    
    // Test 1: Add an EPUB parsing job
    logger.log('📚 Testing EPUB parsing job...');
    const epubJob = await queueService.addEpubParsingJob({
      bookId: 'test-book-epub-' + Date.now(),
      s3Key: 'test-epub-file.epub',
      parsingMethod: 'page-based'
    });
    
    logger.log(`✅ EPUB job added: ${epubJob.id} (${epubJob.name})`);
    
    // Test 2: Add an audio generation job
    logger.log('🎵 Testing audio generation job...');
    const audioJob = await queueService.addAudioGenerationJob({
      paragraphId: 'test-paragraph-' + Date.now(),
      bookId: 'test-book-audio-' + Date.now(),
      content: 'This is a test paragraph for audio generation testing.'
    });
    
    logger.log(`✅ Audio job added: ${audioJob.id} (${audioJob.name})`);
    
    // Wait a bit for jobs to be processed
    logger.log('⏳ Waiting for jobs to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    logger.log('🎯 Queue processor test completed successfully!');
    logger.log('📊 Check the API logs to see if both processors handled their respective jobs');
    
    await app.close();
    
  } catch (error) {
    logger.error('❌ Queue processor test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testQueueProcessors().catch(console.error);
}

export { testQueueProcessors };
