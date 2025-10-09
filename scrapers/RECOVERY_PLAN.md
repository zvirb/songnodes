# Raw Data Recovery Plan - October 7-9, 2025 Scrapes

## Summary

**Data Status**: ✅ All data is safely stored in `raw_scrape_data` table
**Total Records**: 72,535 raw scrape records
**Unprocessed**: 1,927 records
**Failed with Errors**: 61,982 records (error: "object dict can't be used in 'await' expression")
**Date Range**: 2025-10-07 to 2025-10-09

## What Happened

### The Good News
- The `RawDataStoragePipeline` (priority 50) **successfully** archived all scraped data to the database
- All 72K records are preserved as JSONB in the `raw_scrape_data.raw_data` column
- No data was lost during the scraping process

### The Problem
- The downstream `PersistencePipeline` (priority 300) failed to process the stored Pydantic models
- Error: "object dict can't be used in 'await' expression"
- This suggests an async/await mismatch or incorrect handling of the JSONB dictionaries

## Data Breakdown by Type

```
enhancedtrackadjacency    28,855 records
enhancedtrackartist       19,005 records
enhancedsetlisttrack      10,897 records
enhancedtrack             10,897 records
playlist                     965 records
enhancedartist               958 records
enhancedsetlist              958 records
```

## Sample Data Structure

### EnhancedSetlist
```json
{
  "setlist_name": "2004-07-07 - Jenny Marotta, Pete Tong, Satoshi Tomiie @ Angels Of Love",
  "dj_artist_name": "2004-07-07 - Jenny Marotta, Pete Tong...",
  "event_name": null,
  "event_type": null,
  "venue_name": "Angels Of Love",
  "venue_location": "Metropolis, Naples",
  "set_date": null,
  "total_tracks": 0,
  "genre_tags": ["House"],
  "mood_tags": [],
  "audio_quality": "Unknown",
  "duration_minutes": null,
  "external_urls": {"mixesdb": "https://www.mixesdb.com/..."},
  "data_source": "mixesdb",
  "created_at": "2025-10-07 04:04:51.215727",
  "updated_at": "2025-10-07T04:04:51.215815",
  "normalized_name": "2004-07-07 - jenny marotta...",
  "description": null
}
```

### EnhancedTrack
```json
{
  "track_id": "a4407077b1d2b9ba",
  "track_name": "Temptation  [Higher Ground/FFRR]",
  "normalized_title": "temptation  [higher ground/ffrr]",
  "genre": null,
  "bpm": null,
  "musical_key": null,
  "track_type": "Mix",
  "is_remix": false,
  "is_mashup": false,
  "is_live": false,
  "is_cover": false,
  "is_instrumental": false,
  "is_explicit": false,
  "remix_type": null,
  "record_label": null,
  "catalog_number": null,
  "popularity_score": 0,
  "position_in_source": 17,
  "source_context": "[30] SIDEPIECE - Temptation (Extended Mix) [Higher Ground/FFRR]",
  "external_urls": {"mixesdb_context": "https://www.mixesdb.com/..."},
  "data_source": "mixesdb",
  "metadata": "{\"original_string\": \"[30] SIDEPIECE - Temptation...\"}"
}
```

## Issues to Fix Before Recovery

### 1. Field Mapping Discrepancies

The Pydantic models use different field names than what the persistence pipeline expects:

| Pydantic Model | Persistence Pipeline | Action Required |
|:---------------|:---------------------|:----------------|
| `setlist_name` | `name` or `setlist_name` | ✅ Both supported |
| `dj_artist_name` | `dj_artist_name` | ✅ Compatible |
| `track_name` | `track_name` or `title` | ✅ Both supported |
| `musical_key` | `key` | ⚠️  Need mapping |
| `external_urls` (dict) | Individual ID fields | ⚠️  Need extraction |

### 2. Metadata Field is Stringified JSON

Some fields like `metadata` are stored as escaped JSON strings instead of objects:
```json
"metadata": "{\"source\": \"mixesdb\", \"page_title\": \"...\"}"
```

This needs to be parsed during recovery.

### 3. Missing Artist Attribution

Many tracks don't have explicit `artist_name` field - it's embedded in the `source_context` or `metadata`.

### 4. Async/Await Issue

The original error "object dict can't be used in 'await' expression" suggests the `raw_data_processor.py` was trying to await a dictionary instead of a coroutine.

## Recovery Strategy

### Option 1: Fix and Re-run the Persistence Pipeline (Recommended)

**Pros:**
- Uses existing pipeline infrastructure
- Validates data through Pydantic models
- Ensures data quality

**Steps:**
1. Fix field mappings in persistence pipeline
2. Add JSON parsing for stringified fields
3. Extract artist names from metadata when missing
4. Fix async/await handling
5. Run recovery script

### Option 2: Direct Database Import (Fast but Risky)

**Pros:**
- Fastest recovery method
- Bypasses broken pipeline

**Cons:**
- Skips validation
- May import incomplete/malformed data
- Harder to debug issues

**Use Case:** Only if pipeline fixes are too complex

## Recovery Script Created

**Location**: `scrapers/recover_raw_data.py`

**Features**:
- Reads from `raw_scrape_data` table
- Transforms Pydantic model dicts to persistence pipeline format
- Handles field mapping
- Supports dry-run mode for testing
- Batch processing for performance
- Detailed statistics and logging

**Usage**:
```bash
# Test with small sample (dry run)
python recover_raw_data.py --limit 100 --dry-run

# Test actual import with small batch
python recover_raw_data.py --limit 100 --batch-size 50

# Full recovery
python recover_raw_data.py --batch-size 500
```

## What You Need to Fix

Before running the recovery, you mentioned you're working on fixing the pipeline. Here's what needs attention:

### 1. Persistence Pipeline Field Handling

File: `scrapers/pipelines/persistence_pipeline.py`

The `_process_track_item()` and `_process_playlist_item()` methods need to handle:
- `musical_key` → `key` mapping
- Parse `external_urls` dict to extract platform IDs
- Parse `metadata` string field if present

### 2. Artist Extraction Logic

For tracks without explicit `artist_name`, extract from:
- `source_context` field (e.g., "[30] SIDEPIECE - Temptation...")
- `metadata.original_string` field
- Use existing `spiders/utils.parse_track_string()` function

### 3. Raw Data Processor Async Handling

File: `scrapers/raw_data_processor.py`

The `_process_single_scrape()` method should NOT await dictionaries. Ensure all database operations use `await` correctly with async functions, not with raw dict objects.

## Validation Checklist

Before running full recovery:
- [ ] Test with `--limit 10 --dry-run` to see transformation output
- [ ] Test with `--limit 100` to verify database inserts
- [ ] Check logs for validation errors
- [ ] Verify artist attribution quality
- [ ] Confirm track adjacencies are created correctly
- [ ] Validate setlist-track relationships

## Next Steps

1. **Fix the pipeline issues** (you're working on this now)
2. **Test with sample data**: `python recover_raw_data.py --limit 100 --dry-run`
3. **Verify transformations** look correct in dry-run output
4. **Run small batch import**: `python recover_raw_data.py --limit 500`
5. **Validate imported data** in database
6. **Run full recovery**: `python recover_raw_data.py`

## Monitoring Recovery Progress

Watch for these metrics in the recovery script output:
- **Transformation success rate**: Should be >95%
- **Database insert success rate**: Should be >98%
- **Silent failures**: Should be 0 (playlist with 0 tracks but no error)
- **Artist attribution**: Check that generic "Unknown Artist" is minimal

## Contact

If you encounter issues during recovery, check:
1. Logs in recovery script output
2. Database error messages
3. Pydantic validation errors
4. Field mapping mismatches

The recovery script is ready to use once you've fixed the pipeline format issues.
