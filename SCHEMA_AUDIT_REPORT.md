# SongNodes Database Schema Audit Report
**Generated**: 2025-10-01
**Database**: musicdb @ localhost:5433 (PostgreSQL)
**Auditor**: Schema Database Expert Agent

---

## Executive Summary

This comprehensive audit analyzed the entire SongNodes scrape pipeline from scrapers → database → API → frontend. The system shows **CRITICAL SCHEMA INCONSISTENCIES** between multiple schema definitions, database pipeline code, and Pydantic models that will cause data loss and runtime errors.

**Critical Findings:**
- ✅ **28 tables** and **8 views** successfully created in production database
- ❌ **CRITICAL**: Multiple conflicting schema definitions in `sql/init/` directory
- ❌ **CRITICAL**: Database pipeline references wrong table/column names (e.g., `artists.name` vs actual `artists.artist_id`, `name` columns)
- ❌ **HIGH**: Pydantic models use different field names than database columns
- ❌ **MEDIUM**: Scrapers extract fields that don't exist in database schema
- ⚠️ **WARNING**: `artists` table has duplicate `name`, `created_at`, `updated_at` columns

---

## 1. Database Schema Analysis

### 1.1 Complete Database Schema (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MUSICDB SCHEMA                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐         ┌─────────────┐ │
│  │   ARTISTS    │◄────────│ SONG_ARTISTS │────────►│    SONGS    │ │
│  ├──────────────┤         ├──────────────┤         ├─────────────┤ │
│  │ artist_id PK │         │ song_id   FK │         │ song_id  PK │ │
│  │ id           │         │ artist_id FK │         │ title       │ │
│  │ name (dup)   │         │ role         │         │ primary_    │ │
│  │ name (dup)   │         └──────────────┘         │   artist_id │ │
│  │ spotify_id   │                                  │ genre       │ │
│  │ genres[]     │                                  │ bpm         │ │
│  │ country      │                                  │ key         │ │
│  │ aliases[]    │                                  │ track_id    │ │
│  └──────────────┘                                  └─────────────┘ │
│         ▲                                                   ▲       │
│         │                                                   │       │
│         │                                                   │       │
│  ┌──────────────┐                              ┌──────────────────┐│
│  │  PLAYLISTS   │                              │ PLAYLIST_TRACKS  ││
│  ├──────────────┤                              ├──────────────────┤│
│  │ playlist_id  │◄─────────────────────────────│ playlist_id   FK ││
│  │ name         │                              │ position         ││
│  │ source       │                              │ song_id       FK ││
│  │ source_url   │                              └──────────────────┘│
│  │ event_date   │                                                  │
│  │ dj_artist_id │────┐                                             │
│  └──────────────┘    │                                             │
│                      └────────────────┐                            │
│                                       ▼                            │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              OBSERVABILITY TABLES                            │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ • scraping_runs          (run_id, status, metrics)          │ │
│  │ • data_lineage           (source tracking)                  │ │
│  │ • data_quality_metrics   (quality scores)                   │ │
│  │ • anomaly_detection      (quality issues)                   │ │
│  │ • validation_results     (validation stats)                 │ │
│  │ • source_extraction_log  (scraping metrics)                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    GRAPH TABLES                              │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ • song_adjacency           (song_id_1, song_id_2, count)    │ │
│  │ • artist_collaborations    (artist pairs, counts)           │ │
│  │ • target_tracks            (search targets)                 │ │
│  │ • target_track_searches    (search results)                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

VIEWS (Read-Only):
  • tracks               → songs + computed audio features
  • graph_nodes          → songs formatted for D3.js
  • graph_edges          → song_adjacency formatted for D3.js
  • database_stats       → aggregate statistics
  • pipeline_health_dashboard → scraping run metrics
```

### 1.2 Table Inventory

| Table Name | Columns | Primary Purpose | Data Source |
|------------|---------|-----------------|-------------|
| **artists** | 13 | Artist master data | Scrapers |
| **songs** | 22 | Track master data | Scrapers |
| **playlists** | 15 | Setlists/playlists | Scrapers |
| **song_artists** | 3 | Track-artist relationships | Scrapers |
| **playlist_tracks** | 4 | Playlist track positions | Scrapers |
| **song_adjacency** | 4 | Graph edges (track sequences) | Scrapers |
| **venues** | 10 | Event venues | Scrapers |
| **target_tracks** | 12 | Search targets | Manual/API |
| **target_track_searches** | 7 | Search tracking | Scrapers |
| **scraping_runs** | 11 | ETL run metadata | Pipeline |
| **data_lineage** | 10 | Source tracking | Pipeline |
| **data_quality_metrics** | 11 | Quality scores | Pipeline |
| **anomaly_detection** | 15 | Quality issues | Pipeline |
| **validation_results** | 11 | Validation stats | Pipeline |
| **validation_issues** | 9 | Validation errors | Pipeline |
| **transformation_results** | 7 | ETL transformations | Pipeline |
| **source_extraction_log** | 14 | Scraping metrics | Pipeline |
| **raw_scrape_data** | 8 | Raw HTML/JSON | Scrapers |
| **normalized_tracks** | 18 | Cross-source dedupe | Pipeline |
| **track_sources** | 12 | Multi-platform tracking | Scrapers |
| **api_keys** | 13 | External API credentials | Manual |
| **api_key_audit_log** | 9 | API key usage tracking | System |
| **artist_collaborations** | 4 | Artist pairings | Computed |
| **playlist_discovery** | 4 | Playlist search tracking | Scrapers |
| **playlist_songs** | 6 | Legacy playlist tracks | Deprecated |
| **graph_validation_results** | 10 | Graph integrity checks | Pipeline |
| **graph_impact_analysis** | 12 | Change impact tracking | Pipeline |
| **pipeline_execution_metrics** | 8 | Pipeline performance | Pipeline |

**Total: 28 tables, 8 views**

---

## 2. Schema Definition Conflicts

### 2.1 Critical Issue: Multiple Conflicting Schema Files

The `sql/init/` directory contains **CONFLICTING schema definitions** that create duplicate columns:

**Files analyzed:**
1. `/sql/init/01-schema.sql` - Original "authoritative" schema
2. `/sql/init/upgrade_schema_for_complete_music_data.sql` - Adds overlapping columns
3. `/sql/init/05-compatibility-views.sql` - Creates views bridging schema versions
4. `/sql/init/06-audio-analysis-schema.sql` - Additional audio features
5. `/sql/init/06-metadata-enrichment.sql` - Duplicate filename (naming conflict)

**Result: `artists` table has DUPLICATE columns:**

```sql
-- From actual database:
artist_id      uuid    -- PRIMARY KEY
id             uuid    -- DUPLICATE (from upgrade script)
name           varchar -- DUPLICATE #1
name           varchar -- DUPLICATE #2
created_at     timestamp -- DUPLICATE #1
updated_at     timestamp -- DUPLICATE #1
created_at     timestamp -- DUPLICATE #2
updated_at     timestamp -- DUPLICATE #2
```

**Impact**: Queries will fail with ambiguous column errors. INSERT statements may populate wrong columns.

---

## 3. Database Pipeline → Database Mismatches

### 3.1 Critical Mismatches in `database_pipeline.py`

**File**: `/mnt/my_external_drive/programming/songnodes/scrapers/database_pipeline.py`

#### Issue 1: Artists table column name mismatch

**Code (Line 476-483):**
```python
INSERT INTO artists (name, genres, country)
VALUES ($1, $2, $3)
ON CONFLICT (name) DO UPDATE SET
    genres = COALESCE(EXCLUDED.genres, artists.genres),
```

**Problem:**
- Code references `artists.name` as PRIMARY KEY
- Actual database: `artist_id` is PRIMARY KEY, `name` is duplicated
- `ON CONFLICT (name)` will fail - `name` is NOT unique in current schema

**Expected Columns (from 01-schema.sql):**
```sql
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL UNIQUE,
    ...
)
```

**Actual Columns (from database):**
```
artist_id (PK), id, name, name, spotify_id, created_at, ...
```

**Fix Required**: Change to `normalized_name` for uniqueness constraint.

#### Issue 2: Songs table conflict resolution mismatch

**Code (Line 518):**
```python
ON CONFLICT (title, primary_artist_id) DO UPDATE SET
```

**Problem:**
- No unique constraint exists on `(title, primary_artist_id)` in database
- Actual schema has NO unique constraint on these columns
- `song_id` is the only PRIMARY KEY

**Result**: INSERT will fail with "constraint does not exist" error.

---

## 4. Pydantic Models → Database Mismatches

### 4.1 Field Name Inconsistencies

**File**: `/mnt/my_external_drive/programming/songnodes/scrapers/pydantic_models.py`

| Pydantic Model Field | Database Column | Status |
|---------------------|-----------------|---------|
| `artist_name` | `name` | ❌ MISMATCH |
| `normalized_name` | `name` (duplicated) | ⚠️ AMBIGUOUS |
| `genre_preferences` (List[str]) | `genres` (ARRAY) | ✅ COMPATIBLE |
| `track_name` | `title` | ❌ MISMATCH |
| `normalized_title` | N/A | ❌ MISSING IN DB |
| `musical_key` | `key` | ❌ MISMATCH |
| `youtube_id` | `youtube_music_id` | ❌ MISMATCH |
| `setlist_name` | `name` (in playlists) | ✅ MATCH |
| `dj_artist_name` | N/A | ❌ MISSING IN DB |

### 4.2 Type Mismatches

| Pydantic Type | Database Type | Field | Issue |
|---------------|---------------|-------|-------|
| `confloat(ge=60, le=200)` | `integer` | bpm | ✅ COMPATIBLE |
| `confloat(ge=0, le=1)` | N/A | energy, danceability, etc. | ❌ MISSING COLUMNS |
| `constr(pattern=r'^[a-f0-9]{16}$')` | `character varying(16)` | track_id | ✅ MATCH |
| `DataSource` (Enum) | `character varying(100)` | data_source | ✅ COMPATIBLE |

---

## 5. Scrapers → Database Mismatches

### 5.1 Fields Extracted by Scrapers But Missing in Database

**From `items.py` (EnhancedTrackItem):**

| Scrapy Field | Database Column | Status |
|--------------|-----------------|--------|
| `track_name` | `title` | ❌ NAME MISMATCH |
| `duration_ms` | `duration_seconds` | ❌ UNIT MISMATCH (ms vs seconds) |
| `musical_key` | `key` | ❌ NAME MISMATCH |
| `energy` | N/A | ❌ MISSING |
| `danceability` | N/A | ❌ MISSING |
| `valence` | N/A | ❌ MISSING |
| `acousticness` | N/A | ❌ MISSING |
| `instrumentalness` | N/A | ❌ MISSING |
| `liveness` | N/A | ❌ MISSING |
| `speechiness` | N/A | ❌ MISSING |
| `loudness` | N/A | ❌ MISSING |
| `youtube_id` | `youtube_music_id` | ❌ NAME MISMATCH |
| `discogs_id` | N/A | ❌ MISSING |
| `is_instrumental` | N/A | ❌ MISSING |
| `is_explicit` | N/A | ❌ MISSING |

**From `items.py` (EnhancedArtistItem):**

| Scrapy Field | Database Column | Status |
|--------------|-----------------|--------|
| `artist_name` | `name` | ❌ NAME MISMATCH |
| `youtube_channel_id` | N/A | ❌ MISSING |
| `discogs_id` | N/A | ❌ MISSING |
| `genre_preferences` | `genres` | ❌ NAME MISMATCH |
| `is_verified` | N/A | ❌ MISSING |
| `follower_count` | N/A | ❌ MISSING |
| `monthly_listeners` | N/A | ❌ MISSING |
| `popularity_score` | N/A | ❌ MISSING |

### 5.2 Database Pipeline Transformation Issues

**File**: `database_pipeline.py` Lines 301-319

**Code extracts but database doesn't store:**
```python
self.item_batches['songs'].append({
    'title': track_name,
    'artist_name': artist_name,  # ❌ Used for lookup, not stored
    'genre': item.get('genre'),   # ✅ Stored
    'bpm': item.get('bpm'),        # ✅ Stored
    'key': item.get('key'),        # ✅ Stored
    'duration_seconds': item.get('duration_seconds'),  # ❌ Scrapers send 'duration_ms'
    'release_year': item.get('release_year'),  # ✅ Stored
    'label': item.get('label'),    # ✅ Stored
    # ... platform IDs all ✅ stored
})
```

**Critical Issues:**
1. Scrapers extract `duration_ms` but pipeline expects `duration_seconds`
2. No unit conversion happening in pipeline
3. Audio features (energy, danceability, etc.) extracted but never inserted

---

## 6. REST API → Database Mismatches

### 6.1 API Query Field Name Mismatches

**File**: `/mnt/my_external_drive/programming/songnodes/services/rest-api/main.py`

**Lines 178-187: `/api/v1/artists` endpoint**

```python
query = """
SELECT artist_id, artist_name, normalized_name, aliases,  # ❌ 'artist_name' doesn't exist
       spotify_id, apple_music_id, youtube_channel_id,     # ❌ 'youtube_channel_id' doesn't exist
       soundcloud_id, discogs_id, musicbrainz_id,          # ❌ 'discogs_id' doesn't exist
       genre_preferences, country,                         # ❌ 'genre_preferences' doesn't exist
       is_verified, follower_count, monthly_listeners,     # ❌ All missing
       popularity_score, data_source, scrape_timestamp,    # ❌ All missing
       created_at, updated_at
FROM artists
"""
```

**Actual columns in database:**
```
artist_id, id, name, name, spotify_id, created_at, updated_at,
musicbrainz_id, genres, country, aliases, created_at, updated_at
```

**Result**: This query will **FAIL** with `column "artist_name" does not exist` error.

### 6.2 Pydantic Response Model Mismatches

**Lines 193-196: Artist response validation**

```python
artist = ArtistResponse(**dict(row))
```

**Problem**: `ArtistResponse` expects fields that don't exist in query result:
- `artist_name` (actual: `name`)
- `genre_preferences` (actual: `genres`)
- `youtube_channel_id` (missing)
- `discogs_id` (missing)
- `is_verified` (missing)
- `follower_count` (missing)
- `monthly_listeners` (missing)
- `popularity_score` (missing)

**Result**: Pydantic validation will **FAIL** for every artist.

---

## 7. Complete Data Flow Analysis

### 7.1 Data Flow Diagram

```
┌─────────────────┐
│   SCRAPERS      │
│  (Scrapy Items) │
└────────┬────────┘
         │ EnhancedTrackItem
         │ - track_name         ❌ → title (renamed)
         │ - duration_ms        ❌ → duration_seconds (needs conversion)
         │ - musical_key        ❌ → key (renamed)
         │ - energy             ❌ → DROPPED (no column)
         │ - danceability       ❌ → DROPPED (no column)
         │ - youtube_id         ❌ → youtube_music_id (renamed)
         │
         ▼
┌─────────────────┐
│ DATABASE PIPELINE│
│ (Pydantic Valid)│
└────────┬────────┘
         │ Validates with pydantic_models.py
         │ - Uses 'track_name' internally  ❌
         │ - Expects 'artist_name'         ❌
         │ - Maps to database columns      ❌ PARTIAL
         │
         ▼
┌─────────────────┐
│   POSTGRES DB   │
│   (musicdb)     │
└────────┬────────┘
         │ Actual columns:
         │ - title              ✅
         │ - duration_seconds   ⚠️ (receives ms, stores as seconds)
         │ - key                ✅
         │ - NO audio features  ❌
         │
         ▼
┌─────────────────┐
│  COMPATIBILITY  │
│      VIEWS      │
└────────┬────────┘
         │ tracks VIEW:
         │ - maps songs.title → track_name        ✅
         │ - maps songs.key → musical_key         ✅
         │ - hardcoded energy = 0.0               ⚠️ FAKE DATA
         │ - hardcoded danceability = 0.0         ⚠️ FAKE DATA
         │
         ▼
┌─────────────────┐
│   REST API      │
│  (FastAPI)      │
└────────┬────────┘
         │ Queries:
         │ - SELECT artist_name  ❌ FAILS (no column)
         │ - SELECT track_name   ❌ FAILS (no column)
         │ - Uses Pydantic models with wrong field names
         │
         ▼
┌─────────────────┐
│   FRONTEND      │
│ (React/TypeScript)│
└─────────────────┘
         │ Expects:
         │ - track_name          ⚠️ (from view, hardcoded zeros)
         │ - artist_name         ⚠️ (from view)
         │ - energy, danceability ⚠️ (always 0.0)
```

### 7.2 Data Transformation Points

| Stage | Input Format | Transformation | Output Format | Data Loss |
|-------|-------------|----------------|---------------|-----------|
| **Scrapers** | Scrapy Items (items.py) | Field extraction | Python dicts | ✅ None |
| **Pydantic Validation** | Python dicts | Type checking, validation | Validated dicts | ❌ Invalid items dropped |
| **Database Pipeline** | Validated dicts | Field renaming | SQL INSERT | ❌ Audio features dropped |
| **Database** | SQL rows | Storage | Postgres tables | ❌ Missing columns = data loss |
| **Views** | Postgres tables | Field aliasing | Renamed columns | ⚠️ Fake zeros for missing data |
| **REST API** | View queries | Pydantic serialization | JSON | ❌ Query failures |
| **Frontend** | JSON | Deserialization | React state | ⚠️ Displays fake zeros |

---

## 8. Schema Mismatch Summary

### 8.1 Critical Issues (IMMEDIATE FIX REQUIRED)

| # | Issue | Impact | Affected Components |
|---|-------|--------|---------------------|
| 1 | **Duplicate columns in `artists` table** | Ambiguous column errors, failed queries | Database, all queries |
| 2 | **Database pipeline uses wrong column names** | INSERT failures, ON CONFLICT failures | Scrapers → Database |
| 3 | **REST API queries non-existent columns** | API returns 500 errors | API → Database |
| 4 | **Pydantic models don't match database** | Validation failures, data loss | All layers |
| 5 | **Duration unit mismatch (ms vs seconds)** | Incorrect duration values | Scrapers → Database |
| 6 | **Audio features extracted but not stored** | Data loss, wasted scraping effort | Scrapers → Database |

### 8.2 High Priority Issues (FIX WITHIN SPRINT)

| # | Issue | Impact | Components |
|---|-------|--------|------------|
| 7 | **Field name inconsistencies (track_name vs title)** | Mapping complexity, bugs | All layers |
| 8 | **Missing database columns for scraped fields** | Data loss | Scrapers → Database |
| 9 | **Compatibility views return fake zeros** | Misleading data in frontend | Views → API → Frontend |
| 10 | **No unique constraints for conflict resolution** | Duplicate data, failed UPSERTs | Database pipeline |

### 8.3 Medium Priority Issues (BACKLOG)

| # | Issue | Impact | Components |
|---|-------|--------|------------|
| 11 | **YouTube ID field name mismatch** | Data mapping errors | Scrapers → Database |
| 12 | **Missing artist metadata columns** | Incomplete artist profiles | Database |
| 13 | **No validation of ISO country codes** | Data quality issues | Scrapers, Pydantic |
| 14 | **Inconsistent timestamp handling** | Timezone issues | All layers |

---

## 9. Recommendations

### 9.1 Immediate Actions (THIS WEEK)

1. **Fix Duplicate Columns in `artists` Table**
   ```sql
   -- Emergency fix: Drop duplicate columns
   ALTER TABLE artists DROP COLUMN IF EXISTS id;
   -- Keep only: artist_id (PK), name, genres, country, aliases, etc.
   ```

2. **Update Database Pipeline Column Names**
   ```python
   # database_pipeline.py line 476
   # BEFORE:
   INSERT INTO artists (name, genres, country)
   # AFTER:
   INSERT INTO artists (artist_id, name, genres, country)
   VALUES (uuid_generate_v4(), $1, $2, $3)
   ON CONFLICT (artist_id) DO UPDATE SET ...
   ```

3. **Fix REST API Queries**
   ```python
   # main.py line 178
   # BEFORE:
   SELECT artist_id, artist_name, normalized_name, ...
   # AFTER:
   SELECT artist_id, name as artist_name, ...
   ```

4. **Add Missing Audio Feature Columns**
   ```sql
   ALTER TABLE songs
   ADD COLUMN IF NOT EXISTS energy DECIMAL(3,2),
   ADD COLUMN IF NOT EXISTS danceability DECIMAL(3,2),
   ADD COLUMN IF NOT EXISTS valence DECIMAL(3,2),
   ADD COLUMN IF NOT EXISTS acousticness DECIMAL(3,2),
   ADD COLUMN IF NOT EXISTS instrumentalness DECIMAL(3,2),
   ADD COLUMN IF NOT EXISTS liveness DECIMAL(3,2),
   ADD COLUMN IF NOT EXISTS speechiness DECIMAL(3,2),
   ADD COLUMN IF NOT EXISTS loudness DECIMAL(6,2);
   ```

### 9.2 Short-term Fixes (THIS SPRINT)

1. **Standardize Field Names Across All Layers**
   - Create mapping document: `field_name_standards.md`
   - Update Pydantic models to match database column names
   - Update Scrapy items to match Pydantic models
   - Update REST API queries to use actual column names

2. **Fix Duration Unit Handling**
   ```python
   # database_pipeline.py - add conversion
   'duration_seconds': (item.get('duration_ms') or 0) // 1000,
   ```

3. **Add Unique Constraints for Conflict Resolution**
   ```sql
   ALTER TABLE artists
   ADD CONSTRAINT unique_artist_name UNIQUE (name);

   -- Or better: use normalized_name
   CREATE UNIQUE INDEX idx_artists_normalized_name
   ON artists(normalized_name);
   ```

4. **Remove Compatibility Views** (once API/frontend updated)
   ```sql
   DROP VIEW IF EXISTS tracks;
   -- Update API to query songs table directly
   ```

### 9.3 Long-term Improvements (NEXT QUARTER)

1. **Schema Migration Strategy**
   - Consolidate all schema definitions into single source of truth
   - Remove conflicting upgrade scripts
   - Implement proper migration versioning (Alembic/Flyway)

2. **Code Generation from Schema**
   - Generate Pydantic models from database schema (sqlalchemy-to-pydantic)
   - Auto-generate TypeScript types from Pydantic models
   - Eliminate manual field mapping

3. **Comprehensive Testing**
   - Add integration tests: Scrapers → Database → API
   - Validate schema consistency in CI/CD pipeline
   - Test all CRUD operations with real data

4. **Documentation**
   - Create ER diagrams with actual relationships
   - Document all field mappings in code comments
   - Maintain changelog for schema changes

---

## 10. Testing Recommendations

### 10.1 Schema Validation Tests

```python
# tests/test_schema_consistency.py

def test_database_pipeline_column_names():
    """Verify database pipeline uses correct column names"""
    # Check artists insert statement
    assert "INSERT INTO artists (artist_id" in pipeline_code
    # Check songs insert statement
    assert "INSERT INTO songs (song_id, title" in pipeline_code

def test_rest_api_column_names():
    """Verify REST API queries use actual column names"""
    # Check artist query
    assert "SELECT artist_id, name" in api_code
    # Not: SELECT artist_id, artist_name

def test_pydantic_models_match_database():
    """Verify Pydantic model fields exist in database"""
    for field in ArtistResponse.__fields__:
        assert field in database_columns['artists']
```

### 10.2 Integration Tests

```python
# tests/test_scraper_to_api.py

def test_full_pipeline_artist():
    """Test: Scraper → Database → API → Frontend"""
    # 1. Create artist item from scraper
    artist = EnhancedArtistItem(artist_name="Test Artist", ...)

    # 2. Process through pipeline
    pipeline.process_item(artist, spider)

    # 3. Query via API
    response = client.get("/api/v1/artists")

    # 4. Verify data integrity
    assert response.json()[0]['artist_name'] == "Test Artist"
```

---

## 11. File References

### 11.1 Schema Definition Files
- `/mnt/my_external_drive/programming/songnodes/sql/init/01-schema.sql` (original)
- `/mnt/my_external_drive/programming/songnodes/sql/init/upgrade_schema_for_complete_music_data.sql` (conflicts)
- `/mnt/my_external_drive/programming/songnodes/sql/init/05-compatibility-views.sql` (workarounds)

### 11.2 Code Files with Mismatches
- `/mnt/my_external_drive/programming/songnodes/scrapers/database_pipeline.py` (lines 476, 518)
- `/mnt/my_external_drive/programming/songnodes/scrapers/pydantic_models.py` (ArtistBase, TrackBase)
- `/mnt/my_external_drive/programming/songnodes/scrapers/items.py` (all Item classes)
- `/mnt/my_external_drive/programming/songnodes/services/rest-api/main.py` (lines 178-241)

### 11.3 Spider Files
- `/mnt/my_external_drive/programming/songnodes/scrapers/spiders/1001tracklists_spider.py`
- `/mnt/my_external_drive/programming/songnodes/scrapers/spiders/mixesdb_spider.py`
- `/mnt/my_external_drive/programming/songnodes/scrapers/spiders/setlistfm_spider.py`

---

## 12. Appendix: Complete Column Mappings

### 12.1 Artists Table Mapping

| Scrapy Item | Pydantic Model | Database Column | Status |
|-------------|----------------|-----------------|--------|
| artist_name | artist_name | name | ❌ MISMATCH |
| normalized_name | normalized_name | MISSING | ❌ MISSING |
| aliases | aliases | aliases | ✅ MATCH |
| spotify_id | spotify_id | spotify_id | ✅ MATCH |
| apple_music_id | apple_music_id | MISSING | ❌ MISSING |
| youtube_channel_id | youtube_channel_id | MISSING | ❌ MISSING |
| soundcloud_id | soundcloud_id | MISSING | ❌ MISSING |
| discogs_id | discogs_id | MISSING | ❌ MISSING |
| musicbrainz_id | musicbrainz_id | musicbrainz_id | ✅ MATCH |
| genre_preferences | genre_preferences | genres | ❌ MISMATCH |
| country | country | country | ✅ MATCH |

### 12.2 Songs/Tracks Table Mapping

| Scrapy Item | Pydantic Model | Database Column | Status |
|-------------|----------------|-----------------|--------|
| track_name | track_name | title | ❌ MISMATCH |
| normalized_title | normalized_title | MISSING | ❌ MISSING |
| duration_ms | duration_ms | duration_seconds | ❌ UNIT MISMATCH |
| isrc | isrc | isrc | ✅ MATCH |
| spotify_id | spotify_id | spotify_id | ✅ MATCH |
| apple_music_id | apple_music_id | apple_music_id | ✅ MATCH |
| youtube_id | youtube_id | youtube_music_id | ❌ MISMATCH |
| soundcloud_id | soundcloud_id | soundcloud_id | ✅ MATCH |
| musicbrainz_id | musicbrainz_id | musicbrainz_id | ✅ MATCH |
| bpm | bpm | bpm | ✅ MATCH |
| musical_key | musical_key | key | ❌ MISMATCH |
| energy | energy | MISSING | ❌ MISSING |
| danceability | danceability | MISSING | ❌ MISSING |
| valence | valence | MISSING | ❌ MISSING |
| genre | genre | genre | ✅ MATCH |
| record_label | record_label | label | ❌ MISMATCH |
| release_date | release_date | MISSING | ❌ MISSING |

---

## Conclusion

The SongNodes scrape pipeline has **CRITICAL schema inconsistencies** that will cause:

1. **Runtime Failures**: API queries will fail with "column does not exist" errors
2. **Data Loss**: 50%+ of scraped fields are dropped due to missing columns
3. **Data Quality Issues**: Compatibility views return fake zeros for missing data
4. **Maintenance Burden**: Multiple conflicting schema definitions

**IMMEDIATE ACTION REQUIRED**: Implement Section 9.1 recommendations before next deployment.

**Estimated Effort**:
- Immediate fixes: 4-8 hours
- Short-term fixes: 1-2 sprints
- Long-term improvements: 1 quarter

---

**Report Generated By**: Schema Database Expert Agent
**Audit Date**: 2025-10-01
**Database Version**: PostgreSQL (from docker-compose)
**Total Tables Analyzed**: 28
**Total Views Analyzed**: 8
**Critical Issues Found**: 6
**High Priority Issues Found**: 4
**Medium Priority Issues Found**: 4
