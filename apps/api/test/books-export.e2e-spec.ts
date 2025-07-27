import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app/app.module';
import { PrismaService } from '../src/app/prisma/prisma.service';
import { QueueService } from '../src/app/queue/queue.service';
import { S3Service } from '../src/app/s3/s3.service';
import { AudioStatus } from '@prisma/client';

describe('Books Export (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let queueService: QueueService;
  let s3Service: S3Service;

  // Test data
  let testBook: any;
  let testPage: any;
  let testParagraphs: any[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    queueService = moduleFixture.get<QueueService>(QueueService);
    s3Service = moduleFixture.get<S3Service>(S3Service);
  });

  beforeEach(async () => {
    // Clean up database
    await prismaService.paragraph.deleteMany();
    await prismaService.page.deleteMany();
    await prismaService.book.deleteMany();

    // Create test book with pages and paragraphs
    testBook = await prismaService.book.create({
      data: {
        id: 'test-book-1',
        title: 'Test Book for Export',
        author: 'Test Author',
        language: 'en',
        status: 'PROCESSED',
        s3Key: 'test-book.epub',
        pages: {
          create: [
            {
              id: 'test-page-1',
              pageNumber: 1,
              audioStatus: AudioStatus.PENDING,
              paragraphs: {
                create: [
                  {
                    id: 'test-para-1',
                    content: 'First paragraph content for testing.',
                    completed: true,
                    audioS3Key: 'test-para-1.mp3',
                    audioStatus: AudioStatus.READY,
                  },
                  {
                    id: 'test-para-2',
                    content: 'Second paragraph content for testing.',
                    completed: true,
                    audioS3Key: 'test-para-2.mp3',
                    audioStatus: AudioStatus.READY,
                  },
                  {
                    id: 'test-para-3',
                    content: 'Third paragraph content not completed.',
                    completed: false,
                    audioS3Key: null,
                    audioStatus: AudioStatus.PENDING,
                  },
                ],
              },
            },
            {
              id: 'test-page-2',
              pageNumber: 2,
              audioStatus: AudioStatus.PENDING,
              paragraphs: {
                create: [
                  {
                    id: 'test-para-4',
                    content: 'Fourth paragraph content not completed.',
                    completed: false,
                    audioS3Key: null,
                    audioStatus: AudioStatus.PENDING,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        pages: {
          include: {
            paragraphs: true,
          },
        },
      },
    });

    testPage = testBook.pages[0];
    testParagraphs = testPage.paragraphs;
  });

  afterAll(async () => {
    // Clean up
    await prismaService.paragraph.deleteMany();
    await prismaService.page.deleteMany();
    await prismaService.book.deleteMany();
    await app.close();
  });

  describe('GET /api/books/:id/export/status', () => {
    it('should return book export status with page completion data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/books/${testBook.id}/export/status`)
        .expect(200);

      expect(response.body).toEqual({
        bookId: testBook.id,
        pages: [
          {
            id: testPage.id,
            pageNumber: 1,
            audioStatus: AudioStatus.PENDING,
            audioS3Key: null,
            completedParagraphs: 2,
            totalParagraphs: 3,
            completionPercentage: expect.closeTo(66.67, 1),
          },
          {
            id: testBook.pages[1].id,
            pageNumber: 2,
            audioStatus: AudioStatus.PENDING,
            audioS3Key: null,
            completedParagraphs: 0,
            totalParagraphs: 1,
            completionPercentage: 0,
          },
        ],
      });
    });

    it('should return 404 for non-existent book', async () => {
      await request(app.getHttpServer())
        .get('/api/books/nonexistent/export/status')
        .expect(404);
    });
  });

  describe('POST /api/books/:id/pages/:pageId/export', () => {
    it('should start page export successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/${testPage.id}/export`)
        .expect(201);

      expect(response.body).toEqual({ success: true });

      // Verify page status was updated
      const updatedPage = await prismaService.page.findUnique({
        where: { id: testPage.id },
      });
      expect(updatedPage?.audioStatus).toBe(AudioStatus.GENERATING);
    });

    it('should return 400 for page with no completed paragraphs', async () => {
      const pageWithNoCompleted = testBook.pages[1]; // Page 2 has no completed paragraphs

      const response = await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/${pageWithNoCompleted.id}/export`)
        .expect(400);

      expect(response.body.message).toContain('No completed paragraphs');
    });

    it('should return 404 for non-existent page', async () => {
      await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/nonexistent/export`)
        .expect(404);
    });
  });

  describe('POST /api/books/:id/pages/:pageId/cancel-export', () => {
    beforeEach(async () => {
      // Set page to GENERATING status
      await prismaService.page.update({
        where: { id: testPage.id },
        data: { audioStatus: AudioStatus.GENERATING },
      });
    });

    it('should cancel page export successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/${testPage.id}/cancel-export`)
        .expect(201);

      expect(response.body).toEqual({ success: true });

      // Verify page status was reset
      const updatedPage = await prismaService.page.findUnique({
        where: { id: testPage.id },
      });
      expect(updatedPage?.audioStatus).toBe(AudioStatus.PENDING);
    });

    it('should return 400 for page not currently generating', async () => {
      // Set page to READY status
      await prismaService.page.update({
        where: { id: testPage.id },
        data: { audioStatus: AudioStatus.READY },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/${testPage.id}/cancel-export`)
        .expect(400);

      expect(response.body.message).toContain('not currently being exported');
    });

    it('should return 404 for non-existent page', async () => {
      await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/nonexistent/cancel-export`)
        .expect(404);
    });
  });

  describe('DELETE /api/books/:id/pages/:pageId/audio', () => {
    beforeEach(async () => {
      // Set page to have exported audio
      await prismaService.page.update({
        where: { id: testPage.id },
        data: {
          audioStatus: AudioStatus.READY,
          audioS3Key: 'test-page-1-exported.mp3',
        },
      });

      // Mock S3 delete operation
      jest.spyOn(s3Service, 'deleteObject').mockResolvedValue(undefined);
    });

    it('should delete page audio successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/books/${testBook.id}/pages/${testPage.id}/audio`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      // Verify S3 delete was called
      expect(s3Service.deleteObject).toHaveBeenCalledWith('test-page-1-exported.mp3');

      // Verify page status was reset
      const updatedPage = await prismaService.page.findUnique({
        where: { id: testPage.id },
      });
      expect(updatedPage?.audioStatus).toBe(AudioStatus.PENDING);
      expect(updatedPage?.audioS3Key).toBeNull();
    });

    it('should return 400 for page with no audio to delete', async () => {
      // Set page to have no audio
      await prismaService.page.update({
        where: { id: testPage.id },
        data: {
          audioStatus: AudioStatus.PENDING,
          audioS3Key: null,
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/books/${testBook.id}/pages/${testPage.id}/audio`)
        .expect(400);

      expect(response.body.message).toContain('No exported audio available');
    });

    it('should return 404 for non-existent page', async () => {
      await request(app.getHttpServer())
        .delete(`/api/books/${testBook.id}/pages/nonexistent/audio`)
        .expect(404);
    });
  });

  describe('GET /api/books/:id/pages/:pageId/audio', () => {
    beforeEach(async () => {
      // Set page to have exported audio
      await prismaService.page.update({
        where: { id: testPage.id },
        data: {
          audioStatus: AudioStatus.READY,
          audioS3Key: 'test-page-1-exported.mp3',
        },
      });

      // Mock S3 stream operation
      const mockStream = require('stream').Readable.from(['mock audio data']);
      jest.spyOn(s3Service, 'getObjectStream').mockResolvedValue(mockStream);
    });

    it('should stream page audio successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/books/${testBook.id}/pages/${testPage.id}/audio`)
        .expect(200);

      // Verify S3 stream was called
      expect(s3Service.getObjectStream).toHaveBeenCalledWith('test-page-1-exported.mp3');

      // Verify response headers
      expect(response.headers['content-type']).toBe('audio/mpeg');
    });

    it('should return 400 for page with no audio available', async () => {
      // Set page to have no audio
      await prismaService.page.update({
        where: { id: testPage.id },
        data: {
          audioStatus: AudioStatus.PENDING,
          audioS3Key: null,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/books/${testBook.id}/pages/${testPage.id}/audio`)
        .expect(400);

      expect(response.body.message).toContain('No exported audio available');
    });

    it('should return 404 for non-existent page', async () => {
      await request(app.getHttpServer())
        .get(`/api/books/${testBook.id}/pages/nonexistent/audio`)
        .expect(404);
    });
  });

  describe('Complete Export Workflow Integration', () => {
    it('should handle complete export lifecycle: start -> process -> play -> delete', async () => {
      // 1. Start export
      await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/${testPage.id}/export`)
        .expect(201);

      // Verify page is in GENERATING status
      let page = await prismaService.page.findUnique({
        where: { id: testPage.id },
      });
      expect(page?.audioStatus).toBe(AudioStatus.GENERATING);

      // 2. Simulate worker completion (manually update status)
      await prismaService.page.update({
        where: { id: testPage.id },
        data: {
          audioStatus: AudioStatus.READY,
          audioS3Key: 'test-page-1-combined.mp3',
        },
      });

      // Mock S3 operations
      const mockStream = require('stream').Readable.from(['mock audio data']);
      jest.spyOn(s3Service, 'getObjectStream').mockResolvedValue(mockStream);
      jest.spyOn(s3Service, 'deleteObject').mockResolvedValue(undefined);

      // 3. Play exported audio
      await request(app.getHttpServer())
        .get(`/api/books/${testBook.id}/pages/${testPage.id}/audio`)
        .expect(200);

      // 4. Delete exported audio
      await request(app.getHttpServer())
        .delete(`/api/books/${testBook.id}/pages/${testPage.id}/audio`)
        .expect(200);

      // Verify final state
      page = await prismaService.page.findUnique({
        where: { id: testPage.id },
      });
      expect(page?.audioStatus).toBe(AudioStatus.PENDING);
      expect(page?.audioS3Key).toBeNull();
    });

    it('should handle export cancellation workflow: start -> cancel', async () => {
      // 1. Start export
      await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/${testPage.id}/export`)
        .expect(201);

      // Verify page is in GENERATING status
      let page = await prismaService.page.findUnique({
        where: { id: testPage.id },
      });
      expect(page?.audioStatus).toBe(AudioStatus.GENERATING);

      // 2. Cancel export
      await request(app.getHttpServer())
        .post(`/api/books/${testBook.id}/pages/${testPage.id}/cancel-export`)
        .expect(201);

      // Verify page status was reset
      page = await prismaService.page.findUnique({
        where: { id: testPage.id },
      });
      expect(page?.audioStatus).toBe(AudioStatus.PENDING);
    });
  });
});
