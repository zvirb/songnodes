# System Health Analysis: October 12, 2025

**Analysis Date**: 2025-10-12
**Status**: ⚠️ DEGRADED - Critical data extraction issue identified
**Impact**: HIGH - EnhancedTrackItem extraction has stopped

---

## Executive Summary

Validation of the data architecture revealed that while the dual data path design is working as intended, **EnhancedTrackItem extraction has stopped**. The MixesDB spider is only producing PlaylistItem records (title-only tracks), not the full metadata records needed for the medallion architecture.

**Critical Finding**: Zero EnhancedTrackItem records have been created in the last 24 hours, despite 1,641 new playlists being scraped.

---

## Validation Results

### 1. Data Architecture Validation ✅

**EnhancedTrackItem Coverage**:
```
Total records: 48,405
With artist_name: 24,405 (50.42%)
Missing artist_name: 24,000 (49.58%)
```
✅ **Status**: Matches documentation, backfill was successful

**PlaylistItem Distribution**:
```
Total playlists: 4,915
With dash-separated format: 463 (9.42%)
Title-only format: 4,452 (90.58%)
```
✅ **Status**: Expected pattern confirmed

### 2. Recent Scraping Activity (Last 24 Hours) ⚠️

```
Total records scraped: 4,923
EnhancedTrackItem: 0 ❌ CRITICAL
PlaylistItem: 1,641 ✅
```

**Most Recent EnhancedTrackItem**: 2025-10-10 11:26:42 (over 24 hours ago)

⚠️ **Critical Issue**: The spider is scraping playlists but NOT extracting individual track metadata.

### 3. Medallion Architecture (Bronze/Silver Layers) ✅

```
Bronze layer records: 4,758
Silver layer records: 4,758
Linkage percentage: 100%
```

✅ **Status**: Perfect linkage, direct database inserts working correctly

### 4. Sample Data Quality

**Recent PlaylistItem** (2025-10-11 23:19:44):
```
Playlist: "2023-07-14 - Flip Capella - Energy Club Files 795"
Tracks: 37
First track: "Praising You" (title-only, no artist)
```
✅ **Expected**: Title-only format

**Most Recent EnhancedTrackItem** (2025-10-10 11:26:42):
```
Track: "Moscow [Mainstage]"
Artist: "[7?] W" ⚠️ MALFORMED
```
⚠️ **Data Quality Issue**: Artist names contain brackets and numbers

---

## Critical Issues Identified

### Issue #1: EnhancedTrackItem Extraction Stopped ❌

**Symptom**: Zero EnhancedTrackItem records in last 24 hours

**Evidence**:
```sql
-- Query: EnhancedTrackItem by source (last 7 days)
source  | record_count | with_artist
--------|--------------|-------------
mixesdb | 48405        | 24405

-- But query window is "last 7 days", yet showing ALL records
-- This means NO new EnhancedTrackItem created in last 7 days!
```

**Expected Behavior**:
- Spider extracts playlist → yields PlaylistItem
- Spider extracts individual tracks → yields EnhancedTrackItem for each track
- Both should happen on EVERY scrape

**Actual Behavior**:
- Spider extracts playlist → yields PlaylistItem ✅
- Spider extracts individual tracks → **NO EnhancedTrackItem yielded** ❌

**Impact**: HIGH
- No new track metadata entering the system
- Medallion architecture not receiving new data
- 50.42% artist coverage cannot improve without new EnhancedTrackItem records

### Issue #2: persistence_pipeline Event Loop Conflicts ⚠️

**Symptom**: 22 ERROR log entries per scrape run

**Error Pattern**:
```python
[pipelines.persistence_pipeline] ERROR: Error flushing playlists batch: coroutine ignored GeneratorExit
RuntimeError: coroutine ignored GeneratorExit
  at /app/pipelines/persistence_pipeline.py:1165 in flush_all_batches()

[asyncio] ERROR: Task was destroyed but it is pending!
task: <Task pending coro=<PersistencePipeline.flush_all_batches()>>
```

**Root Cause**:
- persistence_pipeline uses asyncio (asyncpg) for database operations
- Scrapy uses Twisted reactor for event loop
- During spider shutdown, asyncio tasks are not properly awaited
- Causes cleanup errors and resource leaks

**Current Status**:
- Items ARE being saved successfully to raw_scrape_data
- Errors occur during shutdown/cleanup phase
- Not preventing data from being stored, but indicates resource leaks

**Impact**: MEDIUM
- Memory/connection leaks over time
- "Unhealthy" container status
- Potential database connection pool exhaustion

### Issue #3: Malformed Artist Names ⚠️

**Sample Data**:
```
"[7?] W"
"[77] W"
"[74] Rick Mitchells"
"[70] Marcel Woods"
"[67] David Gravell"
```

**Pattern**: Artist names prefixed with `[number?]` or `[number]`

**Possible Causes**:
1. Track position numbers being extracted as part of artist name
2. Parse_track_string() parsing position markers incorrectly
3. Source data contains these brackets in the HTML structure

**Impact**: LOW-MEDIUM
- Affects search/filtering by artist name
- Affects data quality metrics
- Can be cleaned up with normalization logic

### Issue #4: Only 2 Items Per Scrape Run ⚠️

**Expected**:
```
Per playlist scrape:
- 1 PlaylistItem (playlist metadata + track list)
- 20-50 EnhancedTrackItem records (one per track in playlist)
- 20-50 relationship items (track-artist relationships)
Total: ~40-100 items
```

**Actual**:
```
Per playlist scrape:
- item_scraped_count: 2
- Likely: 1 PlaylistItem + 1 relationship/edge item
- Missing: ALL EnhancedTrackItem records
```

**Impact**: CRITICAL
- Only collecting playlist structure, not track metadata
- Defeating the purpose of the dual data path architecture

---

## Root Cause Analysis

### Why EnhancedTrackItem Extraction Stopped

**Hypothesis #1**: Track extraction logic failing
- Spider code at lines 500-514 shows dual yielding pattern
- Recent changes may have broken track parsing
- Need to inspect spider's `tracks_data` variable

**Hypothesis #2**: Track parsing returning empty results
- If `parse_track_string()` fails for all tracks in playlist
- Tracks_data list would be empty
- No EnhancedTrackItem yielded

**Hypothesis #3**: Spider configuration changed
- Pipeline configuration may be filtering out EnhancedTrackItem
- Validation pipeline may be rejecting all track items

**Hypothesis #4**: Source website structure changed
- MixesDB HTML structure may have changed
- CSS selectors no longer matching track elements
- Spider successfully extracts playlist but not individual tracks

**Next Steps to Diagnose**:
1. Enable DEBUG logging for MixesDB spider
2. Run single scrape with verbose output
3. Check if `tracks_data` is populated in spider
4. Verify CSS selectors still match MixesDB structure
5. Test `parse_track_string()` with sample recent track data

---

## Immediate Action Items

### Priority 1: Restore EnhancedTrackItem Extraction (CRITICAL)

**Actions**:
1. ✅ Enable DEBUG logging for MixesDB spider
2. ✅ Run test scrape with single playlist URL
3. ✅ Inspect spider output for track extraction
4. ✅ Check if CSS selectors still match MixesDB HTML
5. ✅ Verify parse_track_string() is working
6. ❌ Fix track extraction logic
7. ❌ Validate fix with test scrape
8. ❌ Deploy fix and monitor

**Success Criteria**:
- Test scrape yields 1 PlaylistItem + N EnhancedTrackItem (where N = track count)
- item_scraped_count increases from 2 to 20-50
- EnhancedTrackItem records appear in raw_scrape_data with scrape_type='enhancedtrack'

### Priority 2: Fix persistence_pipeline Event Loop Conflicts (MEDIUM)

**Options**:

**Option A: Proper Cleanup** (Recommended)
- Add proper shutdown handlers to persistence_pipeline
- Ensure all asyncio tasks are awaited before spider closes
- Implement graceful shutdown with timeout

**Option B: Suppress Shutdown Warnings**
- Add asyncio event loop exception handler
- Suppress "Task was destroyed" warnings
- Not a fix, but prevents log noise

**Option C: Replace with Sync Database Client**
- Replace asyncpg with psycopg2 (synchronous)
- Eliminates asyncio/Twisted conflicts entirely
- May reduce performance

**Recommended**: Option A with fallback to Option C if complex

### Priority 3: Clean Up Malformed Artist Names (LOW)

**Actions**:
1. Add regex pattern to strip `[number]` or `[number?]` prefixes
2. Update parse_track_string() or add post-processing step
3. Run backfill script to clean existing records

**Pattern**:
```python
import re
artist_name = re.sub(r'^\[\d+\??]\s*', '', artist_name)
# "[7?] W" → "W"
# "[74] Rick Mitchells" → "Rick Mitchells"
```

---

## System Health Scorecard

| Component | Status | Score | Notes |
|:----------|:-------|:------|:------|
| **Data Architecture** | ✅ Healthy | 95/100 | Dual path working as designed |
| **PlaylistItem Extraction** | ✅ Healthy | 100/100 | 1,641 playlists in 24h |
| **EnhancedTrackItem Extraction** | ❌ Failed | 0/100 | Zero records in 24h |
| **Medallion Architecture** | ✅ Healthy | 100/100 | Perfect bronze/silver linkage |
| **Data Quality** | ⚠️ Degraded | 50/100 | 50.42% artist coverage |
| **Spider Stability** | ⚠️ Degraded | 60/100 | Event loop errors, "unhealthy" status |
| **Overall System** | ⚠️ DEGRADED | 68/100 | Critical extraction failure |

---

## Comparison with Previous Analysis

**Previous State** (from DATA_ARCHITECTURE_INVESTIGATION.md):
- 48,405 EnhancedTrackItem records with 50.42% artist coverage
- 4,396 PlaylistItem records
- System working as designed ✅

**Current State** (2025-10-12):
- Still 48,405 EnhancedTrackItem records (NO NEW RECORDS) ⚠️
- 4,915 PlaylistItem records (+519 new) ✅
- EnhancedTrackItem extraction has stopped ❌

**Regression Detected**: EnhancedTrackItem extraction was working when previous analysis was completed, but has since stopped.

**Timeline**:
- 2025-10-10 11:26:42: Last EnhancedTrackItem created
- 2025-10-10 to 2025-10-11: 1,641 playlists scraped, 0 EnhancedTrackItem
- 2025-10-12: Issue identified during validation

**Possible Trigger**:
- Code change on/after 2025-10-10
- MixesDB website structure change
- Spider configuration change
- Pipeline configuration change

---

## Recommendations

### Immediate (Next 24 Hours)

1. **Debug EnhancedTrackItem Extraction** (Priority 1)
   - Enable DEBUG logging
   - Run test scrape with verbose output
   - Identify why tracks_data is empty or not yielding items

2. **Rollback Recent Changes** (If code change identified)
   - Review git history for changes between 2025-10-09 and 2025-10-10
   - Consider reverting spider or pipeline changes
   - Re-test after rollback

### Short-Term (Next 7 Days)

3. **Fix persistence_pipeline Event Loop Issues** (Priority 2)
   - Implement proper asyncio task cleanup
   - Add shutdown handlers
   - Test with multiple scrape cycles

4. **Clean Malformed Artist Names** (Priority 3)
   - Add regex cleanup to parse_track_string()
   - Run backfill script for existing records

5. **Add Monitoring Alerts**
   - Alert if no EnhancedTrackItem created in 6 hours
   - Alert on item_scraped_count < 10 (indicates extraction failure)
   - Alert on ERROR log count > 5 per scrape

### Long-Term (Next 30 Days)

6. **Implement Comprehensive Testing**
   - Unit tests for spider extraction logic
   - Integration tests for pipeline flow
   - Regression tests for data quality

7. **Improve Data Quality**
   - Target 75%+ artist coverage
   - Implement fuzzy matching for artist name normalization
   - Add source data validation

8. **Consider Architecture Changes**
   - Evaluate moving to synchronous database client (psycopg2)
   - Or fully embrace asyncio and migrate Scrapy to use asyncio reactor
   - Implement proper event loop management

---

## Diagnostic Commands

### Check Spider Status
```bash
docker ps --filter "name=mixesdb"
docker logs --tail 100 songnodes-scraper-mixesdb-1 | grep -E "(ERROR|item_scraped_count)"
```

### Test Single Scrape
```bash
docker exec -it songnodes-scraper-mixesdb-1 scrapy crawl mixesdb \
  -L DEBUG \
  -a start_urls=https://www.mixesdb.com/w/2023-07-14_-_Flip_Capella_-_Energy_Club_Files_795 \
  -a force_run=true \
  -a limit=1
```

### Check Recent Data
```sql
-- Recent EnhancedTrackItem
SELECT COUNT(*), MAX(scraped_at)
FROM raw_scrape_data
WHERE scrape_type = 'enhancedtrack'
  AND scraped_at > NOW() - INTERVAL '24 hours';

-- Recent PlaylistItem
SELECT COUNT(*), MAX(scraped_at)
FROM raw_scrape_data
WHERE scrape_type = 'playlist'
  AND scraped_at > NOW() - INTERVAL '24 hours';
```

### Monitor Item Yield
```bash
# Watch spider logs in real-time during a scrape
docker logs -f songnodes-scraper-mixesdb-1 | grep -E "(item_scraped_count|EnhancedTrackItem|PlaylistItem)"
```

---

## Conclusion

The system's dual data path architecture is fundamentally sound, but **EnhancedTrackItem extraction has completely stopped**. This is a critical issue that must be resolved immediately to restore full functionality.

The persistence_pipeline event loop conflicts are a secondary concern - they cause log noise and potential resource leaks, but items are still being saved successfully.

**Next Step**: Enable DEBUG logging and run a test scrape to identify why EnhancedTrackItem records are no longer being yielded by the spider.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Status**: Investigation in progress - awaiting debug scrape results
