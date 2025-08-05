#!/usr/bin/env tsx

/**
 * Book Merge Utility: Transfer Original Paragraphs
 * 
 * This utility transfers original paragraphs from a new book (with original paragraphs)
 * to an old book (without original paragraphs), then deletes the new book.
 * 
 * This is useful for production migration where you have duplicate books:
 * - Old book: has user edits, audio, etc. but no original paragraphs
 * - New book: has original paragraphs but no user state
 * 
 * The result: Old book with all its state + original paragraphs from new book
 * 
 * Usage:
 *   pnpm tsx src/scripts/merge-book-original-paragraphs.ts --old-book-id <id> --new-book-id <id> [options]
 */

import { PrismaClient } from '@prisma/client';

interface MergeOptions {
  oldBookId: string;
  newBookId: string;
  dryRun: boolean;
  verbose: boolean;
}

interface MergeStats {
  pagesMatched: number;
  originalParagraphsTransferred: number;
  paragraphsLinked: number;
  errors: string[];
}

class BookMerger {
  private prisma: PrismaClient;
  private options: MergeOptions;
  private stats: MergeStats;

  constructor(options: MergeOptions) {
    this.prisma = new PrismaClient();
    this.options = options;
    this.stats = {
      pagesMatched: 0,
      originalParagraphsTransferred: 0,
      paragraphsLinked: 0,
      errors: [],
    };
  }

  async merge(): Promise<void> {
    console.log('🔄 Starting Book Merge Operation');
    console.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE MERGE'}`);
    console.log(`Old Book ID: ${this.options.oldBookId}`);
    console.log(`New Book ID: ${this.options.newBookId}`);
    console.log('---');

    try {
      // Validate books exist and get their data
      const { oldBook, newBook } = await this.validateAndLoadBooks();
      
      // Perform the merge operation
      await this.performMerge(oldBook, newBook);
      
      this.printSummary();
    } catch (error) {
      console.error('❌ Merge failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async validateAndLoadBooks() {
    console.log('🔍 Loading and validating books...');

    const [oldBook, newBook] = await Promise.all([
      this.prisma.book.findUnique({
        where: { id: this.options.oldBookId },
        include: {
          pages: {
            include: {
              paragraphs: {
                orderBy: { orderIndex: 'asc' },
              },
              originalParagraphs: true,
            },
            orderBy: { pageNumber: 'asc' },
          },
        },
      }),
      this.prisma.book.findUnique({
        where: { id: this.options.newBookId },
        include: {
          pages: {
            include: {
              paragraphs: {
                orderBy: { orderIndex: 'asc' },
              },
              originalParagraphs: true,
            },
            orderBy: { pageNumber: 'asc' },
          },
        },
      }),
    ]);

    if (!oldBook) {
      throw new Error(`Old book not found: ${this.options.oldBookId}`);
    }

    if (!newBook) {
      throw new Error(`New book not found: ${this.options.newBookId}`);
    }

    // Validate that books are compatible for merging
    if (oldBook.pages.length !== newBook.pages.length) {
      throw new Error(`Page count mismatch: Old book has ${oldBook.pages.length} pages, new book has ${newBook.pages.length} pages`);
    }

    // Check if old book already has original paragraphs
    const oldBookOriginalParagraphs = oldBook.pages.reduce((total, page) => total + page.originalParagraphs.length, 0);
    if (oldBookOriginalParagraphs > 0) {
      console.warn(`⚠️  Old book already has ${oldBookOriginalParagraphs} original paragraphs. This merge may create duplicates.`);
    }

    // Check if new book has original paragraphs
    const newBookOriginalParagraphs = newBook.pages.reduce((total, page) => total + page.originalParagraphs.length, 0);
    if (newBookOriginalParagraphs === 0) {
      throw new Error('New book has no original paragraphs to transfer');
    }

    console.log(`✅ Books validated:`);
    console.log(`   Old book: "${oldBook.title}" (${oldBook.pages.length} pages)`);
    console.log(`   New book: "${newBook.title}" (${newBook.pages.length} pages, ${newBookOriginalParagraphs} original paragraphs)`);

    return { oldBook, newBook };
  }

  private async performMerge(oldBook: any, newBook: any): Promise<void> {
    if (this.options.dryRun) {
      console.log('\n[DRY RUN] Would perform the following operations:');
      await this.simulateMerge(oldBook, newBook);
      return;
    }

    console.log('\n🔄 Performing merge operation...');

    try {
      await this.prisma.$transaction(async (tx) => {
        // Step 1: Map pages between old and new books and update original paragraphs
        for (let i = 0; i < oldBook.pages.length; i++) {
          const oldPage = oldBook.pages[i];
          const newPage = newBook.pages[i];

          if (oldPage.pageNumber !== newPage.pageNumber) {
            throw new Error(`Page number mismatch at index ${i}: old page ${oldPage.pageNumber}, new page ${newPage.pageNumber}`);
          }

          // Update original paragraphs to reference the old book's page
          if (newPage.originalParagraphs.length > 0) {
            await tx.originalParagraph.updateMany({
              where: { pageId: newPage.id },
              data: { pageId: oldPage.id },
            });

            this.stats.originalParagraphsTransferred += newPage.originalParagraphs.length;
            this.stats.pagesMatched++;

            if (this.options.verbose) {
              console.log(`   📄 Transferred ${newPage.originalParagraphs.length} original paragraphs from page ${newPage.pageNumber}`);
            }
          }
        }

        // Step 2: Link old book's paragraphs to their original paragraphs
        await this.linkParagraphsToOriginals(tx, oldBook, newBook);

        // Step 3: Delete the new book (cascade will handle pages and paragraphs)
        await tx.book.delete({
          where: { id: newBook.id },
        });

        console.log(`✅ Successfully merged books and deleted new book`);
      });
    } catch (error) {
      this.stats.errors.push(`Transaction failed: ${error}`);
      throw error;
    }
  }

  private async simulateMerge(oldBook: any, newBook: any): Promise<void> {
    for (let i = 0; i < oldBook.pages.length; i++) {
      const oldPage = oldBook.pages[i];
      const newPage = newBook.pages[i];

      if (newPage.originalParagraphs.length > 0) {
        console.log(`   📄 Would transfer ${newPage.originalParagraphs.length} original paragraphs from page ${newPage.pageNumber}`);
        this.stats.originalParagraphsTransferred += newPage.originalParagraphs.length;
        this.stats.pagesMatched++;
      }
    }

    console.log(`   🔗 Would link paragraphs to original paragraphs`);
    console.log(`   🗑️  Would delete new book: "${newBook.title}"`);
  }

  private async linkParagraphsToOriginals(tx: any, oldBook: any, newBook: any): Promise<void> {
    // This is the tricky part - we need to match paragraphs between books
    // We'll match by page number and paragraph order index
    
    for (let pageIndex = 0; pageIndex < oldBook.pages.length; pageIndex++) {
      const oldPage = oldBook.pages[pageIndex];
      const newPage = newBook.pages[pageIndex];

      // Get original paragraphs for this page (now pointing to old page after transfer)
      const originalParagraphs = await tx.originalParagraph.findMany({
        where: { pageId: oldPage.id },
        orderBy: { createdAt: 'asc' }, // Assuming creation order matches paragraph order
      });

      // Match paragraphs by order index
      for (let paragraphIndex = 0; paragraphIndex < oldPage.paragraphs.length; paragraphIndex++) {
        const oldParagraph = oldPage.paragraphs[paragraphIndex];
        const correspondingOriginal = originalParagraphs[paragraphIndex];

        if (correspondingOriginal && !oldParagraph.originalParagraphId) {
          await tx.paragraph.update({
            where: { id: oldParagraph.id },
            data: { originalParagraphId: correspondingOriginal.id },
          });

          this.stats.paragraphsLinked++;
        }
      }
    }

    if (this.options.verbose) {
      console.log(`   🔗 Linked ${this.stats.paragraphsLinked} paragraphs to their originals`);
    }
  }

  private printSummary(): void {
    console.log('\n📊 Merge Summary');
    console.log('================');
    console.log(`Pages processed: ${this.stats.pagesMatched}`);
    console.log(`Original paragraphs transferred: ${this.stats.originalParagraphsTransferred}`);
    console.log(`Paragraphs linked: ${this.stats.paragraphsLinked}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${this.stats.errors.length}`);
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n🎉 Merge completed successfully with no errors!');
    }

    if (this.options.dryRun) {
      console.log('\n💡 This was a dry run. No changes were made to the database.');
      console.log('   Run without --dry-run to apply the merge.');
    }
  }
}

// CLI argument parsing
function parseArgs(): MergeOptions {
  const args = process.argv.slice(2);
  const options: Partial<MergeOptions> = {
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--old-book-id':
        options.oldBookId = args[++i];
        break;
      case '--new-book-id':
        options.newBookId = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Usage: pnpm tsx src/scripts/merge-book-original-paragraphs.ts --old-book-id <id> --new-book-id <id> [options]

Required:
  --old-book-id <id>     ID of the old book (keeps user state, gets original paragraphs)
  --new-book-id <id>     ID of the new book (provides original paragraphs, gets deleted)

Options:
  --dry-run              Preview changes without applying them
  --verbose              Show detailed progress
  --help                 Show this help message
        `);
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!options.oldBookId || !options.newBookId) {
    console.error('Both --old-book-id and --new-book-id are required');
    process.exit(1);
  }

  return options as MergeOptions;
}

// Main execution
async function main() {
  const options = parseArgs();
  const merger = new BookMerger(options);
  
  try {
    await merger.merge();
    process.exit(0);
  } catch (error) {
    console.error('Merge failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { BookMerger, MergeOptions };
