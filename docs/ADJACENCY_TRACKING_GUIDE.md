# Track Adjacency Tracking: Complete Guide

**How SongNodes Captures and Stores Track Transitions for DJ Mixing Recommendations**

---

## ✅ YES - Adjacency Information IS Captured and Stored

As of **Migration 006**, SongNodes now has comprehensive adjacency/edge tracking infrastructure in place.

---

## What Gets Captured

### **Every Sequential Track Transition**

When tracks are scraped from playlists/mixes, the system captures:

```
Playlist: "Pete Tong Essential Mix 2010-11-05"

Position 14: Deadmau5 - Strobe
Position 15: Swedish House Mafia - One          ◄─── EDGE CAPTURED
Position 16: Eric Prydz - Pjanoo               ◄─── EDGE CAPTURED
Position 17: Armin van Buuren - Shivers        ◄─── EDGE CAPTURED
```

**3 Edges Created:**
1. `Strobe → One` (occurrence #1)
2. `One → Pjanoo` (occurrence #1)
3. `Pjanoo → Shivers` (occurrence #1)

---

## Database Storage

### **Table: `silver_track_transitions`**

This table stores **every unique track-to-track transition** as a bidirectional edge.

```sql
┌──────────────────────────────────────────────────────────────────┐
│ silver_track_transitions                                          │
├──────────────────────────────────────────────────────────────────┤
│ id                       UUID (primary key)                       │
│                                                                   │
│ ┌─ EDGE DEFINITION ─────────────────────────────────────────┐    │
│ │ from_track_id          UUID → silver_enriched_tracks      │    │
│ │ to_track_id            UUID → silver_enriched_tracks      │    │
│ └───────────────────────────────────────────────────────────┘    │
│                                                                   │
│ ┌─ OCCURRENCE TRACKING ─────────────────────────────────────┐    │
│ │ occurrence_count       INTEGER (how many times seen)      │    │
│ │ first_seen             TIMESTAMP                          │    │
│ │ last_seen              TIMESTAMP                          │    │
│ └───────────────────────────────────────────────────────────┘    │
│                                                                   │
│ ┌─ CONTEXT TRACKING ────────────────────────────────────────┐    │
│ │ playlist_occurrences   JSONB[]                            │    │
│ │   [                                                       │    │
│ │     {                                                     │    │
│ │       "playlist_id": "uuid",                              │    │
│ │       "position": 15,                                     │    │
│ │       "date": "2025-10-10"                                │    │
│ │     },                                                    │    │
│ │     {...another occurrence...}                            │    │
│ │   ]                                                       │    │
│ └───────────────────────────────────────────────────────────┘    │
│                                                                   │
│ ┌─ TRANSITION QUALITY METRICS ──────────────────────────────┐    │
│ │ avg_bpm_difference          FLOAT                         │    │
│ │ avg_key_compatibility       FLOAT (0-1)                   │    │
│ │ avg_energy_difference       FLOAT                         │    │
│ │ avg_transition_duration_ms  INTEGER                       │    │
│ │ transition_quality_score    FLOAT (0-1)                   │    │
│ └───────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### **Example Record**

```sql
id:                     550e8400-e29b-41d4-a716-446655440000
from_track_id:          deadmau5-strobe-uuid
to_track_id:            swedish-house-mafia-one-uuid

-- How many times this transition appears
occurrence_count:       23

-- Context: Which playlists contain this transition
playlist_occurrences:   [
                          {
                            "playlist_id": "pete-tong-essential-mix-uuid",
                            "position": 14,
                            "date": "2010-11-05"
                          },
                          {
                            "playlist_id": "above-beyond-group-therapy-uuid",
                            "position": 8,
                            "date": "2011-03-12"
                          },
                          ...21 more occurrences...
                        ]

-- Transition Quality Metrics
avg_bpm_difference:     2.5           ◄─── Strobe (128) → One (130.5)
avg_key_compatibility:  0.9           ◄─── 8A → 9A (adjacent key)
avg_energy_difference:  0.08          ◄─── 0.76 → 0.84 (energy boost)
transition_quality_score: 0.87        ◄─── EXCELLENT transition

first_seen:             2010-11-05
last_seen:              2025-10-10
```

---

## How Adjacency is Captured During Scraping

### **Automatic Population from Playlists**

```
┌─────────────────────────────────────────────────────────────┐
│ SCRAPING WORKFLOW                                            │
└─────────────────────────────────────────────────────────────┘

1. Spider scrapes playlist:
   ─────────────────────────
   URL: 1001tracklists.com/tracklist/essential-mix-2010/

   Extracted Tracks:
   Position 1:  Track A
   Position 2:  Track B  ◄─── Edge: A → B
   Position 3:  Track C  ◄─── Edge: B → C
   Position 4:  Track D  ◄─── Edge: C → D

   ▼

2. Persistence Pipeline saves to silver_playlist_tracks:
   ────────────────────────────────────────────────────
   INSERT INTO silver_playlist_tracks (playlist_id, track_id, position)
   VALUES
     ('playlist-uuid', 'track-a-uuid', 1),
     ('playlist-uuid', 'track-b-uuid', 2),
     ('playlist-uuid', 'track-c-uuid', 3),
     ('playlist-uuid', 'track-d-uuid', 4);

   ▼

3. Automatic edge extraction (via trigger or batch job):
   ────────────────────────────────────────────────────
   SELECT
     pt1.track_id as from_track,
     pt2.track_id as to_track,
     pt1.playlist_id,
     pt1.position
   FROM silver_playlist_tracks pt1
   JOIN silver_playlist_tracks pt2
     ON pt1.playlist_id = pt2.playlist_id
     AND pt2.position = pt1.position + 1

   Results in 3 edges:
   ├─ A → B
   ├─ B → C
   └─ C → D

   ▼

4. Insert/Update silver_track_transitions:
   ────────────────────────────────────────
   For each edge (A → B):

   INSERT INTO silver_track_transitions (
     from_track_id, to_track_id, occurrence_count, playlist_occurrences
   ) VALUES (
     'track-a-uuid',
     'track-b-uuid',
     1,
     '[{"playlist_id": "playlist-uuid", "position": 1}]'
   )
   ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
     occurrence_count = silver_track_transitions.occurrence_count + 1,
     playlist_occurrences = silver_track_transitions.playlist_occurrences ||
       '[{"playlist_id": "playlist-uuid", "position": 1}]',
     last_seen = NOW();

   ▼

5. Calculate transition quality:
   ─────────────────────────────
   - Fetch BPM, key, energy from both tracks
   - Calculate compatibility scores
   - Update transition_quality_score field
```

---

## Graph Visualization Data

### **Gold Layer: Pre-computed Adjacency Lists**

For fast graph rendering, the system maintains a **materialized view**:

```sql
CREATE MATERIALIZED VIEW gold_track_graph AS
SELECT
    from_track_id as track_id,

    -- Outgoing edges as JSON array
    jsonb_agg(
        jsonb_build_object(
            'to_track_id', to_track_id,
            'occurrence_count', occurrence_count,
            'quality_score', transition_quality_score,
            'bpm_diff', avg_bpm_difference,
            'key_compat', avg_key_compatibility
        )
        ORDER BY occurrence_count DESC
    ) as outgoing_edges,

    COUNT(*) as total_outgoing_edges,
    AVG(transition_quality_score) as avg_outgoing_quality

FROM silver_track_transitions
WHERE transition_quality_score >= 0.5  -- Filter low-quality edges
GROUP BY from_track_id;
```

### **Example Adjacency List**

```json
{
  "track_id": "deadmau5-strobe-uuid",
  "outgoing_edges": [
    {
      "to_track_id": "swedish-house-mafia-one-uuid",
      "occurrence_count": 23,
      "quality_score": 0.87,
      "bpm_diff": 2.5,
      "key_compat": 0.9
    },
    {
      "to_track_id": "eric-prydz-pjanoo-uuid",
      "occurrence_count": 18,
      "quality_score": 0.82,
      "bpm_diff": 4.0,
      "key_compat": 0.85
    },
    {
      "to_track_id": "deadmau5-ghosts-n-stuff-uuid",
      "occurrence_count": 15,
      "quality_score": 0.95,
      "bpm_diff": 0.0,
      "key_compat": 1.0
    }
  ],
  "total_outgoing_edges": 3,
  "avg_outgoing_quality": 0.88
}
```

---

## Query Examples

### **1. Find Top Transitions for a Track**

```sql
SELECT
    from_track.artist_name || ' - ' || from_track.track_title as "Current Track",
    to_track.artist_name || ' - ' || to_track.track_title as "Next Track",
    tr.occurrence_count as "Times Used",
    tr.transition_quality_score as "Quality",
    tr.avg_bpm_difference as "BPM Δ",
    tr.avg_key_compatibility as "Key Match"

FROM silver_track_transitions tr
JOIN silver_enriched_tracks from_track ON from_track.id = tr.from_track_id
JOIN silver_enriched_tracks to_track ON to_track.id = tr.to_track_id

WHERE from_track.track_title ILIKE '%strobe%'
  AND from_track.artist_name ILIKE '%deadmau5%'

ORDER BY tr.occurrence_count DESC
LIMIT 10;
```

**Result:**
```
Current Track          | Next Track                    | Times Used | Quality | BPM Δ | Key Match
-----------------------+-------------------------------+------------+---------+-------+----------
Deadmau5 - Strobe     | Swedish House Mafia - One     | 23         | 0.87    | 2.5   | 0.9
Deadmau5 - Strobe     | Eric Prydz - Pjanoo           | 18         | 0.82    | 4.0   | 0.85
Deadmau5 - Strobe     | Deadmau5 - Ghosts n Stuff     | 15         | 0.95    | 0.0   | 1.0
```

### **2. Get Graph Data for Visualization**

```sql
-- Get nodes (tracks)
SELECT
    id as node_id,
    artist_name,
    track_title,
    bpm,
    key,
    energy,
    data_quality_score
FROM silver_enriched_tracks
WHERE data_quality_score >= 0.7
LIMIT 1000;

-- Get edges (transitions)
SELECT
    from_track_id as source,
    to_track_id as target,
    occurrence_count as weight,
    transition_quality_score as quality,
    avg_bpm_difference as bpm_diff,
    avg_key_compatibility as key_compat
FROM silver_track_transitions
WHERE transition_quality_score >= 0.5
  AND occurrence_count >= 3
ORDER BY occurrence_count DESC
LIMIT 5000;
```

### **3. Find Harmonic Mixing Paths**

```sql
-- Find 3-track mixing sequences with high quality
WITH track_a AS (
    SELECT id FROM silver_enriched_tracks
    WHERE track_title ILIKE '%strobe%'
    LIMIT 1
),
track_b_options AS (
    SELECT
        tr.to_track_id,
        tr.occurrence_count,
        tr.transition_quality_score
    FROM silver_track_transitions tr
    WHERE tr.from_track_id = (SELECT id FROM track_a)
      AND tr.transition_quality_score >= 0.8
    ORDER BY tr.occurrence_count DESC
    LIMIT 10
),
track_c_options AS (
    SELECT
        tb.to_track_id as track_b_id,
        tr.to_track_id as track_c_id,
        tb.transition_quality_score as quality_a_b,
        tr.transition_quality_score as quality_b_c,
        (tb.transition_quality_score + tr.transition_quality_score) / 2 as avg_quality
    FROM track_b_options tb
    JOIN silver_track_transitions tr ON tr.from_track_id = tb.to_track_id
    WHERE tr.transition_quality_score >= 0.8
)
SELECT
    ta.artist_name || ' - ' || ta.track_title as "Track A",
    tb.artist_name || ' - ' || tb.track_title as "Track B",
    tc.artist_name || ' - ' || tc.track_title as "Track C",
    tc_opt.quality_a_b as "A→B Quality",
    tc_opt.quality_b_c as "B→C Quality",
    tc_opt.avg_quality as "Avg Quality"
FROM track_c_options tc_opt
JOIN silver_enriched_tracks ta ON ta.id = (SELECT id FROM track_a)
JOIN silver_enriched_tracks tb ON tb.id = tc_opt.track_b_id
JOIN silver_enriched_tracks tc ON tc.id = tc_opt.track_c_id
ORDER BY tc_opt.avg_quality DESC
LIMIT 20;
```

---

## Transition Quality Calculation

### **Composite Quality Score**

```python
transition_quality_score = (
    bpm_compatibility × 0.4 +
    key_compatibility × 0.4 +
    energy_flow × 0.2
)

# BPM Compatibility (0-1 scale)
bpm_diff = abs(from_track.bpm - to_track.bpm)
bpm_compatibility = 1.0 - min(bpm_diff / 20.0, 1.0)
# Perfect (0 BPM diff) = 1.0
# Good (≤5 BPM diff) = 0.75+
# Poor (>20 BPM diff) = 0.0

# Key Compatibility (Camelot Wheel)
if from_key == to_key:
    key_compatibility = 1.0          # Perfect match
elif abs(from_key - to_key) == 1:
    key_compatibility = 0.9          # Adjacent key
elif (from_key % 12 + 1) == to_key:
    key_compatibility = 0.85         # Energy boost
elif abs(from_key - to_key) == 7:
    key_compatibility = 0.8          # Relative major/minor
else:
    key_compatibility = 0.3          # Dissonant

# Energy Flow (0-1 scale)
energy_diff = abs(from_track.energy - to_track.energy)
energy_flow = 1.0 - energy_diff
# Smooth transition (small diff) = 1.0
# Energy boost acceptable = 0.7+
# Large drop problematic = 0.3
```

**Example:**
```
From: Deadmau5 - Strobe (128 BPM, Key 8A, Energy 0.76)
To:   Swedish House Mafia - One (130.5 BPM, Key 9A, Energy 0.84)

BPM Compatibility: 1.0 - (2.5 / 20) = 0.875
Key Compatibility: 0.9 (adjacent key)
Energy Flow: 1.0 - 0.08 = 0.92

Quality Score: (0.875 × 0.4) + (0.9 × 0.4) + (0.92 × 0.2)
             = 0.35 + 0.36 + 0.184
             = 0.894 ≈ 0.89 (Excellent ✅)
```

---

## Integration with Frontend Graph

### **React/PIXI.js Data Structure**

```typescript
// Fetch graph data for visualization
const graphData = {
  nodes: await fetch('/api/tracks?limit=1000'),  // Track nodes
  edges: await fetch('/api/transitions?min_quality=0.5')  // Adjacency edges
};

// Transform for PIXI.js
const nodes = graphData.nodes.map(track => ({
  id: track.id,
  label: `${track.artist_name} - ${track.track_title}`,
  bpm: track.bpm,
  key: track.key,
  energy: track.energy,
  x: Math.random() * width,  // Force-directed layout will adjust
  y: Math.random() * height
}));

const edges = graphData.edges.map(transition => ({
  source: transition.from_track_id,
  target: transition.to_track_id,
  weight: transition.occurrence_count,
  quality: transition.transition_quality_score,
  color: getColorForQuality(transition.transition_quality_score),
  thickness: Math.log(transition.occurrence_count) * 2
}));

// Render with D3 force-directed layout + PIXI.js
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter(width / 2, height / 2));
```

---

## Current Status

### ✅ **Infrastructure Ready**

- [x] **silver_track_transitions** table created
- [x] **gold_track_graph** materialized view created
- [x] **Automatic quality calculation** functions created
- [x] **Triggers** for auto-update when track metadata changes
- [x] **Migration** includes automatic population from existing playlists

### 📊 **Data Status**

**Current:** 0 edges (waiting for playlist data)

**What happens when you scrape playlists:**

1. ✅ Tracks saved to `silver_enriched_tracks`
2. ✅ Playlist structure saved to `silver_playlist_tracks` (with position)
3. ✅ **Edges automatically extracted** from sequential positions
4. ✅ **Adjacency data populated** in `silver_track_transitions`
5. ✅ **Quality scores calculated** based on BPM/key/energy
6. ✅ **Graph view refreshed** for instant visualization

---

## Summary

### **YES - Adjacency is Fully Captured**

| What | How | Where |
|:-----|:----|:------|
| **Sequential positions** | Scraped from playlists | `silver_playlist_tracks.position` |
| **Track-to-track edges** | Extracted from positions | `silver_track_transitions` (from → to) |
| **Occurrence counts** | Incremented on duplicate | `occurrence_count` field |
| **Context** | Playlist IDs + positions | `playlist_occurrences` JSONB |
| **Quality metrics** | Auto-calculated | `transition_quality_score` (0-1) |
| **Graph adjacency lists** | Pre-computed | `gold_track_graph` materialized view |

### **Primary Data for DJ Mixing:**
- ✅ **Edges** (which tracks follow which)
- ✅ **Weight** (how often transition appears)
- ✅ **Quality** (BPM/key/energy compatibility)
- ✅ **Context** (which playlists/DJs used it)

**Your node graph has all the data it needs to display meaningful connections!** 🎯
