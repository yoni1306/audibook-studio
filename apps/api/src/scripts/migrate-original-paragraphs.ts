#!/usr/bin/env tsx

/**
 * Production Migration Script: Populate Original Paragraphs
 * 
 * This script creates OriginalParagraph records for existing books in production
 * and updates all Paragraph records to reference their original content.
 * 
 * Usage:
 *   pnpm tsx src/scripts/migrate-original-paragraphs.ts [options]
 * 
 * Options:
 *   --dry-run: Preview changes without applying them
 *   --book-id <id>: Migrate specific book only
 *   --batch-size <size>: Process paragraphs in batches (default: 100)
 *   --verbose: Show detailed progress
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

interface MigrationOptions {
  dryRun: boolean;
  bookId?: string;
  batchSize: number;
  verbose: boolean;
}

interface MigrationStats {
  booksProcessed: number;
  pagesProcessed: number;
  originalParagraphsCreated: number;
  paragraphsUpdated: number;
  errors: string[];
}

class OriginalParagraphMigrator {
  private prisma: PrismaClient;
  private options: MigrationOptions;
  private stats: MigrationStats;

  constructor(options: MigrationOptions) {
    this.prisma = new PrismaClient();
    this.options = options;
    this.stats = {
      booksProcessed: 0,
      pagesProcessed: 0,
      originalParagraphsCreated: 0,
      paragraphsUpdated: 0,
      errors: [],
    };
  }

  async migrate(): Promise<void> {
    console.log('🚀 Starting Original Paragraphs Migration');
    console.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    console.log(`Batch Size: ${this.options.batchSize}`);
    
    if (this.options.bookId) {
      console.log(`Target Book: ${this.options.bookId}`);
    }
    
    console.log('---');

    try {
      // Get books to process
      const books = await this.getBooksToMigrate();
      console.log(`📚 Found ${books.length} books to process`);

      for (const book of books) {
        await this.migrateBook(book);
      }

      this.printSummary();
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async getBooksToMigrate() {
    const whereClause = this.options.bookId 
      ? { id: this.options.bookId }
      : {};

    return this.prisma.book.findMany({
      where: whereClause,
      include: {
        pages: {
          include: {
            paragraphs: {
              where: {
                originalParagraphId: null, // Only migrate paragraphs without original references
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });
  }

  private async migrateBook(book: any): Promise<void> {
    if (this.options.verbose) {
      console.log(`\n📖 Processing book: ${book.title} (${book.id})`);
    }

    let bookHasParagraphsToMigrate = false;

    for (const page of book.pages) {
      if (page.paragraphs.length > 0) {
        bookHasParagraphsToMigrate = true;
        await this.migratePage(page);
      }
    }

    if (bookHasParagraphsToMigrate) {
      this.stats.booksProcessed++;
      if (this.options.verbose) {
        console.log(`✅ Completed book: ${book.title}`);
      }
    } else if (this.options.verbose) {
      console.log(`⏭️  Skipped book (already migrated): ${book.title}`);
    }
  }

  private async migratePage(page: any): Promise<void> {
    if (this.options.verbose) {
      console.log(`  📄 Processing page ${page.pageNumber} (${page.paragraphs.length} paragraphs)`);
    }

    // Process paragraphs in batches
    const paragraphs = page.paragraphs;
    for (let i = 0; i < paragraphs.length; i += this.options.batchSize) {
      const batch = paragraphs.slice(i, i + this.options.batchSize);
      await this.migrateParagraphBatch(page.id, batch);
    }

    this.stats.pagesProcessed++;
  }

  private async migrateParagraphBatch(pageId: string, paragraphs: any[]): Promise<void> {
    if (this.options.dryRun) {
      // In dry run mode, just log what would be done
      console.log(`  [DRY RUN] Would create ${paragraphs.length} original paragraphs for page ${pageId}`);
      this.stats.originalParagraphsCreated += paragraphs.length;
      this.stats.paragraphsUpdated += paragraphs.length;
      return;
    }

    try {
      // Use a transaction to ensure data consistency
      await this.prisma.$transaction(async (tx) => {
        // Create original paragraphs for this batch
        const originalParagraphs = paragraphs.map(paragraph => ({
          id: randomUUID(),
          pageId: pageId,
          content: paragraph.content,
          createdAt: paragraph.createdAt,
          updatedAt: new Date(),
        }));

        // Insert original paragraphs
        await tx.originalParagraph.createMany({
          data: originalParagraphs,
        });

        // Update paragraphs to reference their original content
        for (let i = 0; i < paragraphs.length; i++) {
          await tx.paragraph.update({
            where: { id: paragraphs[i].id },
            data: { originalParagraphId: originalParagraphs[i].id },
          });
        }

        this.stats.originalParagraphsCreated += originalParagraphs.length;
        this.stats.paragraphsUpdated += paragraphs.length;
      });

      if (this.options.verbose) {
        console.log(`    ✅ Migrated batch of ${paragraphs.length} paragraphs`);
      }
    } catch (error) {
      const errorMsg = `Failed to migrate paragraph batch for page ${pageId}: ${error}`;
      this.stats.errors.push(errorMsg);
      console.error(`    ❌ ${errorMsg}`);
    }
  }

  private printSummary(): void {
    console.log('\n📊 Migration Summary');
    console.log('===================');
    console.log(`Books processed: ${this.stats.booksProcessed}`);
    console.log(`Pages processed: ${this.stats.pagesProcessed}`);
    console.log(`Original paragraphs created: ${this.stats.originalParagraphsCreated}`);
    console.log(`Paragraphs updated: ${this.stats.paragraphsUpdated}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${this.stats.errors.length}`);
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n🎉 Migration completed successfully with no errors!');
    }

    if (this.options.dryRun) {
      console.log('\n💡 This was a dry run. No changes were made to the database.');
      console.log('   Run without --dry-run to apply the migration.');
    }
  }
}

// CLI argument parsing
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: false,
    batchSize: 100,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--book-id':
        options.bookId = args[++i];
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10) || 100;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Usage: pnpm tsx src/scripts/migrate-original-paragraphs.ts [options]

Options:
  --dry-run              Preview changes without applying them
  --book-id <id>         Migrate specific book only
  --batch-size <size>    Process paragraphs in batches (default: 100)
  --verbose              Show detailed progress
  --help                 Show this help message
        `);
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();
  const migrator = new OriginalParagraphMigrator(options);
  
  try {
    await migrator.migrate();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { OriginalParagraphMigrator, MigrationOptions };
