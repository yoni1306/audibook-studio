/*
  Migration: Add aggregationKey column to text_corrections table
  This migration safely handles existing data by:
  1. Adding the column as nullable first
  2. Updating existing rows with a generated aggregation key
  3. Making the column non-nullable
*/

-- DropIndex
DROP INDEX "text_corrections_originalWord_correctedWord_idx";

-- Step 1: Add the column as nullable first
ALTER TABLE "text_corrections" ADD COLUMN "aggregationKey" TEXT;

-- Step 2: Update existing rows with aggregation key (originalWord|correctedWord)
UPDATE "text_corrections" 
SET "aggregationKey" = "originalWord" || '|' || "correctedWord"
WHERE "aggregationKey" IS NULL;

-- Step 3: Make the column non-nullable
ALTER TABLE "text_corrections" ALTER COLUMN "aggregationKey" SET NOT NULL;

-- CreateIndex
CREATE INDEX "text_corrections_aggregationKey_idx" ON "text_corrections"("aggregationKey");

-- CreateIndex
CREATE INDEX "text_corrections_bookId_aggregationKey_idx" ON "text_corrections"("bookId", "aggregationKey");

-- CreateIndex
CREATE INDEX "text_corrections_createdAt_idx" ON "text_corrections"("createdAt");
