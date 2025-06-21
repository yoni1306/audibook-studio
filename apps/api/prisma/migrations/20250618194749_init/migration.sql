-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "language" TEXT NOT NULL DEFAULT 'he',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "s3Key" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paragraphs" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "audioS3Key" TEXT,
    "audioStatus" "AudioStatus" NOT NULL DEFAULT 'PENDING',
    "audioDuration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "books_s3Key_key" ON "books"("s3Key");

-- CreateIndex
CREATE INDEX "paragraphs_bookId_idx" ON "paragraphs"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "paragraphs_bookId_orderIndex_key" ON "paragraphs"("bookId", "orderIndex");

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable for tracking text fixes
CREATE TABLE "text_fixes" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "fixedText" TEXT NOT NULL,
    "originalWord" TEXT NOT NULL,
    "fixedWord" TEXT NOT NULL,
    "wordPosition" INTEGER NOT NULL,
    "fixType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for better performance
CREATE INDEX "text_fixes_paragraphId_idx" ON "text_fixes"("paragraphId");
CREATE INDEX "text_fixes_originalWord_idx" ON "text_fixes"("originalWord");
CREATE INDEX "text_fixes_fixedWord_idx" ON "text_fixes"("fixedWord");

-- Add foreign key constraint
ALTER TABLE "text_fixes" ADD CONSTRAINT "text_fixes_paragraphId_fkey" 
    FOREIGN KEY ("paragraphId") REFERENCES "paragraphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;