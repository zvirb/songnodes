# Legacy Scraper API Files Documentation

## Overview

This document describes the legacy `scraper_api_*` family of files in the `/scrapers` directory. These files are **NOT actively used in production** and have been superseded by the modern Scrapy-based spider architecture.

## Status: LEGACY - NOT IN USE

All files listed below are **NOT referenced in `docker-compose.yml`** and are retained only for:
- Historical reference
- Documentation of previous implementation approaches
- Potential future migration or reuse of specific functionality

## Legacy Files List

| File | Description | Pipeline Status |
|:-----|:------------|:----------------|
| `scraper_api_1001.py` | 1001tracklists API wrapper | Legacy implementation |
| `scraper_api_internetarchive.py` | Internet Archive scraper | Fixed - uses PersistencePipeline |
| `scraper_api_livetracklist.py` | LiveTracklist scraper | Fixed - uses PersistencePipeline |
| `scraper_api_mixcloud.py` | Mixcloud JSON/NLP scraper | Fixed - uses PersistencePipeline |
| `scraper_api_mixesdb.py` | MixesDB scraper | Legacy implementation |
| `scraper_api_real.py` | 1001tracklists scraper variant | Legacy implementation |
| `scraper_api_reddit.py` | Reddit music subreddit scraper | Legacy implementation |
| `scraper_api_residentadvisor.py` | Resident Advisor event scraper | Fixed - uses PersistencePipeline |
| `scraper_api_setlistfm.py` | Setlist.fm scraper | Legacy implementation |
| `scraper_api_soundcloud.py` | SoundCloud scraper | Fixed - uses PersistencePipeline |
| `scraper_api_youtube.py` | YouTube tracklist scraper | Fixed - uses PersistencePipeline |

## Why These Files Are Legacy

### 1. **Architectural Shift to Scrapy**
The SongNodes project migrated from individual FastAPI-based scraper services to a unified Scrapy framework located in the `spiders/` directory. Scrapy provides:
- Better anti-detection mechanisms
- Built-in middleware architecture
- Standardized item pipelines
- Superior rate limiting and retry logic
- Centralized configuration

### 2. **Not in Docker Compose**
Verification:
```bash
grep -r "scraper_api_" docker-compose.yml
# Returns: (no matches)
```

All scraper services in production now use the Scrapy-based spiders:
- `spiders/mixesdb_spider.py`
- `spiders/onethousandone_spider.py`
- And others in the `spiders/` directory

### 3. **Code Maintenance Burden**
Maintaining 11 separate FastAPI services was becoming a maintenance burden with:
- Duplicate middleware logic
- Inconsistent error handling
- Scattered configuration
- Different anti-detection strategies per service

## What Replaced These Files?

The modern Scrapy-based architecture in the `spiders/` directory:

### Scrapy Spiders (Active)
Located in `/mnt/my_external_drive/programming/songnodes/scrapers/spiders/`:

1. **mixesdb_spider.py** - MixesDB scraping with improved search strategies
2. **onethousandone_spider.py** - 1001tracklists with API + HTML fallback
3. **setlistfm_spider.py** - Setlist.fm with enhanced artist matching
4. And more...

### Unified Pipeline Architecture
All spiders use the **chained pipeline architecture**:

```
Spider → Validation → Enrichment (Delegated) → Persistence
```

Where:
- **Validation**: Schema and data quality checks
- **Enrichment**: Delegated to `metadata-enrichment` microservice
- **Persistence**: `pipelines/persistence_pipeline.py` for database upserts

## Migration Notes

### Files Fixed to Use Modern Pipeline
The following 6 files were **refactored** to use `PersistencePipeline` instead of the deprecated `DatabasePipeline`, but are still marked as LEGACY because they're not in use:

- `scraper_api_internetarchive.py`
- `scraper_api_livetracklist.py`
- `scraper_api_mixcloud.py`
- `scraper_api_residentadvisor.py`
- `scraper_api_soundcloud.py`
- `scraper_api_youtube.py`

These files:
- Import `from pipelines.persistence_pipeline import PersistencePipeline` ✓
- Have updated docstrings removing deprecation warnings ✓
- Are marked with LEGACY comments at the top ✓

### Files NOT Fixed
The following 5 files were NOT refactored and retain their original implementation:

- `scraper_api_1001.py`
- `scraper_api_mixesdb.py`
- `scraper_api_real.py`
- `scraper_api_reddit.py`
- `scraper_api_setlistfm.py`

## Should These Files Be Deleted?

**Recommendation: NO - Keep for now**

### Reasons to Retain:
1. **Historical Documentation**: Shows evolution of scraping architecture
2. **NLP Fallback Logic**: Contains valuable NLP extraction patterns that may be reused
3. **API Client Examples**: Demonstrates working API integration patterns (YouTube, Tidal, etc.)
4. **Migration Reference**: If a new data source needs integration, these provide patterns
5. **Low Storage Cost**: ~500KB total, minimal disk impact

### Future Cleanup Criteria:
Consider deletion only when:
- All logic has been successfully migrated to Scrapy spiders
- No NLP patterns need to be referenced
- At least 12 months have passed since deprecation (current date: 2025-10-10)

## Usage Warning

**DO NOT USE THESE FILES IN PRODUCTION**

If you need to scrape a data source:
1. Check if a Scrapy spider exists in `spiders/` directory
2. If not, create a NEW Scrapy spider (don't resurrect these files)
3. Follow the Scrapy framework patterns in `CLAUDE.md`

## Questions?

See:
- `/mnt/my_external_drive/programming/songnodes/CLAUDE.md` - Main development guide
- `/mnt/my_external_drive/programming/songnodes/scrapers/spiders/` - Modern spider implementations
- `/mnt/my_external_drive/programming/songnodes/pipelines/persistence_pipeline.py` - Modern pipeline

## Cleanup History

**Date**: 2025-10-10
**Action**: Comprehensive legacy file cleanup
**Changes**:
- Deleted 1 backup file: `redis_mcp_server.py.bak`
- Updated 12 files to remove deprecation warnings and use modern PersistencePipeline
- Marked 11 legacy `scraper_api_*` files with LEGACY comments
- Created this documentation

**Migration Status**: Complete - All legacy files documented and marked
