/*
  Warnings:

  - You are about to drop the column `audioDuration` on the `paragraphs` table. All the data in the column will be lost.
  - You are about to drop the column `audioS3Key` on the `paragraphs` table. All the data in the column will be lost.
  - You are about to drop the column `audioStatus` on the `paragraphs` table. All the data in the column will be lost.
  - You are about to drop the column `chapterNumber` on the `paragraphs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pageId,orderIndex]` on the table `paragraphs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pageId` to the `paragraphs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bookId` to the `text_corrections` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "paragraphs" DROP CONSTRAINT "paragraphs_bookId_fkey";

-- DropIndex
DROP INDEX "paragraphs_bookId_orderIndex_key";

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "processingMetadata" JSONB,
ADD COLUMN     "totalPages" INTEGER,
ADD COLUMN     "totalParagraphs" INTEGER;

-- AlterTable
ALTER TABLE "paragraphs" DROP COLUMN "audioDuration",
DROP COLUMN "audioS3Key",
DROP COLUMN "audioStatus",
DROP COLUMN "chapterNumber",
ADD COLUMN     "pageId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "text_corrections" ADD COLUMN     "bookId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "sourceChapter" INTEGER NOT NULL,
    "startPosition" INTEGER NOT NULL,
    "endPosition" INTEGER NOT NULL,
    "pageBreakInfo" JSONB,
    "audioS3Key" TEXT,
    "audioStatus" "AudioStatus" NOT NULL DEFAULT 'PENDING',
    "audioDuration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pages_bookId_idx" ON "pages"("bookId");

-- CreateIndex
CREATE INDEX "pages_audioStatus_idx" ON "pages"("audioStatus");

-- CreateIndex
CREATE UNIQUE INDEX "pages_bookId_pageNumber_key" ON "pages"("bookId", "pageNumber");

-- CreateIndex
CREATE INDEX "paragraphs_pageId_idx" ON "paragraphs"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "paragraphs_pageId_orderIndex_key" ON "paragraphs"("pageId", "orderIndex");

-- CreateIndex
CREATE INDEX "text_corrections_bookId_idx" ON "text_corrections"("bookId");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_corrections" ADD CONSTRAINT "text_corrections_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
