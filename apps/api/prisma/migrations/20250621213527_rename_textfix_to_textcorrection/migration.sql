/*
  Warnings:

  - You are about to drop the `text_fixes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "text_fixes" DROP CONSTRAINT "text_fixes_paragraphId_fkey";

-- DropTable
DROP TABLE "text_fixes";

-- CreateTable
CREATE TABLE "text_corrections" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "originalWord" TEXT NOT NULL,
    "correctedWord" TEXT NOT NULL,
    "sentenceContext" TEXT NOT NULL,
    "fixType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "text_corrections_paragraphId_idx" ON "text_corrections"("paragraphId");

-- CreateIndex
CREATE INDEX "text_corrections_originalWord_idx" ON "text_corrections"("originalWord");

-- CreateIndex
CREATE INDEX "text_corrections_correctedWord_idx" ON "text_corrections"("correctedWord");

-- CreateIndex
CREATE INDEX "text_corrections_originalWord_correctedWord_idx" ON "text_corrections"("originalWord", "correctedWord");

-- AddForeignKey
ALTER TABLE "text_corrections" ADD CONSTRAINT "text_corrections_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "paragraphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
