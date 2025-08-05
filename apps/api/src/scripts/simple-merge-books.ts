#!/usr/bin/env tsx

/**
 * Simple Book Merge Utility: Transfer Original Paragraphs
 * 
 * This utility transfers original paragraphs from a new book to an old book,
 * then deletes the new book. Simplified version with minimal type issues.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Args {
  oldBookId: string;
  newBookId: string;
  dryRun: boolean;
  verbose: boolean;
}

async function parseArgs(): Promise<Args> {
  const args = process.argv.slice(2);
  const result: Partial<Args> = {
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--old-book-id':
        result.oldBookId = args[++i];
        break;
      case '--new-book-id':
        result.newBookId = args[++i];
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--verbose':
        result.verbose = true;
        break;
      case '--help':
        console.log(`
Usage: npx tsx simple-merge-books.ts --old-book-id <id> --new-book-id <id> [options]

Required:
  --old-book-id <id>     ID of the old book (keeps user state, gets original paragraphs)
  --new-book-id <id>     ID of the new book (provides original paragraphs, gets deleted)

Options:
  --dry-run              Preview changes without applying them
  --verbose              Show detailed progress
  --help                 Show this help message
        `);
        process.exit(0);
    }
  }

  if (!result.oldBookId || !result.newBookId) {
    console.error('Both --old-book-id and --new-book-id are required');
    process.exit(1);
  }

  return result as Args;
}

async function mergeBooks(args: Args) {
  console.log('🔄 Starting Book Merge Operation');
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE MERGE'}`);
  console.log(`Old Book ID: ${args.oldBookId}`);
  console.log(`New Book ID: ${args.newBookId}`);
  console.log('---');

  try {
    // 1. Validate books exist
    console.log('🔍 Loading and validating books...');
    
    const [oldBook, newBook] = await Promise.all([
      prisma.book.findUnique({
        where: { id: args.oldBookId },
        include: { pages: { orderBy: { pageNumber: 'asc' } } },
      }),
      prisma.book.findUnique({
        where: { id: args.newBookId },
        include: { pages: { orderBy: { pageNumber: 'asc' } } },
      }),
    ]);

    if (!oldBook) {
      throw new Error(`Old book not found: ${args.oldBookId}`);
    }
    if (!newBook) {
      throw new Error(`New book not found: ${args.newBookId}`);
    }

    if (oldBook.pages.length !== newBook.pages.length) {
      throw new Error(`Page count mismatch: Old book has ${oldBook.pages.length} pages, new book has ${newBook.pages.length} pages`);
    }

    // 2. Check original paragraphs
    const newBookOriginalCount = await prisma.originalParagraph.count({
      where: { page: { bookId: newBook.id } },
    });

    if (newBookOriginalCount === 0) {
      throw new Error('New book has no original paragraphs to transfer');
    }

    console.log(`✅ Books validated:`);
    console.log(`   Old book: "${oldBook.title}" (${oldBook.pages.length} pages)`);
    console.log(`   New book: "${newBook.title}" (${newBook.pages.length} pages, ${newBookOriginalCount} original paragraphs)`);

    if (args.dryRun) {
      console.log('\n[DRY RUN] Would perform the following operations:');
      console.log(`   📄 Transfer ${newBookOriginalCount} original paragraphs`);
      console.log(`   🔗 Link paragraphs to original paragraphs`);
      console.log(`   🗑️  Delete new book: "${newBook.title}"`);
      console.log('\n💡 This was a dry run. No changes were made to the database.');
      return;
    }

    // 3. Perform the merge
    console.log('\n🔄 Performing merge operation...');
    
    await prisma.$transaction(async (tx) => {
      let totalTransferred = 0;
      
      // Transfer original paragraphs page by page
      for (let i = 0; i < oldBook.pages.length; i++) {
        const oldPage = oldBook.pages[i];
        const newPage = newBook.pages[i];

        if (oldPage.pageNumber !== newPage.pageNumber) {
          throw new Error(`Page number mismatch at index ${i}: old page ${oldPage.pageNumber}, new page ${newPage.pageNumber}`);
        }

        // Update original paragraphs to reference the old book's page
        const updateResult = await tx.originalParagraph.updateMany({
          where: { pageId: newPage.id },
          data: { pageId: oldPage.id },
        });

        totalTransferred += updateResult.count;

        if (args.verbose) {
          console.log(`   📄 Transferred ${updateResult.count} original paragraphs from page ${newPage.pageNumber}`);
        }
      }

      // Link paragraphs to their original paragraphs
      let totalLinked = 0;
      for (const oldPage of oldBook.pages) {
        const paragraphs = await tx.paragraph.findMany({
          where: { pageId: oldPage.id },
          orderBy: { orderIndex: 'asc' },
        });

        const originalParagraphs = await tx.originalParagraph.findMany({
          where: { pageId: oldPage.id },
          orderBy: { createdAt: 'asc' },
        });

        // Link paragraphs by order
        for (let i = 0; i < Math.min(paragraphs.length, originalParagraphs.length); i++) {
          if (!paragraphs[i].originalParagraphId) {
            await tx.paragraph.update({
              where: { id: paragraphs[i].id },
              data: { originalParagraphId: originalParagraphs[i].id },
            });
            totalLinked++;
          }
        }
      }

      // Delete the new book
      await tx.book.delete({ where: { id: newBook.id } });

      console.log(`✅ Successfully merged books and deleted new book`);
      console.log(`   📊 Original paragraphs transferred: ${totalTransferred}`);
      console.log(`   🔗 Paragraphs linked: ${totalLinked}`);
    });

    console.log('\n🎉 Merge completed successfully!');

  } catch (error) {
    console.error('❌ Merge failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    const args = await parseArgs();
    await mergeBooks(args);
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
