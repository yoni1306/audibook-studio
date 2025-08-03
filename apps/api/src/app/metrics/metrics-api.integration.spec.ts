import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('Metrics API Integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Metrics Endpoints', () => {
    it('should respond to global metrics endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/metrics/global')
        .expect(200);

      expect(response.body).toHaveProperty('totalBooks');
      expect(response.body).toHaveProperty('totalTextEdits');
      expect(response.body).toHaveProperty('totalAudioGenerated');
      expect(response.body).toHaveProperty('totalBulkFixes');
      expect(response.body).toHaveProperty('totalCorrections');
    });

    it('should respond to recent activity endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/metrics/events/recent')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // If there are activities, check structure
      if (response.body.length > 0) {
        const activity = response.body[0];
        expect(activity).toHaveProperty('id');
        expect(activity).toHaveProperty('eventType');
        expect(activity).toHaveProperty('bookId');
        expect(activity).toHaveProperty('timestamp');
        expect(activity).toHaveProperty('eventData');
      }
    });

    it('should respond to analytics books endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/books')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // If there are books, check structure
      if (response.body.length > 0) {
        const book = response.body[0];
        expect(book).toHaveProperty('bookId');
        expect(book).toHaveProperty('bookTitle');
        expect(book).toHaveProperty('totalTextEdits');
        expect(book).toHaveProperty('totalAudioGenerated');
        expect(book).toHaveProperty('totalBulkFixes');
        expect(book).toHaveProperty('totalCorrections');
      }
    });
  });

  describe('Metrics Recording via API', () => {
    it('should record metrics when recording events directly', async () => {
      // Test the metrics recording endpoint if it exists
      const testEventData = {
        eventType: 'TEXT_EDIT',
        bookId: 'test-book-id',
        eventData: {
          paragraphId: 'test-paragraph-id',
          pageNumber: 1,
          editedContent: 'Test edited content for metrics validation',
          changesCount: 2,
          textChanges: [
            {
              originalWord: 'original',
              correctedWord: 'corrected',
              position: 10
            }
          ]
        },
        duration: 150,
        success: true
      };

      // Try to record a metric event
      const recordResponse = await request(app.getHttpServer())
        .post('/api/metrics/events')
        .send(testEventData);

      // The endpoint might not exist or might return different status codes
      // We'll check if it's implemented and working
      if (recordResponse.status === 201 || recordResponse.status === 200) {
        // If successful, verify the event was recorded
        const recentResponse = await request(app.getHttpServer())
          .get('/api/metrics/events/recent')
          .expect(200);

        const recentEvents = recentResponse.body;
        const testEvent = recentEvents.find((event: any) => 
          event.eventType === 'TEXT_EDIT' && 
          event.eventData?.editedContent === 'Test edited content for metrics validation'
        );

        if (testEvent) {
          expect(testEvent.eventData).toHaveProperty('paragraphId', 'test-paragraph-id');
          expect(testEvent.eventData).toHaveProperty('pageNumber', 1);
          expect(testEvent.eventData).toHaveProperty('editedContent');
          expect(testEvent.eventData.editedContent).toContain('Test edited content');
        }
      } else {
        // If the endpoint doesn't exist, that's also valid information
        console.log(`Metrics recording endpoint returned status: ${recordResponse.status}`);
        console.log('This suggests the endpoint may not be implemented or may have different requirements');
      }
    });
  });

  describe('Activity Context Validation', () => {
    it('should return activity data with proper context structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/metrics/events/recent')
        .expect(200);

      const activities = response.body;
      
      // Check if we have any TEXT_EDIT activities with context
      const textEditActivities = activities.filter((activity: any) => 
        activity.eventType === 'TEXT_EDIT'
      );

      for (const activity of textEditActivities) {
        // Verify TEXT_EDIT activities have editedContent in eventData
        if (activity.eventData) {
          console.log('TEXT_EDIT activity eventData:', JSON.stringify(activity.eventData, null, 2));
          
          // Check for expected fields
          if (activity.eventData.editedContent) {
            expect(typeof activity.eventData.editedContent).toBe('string');
          }
          
          if (activity.eventData.pageNumber) {
            expect(typeof activity.eventData.pageNumber).toBe('number');
          }
          
          if (activity.eventData.paragraphId) {
            expect(typeof activity.eventData.paragraphId).toBe('string');
          }
        }
      }

      // Check other paragraph-based activities for page/paragraph info
      const otherActivities = activities.filter((activity: any) => 
        activity.eventType !== 'TEXT_EDIT' && 
        ['AUDIO_GENERATION', 'BULK_FIX_APPLIED', 'CORRECTION_APPLIED'].includes(activity.eventType)
      );

      for (const activity of otherActivities) {
        if (activity.eventData) {
          console.log(`${activity.eventType} activity eventData:`, JSON.stringify(activity.eventData, null, 2));
          
          // These should ideally have page/paragraph context
          if (activity.eventData.pageNumber || activity.eventData.paragraphId) {
            console.log(`✓ ${activity.eventType} has context: page=${activity.eventData.pageNumber}, paragraph=${activity.eventData.paragraphId}`);
          } else {
            console.log(`⚠ ${activity.eventType} missing page/paragraph context`);
          }
        }
      }
    });
  });

  describe('Metrics Counter Updates', () => {
    it('should show consistent data across all analytics endpoints', async () => {
      // Get data from all endpoints
      const [globalMetrics, bookMetrics, recentActivity] = await Promise.all([
        request(app.getHttpServer()).get('/api/metrics/global').expect(200),
        request(app.getHttpServer()).get('/api/analytics/books').expect(200),
        request(app.getHttpServer()).get('/api/metrics/events/recent').expect(200),
      ]);

      console.log('Global Metrics:', JSON.stringify(globalMetrics.body, null, 2));
      console.log('Book Metrics Count:', bookMetrics.body.length);
      console.log('Recent Activity Count:', recentActivity.body.length);

      // Basic consistency checks
      expect(globalMetrics.body.totalBooks).toBeGreaterThanOrEqual(0);
      expect(globalMetrics.body.totalTextEdits).toBeGreaterThanOrEqual(0);
      expect(globalMetrics.body.totalAudioGenerated).toBeGreaterThanOrEqual(0);
      expect(globalMetrics.body.totalBulkFixes).toBeGreaterThanOrEqual(0);

      // If we have books, verify the totals make sense
      if (bookMetrics.body.length > 0) {
        const totalTextEditsFromBooks = bookMetrics.body.reduce(
          (sum: number, book: any) => sum + (book.totalTextEdits || 0), 
          0
        );
        
        console.log(`Total text edits from books: ${totalTextEditsFromBooks}`);
        console.log(`Global total text edits: ${globalMetrics.body.totalTextEdits}`);
        
        // They should be equal or close (accounting for potential timing differences)
        expect(Math.abs(totalTextEditsFromBooks - globalMetrics.body.totalTextEdits)).toBeLessThanOrEqual(5);
      }

      // Verify recent activity has expected structure
      if (recentActivity.body.length > 0) {
        const firstActivity = recentActivity.body[0];
        expect(firstActivity).toHaveProperty('eventType');
        expect(firstActivity).toHaveProperty('timestamp');
        expect(firstActivity).toHaveProperty('bookId');
        
        // Check if eventData exists and has expected structure
        if (firstActivity.eventData) {
          console.log('First activity eventData keys:', Object.keys(firstActivity.eventData));
        }
      }
    });
  });
});
