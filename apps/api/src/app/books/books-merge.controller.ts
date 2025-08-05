import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaClient } from '@prisma/client';

interface MergeBookRequest {
  oldBookId: string;
  newBookId: string;
  dryRun?: boolean;
}

interface MergeBookResponse {
  success: boolean;
  message: string;
  oldBook?: {
    id: string;
    title: string;
    pages: number;
  };
  newBook?: {
    id: string;
    title: string;
    pages: number;
  };
  stats: {
    pagesMatched: number;
    originalParagraphsTransferred: number;
    paragraphsLinked: number;
  };
  errors?: string[];
}

@ApiTags('books')
@Controller('books')
export class BooksMergeController {
  private prisma = new PrismaClient();

  @Post('merge-original-paragraphs')
  @ApiOperation({
    summary: 'Merge original paragraphs from new book to old book',
    description: `
      Transfers original paragraphs from a new book (with original paragraphs) 
      to an old book (without original paragraphs), then deletes the new book.
      
      This is useful for production migration where you have duplicate books:
      - Old book: has user edits, audio, etc. but no original paragraphs
      - New book: has original paragraphs but no user state
      
      Result: Old book with all its state + original paragraphs from new book
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Merge completed successfully',
    type: Object,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or merge validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during merge',
  })
  async mergeOriginalParagraphs(
    @Body() request: MergeBookRequest,
  ): Promise<MergeBookResponse> {
    try {
      // 1. Validate books exist
      const [oldBook, newBook] = await Promise.all([
        this.prisma.book.findUnique({
          where: { id: request.oldBookId },
          include: { pages: { orderBy: { pageNumber: 'asc' } } },
        }),
        this.prisma.book.findUnique({
          where: { id: request.newBookId },
          include: { pages: { orderBy: { pageNumber: 'asc' } } },
        }),
      ]);

      if (!oldBook) {
        throw new Error(`Old book not found: ${request.oldBookId}`);
      }
      if (!newBook) {
        throw new Error(`New book not found: ${request.newBookId}`);
      }

      if (oldBook.pages.length !== newBook.pages.length) {
        throw new Error(`Page count mismatch: Old book has ${oldBook.pages.length} pages, new book has ${newBook.pages.length} pages`);
      }

      // 2. Check original paragraphs
      const newBookOriginalCount = await this.prisma.originalParagraph.count({
        where: { 
          page: { 
            bookId: newBook.id 
          } 
        },
      });

      if (newBookOriginalCount === 0) {
        throw new Error('New book has no original paragraphs to transfer');
      }

      if (request.dryRun) {
        return {
          success: true,
          message: 'Dry run completed successfully. No changes were made.',
          oldBook: {
            id: oldBook.id,
            title: oldBook.title,
            pages: oldBook.pages.length,
          },
          newBook: {
            id: newBook.id,
            title: newBook.title,
            pages: newBook.pages.length,
          },
          stats: {
            pagesMatched: oldBook.pages.length,
            originalParagraphsTransferred: newBookOriginalCount,
            paragraphsLinked: 0, // Would be calculated in actual run
          },
        };
      }

      // 3. Perform the actual merge
      let totalTransferred = 0;
      let totalLinked = 0;

      await this.prisma.$transaction(async (tx) => {
        // Transfer original paragraphs page by page
        for (let i = 0; i < oldBook.pages.length; i++) {
          const oldPage = oldBook.pages[i];
          const newPage = newBook.pages[i];

          if (oldPage.pageNumber !== newPage.pageNumber) {
            throw new Error(`Page number mismatch at index ${i}: old page ${oldPage.pageNumber}, new page ${newPage.pageNumber}`);
          }

          // Update original paragraphs to reference the old book's page
          const updateResult = await tx.originalParagraph.updateMany({
            where: { 
              pageId: newPage.id 
            },
            data: { 
              pageId: oldPage.id 
            },
          });

          totalTransferred += updateResult.count;
        }

        // Link paragraphs to their original paragraphs
        for (const oldPage of oldBook.pages) {
          const paragraphs = await tx.paragraph.findMany({
            where: { pageId: oldPage.id },
            orderBy: { orderIndex: 'asc' },
          });

          const originalParagraphs = await tx.originalParagraph.findMany({
            where: { 
              pageId: oldPage.id 
            },
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
      });

      return {
        success: true,
        message: 'Books merged successfully. New book has been deleted.',
        stats: {
          pagesMatched: oldBook.pages.length,
          originalParagraphsTransferred: totalTransferred,
          paragraphsLinked: totalLinked,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Merge operation failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('verify-merge')
  @ApiOperation({
    summary: 'Verify the success of a book merge operation',
    description: `
      Runs comprehensive validation queries to verify that a book merge was successful.
      Checks original paragraph counts, paragraph linking, and data integrity.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Verification completed with detailed results',
    type: Object,
  })
  async verifyMerge(
    @Body() request: { bookId: string },
  ): Promise<any> {
    try {
      const bookId = request.bookId;

      // 1. Get book details
      const book = await this.prisma.book.findUnique({
        where: { id: bookId },
        include: {
          pages: {
            orderBy: { pageNumber: 'asc' },
            include: {
              paragraphs: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      });

      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      // 2. Count original paragraphs for this book
      const originalParagraphCount = await this.prisma.originalParagraph.count({
        where: {
          page: {
            bookId: bookId,
          },
        },
      });

      // 3. Count paragraphs with original paragraph links
      const linkedParagraphCount = await this.prisma.paragraph.count({
        where: {
          page: {
            bookId: bookId,
          },
          originalParagraphId: {
            not: null,
          },
        },
      });

      // 4. Count paragraphs without original paragraph links
      const unlinkedParagraphCount = await this.prisma.paragraph.count({
        where: {
          page: {
            bookId: bookId,
          },
          originalParagraphId: null,
        },
      });

      // 5. Get total paragraph count
      const totalParagraphCount = await this.prisma.paragraph.count({
        where: {
          page: {
            bookId: bookId,
          },
        },
      });

      // 6. Check for orphaned original paragraphs (original paragraphs not linked to any paragraph)
      const orphanedOriginalCount = await this.prisma.originalParagraph.count({
        where: {
          page: {
            bookId: bookId,
          },
          paragraphs: {
            none: {},
          },
        },
      });

      // 7. Page-by-page breakdown
      const pageBreakdown = [];
      for (const page of book.pages) {
        const pageOriginalCount = await this.prisma.originalParagraph.count({
          where: { pageId: page.id },
        });
        
        const pageLinkedCount = await this.prisma.paragraph.count({
          where: {
            pageId: page.id,
            originalParagraphId: { not: null },
          },
        });
        
        const pageUnlinkedCount = await this.prisma.paragraph.count({
          where: {
            pageId: page.id,
            originalParagraphId: null,
          },
        });

        pageBreakdown.push({
          pageNumber: page.pageNumber,
          pageId: page.id,
          totalParagraphs: page.paragraphs.length,
          originalParagraphs: pageOriginalCount,
          linkedParagraphs: pageLinkedCount,
          unlinkedParagraphs: pageUnlinkedCount,
          linkingRatio: page.paragraphs.length > 0 ? (pageLinkedCount / page.paragraphs.length * 100).toFixed(1) + '%' : '0%',
        });
      }

      // 8. Calculate overall health metrics
      const linkingRatio = totalParagraphCount > 0 ? (linkedParagraphCount / totalParagraphCount * 100).toFixed(1) : '0';
      const isHealthy = unlinkedParagraphCount === 0 && orphanedOriginalCount === 0 && originalParagraphCount > 0;

      return {
        success: true,
        book: {
          id: book.id,
          title: book.title,
          totalPages: book.pages.length,
        },
        summary: {
          totalParagraphs: totalParagraphCount,
          originalParagraphs: originalParagraphCount,
          linkedParagraphs: linkedParagraphCount,
          unlinkedParagraphs: unlinkedParagraphCount,
          orphanedOriginals: orphanedOriginalCount,
          linkingRatio: linkingRatio + '%',
          isHealthy,
        },
        validation: {
          hasOriginalParagraphs: originalParagraphCount > 0,
          allParagraphsLinked: unlinkedParagraphCount === 0,
          noOrphanedOriginals: orphanedOriginalCount === 0,
          originalToLinkedMatch: originalParagraphCount === linkedParagraphCount,
        },
        pageBreakdown,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Verification failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('health-check')
  @ApiOperation({
    summary: 'Simple health check for book merge success',
    description: 'Returns OK/NOT OK status with reason for migration verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
    type: Object,
  })
  async healthCheck(
    @Body() request: { bookId: string },
  ): Promise<{ status: 'OK' | 'NOT OK'; reason: string; stats?: any }> {
    try {
      const bookId = request.bookId;

      // Quick validation queries
      const [originalCount, linkedCount, unlinkedCount, orphanedCount] = await Promise.all([
        // Original paragraphs for this book
        this.prisma.originalParagraph.count({
          where: { page: { bookId } },
        }),
        // Paragraphs with original links
        this.prisma.paragraph.count({
          where: {
            page: { bookId },
            originalParagraphId: { not: null },
          },
        }),
        // Paragraphs without original links
        this.prisma.paragraph.count({
          where: {
            page: { bookId },
            originalParagraphId: null,
          },
        }),
        // Orphaned original paragraphs
        this.prisma.originalParagraph.count({
          where: {
            page: { bookId },
            paragraphs: { none: {} },
          },
        }),
      ]);

      // Health checks
      if (originalCount === 0) {
        return {
          status: 'NOT OK',
          reason: 'No original paragraphs found',
          stats: { originalCount, linkedCount, unlinkedCount, orphanedCount },
        };
      }

      if (unlinkedCount > 0) {
        return {
          status: 'NOT OK',
          reason: `${unlinkedCount} paragraphs not linked to originals`,
          stats: { originalCount, linkedCount, unlinkedCount, orphanedCount },
        };
      }

      if (orphanedCount > 0) {
        return {
          status: 'NOT OK',
          reason: `${orphanedCount} orphaned original paragraphs`,
          stats: { originalCount, linkedCount, unlinkedCount, orphanedCount },
        };
      }

      if (originalCount !== linkedCount) {
        return {
          status: 'NOT OK',
          reason: `Mismatch: ${originalCount} originals vs ${linkedCount} linked`,
          stats: { originalCount, linkedCount, unlinkedCount, orphanedCount },
        };
      }

      return {
        status: 'OK',
        reason: `Perfect migration: ${linkedCount} paragraphs fully linked`,
        stats: { originalCount, linkedCount, unlinkedCount, orphanedCount },
      };
    } catch (error) {
      return {
        status: 'NOT OK',
        reason: `Health check failed: ${error.message}`,
      };
    }
  }
}
