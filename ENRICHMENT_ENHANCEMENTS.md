# Enrichment System Enhancements - October 2025

This document describes three major architectural improvements to the metadata enrichment system, designed to address the core bottleneck identified in the Failed Tracks Analysis: **lack of metadata, specifically record labels**.

## Overview

The enhancements transform the enrichment system from a simple "resolve with available data" approach to an intelligent, multi-stage pipeline that:

1. **Finds missing metadata first** (Tier 0: Label Hunter)
2. **Uses behavioral intelligence** (Tier 2: Co-Occurrence Analyzer)
3. **Operates on music-industry time scales** (Cool-Down Queue)

---

## Enhancement 1: Label Hunter (Tier 0)

### Problem

**95.9% of failed tracks lack label information.** Without labels, our artist-label association logic (Tier 1) cannot function, forcing us to rely entirely on slower, rate-limited external APIs (Tier 2).

### Solution

The **Label Hunter** is a pre-enrichment module that runs BEFORE artist resolution to discover missing record labels.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Track: "Frozen Ground" (label = NULL)      │
└────────────────┬────────────────────────────┘
                 │
    ┌────────────▼───────────────┐
    │  Step 1: Parse Title       │
    │  Look for [Label] brackets │
    │  Example: "Track [Armada]" │
    └────────────┬───────────────┘
                 │ Not found
    ┌────────────▼───────────────┐
    │  Step 2: Search Beatport   │
    │  EDM specialist            │
    │  High-quality label data   │
    └────────────┬───────────────┘
                 │ Not found
    ┌────────────▼───────────────┐
    │  Step 3: Search Juno       │
    │  Broad coverage            │
    │  All genres                │
    └────────────┬───────────────┘
                 │ Found!
    ┌────────────▼───────────────┐
    │  Update metadata:          │
    │  label = "Anjunabeats"     │
    │  confidence = 0.85         │
    └────────────┬───────────────┘
                 │
    ┌────────────▼───────────────┐
    │  Now ready for Tier 1      │
    │  artist-label association  │
    └────────────────────────────┘
```

### Data Sources

1. **Title Parsing** (Confidence: 0.60-0.70)
   - Extracts labels from `[Label]` or `(Label)` brackets
   - Filters out non-label terms (e.g., "Original Mix", "feat.")
   - Fastest, no external API calls

2. **Beatport** (Confidence: 0.95)
   - EDM specialist
   - Excellent label metadata
   - Catalog numbers, release dates

3. **Juno Download** (Confidence: 0.90)
   - Broad genre coverage
   - Deep catalog
   - Good for underground tracks

4. **Traxsource** (Confidence: 0.85)
   - House/Techno specialist
   - Label-centric structure

### API Endpoint

```bash
# Find labels for 100 tracks without labels
curl -X POST "http://localhost:8022/enrich/hunt-labels?limit=100"
```

**Response**:
```json
{
  "status": "completed",
  "message": "Processed 100 tracks, found 73 labels",
  "stats": {
    "processed": 100,
    "labels_found": 73,
    "labels_updated": 73,
    "failed": 27,
    "skipped": 0
  },
  "success_rate": "73.0%"
}
```

### Expected Impact

**Current State** (from analysis):
- 26 tracks (4.1%) have label hints
- 609 tracks (95.9%) lack labels

**After Label Hunter**:
- Expected to find labels for ~60-75% of tracks without labels
- New Tier 1 candidates: 26 → ~400-500 tracks
- Reduces Tier 2 dependency by ~60%

### Implementation Files

- **`label_hunter.py`**: Core label discovery logic
- **`main.py`**: API endpoint `/enrich/hunt-labels`

---

## Enhancement 2: Co-Occurrence Analyzer (Tier 2)

### Problem

Even external sources like 1001Tracklists often list tracks as "Unknown" or "ID" (especially for promos and unreleased tracks). Simple string matching fails for these tracks.

### Solution

The **Co-Occurrence Analyzer** uses behavioral intelligence - analyzing CONTEXT rather than just direct matches. It answers: "What artists are consistently played near this unknown track?"

### How It Works

#### Input: Track Context from DJ Sets

```
DJ: Above & Beyond
Set: ABGT 500 London
Tracklist:
  1. Ilan Bluestone - Frozen Ground [Anjunabeats]
  2. ID - ID                              ← Our target
  3. Spencer Brown - Rainy Road [Anjunabeats]
```

#### Analysis: Four Signals

1. **Surrounding Artist Patterns**
   - Track appears between Ilan Bluestone and Spencer Brown
   - Both are Anjunabeats artists
   - Score: +0.5

2. **Label Consistency**
   - Surrounding tracks: Anjunabeats, Anjunabeats
   - 100% label consistency
   - Score: +0.3

3. **DJ Behavior**
   - Above & Beyond runs Anjunabeats label
   - Signature artists: Ilan Bluestone, Spencer Brown
   - Score: +0.2

4. **Position Patterns**
   - Mid-set (not opener/closer)
   - Typical position for label mates
   - Score: +0.1

#### Output: Probabilistic Artist Matches

```json
{
  "artist_name": "Ilan Bluestone",
  "probability": 0.87,
  "confidence": 0.75,
  "occurrence_count": 3,
  "label_support": "Anjunabeats",
  "evidence": [
    "Played after Ilan Bluestone in Above & Beyond's set",
    "Played before Spencer Brown in Above & Beyond's set",
    "Surrounded by Anjunabeats releases in 3 sets",
    "Played by Above & Beyond who runs Anjunabeats"
  ]
}
```

### Integration with 1001Tracklists

The analyzer extracts context from scraped tracklist data:

```python
from cooccurrence_analyzer import (
    CoOccurrenceAnalyzer,
    extract_contexts_from_1001tracklists
)

# Extract contexts from 1001TL data
contexts = await extract_contexts_from_1001tracklists(
    tracklist_data=raw_1001tl_data,
    target_track_title="ID - ID"
)

# Analyze
analyzer = CoOccurrenceAnalyzer()
probabilities = await analyzer.analyze_track_context(
    track_title="ID - ID",
    contexts=contexts
)

# Result: 87% probability it's Ilan Bluestone on Anjunabeats
```

### Probability Formula

```
P(artist) = (occurrence_score × 0.5) + (label_score × 0.3) + (dj_score × 0.2)

Where:
  - occurrence_score: How often artist appears near track (0.0-1.0)
  - label_score: Label consistency across contexts (0.0-1.0)
  - dj_score: DJ behavior signals (0.0-1.0)
```

### Minimum Thresholds

- **Minimum Probability**: 0.60 (60% confidence required)
- **Minimum Occurrences**: 2 sets (pattern must appear multiple times)

### Expected Impact

This solves the **"promo/unreleased track"** problem that plagues EDM enrichment:

- Promos played as "ID - ID" → Identified via context
- Unreleased tracks → Probable artist inferred
- Exclusive edits → Label/artist patterns reveal likely source

**Estimated improvement**: +20-35% success rate for "Unknown" artist tracks

### Implementation Files

- **`cooccurrence_analyzer.py`**: Core probabilistic matching logic
- **`multi_tier_artist_resolver.py`**: Integration point (Tier 2)

---

## Enhancement 3: Cool-Down Queue System

### Problem

A track that is unidentifiable TODAY might be identifiable in 3 months when it gets an official release. Marking it as "permanently failed" is a dead end that doesn't match how music releases work.

### Solution

The **Cool-Down Queue** implements a temporal retry strategy. Instead of marking tracks as failed permanently, they're placed in a queue with a future retry timestamp.

### Music Lifecycle Example

```
Day 0:   Track played as "ID - ID" in Above & Beyond's set
         ↓
Day 1:   System tries enrichment → Fails (no data available)
         ↓
Day 1:   → Placed in 90-day cool-down queue
         ↓
         ... 90 days pass ...
         ↓
Day 90:  System auto-retries enrichment
         ↓
Day 90:  Track now released on Beatport as:
         "Ilan Bluestone - Frozen Ground [Anjunabeats]"
         ↓
Day 90:  → Successfully enriched! 🎉
```

### Cool-Down Strategies

#### 1. Fixed Strategy
- Same period for all tracks (default: 90 days)
- Simple, predictable

#### 2. Exponential Backoff
- Increases with each retry: 30d → 60d → 120d → 240d
- Prevents wasting effort on truly unidentifiable tracks

#### 3. Adaptive Strategy (Default)
- Adjusts based on track characteristics:

```python
Base period: 90 days

Adjustments:
  - Has label hint?          → 60 days (labels release on schedules)
  - Track < 30 days old?     → 45 days (recent = likely to release soon)
  - Retry attempt 1?         → 90 days × 1.5 = 135 days
  - Retry attempt 2?         → 90 days × 2.0 = 180 days

Max cool-down: 365 days (1 year)
```

### Database Schema

New columns in `enrichment_status`:

```sql
ALTER TABLE enrichment_status
ADD COLUMN retry_after TIMESTAMP WITH TIME ZONE,      -- When to retry
ADD COLUMN cooldown_reason TEXT,                      -- Why it failed
ADD COLUMN cooldown_strategy VARCHAR(20);             -- Strategy used
```

New status: `pending_re_enrichment`

### API Endpoints

#### 1. Migrate Failed Tracks to Cool-Down

```bash
# Move 100 failed tracks to cool-down queue
curl -X POST "http://localhost:8022/enrich/cooldown/migrate?limit=100"
```

**Response**:
```json
{
  "status": "completed",
  "message": "Migrated 73 tracks to cool-down queue",
  "stats": {
    "candidates": 100,
    "migrated": 73,
    "skipped": 27
  }
}
```

Tracks are skipped if they've exceeded max retry attempts (5).

#### 2. Process Cool-Down Queue

```bash
# Retry tracks that have completed cool-down
curl -X POST "http://localhost:8022/enrich/cooldown/process?limit=50"
```

**Response**:
```json
{
  "status": "completed",
  "message": "Reset 42 tracks to pending",
  "stats": {
    "retrieved": 42,
    "reset_to_pending": 42,
    "enrichment_triggered": 0,
    "failed": 0
  },
  "note": "Tracks reset to pending will be processed in next enrichment cycle"
}
```

#### 3. Get Cool-Down Statistics

```bash
curl http://localhost:8022/enrich/cooldown/stats
```

**Response**:
```json
{
  "status": "success",
  "cooldown_queue": {
    "total_in_queue": 156,
    "ready_for_retry": 23,
    "waiting": 133,
    "next_retry_time": "2025-11-15T14:30:00Z",
    "avg_retry_attempts": 1.3
  }
}
```

### Database Views and Functions

**View**: `cooldown_queue_summary`
```sql
SELECT * FROM cooldown_queue_summary;
```

| strategy | track_count | ready_now | waiting | avg_retry_attempts |
|:---------|------------:|----------:|--------:|-------------------:|
| adaptive | 120 | 18 | 102 | 1.2 |
| fixed | 36 | 5 | 31 | 1.5 |

**Function**: `get_cooldown_tracks_ready()`
```sql
SELECT * FROM get_cooldown_tracks_ready(100);
```

Returns tracks ready for retry with cool-down period details.

### Automated Retry Workflow

**Recommended Cron Job**:
```bash
# Daily at 3:00 AM: Process cool-down queue
0 3 * * * curl -X POST http://localhost:8022/enrich/cooldown/process?limit=100

# Then trigger standard enrichment (will process the reset tracks)
5 3 * * * curl -X POST http://localhost:8022/enrich/trigger?limit=200
```

### Expected Impact

- **No more permanently failed tracks** (until max retries exceeded)
- **Automatic recovery** as music industry releases data
- **Matches DJ workflow**: Promo → ID → Release → Identified
- **Estimated recovery**: 15-25% of "failed" tracks over 6-12 months

### Implementation Files

- **`cooldown_queue.py`**: Core queue management logic
- **`migrations/008_cooldown_queue_up.sql`**: Database schema
- **`main.py`**: API endpoints for queue management

---

## Complete Enrichment Flow (All Enhancements Integrated)

```
┌─────────────────────────────────────────────────────────────┐
│  NEW TRACK: "Frozen Ground" (artist=Unknown, label=NULL)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────▼───────────────┐
          │  TIER 0: Label Hunter      │
          │  Find missing label        │
          │  Sources: Title, Beatport  │
          └────────────┬───────────────┘
                       │ Found: "Anjunabeats"
          ┌────────────▼───────────────┐
          │  TIER 1: Internal DB       │
          │  Artist-label association  │
          │  Mashup component lookup   │
          └────────────┬───────────────┘
                       │ ❌ Not found
          ┌────────────▼───────────────┐
          │  TIER 2: External Sources  │
          │  + Co-Occurrence Analysis  │
          │  1001TL context patterns   │
          └────────────┬───────────────┘
                       │ ✅ Found: "Ilan Bluestone" (87% prob)
          ┌────────────▼───────────────┐
          │  TIER 3: Feedback Loop     │
          │  Update track              │
          │  Enrich internal DB        │
          └────────────┬───────────────┘
                       │
                   SUCCESS!
```

**If ALL tiers fail**:
```
          ┌────────────▼───────────────┐
          │  Cool-Down Queue           │
          │  Status: pending_re_enrich │
          │  Retry after: 90 days      │
          └────────────┬───────────────┘
                       │
              ... 90 days later ...
                       │
          ┌────────────▼───────────────┐
          │  AUTO-RETRY                │
          │  (Track may be released)   │
          └────────────────────────────┘
```

---

## Performance Expectations

### Before Enhancements (Current State)

| Metric | Value |
|:-------|------:|
| Failed tracks | 635 |
| Tracks with labels | 26 (4.1%) |
| Retriable failures | 164 (25.8%) |
| Non-retriable | 471 (74.2%) |

### After Enhancements (Projected)

**Phase 1: Label Hunter**
- Run on 609 tracks without labels
- Expected to find ~400-450 labels (65-75% success)
- New Tier 1 candidates: 26 → 450-500

**Phase 2: Multi-Tier + Co-Occurrence**
- Run on remaining ~160-200 tracks
- Tier 1 (with new labels): +150-200 successes
- Tier 2 (with co-occurrence): +50-80 successes
- Total new successes: ~200-280 tracks

**Phase 3: Cool-Down Queue**
- Move remaining ~190-270 failures to queue
- Expected recovery over 6-12 months: 30-70 tracks
- Truly unidentifiable: ~120-240 tracks

**Final Projected State**:

| Metric | Current | Projected | Improvement |
|:-------|--------:|----------:|------------:|
| Success rate | 71.3% | 85-90% | +14-19% |
| Failed tracks | 635 | 120-240 | -62-81% |
| Permanently failed | 635 | 30-50 | -92-95% |

---

## Implementation Checklist

### 1. Database Migration

```bash
# Apply cool-down queue schema
docker compose exec postgres psql -U musicdb_user -d musicdb \
  -f /migrations/008_cooldown_queue_up.sql
```

### 2. Deploy Updated Service

```bash
# Rebuild metadata-enrichment service with new modules
docker compose build metadata-enrichment
docker compose up -d metadata-enrichment
```

### 3. Initial Label Hunting

```bash
# Run label hunter on all tracks without labels
curl -X POST "http://localhost:8022/enrich/hunt-labels?limit=500"
```

### 4. Multi-Tier Resolution

```bash
# Resolve artists for tracks (now with labels!)
curl -X POST "http://localhost:8022/enrich/multi-tier-resolve?limit=100"
```

### 5. Migrate to Cool-Down

```bash
# Move remaining failures to cool-down queue
curl -X POST "http://localhost:8022/enrich/cooldown/migrate?limit=500"
```

### 6. Setup Cron Jobs

Add to system crontab:
```bash
# Daily cool-down processing + enrichment
0 3 * * * curl -X POST http://localhost:8022/enrich/cooldown/process?limit=100
5 3 * * * curl -X POST http://localhost:8022/enrich/trigger?limit=200

# Weekly label hunting
0 2 * * 0 curl -X POST http://localhost:8022/enrich/hunt-labels?limit=500
```

---

## Monitoring

### Dashboard Metrics

1. **Label Coverage**:
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE metadata->'original_data'->>'label' IS NOT NULL) as with_label,
     COUNT(*) as total,
     (COUNT(*) FILTER (WHERE metadata->'original_data'->>'label' IS NOT NULL) * 100.0 / COUNT(*)) as percentage
   FROM tracks;
   ```

2. **Cool-Down Queue Health**:
   ```bash
   curl http://localhost:8022/enrich/cooldown/stats
   ```

3. **Enrichment Success Rate Trend**:
   ```sql
   SELECT
     DATE(updated_at) as date,
     COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
   FROM enrichment_status
   GROUP BY DATE(updated_at)
   ORDER BY date DESC
   LIMIT 30;
   ```

---

## Summary

These three enhancements transform the enrichment system from reactive to proactive:

1. **Label Hunter (Tier 0)**: Finds missing metadata FIRST
   - Addresses the 95.9% label scarcity problem
   - Enables Tier 1 internal resolution
   - Reduces external API dependency

2. **Co-Occurrence Analyzer (Tier 2)**: Uses behavioral intelligence
   - Solves the "Unknown/ID" track problem
   - Leverages DJ community knowledge
   - Probabilistic matching for promos

3. **Cool-Down Queue**: Operates on music industry timescales
   - No more permanent failures
   - Automatic retry as releases appear
   - Matches how DJs actually work (promo → ID → release)

**Expected Overall Impact**: +14-19% success rate, 62-81% reduction in failed tracks.
