import { Logger } from '@nestjs/common';
import { downloadFromS3, uploadToS3, deleteOldAudioFiles } from './s3-client';
import { PageBasedEPUBParser } from './text-processing/page-based-epub-parser';
import { XHTMLBasedEPUBParser } from './text-processing/xhtml-based-epub-parser';
import { DEFAULT_EPUB_PARSER_CONFIG } from './config/epub-parser-config';
import {
  updateBookStatus,
  updateBookMetadata,
  getParagraph,
  getBookMetadata,
} from './database.service';
import { 
  saveEPUBParseResult, 
  updateParagraphAudioStatus 
} from './page-based-database.service';
import { BookStatus, AudioStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import { createTTSService, TTSConfig } from './tts-service';
import { connect, StringCodec } from 'nats';
import {
  EpubParsingJobData,
  AudioGenerationJobData,
  PageAudioCombinationJobData,
  EpubParsingResult,
  AudioGenerationResult,
  PageAudioCombinationResult,
} from './job-types';

/**
 * Job Processor Interface for NATS JavaScript Worker
 */
export interface JobProcessorInterface {
  processEpubParsing(data: EpubParsingJobData): Promise<EpubParsingResult>;
  processAudioGeneration(data: AudioGenerationJobData): Promise<AudioGenerationResult>;
  processPageAudioCombination(data: PageAudioCombinationJobData): Promise<PageAudioCombinationResult>;
}

/**
 * Complete Job Processor Implementation
 * 
 * Extracted from the original main.ts BullMQ worker implementation
 */
export class JobProcessor implements JobProcessorInterface {
  private readonly logger = new Logger(JobProcessor.name);

  async processEpubParsing(data: EpubParsingJobData): Promise<EpubParsingResult> {
    const startTime = Date.now();
    const { bookId, s3Key, parsingMethod = 'xhtml-based', correlationId } = data;
    
    this.logger.log(`Starting ${parsingMethod} EPUB parsing`, {
      bookId,
      s3Key,
      parsingMethod,
      correlationId,
    });

    try {
      // Download EPUB from S3
      this.logger.debug('Downloading EPUB from S3', { s3Key });
      const downloadStart = Date.now();
      const localPath = await downloadFromS3(s3Key);
      this.logger.log('EPUB downloaded successfully', {
        downloadDuration: Date.now() - downloadStart,
        localPath,
      });

      // Update status to PROCESSING
      await updateBookStatus(bookId, BookStatus.PROCESSING);
      this.logger.debug('Book status updated to PROCESSING');

      // Parse the EPUB using selected method
      this.logger.log(`Starting ${parsingMethod} EPUB parsing`, { localPath });
      const parseStart = Date.now();
      
      let result;
      if (parsingMethod === 'xhtml-based') {
        const xhtmlParser = new XHTMLBasedEPUBParser({
          paragraphTargetLengthChars: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthChars,
          paragraphTargetLengthWords: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthWords,
          includeEmptyPages: false,
        });
        
        const xhtmlResult = await xhtmlParser.parseEpub(localPath);
        
        this.logger.log('XHTML parser results:', {
          totalXHTMLFiles: xhtmlResult.metadata.xhtmlFiles?.length || 0,
          totalPages: xhtmlResult.pages.length,
          totalParagraphs: xhtmlResult.metadata.totalParagraphs,
          averageParagraphsPerPage: xhtmlResult.metadata.averageParagraphsPerPage,
        });
        
        // Convert XHTML result to page-based format for database compatibility
        result = {
          pages: xhtmlResult.pages.map((xhtmlPage) => ({
            pageNumber: xhtmlPage.pageNumber,
            sourceChapter: xhtmlPage.sourceChapter,
            startPosition: xhtmlPage.startPosition,
            endPosition: xhtmlPage.endPosition,
            content: '',
            paragraphs: xhtmlPage.paragraphs.map(p => ({
              orderIndex: p.orderIndex,
              content: p.content,
              audioStatus: 'PENDING' as const,
            })),
          })),
          metadata: {
            totalPages: xhtmlResult.metadata.totalPages,
            totalParagraphs: xhtmlResult.metadata.totalParagraphs,
            averageParagraphsPerPage: xhtmlResult.metadata.averageParagraphsPerPage,
          },
        };
      } else {
        // Use page-based parser (default)
        const pageParser = new PageBasedEPUBParser({
          pageBreakDetection: DEFAULT_EPUB_PARSER_CONFIG.pageBreakDetection,
          paragraphTargetLengthChars: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthChars,
          paragraphTargetLengthWords: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthWords,
        });
        
        result = await pageParser.parseEpub(localPath);
      }
      
      this.logger.log(`${parsingMethod} EPUB parsing completed`, {
        parseDuration: Date.now() - parseStart,
        totalPages: result.pages.length,
        totalParagraphs: result.metadata.totalParagraphs,
        averageParagraphsPerPage: result.metadata.averageParagraphsPerPage,
      });

      if (result.pages.length === 0) {
        throw new Error('No pages extracted from EPUB');
      }

      // Save pages and paragraphs to database
      this.logger.log('Saving pages to database', {
        pageCount: result.pages.length,
        paragraphCount: result.metadata.totalParagraphs,
      });
      const saveStart = Date.now();
      await saveEPUBParseResult(bookId, result.pages, result.metadata);
      this.logger.log('Pages saved successfully', {
        saveDuration: Date.now() - saveStart,
      });

      // Update book metadata with extracted EPUB information
      if (result.bookMetadata) {
        this.logger.log('Updating book metadata with extracted EPUB information', {
          bookId,
          hasTitle: !!result.bookMetadata.title,
          hasAuthor: !!result.bookMetadata.author,
          hasLanguage: !!result.bookMetadata.language
        });
        
        const metadataStart = Date.now();
        await updateBookMetadata(bookId, result.bookMetadata);
        this.logger.log('Book metadata updated successfully', {
          metadataDuration: Date.now() - metadataStart,
        });
      }

      // Update book status to READY
      await updateBookStatus(bookId, BookStatus.READY);
      this.logger.log('Book processing completed', {
        bookId,
        totalDuration: Date.now() - startTime,
        paragraphCount: result.metadata.totalParagraphs,
      });

      // Automatically trigger diacritics processing for Hebrew books
      try {
        await this.triggerDiacriticsProcessingFromMetadata(bookId);
        this.logger.log('Diacritics processing job queued automatically', { bookId });
      } catch (error) {
        this.logger.warn('Failed to automatically queue diacritics processing', {
          bookId,
          error: error.message,
        });
      }

      // Clean up temp file
      await fs.unlink(localPath).catch((error) => {
        this.logger.warn('Failed to clean up temp file', {
          path: localPath,
          error: error.message,
        });
      });

      return {
        processed: true,
        bookId,
        paragraphCount: result.metadata.totalParagraphs,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('EPUB parsing failed', {
        bookId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });

      // Update book status to ERROR
      await updateBookStatus(bookId, BookStatus.ERROR);
      throw error;
    }
  }

  async processAudioGeneration(data: AudioGenerationJobData): Promise<AudioGenerationResult> {
    const startTime = Date.now();
    const { paragraphId, bookId, content, correlationId } = data;
    
    this.logger.log('Starting audio generation', {
      paragraphId,
      bookId,
      contentLength: content?.length,
      correlationId,
    });

    try {
      // Mark as GENERATING
      await updateParagraphAudioStatus(paragraphId, AudioStatus.GENERATING);

      // Get paragraph details
      const paragraph = await getParagraph(paragraphId);
      if (!paragraph) {
        throw new Error('Paragraph not found');
      }

      this.logger.debug('Paragraph retrieved', {
        paragraphId: paragraph.id,
        contentLength: paragraph.content.length,
        orderIndex: paragraph.orderIndex,
        bookTtsModel: paragraph.page.book.ttsModel,
        bookTtsVoice: paragraph.page.book.ttsVoice,
      });

      // Create TTS service based on book configuration
      const ttsConfig: TTSConfig = {
        model: paragraph.page.book.ttsModel || 'azure',
        voice: paragraph.page.book.ttsVoice || undefined,
        settings: paragraph.page.book.ttsSettings ? 
          JSON.parse(JSON.stringify(paragraph.page.book.ttsSettings)) : undefined,
      };
      
      const ttsService = createTTSService(ttsConfig);
      const outputPath = `/tmp/audio-${paragraphId}.mp3`;
      
      this.logger.log('Using TTS configuration', {
        model: ttsConfig.model,
        voice: ttsConfig.voice,
        settings: ttsConfig.settings,
      });

      this.logger.log('Calling TTS service', {
        outputPath,
        contentPreview: paragraph.content.substring(0, 50) + '...',
      });
      const ttsStart = Date.now();
      const result = await ttsService.generateAudio(paragraph.content, outputPath);
      this.logger.log('TTS generation completed', {
        ttsDuration: Date.now() - ttsStart,
        audioDuration: result.duration,
        filePath: result.filePath,
      });

      // Clean up old audio files before uploading new one
      await deleteOldAudioFiles(bookId, paragraphId);
      
      // Upload to S3 with timestamp to avoid browser caching issues
      const timestamp = Date.now();
      const s3Key = `audio/${bookId}/${paragraphId}_${timestamp}.mp3`;
      this.logger.debug('Uploading audio to S3', { s3Key, localPath: outputPath });
      const uploadStart = Date.now();
      await uploadToS3(outputPath, s3Key);
      this.logger.log('Audio uploaded to S3', {
        uploadDuration: Date.now() - uploadStart,
        s3Key,
      });

      // Update database with audio information
      this.logger.debug('Updating paragraph audio status in database', {
        paragraphId,
        s3Key,
        duration: result.duration,
      });
      await updateParagraphAudioStatus(
        paragraphId,
        AudioStatus.READY,
        s3Key,
        result.duration
      );
      this.logger.log('Database updated with audio information', {
        paragraphId,
        audioStatus: AudioStatus.READY,
      });

      this.logger.log('Audio generation completed successfully', {
        paragraphId,
        totalDuration: Date.now() - startTime,
        audioDuration: result.duration,
        s3Key,
      });

      // Clean up temp file
      await fs.unlink(outputPath).catch((error) => {
        this.logger.warn('Failed to clean up temp audio file', {
          path: outputPath,
          error: error.message,
        });
      });

      return {
        processed: true,
        paragraphId,
        duration: result.duration,
        s3Key,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Audio generation failed', {
        paragraphId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });

      // Mark as ERROR
      await updateParagraphAudioStatus(paragraphId, AudioStatus.ERROR);
      throw error;
    }
  }

  async processPageAudioCombination(data: PageAudioCombinationJobData): Promise<PageAudioCombinationResult> {
    const startTime = Date.now();
    const { pageId, bookId, correlationId } = data;
    
    this.logger.log('Starting page audio combination', {
      pageId,
      bookId,
      correlationId,
    });

    try {
      // Get page and its completed paragraphs with audio
      const { prisma } = require('./database.service');
      
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        include: {
          paragraphs: {
            where: {
              completed: true,
              audioStatus: 'READY',
              audioS3Key: { not: null },
            },
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              orderIndex: true,
              audioS3Key: true,
              audioDuration: true,
            },
          },
        },
      });
      
      if (!page) {
        throw new Error(`Page not found: ${pageId}`);
      }
      
      if (page.paragraphs.length === 0) {
        throw new Error(`No completed paragraphs with audio found for page ${page.pageNumber}`);
      }
      
      this.logger.log(`Found ${page.paragraphs.length} completed paragraphs with audio for page ${page.pageNumber}`);
      
      // Download all paragraph audio files
      const audioFiles: { localPath: string; duration: number }[] = [];
      let totalDuration = 0;
      
      for (const paragraph of page.paragraphs) {
        if (!paragraph.audioS3Key) continue;
        
        this.logger.debug(`Downloading audio for paragraph ${paragraph.id}`);
        const localPath = await downloadFromS3(paragraph.audioS3Key);
        const duration = paragraph.audioDuration || 0;
        
        audioFiles.push({ localPath, duration });
        totalDuration += duration;
      }
      
      if (audioFiles.length === 0) {
        throw new Error('No audio files downloaded');
      }
      
      // Combine audio files using ffmpeg
      const ffmpeg = require('fluent-ffmpeg');
      const path = require('path');
      const os = require('os');
      
      const outputPath = path.join(os.tmpdir(), `page-${page.pageNumber}-${Date.now()}.mp3`);
      
      this.logger.log(`Combining ${audioFiles.length} audio files into: ${outputPath}`);
      
      await new Promise((resolve, reject) => {
        let command = ffmpeg();
        
        // Add all input files
        audioFiles.forEach(file => {
          command = command.input(file.localPath);
        });
        
        // Set output options
        command
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .audioFrequency(22050)
          .audioChannels(1)
          .on('start', (commandLine) => {
            this.logger.debug('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            this.logger.debug(`Processing: ${progress.percent}% done`);
          })
          .on('end', () => {
            this.logger.log('Audio combination completed successfully');
            resolve(outputPath);
          })
          .on('error', (err) => {
            this.logger.error('FFmpeg error:', err.message);
            reject(err);
          })
          .mergeToFile(outputPath);
      });
      
      // Upload combined audio to S3
      const s3Key = `books/${bookId}/pages/page-${page.pageNumber}-${Date.now()}.mp3`;
      this.logger.log(`Uploading combined audio to S3: ${s3Key}`);
      
      await uploadToS3(outputPath, s3Key);
      
      // Update page with combined audio info
      await prisma.page.update({
        where: { id: pageId },
        data: {
          audioS3Key: s3Key,
          audioStatus: 'READY',
          audioDuration: totalDuration,
        },
      });
      
      // Clean up temporary files
      try {
        await fs.unlink(outputPath);
        for (const file of audioFiles) {
          await fs.unlink(file.localPath).catch((err) => {
            this.logger.debug('Failed to delete temp file:', err.message);
          });
        }
      } catch (cleanupError) {
        this.logger.warn('Failed to clean up temporary files:', cleanupError.message);
      }
      
      this.logger.log('Page audio combination completed', {
        pageId,
        pageNumber: page.pageNumber,
        bookId,
        s3Key,
        totalDuration,
        paragraphCount: page.paragraphs.length,
        duration: Date.now() - startTime,
      });
      
      return {
        processed: true,
        pageId,
        pageNumber: page.pageNumber,
        bookId,
        s3Key,
        totalDuration,
        paragraphCount: page.paragraphs.length,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Page audio combination failed', {
        pageId,
        bookId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });
      
      // Update page status to ERROR
      try {
        const { prisma } = require('./database.service');
        await prisma.page.update({
          where: { id: pageId },
          data: { audioStatus: 'ERROR' },
        });
      } catch (dbError) {
        this.logger.error('Failed to update page status to ERROR:', dbError.message);
      }
      
      throw error;
    }
  }

  /**
   * Trigger diacritics processing based on book's stored metadata
   */
  private async triggerDiacriticsProcessingFromMetadata(bookId: string): Promise<void> {
    try {
      // Fetch book to get processing metadata
      const book = await getBookMetadata(bookId);

      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      // Determine diacritics type from metadata, default to 'advanced'
      let metadata: any = {};
      if (book.processingMetadata) {
        try {
          metadata = typeof book.processingMetadata === 'string' 
            ? JSON.parse(book.processingMetadata)
            : book.processingMetadata;
        } catch (error) {
          this.logger.warn(`Failed to parse processingMetadata for book ${bookId}:`, error);
        }
      }
      
      this.logger.log(`🔍 [DEBUG] Raw book.processingMetadata:`, {
        bookId,
        rawMetadata: book.processingMetadata,
        metadataType: typeof book.processingMetadata,
        parsedMetadata: metadata
      });
      
      const diacriticsType = metadata?.diacriticsType || 'advanced';
      const jobType: 'advanced' | 'simple' = diacriticsType === 'simple' ? 'simple' : 'advanced';

      this.logger.log(`📋 Using diacritics type from book metadata: ${diacriticsType}`, {
        bookId,
        jobType,
        metadata,
        extractedDiacriticsType: diacriticsType
      });

      await this.triggerDiacriticsProcessing(bookId, jobType);
    } catch (error) {
      this.logger.error('Failed to trigger diacritics processing from metadata', {
        bookId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Automatically trigger diacritics processing job after EPUB parsing completes
   */
  private async triggerDiacriticsProcessing(bookId: string, jobType: 'advanced' | 'simple' = 'advanced'): Promise<void> {
    try {
      const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
      const nc = await connect({ servers: natsUrl });
      const js = nc.jetstream();
      const sc = StringCodec();

      const jobName = jobType === 'simple' ? 'add-simple-diacritics' : 'add-advanced-diacritics';
      const subject = jobType === 'simple' ? 'jobs.python.add-simple-diacritics' : 'jobs.python.add-advanced-diacritics';
      
      const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const jobData = {
        jobId,
        jobName,
        data: { 
          bookId,
          correlationId: `auto-${jobType}-diacritics-${bookId}` 
        },
        correlationId: `auto-${jobType}-diacritics-${bookId}`,
        timestamp: Date.now(),
      };

      await js.publish(subject, sc.encode(JSON.stringify(jobData)));
      this.logger.log(`📤 Auto-published ${jobType} diacritics job for book ${bookId} with ID ${jobId}`);
      
      await nc.close();
    } catch (error) {
      this.logger.error('Failed to trigger diacritics processing', {
        bookId,
        jobType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Trigger simple diacritics processing job
   */
  async triggerSimpleDiacriticsProcessing(bookId: string): Promise<void> {
    return this.triggerDiacriticsProcessing(bookId, 'simple');
  }

  /**
   * Trigger advanced diacritics processing job
   */
  async triggerAdvancedDiacriticsProcessing(bookId: string): Promise<void> {
    return this.triggerDiacriticsProcessing(bookId, 'advanced');
  }
}
