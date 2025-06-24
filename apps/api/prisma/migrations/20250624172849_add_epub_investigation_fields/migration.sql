/*
  Warnings:

  - Added the required column `bookId` to the `text_corrections` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "books" ADD COLUMN     "epubMetadata" JSONB,
ADD COLUMN     "processingLog" TEXT;

-- AlterTable
ALTER TABLE "paragraphs" ADD COLUMN     "sourceBlocks" JSONB,
ADD COLUMN     "sourceChapter" TEXT;

-- AlterTable
ALTER TABLE "text_corrections" ADD COLUMN     "bookId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "raw_chapters" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "title" TEXT,
    "href" TEXT NOT NULL,
    "rawHtml" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "pageBlocks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_chapters_bookId_idx" ON "raw_chapters"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "raw_chapters_bookId_chapterNumber_key" ON "raw_chapters"("bookId", "chapterNumber");

-- CreateIndex
CREATE INDEX "text_corrections_bookId_idx" ON "text_corrections"("bookId");

-- AddForeignKey
ALTER TABLE "raw_chapters" ADD CONSTRAINT "raw_chapters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_corrections" ADD CONSTRAINT "text_corrections_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
