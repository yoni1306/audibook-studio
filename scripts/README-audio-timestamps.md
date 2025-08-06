# Audio Timestamp Backfill - Automatic Startup Logic

## Overview

The audio timestamp backfill runs automatically when the API service starts up. It backfills the `audioGeneratedAt` timestamp for existing paragraphs that have audio but are missing the timestamp field.

## Purpose

When the `audioGeneratedAt` field was added to the database schema, existing paragraphs with generated audio had `NULL` values for this field. This script updates those paragraphs to use their `updatedAt` timestamp as a reasonable approximation of when the audio was generated.

## What it does

The script:

1. **Identifies target paragraphs** that need updating:
   - `audioStatus = 'READY'` (audio was successfully generated)
   - `audioS3Key IS NOT NULL` (audio file exists)
   - `audioGeneratedAt IS NULL` (missing timestamp)

2. **Updates the timestamp**:
   - Sets `audioGeneratedAt = updatedAt` for all matching paragraphs
   - Uses raw SQL for efficient bulk update

3. **Provides detailed reporting**:
   - Shows count of paragraphs that need updating
   - Displays sample paragraphs before update
   - Reports final statistics and coverage

## Usage

### Automatic Execution

The backfill logic runs automatically when the API service starts:

```bash
# Start the API service - backfill runs automatically if needed
pnpm start:api
```

The logic only runs when conditions are met (paragraphs with missing timestamps exist).

### Prerequisites

- Database must be running and accessible
- Environment variables must be properly configured
- The `audioGeneratedAt` field must exist in the database schema
- API service startup (automatic execution)

### Safety

- The logic is **idempotent** - it can run multiple times safely
- Only updates paragraphs that actually need updating
- **Conditional execution** - only runs when paragraphs need updating
- Uses transactions for data integrity
- Provides detailed logging of all operations
- **Non-blocking** - service startup continues even if backfill fails

## Startup Logic System

This backfill is implemented using the API service's **StartupLogic** system:

- **Automatic**: Runs during API service initialization
- **Conditional**: Only executes when conditions are met
- **Extensible**: Easy to add new startup logic for future migrations
- **Safe**: Failures don't crash the service startup
- **Logged**: All operations are logged for monitoring

### Implementation Details

- **Base Class**: `StartupLogicBase` - provides framework for startup logic
- **Implementation**: `AudioTimestampBackfillStartup` - specific backfill logic
- **Manager**: `StartupService` - orchestrates all startup logic
- **Integration**: Automatically imported in `AppModule`

## Example Output

```
🚀 Starting audio timestamp backfill migration...
📊 Found 1,234 paragraphs that need audioGeneratedAt backfill

📋 Sample of paragraphs to update:
  1. Book: "My Audiobook", Page: 1, Updated: 2025-01-15T10:30:00.000Z
  2. Book: "Another Book", Page: 3, Updated: 2025-01-16T14:22:00.000Z
  ... and 1,232 more

🔄 Proceeding with the update...
✅ Successfully updated 1,234 paragraphs
📊 Remaining paragraphs with null audioGeneratedAt: 0

📈 Final Statistics:
   Total paragraphs with READY audio: 1,234
   Paragraphs with audioGeneratedAt: 1,234
   Coverage: 100.0%

🎉 Audio timestamp backfill migration completed successfully!
```

## Important Notes

### Accuracy Limitation

The `updatedAt` timestamp is used as an approximation for `audioGeneratedAt`. This is reasonably accurate because:

- In most cases, audio is generated shortly after paragraph content is updated
- The timestamp provides a good baseline for audio-text sync detection
- Future audio generations will have precise timestamps

### When to Run

- **After deploying** the `audioGeneratedAt` schema changes
- **Before relying** on audio-text sync detection features
- **Anytime** you notice paragraphs with missing audio timestamps

### Verification

After running the migration, you can verify the results:

```sql
-- Check coverage of audio timestamps
SELECT 
  COUNT(*) as total_ready_audio,
  COUNT(audioGeneratedAt) as with_timestamp,
  ROUND(COUNT(audioGeneratedAt) * 100.0 / COUNT(*), 1) as coverage_percent
FROM paragraphs 
WHERE audioStatus = 'READY' AND audioS3Key IS NOT NULL;
```

## Related Features

This migration enables:
- **Audio-text sync detection** in the frontend
- **Visual warnings** when text is modified after audio generation
- **Better user experience** for audio regeneration workflows

## Troubleshooting

### Common Issues

1. **Database connection errors**: Check your `.env.local` file
2. **Permission errors**: Ensure database user has UPDATE permissions
3. **No paragraphs found**: Verify you have paragraphs with READY audio status

### Rollback

If needed, you can reset the timestamps:

```sql
UPDATE paragraphs 
SET audioGeneratedAt = NULL 
WHERE audioStatus = 'READY' AND audioS3Key IS NOT NULL;
```

Then re-run the migration script.
