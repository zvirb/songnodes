# SongNodes Migration Validation Script

## Overview

The `validate_migration.sh` script provides comprehensive validation of the Scrapy migration, ensuring all components are properly configured and functional before deployment.

## Quick Start

```bash
# Make executable (if needed)
chmod +x scripts/validate_migration.sh

# Run full validation (includes integration test)
./scripts/validate_migration.sh

# Run validation without integration test (faster)
./scripts/validate_migration.sh --skip-integration
```

## Validation Checks

### 1. Environment Validation
- ✓ Working directory verification
- ✓ Python version >= 3.9
- ✓ Scrapers directory structure
- ✓ Critical files presence (scrapy.cfg, items.py, item_loaders.py, etc.)

### 2. Dependencies Validation
- ✓ requirements.txt existence
- ✓ Critical Python packages installed:
  - scrapy
  - psycopg2-binary
  - redis
  - pydantic
  - asyncpg
  - twisted

### 3. Database Connection Validation
- ✓ Database environment variables
- ✓ PostgreSQL connection test
- ✓ Redis connection test (optional)
- ✓ Loads credentials from .env file

**Default Credentials (Development):**
```bash
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=musicdb
DATABASE_USER=musicdb_user
DATABASE_PASSWORD=musicdb_secure_pass_2024
```

### 4. Settings Module Validation
- ✓ Load `settings.development` module
- ✓ Load `settings.production` module
- ✓ Test SCRAPY_SETTINGS_MODULE environment variable
- ✓ Validate critical settings values

### 5. Spider Discovery Validation
- ✓ Run `scrapy list` command
- ✓ Verify expected spiders present:
  - 1001tracklists
  - mixesdb
  - setlistfm

### 6. ItemLoader Validation
- ✓ Import ItemLoader classes:
  - ArtistLoader
  - TrackLoader
  - SetlistLoader
  - VenueLoader
  - PlaylistLoader
- ✓ Import processor utilities
- ✓ Test TrackLoader with sample data

### 7. Pipeline Validation
- ✓ Import pipeline modules:
  - SimpleTwistedPipeline
  - DatabasePipeline
- ✓ Validate pipeline configuration in settings

### 8. Database Schema Validation
- ✓ Verify `song_adjacency` table exists
- ✓ Check required columns:
  - song_id_1
  - song_id_2
  - occurrence_count
  - avg_distance
- ✓ Test adjacency query

### 9. Integration Test (Optional)
- ✓ Run 1001tracklists spider with 5 item limit
- ✓ Verify items were scraped
- ✓ Check data reached database
- ✓ Verify adjacency edges generated

## Usage Examples

### Full Validation (Recommended)
```bash
./scripts/validate_migration.sh
```

**Output:**
```
========================================
SongNodes Scrapy Migration Validation
========================================
  Project: /path/to/songnodes
  Started: Wed Oct  1 18:10:00 UTC 2025

========================================
1. Environment Validation
========================================

[CHECK 1] Verifying working directory
✓ Working directory: /path/to/songnodes

[CHECK 2] Checking Python version (>= 3.9)
✓ Python version: 3.12.0

...

========================================
Validation Summary
========================================

Total Checks:  42
Passed:        40
Failed:        2
Success Rate:  95.2%

✓ Migration validation PASSED!
```

### Quick Validation (Skip Integration)
```bash
./scripts/validate_migration.sh --skip-integration
```

**Use when:**
- Testing configuration changes
- CI/CD pre-deployment checks
- Quick development validation
- Database integration not needed

### CI/CD Integration
```yaml
# .github/workflows/validate.yml
- name: Validate Scrapy Migration
  run: |
    ./scripts/validate_migration.sh --skip-integration
```

## Troubleshooting

### Common Issues

#### 1. Python Version Too Old
**Error:** `Python version 3.8.0 is too old (need >= 3.9)`

**Solution:**
```bash
# Install Python 3.9+
sudo apt update
sudo apt install python3.9 python3.9-venv

# Or use pyenv
pyenv install 3.9.0
pyenv local 3.9.0
```

#### 2. Missing Dependencies
**Error:** `scrapy (not installed)`

**Solution:**
```bash
cd scrapers
pip install -r requirements.txt
```

#### 3. Database Connection Failed
**Error:** `PostgreSQL connection failed`

**Solution:**
```bash
# Start database services
docker compose up -d postgres redis

# Verify services running
docker compose ps

# Check logs if issues persist
docker compose logs postgres
```

#### 4. Critical Files Missing
**Error:** `5 critical files missing`

**Solution:**
```bash
# Ensure you're in the correct directory
cd /path/to/songnodes

# Check git status
git status

# Pull latest changes
git pull origin main
```

#### 5. Spider Discovery Failed
**Error:** `Spider discovery failed`

**Solution:**
```bash
# Check scrapy.cfg exists
cat scrapers/scrapy.cfg

# Verify settings module
export SCRAPY_SETTINGS_MODULE="settings.development"
cd scrapers && scrapy list
```

#### 6. ItemLoader Import Failed
**Error:** `ItemLoader imports failed`

**Solution:**
```bash
# Check Python path
cd scrapers
python3 -c "import sys; print('\n'.join(sys.path))"

# Test import manually
python3 -c "from item_loaders import TrackLoader"

# Check for syntax errors
python3 -m py_compile item_loaders.py
```

#### 7. Database Schema Missing
**Error:** `song_adjacency table not found`

**Solution:**
```bash
# Run database initialization
docker compose exec postgres psql -U musicdb_user -d musicdb -f /docker-entrypoint-initdb.d/04-graph-schema.sql

# Or rebuild database
docker compose down -v
docker compose up -d postgres
```

#### 8. Integration Test Timeout
**Error:** `Spider execution failed (exit code: 124)`

**Solution:**
```bash
# Increase timeout in script (line ~600)
# timeout 120 -> timeout 300

# Or skip integration test
./scripts/validate_migration.sh --skip-integration
```

## Exit Codes

| Code | Meaning                                    |
|------|--------------------------------------------|
| 0    | All checks passed                          |
| 1    | One or more checks failed                  |
| 124  | Integration test timeout (treated as pass) |

## Best Practices

### Before Deployment
1. Run full validation: `./scripts/validate_migration.sh`
2. Fix all errors (0 failed checks)
3. Review warnings (yellow ⚠)
4. Test with real spiders: `scrapy crawl 1001tracklists -s CLOSESPIDER_ITEMCOUNT=10`

### During Development
1. Run quick validation after changes: `--skip-integration`
2. Check specific components manually if needed
3. Use validation to debug configuration issues

### In CI/CD
1. Run validation on every PR
2. Skip integration tests for speed: `--skip-integration`
3. Fail build if validation fails
4. Cache Python dependencies for faster runs

## Advanced Usage

### Custom Database Connection
```bash
# Override database connection
export DATABASE_HOST=production-db.example.com
export DATABASE_PORT=5432
export DATABASE_PASSWORD=production_password

./scripts/validate_migration.sh
```

### Debugging Failed Checks
```bash
# Run with verbose output
bash -x ./scripts/validate_migration.sh 2>&1 | tee validation.log

# Check specific validation step
cd scrapers
export SCRAPY_SETTINGS_MODULE="settings.development"
scrapy list  # Test spider discovery
python3 -c "from item_loaders import TrackLoader"  # Test imports
```

### Integration with Git Hooks
```bash
# .git/hooks/pre-push
#!/bin/bash
./scripts/validate_migration.sh --skip-integration
exit $?
```

## Related Documentation

- **Scrapy Settings:** `scrapers/settings/README.md`
- **ItemLoaders:** `scrapers/item_loaders.py` (inline documentation)
- **Database Schema:** `sql/init/04-graph-schema.sql`
- **Docker Compose:** `docker-compose.yml`

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review validation output for specific error messages
3. Check project documentation in `CLAUDE.md`
4. Review recent git commits for breaking changes

## Version History

| Version | Date       | Changes                                    |
|---------|------------|--------------------------------------------|
| 1.0.0   | 2025-10-01 | Initial release with comprehensive checks  |
