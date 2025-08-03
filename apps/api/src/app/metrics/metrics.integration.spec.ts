import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';
import { BooksService } from '../books/books.service';
import { AppModule } from '../app.module';
import { BookStatus, AudioStatus, EventType } from '@prisma/client';

describe('Metrics Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let metricsService: MetricsService;
  let booksService: BooksService;
  let testBookId: string;
  let testParagraphId: string;
  let testPageId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    metricsService = moduleFixture.get<MetricsService>(MetricsService);
    booksService = moduleFixture.get<BooksService>(BooksService);
  });

  beforeEach(async () => {
    // Clean up database in correct order
    await prisma.metricEvent.deleteMany();
    await prisma.bookMetrics.deleteMany();
    await prisma.textCorrection.deleteMany();
    await prisma.paragraph.deleteMany();
    await prisma.page.deleteMany();
    await prisma.book.deleteMany();

    // Create test book with page and paragraph
    const testBook = await prisma.book.create({
      data: {
        title: 'Test Book for Metrics',
        author: 'Test Author',
        s3Key: 'test-book.epub',
        status: BookStatus.READY,
      },
    });
    testBookId = testBook.id;

    const testPage = await prisma.page.create({
      data: {
        bookId: testBookId,
        pageNumber: 1,
        sourceChapter: 1,
        startPosition: 0,
        endPosition: 100,
        audioStatus: AudioStatus.PENDING,
      },
    });
    testPageId = testPage.id;

    const testParagraph = await prisma.paragraph.create({
      data: {
        pageId: testPageId,
        bookId: testBookId,
        orderIndex: 0,
        content: 'Original paragraph content with some text to edit.',
        audioStatus: AudioStatus.PENDING,
      },
    });
    testParagraphId = testParagraph.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Scenario 1: Edit paragraph text and generate audio', () => {
    it('should record metrics and activity with proper context', async () => {
      const editedContent = 'Edited paragraph content with different text to edit.';

      // Step 1: Edit paragraph text with audio generation
      const editResponse = await request(app.getHttpServer())
        .put(`/api/books/paragraphs/${testParagraphId}`)
        .send({
          content: editedContent,
          generateAudio: true,
        })
        .expect(200);

      expect(editResponse.body.content).toBe(editedContent);

      // Wait a moment for async metrics processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Verify TEXT_EDIT metric was recorded
      const textEditEvents = await prisma.metricEvent.findMany({
        where: {
          bookId: testBookId,
          eventType: 'TEXT_EDIT',
        },
      });

      expect(textEditEvents).toHaveLength(1);
      const textEditEvent = textEditEvents[0];
      
      // Verify event data contains proper context
      expect(textEditEvent.eventData).toMatchObject({
        paragraphId: testParagraphId,
        pageNumber: 1,
        pageId: testPageId,
        editedContent: expect.stringContaining('Edited paragraph content'),
        changesCount: expect.any(Number),
        textChanges: expect.any(Array),
      });

      // Step 3: Verify book metrics were updated
      const bookMetrics = await prisma.bookMetrics.findUnique({
        where: { bookId: testBookId },
      });

      expect(bookMetrics).toBeTruthy();
      expect(bookMetrics.totalTextEdits).toBeGreaterThan(0);
      expect(bookMetrics.lastActivity).toBeTruthy();

      // Step 4: Verify global metrics endpoint returns updated data
      const globalMetricsResponse = await request(app.getHttpServer())
        .get('/api/metrics/global')
        .expect(200);

      expect(globalMetricsResponse.body.totalTextEdits).toBeGreaterThan(0);
      expect(globalMetricsResponse.body.totalBooks).toBe(1);

      // Step 5: Verify recent activity endpoint returns proper context
      const recentActivityResponse = await request(app.getHttpServer())
        .get('/api/metrics/events/recent')
        .expect(200);

      expect(recentActivityResponse.body).toHaveLength(1);
      const activityItem = recentActivityResponse.body[0];
      
      expect(activityItem.eventType).toBe('TEXT_EDIT');
      expect(activityItem.bookId).toBe(testBookId);
      expect(activityItem.eventData).toMatchObject({
        paragraphId: testParagraphId,
        pageNumber: 1,
        editedContent: expect.stringContaining('Edited paragraph content'),
      });
    });
  });

  describe('Scenario 2: Edit paragraph with bulk fixes (no audio)', () => {
    it('should record metrics for text edit and bulk fixes separately', async () => {
      // Step 1: First edit to create some text changes
      const firstEditContent = 'First edit with word changes for bulk suggestions.';
      
      const firstEditResponse = await request(app.getHttpServer())
        .put(`/api/books/paragraphs/${testParagraphId}`)
        .send({
          content: firstEditContent,
          generateAudio: false,
        })
        .expect(200);

      expect(firstEditResponse.body.bulkSuggestions).toBeDefined();

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Apply bulk fixes if suggestions exist
      if (firstEditResponse.body.bulkSuggestions && firstEditResponse.body.bulkSuggestions.length > 0) {
        const bulkFixesData = {
          bookId: testBookId,
          fixes: firstEditResponse.body.bulkSuggestions.map(suggestion => ({
            originalWord: suggestion.originalWord,
            correctedWord: suggestion.correctedWord,
            paragraphIds: suggestion.paragraphIds,
          })),
        };

        await request(app.getHttpServer())
          .post('/api/books/bulk-fixes')
          .send(bulkFixesData)
          .expect(200);

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 3: Verify metrics were recorded
      const allEvents = await prisma.metricEvent.findMany({
        where: { bookId: testBookId },
        orderBy: { timestamp: 'asc' },
      });

      // Should have at least TEXT_EDIT event
      const textEditEvents = allEvents.filter(e => e.eventType === 'TEXT_EDIT');
      expect(textEditEvents).toHaveLength(1);

      // May have BULK_FIX_APPLIED event if bulk fixes were applied
      const bulkFixEvents = allEvents.filter(e => e.eventType === 'BULK_FIX_APPLIED');
      
      // Step 4: Verify book metrics reflect all activities
      const finalBookMetrics = await prisma.bookMetrics.findUnique({
        where: { bookId: testBookId },
      });

      expect(finalBookMetrics).toBeTruthy();
      expect(finalBookMetrics.totalTextEdits).toBeGreaterThan(0);
      
      if (bulkFixEvents.length > 0) {
        expect(finalBookMetrics.totalBulkFixes).toBeGreaterThan(0);
      }

      // Step 5: Verify recent activity shows all events with context
      const finalActivityResponse = await request(app.getHttpServer())
        .get('/api/metrics/events/recent')
        .expect(200);

      expect(finalActivityResponse.body.length).toBeGreaterThanOrEqual(1);
      
      // Verify TEXT_EDIT event has proper context
      const textEditActivity = finalActivityResponse.body.find(
        (item: any) => item.eventType === 'TEXT_EDIT'
      );
      
      expect(textEditActivity).toBeTruthy();
      expect(textEditActivity.eventData).toMatchObject({
        paragraphId: testParagraphId,
        pageNumber: 1,
        editedContent: expect.stringContaining('First edit with word changes'),
      });

      // If bulk fix was applied, verify it has context too
      if (bulkFixEvents.length > 0) {
        const bulkFixActivity = finalActivityResponse.body.find(
          (item: any) => item.eventType === 'BULK_FIX_APPLIED'
        );
        
        expect(bulkFixActivity).toBeTruthy();
        expect(bulkFixActivity.eventData).toMatchObject({
          totalParagraphsUpdated: expect.any(Number),
          totalWordsFixed: expect.any(Number),
        });
      }
    });
  });

  describe('Analytics Endpoints Integration', () => {
    it('should provide consistent data across all analytics endpoints', async () => {
      // Create some activity
      await request(app.getHttpServer())
        .put(`/api/books/paragraphs/${testParagraphId}`)
        .send({
          content: 'Analytics test content with changes.',
          generateAudio: false,
        })
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test all analytics endpoints
      const [globalMetrics, bookMetrics, recentActivity] = await Promise.all([
        request(app.getHttpServer()).get('/api/metrics/global').expect(200),
        request(app.getHttpServer()).get('/api/analytics/books').expect(200),
        request(app.getHttpServer()).get('/api/metrics/events/recent').expect(200),
      ]);

      // Verify data consistency
      expect(globalMetrics.body.totalBooks).toBe(1);
      expect(globalMetrics.body.totalTextEdits).toBeGreaterThan(0);
      
      expect(bookMetrics.body).toHaveLength(1);
      expect(bookMetrics.body[0].bookId).toBe(testBookId);
      expect(bookMetrics.body[0].totalTextEdits).toBeGreaterThan(0);
      
      expect(recentActivity.body).toHaveLength(1);
      expect(recentActivity.body[0].eventType).toBe('TEXT_EDIT');
      expect(recentActivity.body[0].bookId).toBe(testBookId);
      expect(recentActivity.body[0].eventData.editedContent).toContain('Analytics test content');
    });
  });
});
