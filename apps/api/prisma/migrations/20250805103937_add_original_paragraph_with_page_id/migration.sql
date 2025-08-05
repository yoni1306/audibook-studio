-- AlterTable
ALTER TABLE "paragraphs" ADD COLUMN     "originalParagraphId" TEXT;

-- CreateTable
CREATE TABLE "original_paragraphs" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "original_paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "original_paragraphs_pageId_idx" ON "original_paragraphs"("pageId");

-- CreateIndex
CREATE INDEX "paragraphs_originalParagraphId_idx" ON "paragraphs"("originalParagraphId");

-- AddForeignKey
ALTER TABLE "original_paragraphs" ADD CONSTRAINT "original_paragraphs_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_originalParagraphId_fkey" FOREIGN KEY ("originalParagraphId") REFERENCES "original_paragraphs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
