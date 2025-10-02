# Database Migrations

This directory contains database schema migrations for the SongNodes project.

## Migration Files

### 002_add_isrc_unique_constraints (2025-10-02)

**Purpose:** Add unique constraints on ISRC and Spotify ID for reliable track deduplication

**Files:**
- `002_add_isrc_unique_constraints.sql` - Forward migration (adds constraints)
- `002_add_isrc_unique_constraints_down.sql` - Rollback migration (removes constraints)
- `MIGRATION_002_TESTING_PLAN.md` - Comprehensive testing plan
- `MIGRATION_002_IMPLEMENTATION_SUMMARY.md` - Implementation details and test results
- `../scripts/verify_isrc_uniqueness.py` - Verification script

**Quick Start:**
```bash
# 1. Backup database
docker compose exec postgres pg_dump -U musicdb_user musicdb > backup_$(date +%Y%m%d).sql

# 2. Run migration
docker compose exec postgres psql -U musicdb_user -d musicdb \
  -f /path/to/scrapers/migrations/002_add_isrc_unique_constraints.sql

# 3. Verify
python3 scrapers/scripts/verify_isrc_uniqueness.py
```

**Breaking Changes:** YES - Merges duplicate ISRCs and Spotify IDs

**Related Code Changes:**
- `scrapers/database_pipeline.py` - New upsert logic
- `services/metadata-enrichment/enrichment_pipeline.py` - ISRC population

---

## Migration Workflow

### 1. Development
```bash
# Create migration file
touch migrations/XXX_migration_name.sql
touch migrations/XXX_migration_name_down.sql

# Test locally
docker compose exec postgres psql -U musicdb_user -d musicdb -f migrations/XXX_migration_name.sql

# Verify
# (create verification script if needed)
```

### 2. Staging
```bash
# Deploy to staging
psql -h staging-db -U user -d musicdb -f migrations/XXX_migration_name.sql

# Run tests
./run_tests.sh

# Monitor for 24-48 hours
```

### 3. Production
```bash
# Schedule maintenance window
# Backup database
# Run migration
# Verify immediately
# Monitor for 48 hours
```

---

## Migration Naming Convention

**Format:** `XXX_descriptive_name.sql`

Where:
- `XXX` = Sequential number (001, 002, 003, ...)
- `descriptive_name` = Brief description using underscores

**Examples:**
- `001_add_mbid_and_camelot.sql`
- `002_add_isrc_unique_constraints.sql`
- `003_add_audio_features.sql`

**Rollback files:** Append `_down.sql`
- `002_add_isrc_unique_constraints_down.sql`

---

## Migration Best Practices

### 1. Always Idempotent

Migrations should be safe to run multiple times:

```sql
-- Good (idempotent)
CREATE TABLE IF NOT EXISTS new_table (...);
ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column ...;

-- Bad (not idempotent)
CREATE TABLE new_table (...);  -- Fails if table exists
ALTER TABLE existing_table ADD COLUMN new_column ...;  -- Fails if column exists
```

### 2. Always Provide Rollback

Every migration should have a corresponding `_down.sql` file:

```sql
-- Forward (002_add_feature.sql)
ALTER TABLE tracks ADD COLUMN new_field VARCHAR(100);

-- Rollback (002_add_feature_down.sql)
ALTER TABLE tracks DROP COLUMN IF EXISTS new_field;
```

### 3. Track Migration State

Use `schema_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rollback_available BOOLEAN DEFAULT TRUE,
    description TEXT
);

-- Record migration
INSERT INTO schema_migrations (migration_name, description)
VALUES ('002_add_isrc_unique_constraints', 'Add unique constraints on ISRC and Spotify ID')
ON CONFLICT (migration_name) DO NOTHING;
```

### 4. Handle Breaking Changes

For breaking changes:
1. Create migration testing plan
2. Document breaking changes
3. Update application code
4. Test on staging first
5. Schedule maintenance window
6. Communicate with users

### 5. Preserve Data

Never delete data without:
1. Creating backup/audit table
2. Logging what was deleted
3. Providing restore instructions

```sql
-- Create audit table
CREATE TABLE deleted_records (
    original_id UUID,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    original_data JSONB
);

-- Log before delete
INSERT INTO deleted_records (original_id, original_data)
SELECT id, to_jsonb(table_name.*)
FROM table_name
WHERE condition;

-- Delete
DELETE FROM table_name WHERE condition;
```

### 6. Use Transactions

Wrap migrations in transactions when possible:

```sql
BEGIN;

-- Migration steps
ALTER TABLE ...;
CREATE INDEX ...;
INSERT INTO schema_migrations ...;

COMMIT;
-- Or ROLLBACK if error
```

**Note:** Some operations (like CREATE INDEX CONCURRENTLY) cannot run in transactions.

---

## Verification Scripts

Create a verification script for each major migration:

```python
#!/usr/bin/env python3
"""
Migration XXX Verification Script
"""

def verify_migration():
    # 1. Check migration was applied
    # 2. Verify constraints/indexes exist
    # 3. Check data integrity
    # 4. Run sample queries
    # 5. Generate report
    pass

if __name__ == "__main__":
    verify_migration()
```

Run verification after migration:
```bash
python3 scrapers/scripts/verify_XXX.py
```

---

## Troubleshooting

### Migration Fails

1. **Check error message**
   ```bash
   docker compose logs postgres | grep ERROR
   ```

2. **Rollback if needed**
   ```bash
   psql -f migrations/XXX_migration_name_down.sql
   ```

3. **Restore from backup**
   ```bash
   psql -d musicdb < backup_YYYYMMDD.sql
   ```

### Performance Issues

1. **Add indexes during off-peak hours**
   ```sql
   CREATE INDEX CONCURRENTLY idx_name ON table_name(column);
   ```

2. **Use ANALYZE after large data changes**
   ```sql
   ANALYZE table_name;
   ```

3. **Check query plans**
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```

### Duplicate Constraint Violations

1. **Find duplicates before migration**
   ```sql
   SELECT column, COUNT(*)
   FROM table_name
   GROUP BY column
   HAVING COUNT(*) > 1;
   ```

2. **Merge or delete duplicates**
   ```sql
   -- (see migration 002 for examples)
   ```

---

## Migration Checklist

Before running a migration:

- [ ] Database backup created
- [ ] Rollback migration created and tested
- [ ] Migration tested on local dev database
- [ ] Migration tested on staging database
- [ ] Verification script created
- [ ] Breaking changes documented
- [ ] Application code updated (if needed)
- [ ] Maintenance window scheduled (if needed)
- [ ] Stakeholders notified (if breaking)

After running a migration:

- [ ] Migration completed without errors
- [ ] Verification script passed
- [ ] Application still works correctly
- [ ] Performance is acceptable
- [ ] Monitoring shows no issues
- [ ] Documentation updated

---

## Contact

**Database Schema Expert:** Schema Database Expert Agent
**Last Updated:** 2025-10-02

For questions or issues with migrations, please refer to:
- Migration testing plans in this directory
- Verification scripts in `../scripts/`
- Database schema documentation in `/sql/init/`
