-- AlterTable
ALTER TABLE "paragraphs" ADD COLUMN     "originalParagraphId" TEXT;

-- CreateTable
CREATE TABLE "original_books" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "language" TEXT NOT NULL DEFAULT 'he',
    "s3Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "original_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "original_pages" (
    "id" TEXT NOT NULL,
    "originalBookId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "sourceChapter" INTEGER NOT NULL,
    "startPosition" INTEGER NOT NULL,
    "endPosition" INTEGER NOT NULL,
    "pageBreakInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "original_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "original_paragraphs" (
    "id" TEXT NOT NULL,
    "originalPageId" TEXT NOT NULL,
    "originalBookId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "original_paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "original_books_bookId_key" ON "original_books"("bookId");

-- CreateIndex
CREATE INDEX "original_pages_originalBookId_idx" ON "original_pages"("originalBookId");

-- CreateIndex
CREATE UNIQUE INDEX "original_pages_originalBookId_pageNumber_key" ON "original_pages"("originalBookId", "pageNumber");

-- CreateIndex
CREATE INDEX "original_paragraphs_originalPageId_idx" ON "original_paragraphs"("originalPageId");

-- CreateIndex
CREATE INDEX "original_paragraphs_originalBookId_idx" ON "original_paragraphs"("originalBookId");

-- CreateIndex
CREATE UNIQUE INDEX "original_paragraphs_originalPageId_orderIndex_key" ON "original_paragraphs"("originalPageId", "orderIndex");

-- CreateIndex
CREATE INDEX "paragraphs_originalParagraphId_idx" ON "paragraphs"("originalParagraphId");

-- AddForeignKey
ALTER TABLE "original_books" ADD CONSTRAINT "original_books_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "original_pages" ADD CONSTRAINT "original_pages_originalBookId_fkey" FOREIGN KEY ("originalBookId") REFERENCES "original_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "original_paragraphs" ADD CONSTRAINT "original_paragraphs_originalPageId_fkey" FOREIGN KEY ("originalPageId") REFERENCES "original_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_originalParagraphId_fkey" FOREIGN KEY ("originalParagraphId") REFERENCES "original_paragraphs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
