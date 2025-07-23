/*
  Warnings:

  - Added the required column `aggregationKey` to the `text_corrections` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "text_corrections_originalWord_correctedWord_idx";

-- AlterTable
ALTER TABLE "text_corrections" ADD COLUMN     "aggregationKey" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "text_corrections_aggregationKey_idx" ON "text_corrections"("aggregationKey");

-- CreateIndex
CREATE INDEX "text_corrections_bookId_aggregationKey_idx" ON "text_corrections"("bookId", "aggregationKey");

-- CreateIndex
CREATE INDEX "text_corrections_createdAt_idx" ON "text_corrections"("createdAt");
