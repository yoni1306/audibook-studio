/*
  Warnings:

  - Added the required column `fixType` to the `text_corrections` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FixType" AS ENUM ('vowelization', 'disambiguation', 'punctuation', 'sentence_break', 'dialogue_marking', 'expansion', 'default');

-- AlterTable
ALTER TABLE "paragraphs" ADD COLUMN     "audioDuration" DOUBLE PRECISION,
ADD COLUMN     "audioS3Key" TEXT,
ADD COLUMN     "audioStatus" "AudioStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "text_corrections" ADD COLUMN     "ttsModel" TEXT,
ADD COLUMN     "ttsVoice" TEXT,
DROP COLUMN "fixType",
ADD COLUMN     "fixType" "FixType" NOT NULL;

-- CreateIndex
CREATE INDEX "paragraphs_audioStatus_idx" ON "paragraphs"("audioStatus");
