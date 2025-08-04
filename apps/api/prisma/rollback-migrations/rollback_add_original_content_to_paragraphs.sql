-- Rollback migration for: 20250803165017_add_original_content_to_paragraphs
-- This file can be used to manually rollback the originalContent field addition

-- WARNING: This will permanently delete all originalContent data
-- Make sure to backup the database before running this rollback

BEGIN;

-- Remove the originalContent column
ALTER TABLE "paragraphs" DROP COLUMN IF EXISTS "originalContent";

-- Update the _prisma_migrations table to mark the migration as rolled back
-- (This is optional and depends on your rollback strategy)
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20250803165017_add_original_content_to_paragraphs';

COMMIT;

-- To apply this rollback:
-- 1. Stop your application
-- 2. Backup your database
-- 3. Run: psql -d your_database -f rollback_add_original_content_to_paragraphs.sql
-- 4. Update your Prisma schema to remove the originalContent field
-- 5. Run: npx prisma generate
-- 6. Restart your application
