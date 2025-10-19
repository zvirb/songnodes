# SongNodes Data Pipeline Audit Report
**Date**: 2025-10-19
**Auditor**: Claude Code Assistant
**Scope**: End-to-end data flow from Silver → Gold → Graph Visualization

## Executive Summary

This audit uncovered multiple critical blocking errors in the SongNodes data pipeline that prevented tracks from appearing in the frontend graph visualization. Despite having 15,129 tracks in the database, users saw only 462 tracks.

**Key Finding**: A cascading filter in the Graph Visualization API combined with missing artist relationships created a bottleneck reducing visible tracks by 96.9%.

---

## Critical Issues Identified & Resolved

### 1. ✅ **Missing Playlist ETL (Medallion Architecture Gap)**

**Issue**: Only 354/16,476 playlists (2.1%) in gold layer, blocking graph adjacency generation.

**Root Cause**:
- No ETL script to transform `silver_enriched_playlists` → `playlists` + `playlist_tracks`
- 97.9% of playlist data stuck in silver layer

**Impact**:
- Sparse `song_adjacency` graph
- Most tracks lacked playlist context for adjacency relationships

**Resolution**:
1. Created `/services/data-transformer/silver_playlists_to_gold_etl.py`
   - Maps silver artist/track UUIDs → gold layer UUIDs via normalized name matching
   - Creates `playlists` entries with unique `source_url` key
   - Populates `playlist_tracks` junction table with position data

2. Created `/scripts/migrations/migrate_silver_to_gold_playlists.sql`
   - Direct SQL migration for immediate impact
   - Migrated 808 playlists (exceeded 581 target)
   - Created 2,282 track relationships

**Results**:
- Gold playlists: 354 → 1,162 (+228%)
- Track relationships: +2,282 new associations

**File**: `services/data-transformer/silver_playlists_to_gold_etl.py:1-463`
**Migration**: `scripts/migrations/migrate_silver_to_gold_playlists.sql`

---

### 2. ✅ **Graph Generator Execution**

**Issue**: New playlist data not generating adjacency edges.

**Action**: Ran `setlist_graph_generator.py` to create adjacency relationships from newly migrated playlists.

**Results**:
- **2,730 new edges** saved to `song_adjacency` table
- Total edges: now 9,391
- Unique tracks in graph: 3,653

**Note**: JSON export failed (permission error `/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013`) but database writes succeeded.

**File**: `services/data-transformer/setlist_graph_generator.py:535-585`

---

### 3. ⚠️ **Enrichment Pipeline Bug (High Priority)**

**Issue**: 1,546 tracks show `enrichment_status='completed'` but have NO artist relationships.

**Root Cause** (Identified but NOT fixed):
- `enrichment_pipeline.py` lines 532-539
- Spotify client doesn't populate `metadata['artists']` array
- Conditional check `if metadata.get('artists')` never triggers
- Fallback `populate_artists_from_spotify()` may not work correctly

**Impact**:
- 15.45% of track collection (2,414 total)
- 1,003 adjacency tracks (27.5% of graph) have 'Unknown' artists

**Code Location**: `services/metadata-enrichment/enrichment_pipeline.py:532-539`

**Recommended Fix**:
```python
# BEFORE (Current - Broken)
if metadata.get('artists') and isinstance(metadata['artists'], list):
    await self._create_artist_relationships(...)
elif metadata.get('spotify_id'):
    await self.artist_populator.populate_artists_from_spotify(...)

# AFTER (Proposed Fix)
if metadata.get('spotify_id'):
    # Always try to populate artists from Spotify ID
    await self.artist_populator.populate_artists_from_spotify(
        track_id=UUID(task.track_id),
        spotify_id=metadata['spotify_id']
    )
elif metadata.get('artists'):
    # Fallback to metadata artists if no Spotify ID
    await self._create_artist_relationships(...)
```

**Status**: ❌ NOT FIXED (requires code change + backfill of 1,546 tracks)

---

### 4. 🔍 **Graph API Overly Strict Filtering (Root Cause of User Issue)**

**Issue**: Only 469/3,653 adjacency tracks visible in frontend (87.2% filtered out).

**Root Cause**:
- Graph Visualization API uses "edge-first" approach with BOTH-endpoint filtering
- `services/graph-visualization-api/main.py:455-476`

**Filter Logic**:
```sql
WHERE n1.artist_name IS NOT NULL
  AND n1.artist_name != ''
  AND n1.artist_name != 'Unknown'     -- ENDPOINT 1
  AND n2.artist_name IS NOT NULL
  AND n2.artist_name != ''
  AND n2.artist_name != 'Unknown'     -- ENDPOINT 2
```

**Cascading Impact**:
- 1,003 tracks (27.5% of graph) have 'Unknown' artist_name
- Every edge touching an Unknown track is removed
- One Unknown track can eliminate dozens of edges
- Result: 3,653 tracks → 469 visible nodes

**Data Flow**:
1. `song_adjacency` table has 9,391 edges connecting 3,653 tracks
2. `graph_nodes` view returns 'Unknown' for 1,003 tracks (missing `track_artists` with `role='primary'`)
3. Graph API joins to `graph_nodes` and filters out all edges with Unknown endpoints
4. Remaining: 469 nodes passing filter

**File**: `services/graph-visualization-api/main.py:455-476`

**Proposed Solutions**:
1. **Short-term**: Relax filter to allow edges with AT LEAST ONE valid artist
2. **Long-term**: Fix enrichment pipeline to populate missing artist relationships

**Status**: ❌ NOT FIXED (design decision needed)

---

### 5. ✅ **Frontend Display Limits**

**Issue**: GraphFilterPanel hardcoded 500-node limit.

**Resolution**: Updated default limits to match API capacity
- `maxNodes`: 500 → 15,000
- `maxEdges`: 5,000 → 50,000

**Impact**: Minor (overshadowed by API filtering issue #4)

**File**: `frontend/src/components/GraphFilterPanel.tsx:17-18`

---

## Data Quality Statistics

### Database Totals
| Metric | Count | Coverage |
|:-------|------:|:---------|
| Total tracks | 15,129 | 100% |
| Tracks with artists | 12,792 | 84.6% |
| Tracks with 'Unknown' artist | 2,337 | 15.4% |
| Total playlists (gold) | 1,162 | - |
| Total playlist-track relationships | 2,282+ | - |

### Graph Adjacency
| Metric | Count | Coverage |
|:-------|------:|:---------|
| Total edges in `song_adjacency` | 9,391 | - |
| Unique tracks in adjacency | 3,653 | 24.1% of all tracks |
| Adjacency tracks with 'Unknown' artist | 1,003 | 27.5% of graph |
| Adjacency tracks with valid artists | 2,650 | 72.5% of graph |

### Graph API Filtering
| Metric | Count | % of Adjacency Graph |
|:-------|------:|:---------------------|
| Tracks in adjacency | 3,653 | 100% |
| **Visible after API filter** | **469** | **12.8%** |
| **Hidden by filter** | **3,184** | **87.2%** |

---

## Remaining Blocking Issues

### Priority 1: Enrichment Pipeline Bug
- **Tracks Affected**: 1,546
- **Impact**: High - prevents artist attribution
- **Effort**: Medium - code fix + backfill script
- **Location**: `services/metadata-enrichment/enrichment_pipeline.py:532-539`

### Priority 2: Graph API Filter Policy
- **Tracks Affected**: 3,184 (87.2% of graph)
- **Impact**: Critical - directly causes user-visible issue
- **Effort**: Low - policy decision + 10 lines of SQL
- **Location**: `services/graph-visualization-api/main.py:455-476`

**Options**:
1. Remove 'Unknown' filter entirely (show all tracks with adjacency)
2. Relax to "at least one valid artist per edge"
3. Keep strict filter but fix enrichment first

### Priority 3: Track Title Deduplication
- **Impact**: Medium - 29% data loss (21,357 → 15,129)
- **Root Cause**: Unique constraint `(title, normalized_title)` without artist
- **Example**: "Da Bump" has 51 artists in ONE record
- **Effort**: High - schema change + data migration
- **Status**: Structural issue, needs architecture decision

---

## Recommendations

### Immediate Actions (Today)
1. **Fix enrichment pipeline** (Issue #3)
   - Update `enrichment_pipeline.py` to always use Spotify ID
   - Backfill 1,546 completed-but-no-artists tracks

2. **Relax Graph API filter** (Issue #4)
   - Change to "at least one valid artist per edge"
   - Will immediately show ~2,000 more tracks

### Short-term (This Week)
3. **Run ETL scripts regularly**
   - Schedule `silver_playlists_to_gold_etl.py` daily
   - Monitor for new silver data

4. **Monitor enrichment success rate**
   - Track `enrichment_status='completed'` vs artist relationship creation
   - Alert if divergence > 5%

### Long-term (This Month)
5. **Review track deduplication strategy**
   - Evaluate impact of adding artist to unique key
   - Consider track variants table for multiple artist versions

6. **Implement data quality dashboard**
   - Silver → Gold transformation rates
   - Artist attribution coverage
   - Graph connectivity metrics

---

## Files Modified

### Created
- `services/data-transformer/silver_playlists_to_gold_etl.py` (463 lines)
- `scripts/migrations/migrate_silver_to_gold_playlists.sql`
- `docs/PIPELINE_AUDIT_2025-10-19.md` (this file)

### Modified
- `frontend/src/components/GraphFilterPanel.tsx` (lines 17-18)

### Analyzed (No Changes)
- `services/graph-visualization-api/main.py` (Issue #4 identified)
- `services/metadata-enrichment/enrichment_pipeline.py` (Issue #3 identified)
- `services/data-transformer/silver_to_gold_etl.py` (reference for ETL patterns)

---

## Conclusion

The pipeline audit revealed that the root cause of the "only 462 tracks visible" issue is a **combination of two factors**:

1. **Incomplete artist attribution** - 27.5% of adjacency tracks lack artist relationships
2. **Overly strict API filtering** - eliminates 87.2% of the graph

The good news: Both issues are solvable with targeted fixes. Fixing the enrichment pipeline and relaxing the Graph API filter will restore visibility to ~2,000 additional tracks immediately.

The broader architectural issue (track deduplication collapsing 29% of data) should be addressed in a separate effort with careful consideration of schema impacts.

---

**Audit Completed**: 2025-10-19
**Next Review**: After implementing recommended fixes
