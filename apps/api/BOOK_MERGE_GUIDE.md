# Book Merge Guide: Original Paragraphs Migration

This guide explains how to migrate original paragraphs from a new book to an old book in production, preserving the old book's user state while adding the normalized original content structure.

## Scenario

You have two versions of the same book:
- **Old Book**: Has user edits, audio files, corrections, etc. but no original paragraphs (pre-migration)
- **New Book**: Has original paragraphs but no user state (post-migration)

**Goal**: Merge them so the old book keeps all its state AND gets the original paragraphs.

## Methods

### Method 1: Command Line Script (Recommended)

```bash
# Dry run first to preview changes
pnpm tsx src/scripts/merge-book-original-paragraphs.ts \
  --old-book-id "old-book-uuid" \
  --new-book-id "new-book-uuid" \
  --dry-run \
  --verbose

# If dry run looks good, run the actual merge
pnpm tsx src/scripts/merge-book-original-paragraphs.ts \
  --old-book-id "old-book-uuid" \
  --new-book-id "new-book-uuid" \
  --verbose
```

### Method 2: API Endpoint

```bash
# Dry run via API
curl -X POST http://localhost:3000/api/books/merge-original-paragraphs \
  -H "Content-Type: application/json" \
  -d '{
    "oldBookId": "old-book-uuid",
    "newBookId": "new-book-uuid",
    "dryRun": true
  }'

# Actual merge via API
curl -X POST http://localhost:3000/api/books/merge-original-paragraphs \
  -H "Content-Type: application/json" \
  -d '{
    "oldBookId": "old-book-uuid",
    "newBookId": "new-book-uuid",
    "dryRun": false
  }'
```

## What Happens During Merge

1. **Validation**: 
   - Both books exist
   - Same number of pages
   - New book has original paragraphs
   - Page numbers match

2. **Transfer Original Paragraphs**:
   - Updates `originalParagraphs.pageId` from new book pages to old book pages
   - Preserves all original content and metadata

3. **Link Paragraphs**:
   - Updates `paragraphs.originalParagraphId` in old book to reference transferred originals
   - Matches by page number and paragraph order

4. **Cleanup**:
   - Deletes the new book (cascade deletes its pages and paragraphs)
   - Original paragraphs are now owned by the old book

## Result

- ✅ Old book retains all user state (edits, audio, corrections, etc.)
- ✅ Old book now has original paragraphs for diff/revert functionality
- ✅ New book is cleanly removed
- ✅ Database is normalized with proper foreign key relationships

## Safety Features

- **Dry Run Mode**: Preview all changes before applying
- **Transaction Safety**: All operations in a single database transaction
- **Validation**: Comprehensive checks before starting
- **Detailed Logging**: Full visibility into the process
- **Error Handling**: Graceful failure with rollback

## Example Output

```
🔄 Starting Book Merge Operation
Mode: LIVE MERGE
Old Book ID: abc-123
New Book ID: def-456
---
🔍 Loading and validating books...
✅ Books validated:
   Old book: "My Book Title" (25 pages)
   New book: "My Book Title" (25 pages, 150 original paragraphs)

🔄 Performing merge operation...
   📄 Transferred 6 original paragraphs from page 1
   📄 Transferred 8 original paragraphs from page 2
   ...
   🔗 Linked 150 paragraphs to their originals
✅ Successfully merged books and deleted new book

📊 Merge Summary
================
Pages processed: 25
Original paragraphs transferred: 150
Paragraphs linked: 150

🎉 Merge completed successfully with no errors!
```

## Troubleshooting

### Common Issues

1. **Page count mismatch**: Books have different number of pages
   - **Solution**: Verify you have the correct book IDs

2. **No original paragraphs in new book**: New book doesn't have original paragraphs
   - **Solution**: Make sure the new book was processed with the updated workers

3. **Old book already has original paragraphs**: May create duplicates
   - **Solution**: Check if merge was already performed

### Recovery

If something goes wrong:
1. The transaction will automatically rollback
2. No partial state will be left in the database
3. Both books will remain unchanged
4. Check the error logs for specific issues

## Best Practices

1. **Always run dry-run first** to preview changes
2. **Backup your database** before running in production
3. **Test with a small book first** to verify the process
4. **Run during low-traffic periods** to minimize impact
5. **Monitor logs** during and after the operation
