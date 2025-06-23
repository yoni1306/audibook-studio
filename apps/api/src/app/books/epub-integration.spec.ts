import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { BooksModule } from './books.module';
import { BookStatus } from '@prisma/client';

/*
I want you to change the integration test to do the following - 
1. call create book endpoint in books ctrl with stub data, just to have a generated book id
2. call queue ctrl parse epub with the book id and s3 key. in add epub parsing job of queue service mock getCurrentCorrelationId function
3. wait for the book to be enqueued in worker and parse-epub job to start. mock downloadFromS3 to return the local path of the epub file "test_book.epub" from the artifacts folder.
4. wait for the book to be completely processed.
5. call getbook in books controller with the book id
6. assert book paragraphs text contains numbered list
*/

// Import the actual parseEpub function from workers
import { parseEpub } from '../../../workers/src/epub-parser';

describe('EPUB Integration Test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BooksModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    if (bookId) {
      await prisma.paragraph.deleteMany({
        where: { bookId },
      });
      await prisma.book.delete({
        where: { id: bookId },
      });
    }
    await app.close();
  });

  it('should parse EPUB content and store paragraphs in database', async () => {
    // Step 1: Create a book
    const createBookResponse = await request(app.getHttpServer())
      .post('/api/books')
      .send({
        title: 'Test Book Integration',
        author: 'Test Author',
        language: 'he',
      })
      .expect(201);

    expect(createBookResponse.body).toHaveProperty('book');
    expect(createBookResponse.body.book).toHaveProperty('id');
    bookId = createBookResponse.body.book.id;

    console.log('✅ Book created:', bookId);

    // Step 2: Verify the test EPUB file exists
    const epubPath = path.resolve(process.cwd(), 'test-artifacts/test_book.epub');
    expect(fs.existsSync(epubPath)).toBe(true);
    
    const epubStats = fs.statSync(epubPath);
    expect(epubStats.size).toBeGreaterThan(0);
    console.log('✅ EPUB file verified:', epubStats.size, 'bytes');

    // Step 3: Parse EPUB directly using the parser
    console.log('🔄 Starting EPUB parsing...');
    const parseStart = Date.now();
    const paragraphs = await parseEpub(epubPath);
    const parseDuration = Date.now() - parseStart;
    
    console.log('✅ EPUB parsed successfully in', parseDuration, 'ms');
    console.log('📄 Extracted paragraphs:', paragraphs.length);

    // Step 4: Verify parsing results
    expect(paragraphs).toBeDefined();
    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);

    // Step 5: Save paragraphs to database manually (simulating worker behavior)
    console.log('💾 Saving paragraphs to database...');
    
    // Update book status to PROCESSING
    await prisma.book.update({
      where: { id: bookId },
      data: { status: BookStatus.PROCESSING },
    });

    // Save paragraphs
    const saveStart = Date.now();
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      await prisma.paragraph.create({
        data: {
          id: `${bookId}-${paragraph.chapterNumber}-${i}`,
          bookId,
          content: paragraph.content,
          chapterNumber: paragraph.chapterNumber,
          orderIndex: i,
        },
      });
    }
    const saveDuration = Date.now() - saveStart;

    // Update book status to READY
    await prisma.book.update({
      where: { id: bookId },
      data: { status: BookStatus.READY },
    });

    console.log('✅ Paragraphs saved successfully in', saveDuration, 'ms');

    // Step 6: Fetch book with paragraphs via API
    const bookWithParagraphsResponse = await request(app.getHttpServer())
      .get(`/api/books/${bookId}`)
      .expect(200);

    expect(bookWithParagraphsResponse.body).toHaveProperty('book');
    expect(bookWithParagraphsResponse.body.book).toHaveProperty('paragraphs');
    expect(Array.isArray(bookWithParagraphsResponse.body.book.paragraphs)).toBe(true);
    expect(bookWithParagraphsResponse.body.book.paragraphs.length).toBeGreaterThan(0);

    const retrievedParagraphs = bookWithParagraphsResponse.body.book.paragraphs;
    console.log('✅ Paragraphs retrieved via API:', retrievedParagraphs.length, 'paragraphs');

    // Step 7: Assert paragraph content structure and content
    expect(retrievedParagraphs.length).toBe(paragraphs.length);
    
    retrievedParagraphs.forEach((paragraph, index) => {
      expect(paragraph).toHaveProperty('id');
      expect(paragraph).toHaveProperty('content');
      expect(paragraph).toHaveProperty('chapterNumber');
      expect(paragraph).toHaveProperty('bookId', bookId);
      
      // Verify content is not empty
      expect(paragraph.content.trim().length).toBeGreaterThan(0);
      
      console.log(`📄 Paragraph ${index + 1}: Chapter ${paragraph.chapterNumber}`);
      console.log(`   Content preview: "${paragraph.content.substring(0, 100)}..."`);
    });

    // Step 8: Check for specific content types (lists, regular text)
    const hasNumberedList = retrievedParagraphs.some(p => 
      p.content.includes('1. ') || /^\d+\.\s/.test(p.content)
    );
    const hasBulletList = retrievedParagraphs.some(p => 
      p.content.includes('• ')
    );
    
    console.log('✅ Content analysis:');
    console.log(`   - Has numbered lists: ${hasNumberedList}`);
    console.log(`   - Has bullet lists: ${hasBulletList}`);
    console.log(`   - Total paragraphs: ${retrievedParagraphs.length}`);
    console.log(`   - Chapters found: ${[...new Set(retrievedParagraphs.map(p => p.chapterNumber))].length}`);

    // Step 9: Verify at least some meaningful content was extracted
    const totalContentLength = retrievedParagraphs.reduce((sum, p) => sum + p.content.length, 0);
    expect(totalContentLength).toBeGreaterThan(100); // At least 100 characters total
    
    console.log(`✅ Total content extracted: ${totalContentLength} characters`);

    // Step 10: Verify chapter structure
    const chapters = [...new Set(retrievedParagraphs.map(p => p.chapterNumber))].sort((a, b) => Number(a) - Number(b));
    expect(chapters.length).toBeGreaterThan(0);
    expect(chapters[0]).toBe(1); // First chapter should be 1
    
    console.log('✅ Chapter structure verified:', chapters);

    // Step 11: Verify book status is READY
    expect(bookWithParagraphsResponse.body.book.status).toBe('READY');
    console.log('✅ Book status verified as READY');

    console.log('🎉 EPUB Integration Test completed successfully!');
  }, 30000); // 30 second timeout for the entire test
});
