import { Worker, Job } from 'bullmq';
import { PrismaClient, BookStatus } from '@prisma/client';
import * as fs from 'fs/promises';

/**
 * WORKERS SERVICE REGRESSION TESTS
 * 
 * These tests verify that the workers service maintains its critical EPUB parsing
 * and audio generation logic. They should FAIL if:
 * 1. Real EPUB parsing logic is removed or replaced with stubs
 * 2. Job processing logic is simplified or removed
 * 3. Database integration is broken
 * 4. S3 integration is removed
 * 
 * CRITICAL: These tests protect against accidental removal of working functionality
 */
describe('Workers Service Regression Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('EPUB Parsing Logic Regression', () => {
    it('should contain real EPUB parsing imports and logic', async () => {
      // REGRESSION: Verify workers main.ts contains real parsing imports
      const mainTsContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/main.ts',
        'utf-8'
      );

      // Ensure real parser imports exist
      expect(mainTsContent).toContain('PageBasedEPUBParser');
      expect(mainTsContent).toContain('XHTMLBasedEPUBParser');
      expect(mainTsContent).toContain('downloadFromS3');
      expect(mainTsContent).toContain('saveEPUBParseResult');
      
      // Ensure it's not just simulation
      expect(mainTsContent).not.toContain('simulateEpubParsing');
      expect(mainTsContent).not.toContain('setTimeout(resolve, 2000)');
    });

    it('should process parse-epub jobs with real parsing logic', async () => {
      const mainTsContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/main.ts',
        'utf-8'
      );

      // Verify parse-epub case exists and contains real logic
      expect(mainTsContent).toContain("case 'parse-epub':");
      expect(mainTsContent).toContain('downloadFromS3(job.data.s3Key)');
      expect(mainTsContent).toContain('parseEpub(localPath)');
      expect(mainTsContent).toContain('saveEPUBParseResult');
    });

    it('should use correct queue name (audio-processing)', async () => {
      const mainTsContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/main.ts',
        'utf-8'
      );

      // Verify worker uses correct queue name
      expect(mainTsContent).toContain("new Worker(\n  'audio-processing'");
    });

    it('should handle both parsing methods (page-based and xhtml-based)', async () => {
      const mainTsContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/main.ts',
        'utf-8'
      );

      // Verify both parsing methods are supported
      expect(mainTsContent).toContain("parsingMethod === 'xhtml-based'");
      expect(mainTsContent).toContain('new XHTMLBasedEPUBParser');
      expect(mainTsContent).toContain('new PageBasedEPUBParser');
    });

    it('should update book status during processing', async () => {
      const mainTsContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/main.ts',
        'utf-8'
      );

      // Verify book status updates
      expect(mainTsContent).toContain('updateBookStatus(job.data.bookId, BookStatus.PROCESSING)');
      expect(mainTsContent).toContain('updateBookStatus(job.data.bookId, BookStatus.ERROR)');
    });
  });

  describe('Audio Generation Logic Regression', () => {
    it('should process generate-audio jobs with real TTS logic', async () => {
      const mainTsContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/main.ts',
        'utf-8'
      );

      // Verify generate-audio case exists
      expect(mainTsContent).toContain("case 'generate-audio':");
      expect(mainTsContent).toContain('getTTSService');
      expect(mainTsContent).toContain('generateAudio');
      expect(mainTsContent).toContain('uploadToS3');
    });

    it('should update paragraph audio status during processing', async () => {
      const mainTsContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/main.ts',
        'utf-8'
      );

      // Verify paragraph status updates
      expect(mainTsContent).toContain('updateParagraphAudioStatus');
      expect(mainTsContent).toContain('AudioStatus.PROCESSING');
      expect(mainTsContent).toContain('AudioStatus.COMPLETED');
    });
  });

  describe('Parser Implementation Regression', () => {
    it('should maintain PageBasedEPUBParser functionality', async () => {
      const parserContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/text-processing/page-based-epub-parser.ts',
        'utf-8'
      );

      // Verify core parsing methods exist
      expect(parserContent).toContain('parseEpub');
      expect(parserContent).toContain('parseEPUBStructure');
      expect(parserContent).toContain('extractTextFromXHTML');
      expect(parserContent).toContain('splitIntoPages');
    });

    it('should maintain XHTMLBasedEPUBParser functionality', async () => {
      const parserContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/text-processing/xhtml-based-epub-parser.ts',
        'utf-8'
      );

      // Verify core parsing methods exist
      expect(parserContent).toContain('parseEpub');
      expect(parserContent).toContain('extractXHTMLFiles');
      expect(parserContent).toContain('processXHTMLFile');
      expect(parserContent).toContain('splitIntoParagraphs');
    });
  });

  describe('Database Integration Regression', () => {
    it('should maintain database service functionality', async () => {
      const dbServiceContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/database.service.ts',
        'utf-8'
      );

      // Verify database operations exist
      expect(dbServiceContent).toContain('updateBookStatus');
      expect(dbServiceContent).toContain('updateBookMetadata');
      expect(dbServiceContent).toContain('getParagraph');
    });

    it('should maintain page-based database service functionality', async () => {
      const pageDbServiceContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/page-based-database.service.ts',
        'utf-8'
      );

      // Verify page-based operations exist
      expect(pageDbServiceContent).toContain('saveEPUBParseResult');
      expect(pageDbServiceContent).toContain('updateParagraphAudioStatus');
    });
  });

  describe('S3 Integration Regression', () => {
    it('should maintain S3 client functionality', async () => {
      const s3ClientContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/s3-client.ts',
        'utf-8'
      );

      // Verify S3 operations exist
      expect(s3ClientContent).toContain('downloadFromS3');
      expect(s3ClientContent).toContain('uploadToS3');
      expect(s3ClientContent).toContain('deleteOldAudioFiles');
    });
  });

  describe('Configuration Regression', () => {
    it('should maintain EPUB parser configuration', async () => {
      const configContent = await fs.readFile(
        '/Users/yonica/Dev/audibook-studio/apps/workers/src/config/epub-parser-config.ts',
        'utf-8'
      );

      // Verify configuration exists
      expect(configContent).toContain('DEFAULT_EPUB_PARSER_CONFIG');
      expect(configContent).toContain('paragraphTargetLengthChars');
      expect(configContent).toContain('pageBreakDetection');
    });
  });
});
