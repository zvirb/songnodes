# Data Collection Validation Test Plan

**Objective:** Verify that DJ setlist scraping captures ALL required data for mixing recommendations

---

## Test Requirements

### Primary Data Collection Goals

1. ✅ **Capture DJ setlists** (track sequences with positions)
2. ✅ **Extract all track metadata** (BPM, key, energy, genres, etc.)
3. ✅ **Save adjacency information** (Track A → Track B transitions)
4. ✅ **Measure adjacency frequency** (occurrence counts)
5. ✅ **Store context** (which DJ/playlist, when, where in mix)

---

## Test Plan

### Test 1: Bronze Layer Data Capture

**Purpose:** Verify 100% of scraped HTML/JSON is preserved

**Test Steps:**
1. Scrape a single DJ mix from MixesDB or 1001tracklists
2. Check `bronze_scraped_tracks` table
3. Verify `raw_data` JSONB contains complete original data

**Expected Fields in `raw_data`:**
```json
{
  "track_name": "...",
  "artist_name": "...",
  "mix_name": "...",
  "position": 1,
  "timestamp": "0:03:45",
  "source_url": "https://...",
  "dj": "...",
  "date": "...",
  "original_html": "<div>...</div>"
}
```

**Validation Query:**
```sql
SELECT
  id,
  source,
  raw_data->>'track_name' as track,
  raw_data->>'position' as position,
  scraped_at
FROM bronze_scraped_tracks
ORDER BY (raw_data->>'position')::INTEGER
LIMIT 10;
```

**Success Criteria:**
- [ ] All tracks from mix captured
- [ ] Position numbers sequential (1, 2, 3...)
- [ ] No missing tracks in sequence
- [ ] Complete HTML/JSON preserved
- [ ] Timestamp data captured

---

### Test 2: Silver Layer Enrichment

**Purpose:** Verify all metadata fields populated via API enrichment

**Test Steps:**
1. After Bronze capture, trigger enrichment
2. Check `silver_enriched_tracks` table
3. Verify ALL fields populated

**Required Fields (40+ total):**

**Identity Fields:**
- [ ] `id` (UUID)
- [ ] `bronze_id` (link to source)
- [ ] `artist_name`
- [ ] `track_title`

**External IDs:**
- [ ] `spotify_id`
- [ ] `isrc`
- [ ] `musicbrainz_id`
- [ ] `beatport_id` (if available)

**Audio Features (CRITICAL for recommendations):**
- [ ] `bpm` (REQUIRED)
- [ ] `key` (REQUIRED - Camelot notation)
- [ ] `energy` (0-1)
- [ ] `danceability` (0-1)
- [ ] `valence` (0-1)
- [ ] `acousticness` (0-1)
- [ ] `instrumentalness` (0-1)
- [ ] `liveness` (0-1)
- [ ] `speechiness` (0-1)
- [ ] `loudness` (dB)

**Metadata:**
- [ ] `genre` (array)
- [ ] `release_date`
- [ ] `release_name`
- [ ] `label`
- [ ] `duration_ms`

**Quality Tracking:**
- [ ] `data_quality_score` (0-1)
- [ ] `enrichment_metadata` (JSONB with provenance)
- [ ] `validation_status`

**Validation Query:**
```sql
SELECT
  artist_name,
  track_title,
  bpm,
  key,
  energy,
  danceability,
  genre,
  spotify_id,
  data_quality_score,
  CASE
    WHEN bpm IS NULL THEN '❌ Missing BPM'
    WHEN key IS NULL THEN '❌ Missing Key'
    WHEN energy IS NULL THEN '❌ Missing Energy'
    WHEN spotify_id IS NULL THEN '⚠️ No Spotify ID'
    ELSE '✅ Complete'
  END as status
FROM silver_enriched_tracks
ORDER BY id
LIMIT 20;
```

**Success Criteria:**
- [ ] BPM field populated for ≥90% of tracks
- [ ] Key field populated for ≥80% of tracks
- [ ] Energy field populated for ≥85% of tracks
- [ ] At least one external ID (Spotify/MusicBrainz) for ≥95% of tracks
- [ ] Genre array populated for ≥70% of tracks
- [ ] `data_quality_score` ≥ 0.7 for ≥80% of tracks

---

### Test 3: Adjacency Edge Creation (CRITICAL)

**Purpose:** Verify track-to-track transitions are captured

**Test Steps:**
1. After enrichment, check `silver_track_transitions` table
2. Verify edges match playlist sequence
3. Check quality scores calculated

**Example Playlist:**
```
Position 1: Track A
Position 2: Track B  ◄─── Edge: A → B
Position 3: Track C  ◄─── Edge: B → C
Position 4: Track D  ◄─── Edge: C → D
```

**Expected: 3 edges created**

**Validation Query:**
```sql
SELECT
  from_track.artist_name || ' - ' || from_track.track_title as from_track,
  to_track.artist_name || ' - ' || to_track.track_title as to_track,
  tr.occurrence_count,
  tr.transition_quality_score,
  tr.avg_bpm_difference,
  tr.avg_key_compatibility
FROM silver_track_transitions tr
JOIN silver_enriched_tracks from_track ON from_track.id = tr.from_track_id
JOIN silver_enriched_tracks to_track ON to_track.id = tr.to_track_id
ORDER BY tr.occurrence_count DESC;
```

**Success Criteria:**
- [ ] Number of edges = Number of tracks - 1
- [ ] No gaps in transition sequence
- [ ] `occurrence_count` = 1 for first scrape
- [ ] `playlist_occurrences` JSONB contains playlist context
- [ ] `transition_quality_score` calculated (not NULL)
- [ ] `avg_bpm_difference` populated where both tracks have BPM
- [ ] `avg_key_compatibility` populated where both tracks have key

---

### Test 4: Playlist Context Preservation

**Purpose:** Verify playlist metadata and track positions saved

**Test Steps:**
1. Check `silver_enriched_playlists` table
2. Check `silver_playlist_tracks` junction table

**Validation Query:**
```sql
-- Verify playlist metadata
SELECT
  playlist_name,
  artist_name as dj,
  event_date,
  track_count
FROM silver_enriched_playlists;

-- Verify track positions
SELECT
  pt.position,
  t.artist_name || ' - ' || t.track_title as track,
  pt.cue_time_ms
FROM silver_playlist_tracks pt
JOIN silver_enriched_tracks t ON t.id = pt.track_id
WHERE pt.playlist_id = (SELECT id FROM silver_enriched_playlists LIMIT 1)
ORDER BY pt.position;
```

**Success Criteria:**
- [ ] Playlist name captured
- [ ] DJ/artist name captured
- [ ] Event date captured (if available)
- [ ] Track count matches actual tracks
- [ ] Positions are sequential (1, 2, 3, 4...)
- [ ] No duplicate positions
- [ ] Cue times captured if available

---

### Test 5: Gold Layer Analytics

**Purpose:** Verify analytics computed correctly

**Test Steps:**
1. Check `gold_track_analytics` table
2. Verify materialized view `gold_track_graph`

**Validation Query:**
```sql
-- Track analytics
SELECT
  track_name,
  primary_artist,
  bpm,
  key,
  play_count,
  playlist_appearances,
  data_completeness,
  confidence_score
FROM gold_track_analytics
LIMIT 10;

-- Graph adjacency lists
SELECT
  track_id,
  jsonb_array_length(outgoing_edges) as edge_count,
  total_outgoing_edges,
  avg_outgoing_quality
FROM gold_track_graph
LIMIT 10;
```

**Success Criteria:**
- [ ] `play_count` = 1 for first scrape
- [ ] `playlist_appearances` = 1 for first scrape
- [ ] `data_completeness` calculated
- [ ] `confidence_score` calculated
- [ ] `outgoing_edges` JSONB array populated
- [ ] `total_outgoing_edges` matches adjacency count

---

### Test 6: Field Coverage Analysis

**Purpose:** Identify which fields are consistently missing

**Test Steps:**
1. Run field coverage analysis query
2. Identify fields with <80% population rate
3. Fix scraper/enrichment code

**Validation Query:**
```sql
WITH field_coverage AS (
  SELECT
    COUNT(*) as total_tracks,
    COUNT(bpm) * 100.0 / COUNT(*) as bpm_coverage,
    COUNT(key) * 100.0 / COUNT(*) as key_coverage,
    COUNT(energy) * 100.0 / COUNT(*) as energy_coverage,
    COUNT(danceability) * 100.0 / COUNT(*) as danceability_coverage,
    COUNT(valence) * 100.0 / COUNT(*) as valence_coverage,
    COUNT(spotify_id) * 100.0 / COUNT(*) as spotify_id_coverage,
    COUNT(isrc) * 100.0 / COUNT(*) as isrc_coverage,
    COUNT(genre) * 100.0 / COUNT(*) as genre_coverage,
    COUNT(release_date) * 100.0 / COUNT(*) as release_date_coverage
  FROM silver_enriched_tracks
)
SELECT
  'bpm' as field, bpm_coverage as coverage FROM field_coverage
UNION ALL
SELECT 'key', key_coverage FROM field_coverage
UNION ALL
SELECT 'energy', energy_coverage FROM field_coverage
UNION ALL
SELECT 'danceability', danceability_coverage FROM field_coverage
UNION ALL
SELECT 'spotify_id', spotify_id_coverage FROM field_coverage
UNION ALL
SELECT 'genre', genre_coverage FROM field_coverage
ORDER BY coverage DESC;
```

**Target Coverage:**
- [ ] BPM: ≥90%
- [ ] Key: ≥80%
- [ ] Energy: ≥85%
- [ ] Spotify ID: ≥95%
- [ ] Genre: ≥70%

---

### Test 7: Enrichment Waterfall Verification

**Purpose:** Verify provider priority system working

**Test Steps:**
1. Check `enrichment_metadata` JSONB for sample tracks
2. Verify waterfall attempted in correct order

**Validation Query:**
```sql
SELECT
  artist_name || ' - ' || track_title as track,
  enrichment_metadata->'waterfall_attempts' as waterfall,
  enrichment_metadata->'providers_used' as providers
FROM silver_enriched_tracks
WHERE enrichment_metadata IS NOT NULL
LIMIT 5;
```

**Success Criteria:**
- [ ] Beatport tried first for BPM (0.98 confidence)
- [ ] Spotify tried second for BPM (0.85 confidence)
- [ ] Provider confidence scores match config
- [ ] Waterfall stops after successful provider
- [ ] Cache hits recorded

---

### Test 8: Data Completeness Report

**Purpose:** Generate comprehensive data quality report

**Validation Query:**
```sql
WITH quality_stats AS (
  SELECT
    COUNT(*) as total_tracks,
    AVG(data_quality_score) as avg_quality,
    COUNT(*) FILTER (WHERE data_quality_score >= 0.9) as excellent,
    COUNT(*) FILTER (WHERE data_quality_score >= 0.7 AND data_quality_score < 0.9) as good,
    COUNT(*) FILTER (WHERE data_quality_score < 0.7) as needs_improvement,
    COUNT(*) FILTER (WHERE bpm IS NULL) as missing_bpm,
    COUNT(*) FILTER (WHERE key IS NULL) as missing_key,
    COUNT(*) FILTER (WHERE energy IS NULL) as missing_energy,
    COUNT(*) FILTER (WHERE spotify_id IS NULL AND isrc IS NULL) as no_ids
  FROM silver_enriched_tracks
)
SELECT
  'Total Tracks: ' || total_tracks as metric,
  NULL as value
FROM quality_stats
UNION ALL
SELECT 'Avg Quality Score', ROUND(avg_quality, 3)::TEXT FROM quality_stats
UNION ALL
SELECT 'Excellent (≥0.9)', excellent::TEXT FROM quality_stats
UNION ALL
SELECT 'Good (0.7-0.9)', good::TEXT FROM quality_stats
UNION ALL
SELECT 'Needs Improvement (<0.7)', needs_improvement::TEXT FROM quality_stats
UNION ALL
SELECT 'Missing BPM', missing_bpm::TEXT FROM quality_stats
UNION ALL
SELECT 'Missing Key', missing_key::TEXT FROM quality_stats
UNION ALL
SELECT 'Missing Energy', missing_energy::TEXT FROM quality_stats
UNION ALL
SELECT 'No External IDs', no_ids::TEXT FROM quality_stats;
```

---

## Common Issues & Fixes

### Issue 1: BPM field not populated

**Diagnosis:**
```sql
SELECT
  artist_name,
  track_title,
  enrichment_metadata->'waterfall_attempts' as attempts
FROM silver_enriched_tracks
WHERE bpm IS NULL
LIMIT 10;
```

**Possible Causes:**
- Beatport API key missing
- Spotify API not returning audio features
- Field mapping error in enrichment pipeline

**Fix:**
- Verify API credentials
- Check enrichment metadata for errors
- Update field mapping in `api_enrichment_pipeline.py`

---

### Issue 2: Adjacency edges not created

**Diagnosis:**
```sql
SELECT COUNT(*) as edge_count FROM silver_track_transitions;
SELECT COUNT(*) - 1 as expected_edges FROM silver_playlist_tracks WHERE playlist_id = (SELECT id FROM silver_enriched_playlists LIMIT 1);
```

**Possible Causes:**
- Edge extraction query not running
- Trigger not firing
- Position numbers not sequential

**Fix:**
- Manually run edge extraction:
```sql
INSERT INTO silver_track_transitions (from_track_id, to_track_id, occurrence_count, playlist_occurrences)
SELECT
  pt1.track_id,
  pt2.track_id,
  1,
  jsonb_build_array(jsonb_build_object('playlist_id', pt1.playlist_id, 'position', pt1.position))
FROM silver_playlist_tracks pt1
JOIN silver_playlist_tracks pt2 ON pt1.playlist_id = pt2.playlist_id AND pt2.position = pt1.position + 1
ON CONFLICT DO NOTHING;
```

---

### Issue 3: Missing genre data

**Diagnosis:**
```sql
SELECT
  COUNT(*) FILTER (WHERE genre IS NULL OR cardinality(genre) = 0) as tracks_without_genre,
  COUNT(*) as total
FROM silver_enriched_tracks;
```

**Possible Causes:**
- Last.fm API not being called
- Genre not in waterfall config
- Field mapping error

**Fix:**
- Add genre to waterfall config
- Enable Last.fm provider
- Update `metadata_enrichment_config` table

---

## Test Execution Checklist

### Pre-Test:
- [ ] Database cleaned (all medallion tables truncated)
- [ ] Spotify credentials verified (via UI screenshot)
- [ ] Tidal credentials verified (via UI screenshot)
- [ ] API keys loaded in database
- [ ] Scrapers running (health checks passing)

### Execute Tests:
- [ ] Test 1: Bronze Layer capture
- [ ] Test 2: Silver Layer enrichment
- [ ] Test 3: Adjacency edges
- [ ] Test 4: Playlist context
- [ ] Test 5: Gold analytics
- [ ] Test 6: Field coverage
- [ ] Test 7: Waterfall verification
- [ ] Test 8: Quality report

### Post-Test:
- [ ] Document missing fields
- [ ] Fix scraper/enrichment code
- [ ] Re-run tests
- [ ] Verify 100% data capture

---

## Success Metrics

**Minimum Acceptable:**
- Bronze layer: 100% of scraped HTML/JSON preserved
- Silver layer: ≥85% field population (BPM, key, energy)
- Adjacency edges: 100% of sequential transitions captured
- Quality score: ≥0.7 average across all tracks

**Target:**
- Bronze layer: 100% preservation ✅
- Silver layer: ≥95% field population
- Adjacency edges: 100% capture + quality scores
- Quality score: ≥0.85 average

---

## Next Steps After Testing

1. **If tests fail:** Fix missing field extraction in scrapers/enrichment
2. **If tests pass:** Run larger test (10+ playlists)
3. **Production readiness:** Scrape 100+ playlists, verify consistency

---

**Testing Priority: Adjacency edges are MOST CRITICAL for DJ recommendations!**
