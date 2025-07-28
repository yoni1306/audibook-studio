-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TEXT_EDIT', 'AUDIO_GENERATION', 'BULK_FIX_APPLIED', 'BULK_FIX_SUGGESTED', 'PARAGRAPH_COMPLETED', 'BOOK_UPLOADED', 'EPUB_PARSED', 'CORRECTION_RECORDED');

-- CreateTable
CREATE TABLE "metric_events" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "eventData" JSONB,
    "duration" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_metrics" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "totalTextEdits" INTEGER NOT NULL DEFAULT 0,
    "totalAudioGenerated" INTEGER NOT NULL DEFAULT 0,
    "totalBulkFixes" INTEGER NOT NULL DEFAULT 0,
    "totalCorrections" INTEGER NOT NULL DEFAULT 0,
    "avgProcessingTime" DOUBLE PRECISION,
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_events_bookId_eventType_timestamp_idx" ON "metric_events"("bookId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "metric_events_eventType_timestamp_idx" ON "metric_events"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "metric_events_timestamp_idx" ON "metric_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "book_metrics_bookId_key" ON "book_metrics"("bookId");

-- CreateIndex
CREATE INDEX "book_metrics_lastActivity_idx" ON "book_metrics"("lastActivity");

-- CreateIndex
CREATE INDEX "book_metrics_completionPercentage_idx" ON "book_metrics"("completionPercentage");

-- AddForeignKey
ALTER TABLE "metric_events" ADD CONSTRAINT "metric_events_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_metrics" ADD CONSTRAINT "book_metrics_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
