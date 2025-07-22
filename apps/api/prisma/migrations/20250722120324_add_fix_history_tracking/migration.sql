/*
  Warnings:

  - Added the required column `currentWord` to the `text_corrections` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "text_corrections" ADD COLUMN     "currentWord" TEXT NOT NULL,
ADD COLUMN     "fixSequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isLatestFix" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "text_corrections_paragraphId_originalWord_isLatestFix_idx" ON "text_corrections"("paragraphId", "originalWord", "isLatestFix");

-- CreateIndex
CREATE INDEX "text_corrections_paragraphId_originalWord_fixSequence_idx" ON "text_corrections"("paragraphId", "originalWord", "fixSequence");
