# Migration Rollback Guide

Since Prisma doesn't have built-in up/down migration methods, we maintain manual rollback scripts for critical migrations.

## Rollback Strategy

### 1. For Schema-Only Changes
- Create a reverse migration file in `rollback-migrations/`
- Document the exact steps to undo the changes
- Include data backup instructions

### 2. For Data Migrations
- Always backup data before applying
- Create rollback scripts that can restore previous state
- Test rollback procedures in staging environment

## Available Rollbacks

### `rollback_add_original_content_to_paragraphs.sql`
**Rolls back**: `20250803165017_add_original_content_to_paragraphs`

**What it does**:
- Removes the `originalContent` column from paragraphs table
- Provides instructions for schema cleanup

**Usage**:
```bash
# 1. Backup database
pg_dump audibook > backup_before_rollback.sql

# 2. Apply rollback
psql -d audibook -f rollback-migrations/rollback_add_original_content_to_paragraphs.sql

# 3. Update Prisma schema (remove originalContent field)
# 4. Regenerate Prisma client
npx prisma generate
```

## Best Practices

1. **Always backup before rollback**
2. **Test rollbacks in staging first**
3. **Document rollback procedures**
4. **Consider data dependencies before rolling back**
5. **Update application code to handle schema changes**

## Alternative: Prisma Migration Reset

For development environments, you can also use:
```bash
# Reset all migrations and data (DESTRUCTIVE)
npx prisma migrate reset

# Then apply migrations up to a specific point
# (This requires manually managing which migrations to apply)
```

## Production Rollback Checklist

- [ ] Application is in maintenance mode
- [ ] Database is backed up
- [ ] Rollback script is tested in staging
- [ ] Application code is updated to handle schema changes
- [ ] Rollback script is applied
- [ ] Application is restarted
- [ ] Functionality is verified
- [ ] Maintenance mode is disabled
