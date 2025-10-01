# Validation Script Quick Reference

## One-Line Commands

```bash
# Full validation (includes integration test)
./scripts/validate_migration.sh

# Quick validation (skip integration)
./scripts/validate_migration.sh --skip-integration

# Save output to file
./scripts/validate_migration.sh 2>&1 | tee validation.log

# Run with verbose debugging
bash -x ./scripts/validate_migration.sh
```

## 9 Validation Steps

| # | Step                      | What It Checks                                    | Critical? |
|---|---------------------------|---------------------------------------------------|-----------|
| 1 | Environment               | Python >= 3.9, directory structure, critical files | ✅ Yes    |
| 2 | Dependencies              | Python packages (scrapy, psycopg2, pydantic, etc.) | ✅ Yes    |
| 3 | Database Connection       | PostgreSQL, Redis connectivity                     | ✅ Yes    |
| 4 | Settings                  | Load dev/prod settings, validate config            | ✅ Yes    |
| 5 | Spiders                   | `scrapy list`, verify expected spiders             | ✅ Yes    |
| 6 | ItemLoaders               | Import loaders, test with sample data              | ✅ Yes    |
| 7 | Pipelines                 | Import pipelines, check configuration              | ✅ Yes    |
| 8 | Database Schema           | song_adjacency table, required columns             | ✅ Yes    |
| 9 | Integration (Optional)    | Run spider, verify database writes                 | ⚠️ No     |

## Expected Output Summary

```
========================================
Validation Summary
========================================

Total Checks:  42
Passed:        42
Failed:        0
Success Rate:  100.0%

✓ Migration validation PASSED!
```

## Common Fixes

| Error                             | Fix                                               |
|-----------------------------------|---------------------------------------------------|
| Python version too old            | `pyenv install 3.9.0 && pyenv local 3.9.0`       |
| Missing dependencies              | `cd scrapers && pip install -r requirements.txt`  |
| Database connection failed        | `docker compose up -d postgres redis`             |
| Spider discovery failed           | Check `scrapers/scrapy.cfg` and settings module   |
| ItemLoader import failed          | `cd scrapers && python3 -m py_compile item_loaders.py` |
| song_adjacency table not found    | `docker compose down -v && docker compose up -d`  |

## Validation Checklist

### Before Deployment
- [ ] Run full validation: `./scripts/validate_migration.sh`
- [ ] All checks pass (0 failed)
- [ ] Review and address warnings
- [ ] Test spiders manually: `scrapy crawl 1001tracklists -s CLOSESPIDER_ITEMCOUNT=10`

### After Code Changes
- [ ] Run quick validation: `./scripts/validate_migration.sh --skip-integration`
- [ ] Fix any failed checks
- [ ] Commit changes

### CI/CD Integration
```yaml
- name: Validate Migration
  run: ./scripts/validate_migration.sh --skip-integration
```

## Success Criteria

✅ **PASS:** All checks green, 0 failures
⚠️ **WARNING:** Some warnings (yellow), but all checks pass
❌ **FAIL:** One or more critical checks failed

## Quick Debugging

```bash
# Test database connection
psql -h localhost -p 5433 -U musicdb_user -d musicdb -c "SELECT 1"

# Test spider discovery
cd scrapers && export SCRAPY_SETTINGS_MODULE="settings.development" && scrapy list

# Test ItemLoader import
cd scrapers && python3 -c "from item_loaders import TrackLoader; print('OK')"

# Test pipeline import
cd scrapers && python3 -c "from database_pipeline import DatabasePipeline; print('OK')"

# Check database schema
psql -h localhost -p 5433 -U musicdb_user -d musicdb -c "\d song_adjacency"
```

## Environment Variables

```bash
# Database (Development defaults)
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=musicdb
DATABASE_USER=musicdb_user
DATABASE_PASSWORD=musicdb_secure_pass_2024

# Scrapy
SCRAPY_SETTINGS_MODULE=settings.development
```

## Exit Codes

- **0:** Success
- **1:** Failure
- **124:** Timeout (treated as success for integration test)
