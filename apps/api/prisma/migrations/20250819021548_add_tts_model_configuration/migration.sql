-- AlterTable
ALTER TABLE "books" ADD COLUMN     "ttsModel" TEXT NOT NULL DEFAULT 'azure',
ADD COLUMN     "ttsSettings" JSONB,
ADD COLUMN     "ttsVoice" TEXT;
