-- AlterTable
ALTER TABLE "paragraphs" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "paragraphs_completed_idx" ON "paragraphs"("completed");
