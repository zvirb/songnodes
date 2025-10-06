# Failed Tracks Analysis - October 6, 2025

## Summary

**Total Failed Tracks**: 635

This analysis was performed after implementing the circuit breaker recovery system and multi-tier artist resolver. The data reveals the current state of failed enrichments and the recovery opportunities available.

## CSV Export

**File**: `failed_tracks_analysis_20251006.csv` (91KB, 635 tracks)

**Columns**:
- `id`: Track UUID
- `title`: Track title
- `label`: Record label (from metadata->original_data->label)
- `artist_name`: Artist name (NULL if unknown/missing)
- `status`: Enrichment status (all "failed" in this export)
- `error_message`: Error details
- `retry_count`: Number of retry attempts
- `is_retriable`: Whether the failure is retriable (circuit breaker errors)
- `last_attempt`: Timestamp of last enrichment attempt
- `enrichment_sources`: JSON array of sources that were attempted
- `track_created_at`: When the track was created

## Failure Categories

### 🔄 Retriable Failures (164 tracks - 25.8%)

These failures are temporary and should be retried:

1. **Circuit Breaker Errors**: 134 tracks (21.1%)
   - API rate limiting from Spotify/MusicBrainz
   - Services have likely recovered
   - **Action**: Already marked as retriable, will be auto-prioritized

2. **MusicBrainz 'id' Error**: 30 tracks (4.7%)
   - Fixed in commit `9436d74` (handle recordings without 'id' field)
   - **Action**: ✅ Just marked as retriable (retry_count reset to 0)
   - These should succeed on next enrichment cycle

**Total Retriable**: 164 tracks (25.8% of all failures)

### ❌ Non-Retriable Failures (471 tracks - 74.2%)

These are tracks where enrichment genuinely failed - no matching data found.

**Characteristics**:
- 95.9% have **no label hints** (609/635 total tracks)
- 4.1% have label hints (26 tracks) but still failed
- Many have "Unknown" as artist name

**Multi-Tier Resolution Opportunities**:
- **Tier 1 candidates**: 56 tracks (8.8%)
  - 26 with label hints → artist-label association lookup
  - 30 potential mashups → component resolution
- **Tier 2 candidates**: 471 tracks (74.2%)
  - Require external source queries (1001Tracklists, MixesDB, Discogs)

## Top Labels in Failed Tracks

Only 26 tracks (4.1%) have label information:

| Label | Count |
|:------|------:|
| Tinted | 2 |
| Spinnin' Deep | 2 |
| Cube | 2 |
| One | 1 |
| Higher Ground | 1 |
| Lovejuice | 1 |
| Insomniac | 1 |
| Popcultur | 1 |
| Cr2 | 1 |
| Elevation | 1 |

The low percentage of tracks with labels (4.1%) explains why many tracks fail enrichment - most metadata from scrapers lacks label information.

## Mashup Detection

**30 tracks (4.7%)** match mashup patterns (contains "vs" or "vs.")

Examples:
- Tracks like "Track1 vs Track2"
- Multi-artist mashups with "vs." separators

These are **perfect candidates** for the multi-tier resolver's mashup component resolution feature!

## Error Analysis

| Error Type | Count | Percentage | Action Required |
|:-----------|------:|-----------:|:----------------|
| Circuit Breaker (API Rate Limit) | 134 | 21.1% | ✅ Auto-retried (marked retriable) |
| MusicBrainz 'id' KeyError | 30 | 4.7% | ✅ Fixed + marked retriable |
| No matching data found | 471 | 74.2% | 🎯 Multi-tier resolver target |

## Recovery Strategy

### Phase 1: Automatic Recovery (Immediate)

The enrichment pipeline will automatically prioritize:
1. **164 retriable failures** (circuit breaker + 'id' errors)
2. These will be attempted **before** new pending tracks

Expected success rate: **~80-90%** for retriable failures

### Phase 2: Multi-Tier Resolution (Manual Trigger)

For the remaining 471 non-retriable failures:

```bash
# Trigger multi-tier resolution for 50 tracks
curl -X POST "http://localhost:8022/enrich/multi-tier-resolve?limit=50"
```

**Expected Results**:
- **Tier 1** (Internal DB): ~8-15% success (label hints + mashups)
- **Tier 2** (External APIs): ~20-35% additional success
- **Combined**: ~30-50% total recovery

**Why not higher?**
- 95.9% of failed tracks lack label hints
- Many tracks may have artist="Unknown" in external sources too
- Some tracks may be very obscure/unreleased

### Phase 3: Manual Intervention (Last Resort)

For tracks that fail both automatic recovery and multi-tier resolution:
- Manual research required
- Consider marking as "unidentifiable"
- Flag for later re-enrichment when more data becomes available

## Monitoring Commands

### Check Retriable Status
```bash
curl http://localhost:8022/stats | jq '.retriable_failures'
```

### Check Overall Enrichment Stats
```bash
curl http://localhost:8022/stats | jq '.enrichment_status'
```

### Reset Circuit Breaker for Specific Service
```bash
curl -X POST "http://localhost:8022/enrich/reset-circuit-breaker/spotify"
```

### Trigger Standard Enrichment (prioritizes retriable)
```bash
curl -X POST "http://localhost:8022/enrich/trigger?limit=100"
```

## Key Insights

1. **Circuit Breaker Recovery Working**: 134 tracks (21.1%) are correctly marked as retriable from previous API outages

2. **MusicBrainz Fix Applied**: 30 tracks with 'id' errors now marked retriable - should succeed next cycle

3. **Low Label Coverage**: Only 4.1% of failed tracks have label information, making internal resolution difficult

4. **Mashup Opportunity**: 30 tracks (4.7%) are mashups - perfect for the new mashup resolver feature

5. **External Sources Critical**: 74.2% of failures require external API queries (1001TL, MixesDB, Discogs)

6. **Self-Improving System**: Every successful external match from multi-tier resolver enriches the internal database, progressively reducing future failures

## Next Steps

1. ✅ **Automatic Recovery**: Already configured - next enrichment cycle will prioritize 164 retriable failures
2. 🎯 **Multi-Tier Resolution**: Trigger for remaining 471 failures to leverage external sources
3. 📊 **Monitor Results**: Track success rates to measure effectiveness
4. 🔄 **Feedback Loop**: Successful external matches will enrich internal DB for future lookups

## Files Generated

- **CSV Export**: `failed_tracks_analysis_20251006.csv` (635 tracks, 91KB)
- **Analysis Script**: `/tmp/analyze_failed.py`
- **This Report**: `FAILED_TRACKS_ANALYSIS.md`

---

**Analysis Date**: October 6, 2025
**Database Snapshot**: 635 failed tracks
**Retriable Failures**: 164 (25.8%)
**Multi-Tier Resolution Candidates**: 471 (74.2%)
