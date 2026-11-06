# SongNodes: Architectural Enhancements, Critical Gaps & Proposed Modules

**Document Reference:** `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`  
**Accompanying Diagram:** `documentation/data-flow-analysis/enhanced-architecture-connections-and-gaps.svg`  
**Date:** 2026-11-07T09:05:00+11:00  
**Status:** Approved Architectural Recommendation

---

## 1. Critical Data Gaps Analysis

The investigation identified 5 architectural gaps where data flow loops are broken, data is orphaned, or synchronization is decoupled:

### GAP-01: Disconnected Rekordbox Booth Performance Feedback Loop
- **Severity:** High
- **Domain:** Floor Execution -> Silver Ingestion
- **Current State:** DJ setlists are exported from SongNodes as Rekordbox XML files (`outputs/rekordbox_musicLibrary.xml`), but the actual gig performance data (which tracks were played, at what time, transition order in the booth) is trapped in Pioneer `history.txt` / `HISTORY.m3u8` USB files and never returns to SongNodes.
- **Consequence:** Live transitions proven on club sound systems do not increment `occurrence_count` in `silver_track_transitions`; rotation decay algorithms cannot observe real play history.
- **Technical Fix:** Implement `MOD-01` Booth History Ingester (`services/library/booth_history.py` and `/sets/history` UI route) to ingest Pioneer `HISTORY.m3u8` files, match track titles against silver records, advance rotation decay timers, and commit verified live transitions.
- **Data Contract:**
```json
{
  "schema": "songnodes.booth_history",
  "version": "1.0.0",
  "venue": "Club 77 (Sydney)",
  "set_date": "2026-11-06T23:30:00+11:00",
  "transitions": [
    {"from_id": "trk_01HF9Z", "to_id": "trk_02KJ8X", "played_at": "2026-11-06T23:36:12+11:00", "duration_sec": 348}
  ]
}
```

### GAP-02: Dual Storage Disconnect (PostgreSQL library.* vs SQLite dj_library.sqlite)
- **Severity:** High
- **Domain:** Storage Architecture & Curation
- **Current State:** The weekly automated pipeline writes to SQLite (`dj_library.sqlite`), while SongNodes REST API writes to PostgreSQL `library.*`. The sync script `sync-music-library.sh` only synchronizes a static JSON file (`data/music-library.json`).
- **Consequence:** Curator tag edits or crate adjustments made in the web UI do not propagate back to the weekly SQLite ledger, risking split-brain divergence.
- **Technical Fix:** Deploy `MOD-03` Bi-Directional Library Bridge (`services/library/bridge.py`) enforcing single-writer distributed leases and SHA-256 table checksum verification.
- **Data Contract:**
```json
{
  "schema": "songnodes.library_sync",
  "version": "1.0.0",
  "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "reconciled_at": "2026-11-07T08:00:00+11:00",
  "mutations": [
    {"table": "track_tags", "action": "INSERT", "key": "trk_01HF9Z", "data": {"tag": "peak_weapon"}}
  ]
}
```

### GAP-03: Missing Audio Fingerprint & AcoustID Transition Segmenter
- **Severity:** Medium
- **Domain:** Audio Telemetry & Verification
- **Current State:** Track pairings rely exclusively on scraped textual tracklists. Recorded DJ audio mixes and radio broadcasts cannot be automatically segmented or verified against acoustic fingerprints.
- **Consequence:** Un-tracklisted DJ sets and radio broadcasts cannot be mined for transitions; track version mismatches (Dub vs Vocal) cannot be acoustically validated.
- **Technical Fix:** Deploy Essentia / Chromaprint Audio Segmenter worker (`services/audio-analysis/segmenter.py`) that detects transition crossfades and queries AcoustID for automated setlist synthesis.

### GAP-04: Unwired Scraper Target Queue Feedback
- **Severity:** Medium
- **Domain:** Demand Ingestion -> Unified Scrapers
- **Current State:** Curators add target artists in `/library` or `/sources/targets`, which writes to `target_tracks` in PostgreSQL. However, the standalone `musicLibrary` pipeline reads `config/sources.json` and does not poll this queue.
- **Consequence:** High-priority targets added by curators sit idle until manually dispatched in SongNodes.
- **Technical Fix:** Wire `ML-TASK-03` cron script synchronising PostgreSQL `target_tracks` directly into the weekly runner.

### GAP-05: Outbox Projection Lag Invisibility
- **Severity:** Low
- **Domain:** Pipeline Telemetry -> Web Client
- **Current State:** Graph projection (`projection_consume`) polls PostgreSQL outbox every 15 seconds. During bulk scraping, projection lags behind silver ingestion with no UI freshness indicator.
- **Consequence:** Selectors may query transition routes on `/paths` that omit transitions currently pending in the projection queue.
- **Technical Fix:** Add WebSocket / SSE notification stream on `/api/v1/outbox/status` broadcasting active projection lag with a non-intrusive `FreshnessStamp` pill.

---

## 2. Proposed Single-Purpose Modules (<500 LOC)

All proposed modules strictly follow the One Job Rule, have an explicit diff budget (<500 LOC), and conform 100% to the SongNodes Design System:

| Module Identifier | Module Name & File Path | Target Users | 1 Verb | Est. LOC | Core Operation & Contract |
|---|---|---|---|---|---|
| **MOD-01** | **Booth History Ingester**<br>`services/library/booth_history.py` | Performing DJ, Curator | **Harvest** | ~340 LOC | Ingests Pioneer `HISTORY.m3u8` files, matches track titles against silver records, advances rotation decay timers, and commits verified live transitions. |
| **MOD-02** | **Realtime Graph Outbox Daemon**<br>`services/graph-projection/sync_daemon.py` | Platform Admin, Graph Engineer | **Stream** | ~280 LOC | Replaces 15s polling projection with sub-second event-driven Bolt synchronization directly updating Memgraph nodes and edges. |
| **MOD-03** | **Bi-Directional Library Bridge**<br>`services/library/bridge.py` | Curator, Data Pipeline Engineer | **Reconcile** | ~410 LOC | Enforces single-writer locks, compares table checksums, bi-directionally syncs crate memberships and user tags, and exports fresh static JSON. |
| **MOD-04** | **Audio Preview Caching Proxy**<br>`services/rest_api/routers/audio_cache.py` | Performing DJ, Selector | **Cache** | ~290 LOC | Caches 30s preview audio files on disk, generates waveform peak JSON arrays, and streams audio offline with zero external network latency. |

---

## 3. Proposed Unified Storage Directory Backbone

To eliminate fragmented storage paths across `E:\musicLibrary`, `services/`, and `frontend/public/data/`, the following unified volume backbone is proposed:

```
/var/songnodes/
├── bronze/                 # Immutable JSONL raw scraper captures (1..N)
│   ├── 1001tracklists/
│   ├── mixesdb/
│   └── radio_broadcasts/
├── silver/                 # Normalized evidence ledger & snapshots
│   ├── consensus_ledger/
│   └── entity_redirects/
├── library/                # Curated DJ crates & SQLite mirror
│   ├── dj_library.sqlite
│   ├── crates/
│   └── overrides/
├── audio/                  # 30-second preview cache & waveforms
│   ├── cache/
│   └── waveforms/
└── exports/                # Generated timestamped gig bundles
    ├── rekordbox/
    ├── tidal_sync/
    └── csv/
```

*All volume paths support atomic file operations and continuous snapshotting.*
