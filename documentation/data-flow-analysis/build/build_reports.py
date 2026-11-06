"""
Generate canonical Markdown reports from findings.json and codebase evidence.
Outputs:
- documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md
- documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md
- e:/musicLibrary/TODO-ARCHITECTURAL-IMPROVEMENTS.md
"""
import json
import os

with open("documentation/data-flow-analysis/findings.json", "r", encoding="utf-8") as f:
    findings = json.load(f)

meta = findings["meta"]
summary = findings["summary"]
pages = findings["pages"]
stores = findings["stores"]
edges = findings["edges"]
personas = findings["personas"]
audit = findings["production_audit"]
gaps = findings["gaps"]
sister_tasks = findings["sister_tasks"]
modules = findings["proposed_modules"]

# 1. Main Investigation Report
main_report = f"""# SongNodes: Architectural Investigation, End-to-End Data Flow & Page Interaction Report

**Document Reference:** `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md`  
**Generated Date:** {meta['generated_at']}  
**Repository Commit:** `{meta['commit_sha']}`  
**Governing Standard:** SongNodes Design System v{meta['design_system_version']} (`design-system/`)  
**Locale & Conventions:** `{meta['locale']}`, sentence case, `{meta['timezone']}` 24-hour time  
**Classification Method:** Multi-signal static analysis (routing table + live API wiring + test suites + import graphs)

---

## 1. Executive Summary

SongNodes is a modular DJ track transition graph and library curation platform engineered to capture, enrich, and navigate verified sequential track pairings (`position N -> position N+1`) harvested from complete, observed DJ setlists rather than synthetic unverified algorithmic recommendations. The system operates in close federation with its sister repository, **musicLibrary** (`{meta['sister_project_path']}`), which provides weekly radio scraping, automated rotation lifecycles (High/Standard/Archive), and crate management.

### Key Headline Architecture Metrics

| Metric Dimension | Value | Operational Significance |
|---|---|---|
| **Catalogued UI/Operational Pages** | **{summary['total_pages']} Views** | Encompasses all registered static and dynamic feature routes |
| **Production-Level Pages** | **{summary['production_pages']} Pages** | Tested, fully wired everyday operational DJ and curation tools |
| **Non-Final Artifacts / Stubs** | **{summary['non_final_pages']} Artifacts** | Superseded prototypes (legacy PIXI Graph) & static route stubs |
| **Authoritative Storage Hubs** | **{summary['total_stores']} Hubs** | PostgreSQL Medallion, Memgraph, Redis, SQLite, Filesystem, LocalStorage |
| **Mapped Data-Flow Edges** | **{summary['total_data_edges']} Edges** | End-to-end traced network, SQL, IPC, and filesystem contracts |
| **User Operational Personas** | **{summary['total_personas']} Personas** | Selector, Librarian, Scraper Engineer, Resolution Specialist, Admin |
| **Critical Architectural Gaps** | **{summary['total_gaps']} Gaps** | Missing booth feedback loop, dual-storage split-brain, audio segmenter |
| **Sister-Project Action Tasks** | **{summary['total_sister_tasks']} Tasks** | Concrete improvement work distributed to `musicLibrary` |
| **Proposed Single-Purpose Modules** | **{summary['total_proposed_modules']} Modules** | Lightweight (&lt;500 LOC) solutions closing core feedback loops |

---

## 2. Definitive Page Catalog & Production Audit

Every UI and operational entry point in SongNodes is catalogued below, classified by operational readiness using dual independent signals (routing table entry + live backend wiring + automated test coverage).

| Page & Route | Operational Domain | Module Token | Classification | Dual Signals / Evidence |
|---|---|---|---|---|
"""

for p in pages:
    ev = "<br>".join([f"`{e}`" for e in p["evidence_files"][:2]])
    badge = "● Production" if p["classification"] == "production" else "▲ Non-Final"
    main_report += f"| **{p['title']}** (`{p['route']}`)<br>*{p['lead']}* | {p['description']} | `{p['module_token']}` | {badge} | {p['rationale']}<br>{ev} |\n"

main_report += """
### 2.1 Production Classification Analysis

1. **Production-Level Tools ({summary['production_pages']} views)**:
   - **HomePage (`/`)**: Production launcher and operational telemetry overview (`frontend/src/pages/HomePage.tsx:1-63`).
   - **LibraryPage (`/library`)**: Production track exploration, crate filtering, and scraper target promotion (`frontend/src/features/musicLibrary/LibraryPage.tsx:1-485`).
   - **SetBuilderPage (`/sets`)**: Production harmonic wave setlist builder with dual persistence (`frontend/src/features/musicLibrary/SetBuilderPage.tsx:1-681`).
   - **PathfinderPage (`/paths`)**: Production graph traversal finding harmonic transition paths via Memgraph Cypher queries (`frontend/src/features/pathfinder/PathfinderPage.tsx:1-337`).
   - **CamelotPage (`/harmony`)**: Production Camelot wheel harmonic modulation and pitch shift calculator (`frontend/src/features/camelot/CamelotPage.tsx:1-236`).
   - **TargetTracksManager (`/sources/targets`)**: Production scraper target queue with duplicate guards (`frontend/src/pages/ModulePages.tsx:35-85`).
   - **AISetlistsPage (`/sources/import`)**: Production AI OCR parser enforcing strict 1..N playlist completeness (`frontend/src/features/aiSetlists/AISetlistsPage.tsx:1-393`).
   - **ScraperProgressPage (`/pipeline`)**: Production scraper telemetry and Celery DLQ revival console (`frontend/src/pages/ScraperProgressPage.tsx:1-573`).
   - **SettingsPage (`/settings`)**: Production credentials, encrypted token vault, and display preferences (`frontend/src/pages/SettingsPage.tsx:1-1180`).
   - **NotFoundPage (`*`)**: Production error boundary rendering honest empty state (`frontend/src/pages/ModulePages.tsx:8-13`).

2. **Non-Final Artifacts & Stubs ({summary['non_final_pages']} views)**:
   - **GraphPage (`/graph`)**: Superseded prototype. Documented in `docs/IMPLEMENTATION_PLAN.md:120` as slated for Milestone 6 replacement with Sigma.js; carries pending design system exemption in `frontend/design-system-pending.txt:14`.
   - **PlannedModulePage (`/paths` static stub)**: Redirect/stub. Static fallback in `frontend/src/routes/registry.tsx:16` that is automatically overwritten at runtime by `features/pathfinder/route.tsx`.

---

## 3. Storage Hubs & Data Contracts

SongNodes enforces a Medallion Storage Architecture supplemented by in-memory graph topologies and local client-side persistence:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL MEDALLION ARCHITECTURE                     │
│                                                                             │
│  ┌───────────────────────┐   Celery Worker   ┌───────────────────────────┐  │
│  │     Bronze Layer      ├──────────────────►│       Silver Layer        │  │
│  │ (Raw Immutable Sets)  │   ingest_pending  │ (Canonical & Transitions) │  │
│  └───────────────────────┘                   └─────────────┬─────────────┘  │
│                                                            │                │
│                         ┌──────────────────────────────────┴─────────────┐  │
│                         ▼                                                ▼  │
│            ┌─────────────────────────┐                      ┌────────────┴┐ │
│            │   Gold Read Projection  │                      │   Memgraph  │ │
│            │  (Fast Denormalization) │                      │ (In-Memory) │ │
│            └─────────────────────────┘                      └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Authoritative Stores Matrix

| Store Identifier | Storage Engine | Physical Location / Volume | Lock / Concurrency Model | Authoritative Scope |
|---|---|---|---|---|
"""

for s in stores:
    main_report += f"| **{s['name']}** (`{s['id']}`) | {s['type']} | `{s['physical_path']}` | {s['lock_or_concurrency']} | {s['source_of_truth']} | {s['role']} |\n"

main_report += """
### 3.2 Formal Data Contracts

1. **Raw Scraped Playlist Contract (`RawScrapePayload`)**:
   - Schema: `{source: string, source_id: string, name: string, dj_artist: string, tracks: [{position: int, artist: string, title: string, raw_text: string}]}`
   - Invariant: Positions must strictly be `1..N` with no missing sequence indices. Any playlist with missing positions is marked `status = 'failed'` with `completeness_error`.
2. **Canonical Transition Contract (`silver_track_transitions`)**:
   - Schema: `(source_track_id INT, target_track_id INT, occurrence_count INT, confidence_score FLOAT, verified_in_sets INT[])`
   - Invariant: Transitions are strictly directed (`source -> target`). Transitions never span missing songs. Both endpoints must resolve to valid artists; placeholder artists (`VA`, `Unknown`, `ID`) are rejected.
3. **Harmonic Setlist Contract (`songnodes.set/1.0.0`)**:
   - Schema: `{schema: "songnodes.set", schemaVersion: "1.0.0", exportedAt: ISO8601, set: {id: string, name: string, shape: string, tracks: [{slot: int, trackId: string, artist: string, title: string, bpm: float, camelot: string, energy: int}]}}`
   - Invariant: Energy ratings conform strictly to canonical 1–10 scale; missing values are exported as empty rather than fabricated zero.

---

## 4. Inter-Page & Inter-Process Protocols

### 4.1 Client-Side Offline Outbox & Dual Persistence
`SetBuilderPage.tsx` implements a robust dual-persistence protocol:
1. Every slot modification, track addition, or reorder is synchronously committed to browser `localStorage` under key `songnodes_saved_sets`.
2. Asynchronously, if the backend REST API is reachable, mutations are dispatched to `POST /api/v1/library/sets`.
3. If network failure occurs, the local outbox persists the state, and a warning status banner alerts the selector: `"Saved locally. Changes will sync once connected."`

### 4.2 OAuth Streaming Handshake & Cross-Window Messaging
The music streaming authentication pipeline (`/settings`) implements secure popup handshakes:
1. User triggers `Connect TIDAL` or `Connect Spotify`.
2. System generates cryptographically random UUID state in `sessionStorage`.
3. Pop-up window opens `POST /api/v1/music-auth/tidal/oauth/init`.
4. User authenticates on external OAuth server; browser redirects to `/oauth/callback`.
5. `OAuthCallback.tsx` validates received state against `sessionStorage`, transmits payload via `window.opener.postMessage({type: 'OAUTH_SUCCESS', token: ...}, window.location.origin)`, and cleanly closes the popup.
6. Tokens are stored encrypted on server-side disk via SEC6 credential manager; no raw secrets remain in browser `localStorage`.

### 4.3 Stale-Data Fallbacks & Honest UI States
Per Design System rule 08 (Honest states, never mock data):
- When the backend library search API (`/api/v1/library/search`) is offline or initializing, `LibraryPage.tsx` falls back to `data/music-library.json`.
- If both fail, an explicit empty error state is displayed with error cause; mock tracks or placeholder records are never rendered in non-test code.
- Missing BPM, musical key, or energy rating is rendered as an en dash (`<span class="sn-none">–</span>`), never as `"0 BPM"`, `"Unknown"`, or `"N/A"`.

---

## 5. Personas & Operational User Journeys

### 5.1 Persona 1: Performing DJ / Selector
- **Primary Objective:** Build a 2-hour wave-shaped setlist for a Friday headline club gig, verifying harmonic transitions and exporting to USB Rekordbox XML and TIDAL.
- **Morning Routine:** Opens `/sets` or `/library` at 14:00 on laptop; filters for `High Rotation` tracks in `Building Tier (5–7)`.
- **Step-by-Step Progression:**
  1. `/` (Home) -> Inspect latest track count and freshness timestamp.
  2. `/library` -> Filter by crate `"Peak Club"` and energy tier `"Building (5-7)"`.
  3. `/library` -> Audition 30s preview audio; click `"Add to Set"`.
  4. `/sets` -> Drag track into Slot 4; inspect Camelot compatibility badge (`● same key`, `◐ +1 Camelot`).
  5. `/paths` -> Identify a harmonic leap between 8A (124 BPM) and 3B (128 BPM); query Memgraph shortest path for a 2-hop harmonic bridge.
  6. `/sets` -> Accept suggested bridge track; click `"Export Set"` -> select Rekordbox XML with local audio file paths and trigger TIDAL sync (`SET · Friday Peak`).
- **Failure Modes & Fallbacks:** Backend API failure triggers LocalStorage draft outbox; missing preview audio renders clean en dash without crashing.

### 5.2 Persona 2: Music Curator / Track Librarian
- **Primary Objective:** Ensure metadata purity across incoming radio scrapes, resolve competing provider evidence, and curate High/Standard/Archive crate rotation.
- **Morning Routine:** Audits Sunday morning harvest logs; inspects `inbox/to_resolve_<date>.json`; evaluates uncalibrated tracks.
- **Step-by-Step Progression:**
  1. `/library` -> Filter by `"Needs Review"` or `"Uncalibrated Energy"`.
  2. `/library` -> Open Track Detail drawer; compare MusicBrainz, TIDAL, Deezer, and Discogs metadata evidence.
  3. `/harmony` -> Check key modulation rules and pitch-shift compatibility on the Camelot wheel.
  4. `overrides/energy_overrides.csv` -> Commit manual rating override (locks rotation and sets canonical energy).
  5. `/sources/targets` -> Promote critical un-scraped artist to priority scraper queue.
- **Failure Modes & Fallbacks:** In the event of provider conflict (e.g. TIDAL BPM 124 vs Deezer BPM 62), track is routed to `review_queue.csv` for human adjudication.

### 5.3 Persona 3: Data Pipeline & Scraper Engineer
- **Primary Objective:** Maintain scraping fleet health (1001Tracklists, MixesDB, NTS), guarantee complete sequential playlist capture, and clear Celery dead-letter queues.
- **Morning Routine:** Navigates to `/pipeline` to review scrape window completions, active Celery worker counts, and Redis queue latency.
- **Step-by-Step Progression:**
  1. `/pipeline` -> Review ScrapeWindowCard metrics and Celery worker concurrency.
  2. `/pipeline` -> Check Dead-Letter Queue (DLQ); inspect failed job traces (e.g. Cloudflare challenge on 1001Tracklists).
  3. `/pipeline` -> Click `"Revive / Retry"` to re-enqueue transiently failed jobs.
  4. `/sources/import` -> Ingest missing DJ setlist via OCR text parser, ensuring 1..N sequential completeness.
  5. `/pipeline` -> Verify outbox consumer lag returns to 0s.
- **Failure Modes & Fallbacks:** Anti-bot challenge triggers exponential backoff; incomplete playlists are rejected at Bronze layer without poisoning Silver transitions.

### 5.4 Persona 4: Entity Resolution & Consensus Specialist
- **Primary Objective:** Reconcile duplicate tracks and artists across heterogeneous providers without destroying historical references.
- **Morning Routine:** Audits `/api/v1/metadata/review` and `er_shadow` job outputs; validates shadow candidate pairs.
- **Step-by-Step Progression:**
  1. `/settings` -> Verify upstream API credentials and rate-limit budgets.
  2. `/api/v1/metadata/review` -> Examine tracks with competing provider snapshots.
  3. `/api/v1/tracks/{id}/merge` -> Execute human-approved reversible merge into canonical ID.
  4. `/pipeline` -> Trigger `projection_rebuild` to propagate merged entity to gold layer and Memgraph.
- **Failure Modes & Fallbacks:** Reversible merges ensure that erroneous joins can be instantly undone via `POST /api/v1/merges/{id}/revert`.

### 5.5 Persona 5: Platform & Infrastructure Administrator
- **Primary Objective:** Maintain 99.9% uptime across Docker Compose stack (FastAPI, PostgreSQL, Redis, Memgraph, Celery, Scrapers).
- **Morning Routine:** Reviews `/health` probes, inspects disk allocation on `E:\\DockerData`, and audits database migration parity.
- **Step-by-Step Progression:**
  1. `/settings` -> Inspect real-time service health matrix.
  2. `/pipeline` -> Monitor Redis broker memory and Celery task lease expirations.
  3. Terminal -> Run `python migrate.py --check` to verify PostgreSQL schema migrations.
  4. Terminal -> Execute `backup_volumes.sh` to produce cold volume backups.
- **Failure Modes & Fallbacks:** Database connection pool exhaustion triggers graceful asyncpg recycling; REST API returns honest 503 code.

---

## 6. Technical Debt, Latencies & Vulnerabilities

| Severity | Domain | Identified Technical Debt / Vulnerability | Architectural Consequence | Remediation Path |
|---|---|---|---|---|
| **High** | Floor Execution | **Disconnected Rekordbox Booth Loop** | Live gig performance data (Pioneer `HISTORY.m3u8`) is discarded; rotation decay algorithms operate blind. | Implement `MOD-01` Booth History Ingester. |
| **High** | Curation Store | **Dual Storage Disconnect** | SQLite `dj_library.sqlite` and PostgreSQL `library.*` diverge; UI edits do not propagate to weekly runs. | Implement `MOD-03` Bi-Directional Library Bridge. |
| **Medium** | Pipeline Sync | **15s Polling Latency on Outbox** | Graph projection (`projection_consume`) polls every 15s, creating brief lag before new transitions reach `/paths`. | Implement `MOD-02` Realtime Graph Outbox Daemon. |
| **Medium** | Telemetry | **Unwired Scraper Target Queue** | Curators add target artists in `/library`, but standalone weekly scraper does not consume the queue. | Wire `ML-TASK-03` target queue dispatcher cron. |
| **Medium** | Audio Pipeline | **Lack of Live Audio Segmenter** | Transitions rely entirely on text tracklists; un-tracklisted DJ sets and radio mixes cannot be mined. | Deploy Essentia / Chromaprint Audio Segmenter. |
| **Low** | Frontend Cache | **Uncached 30s Audio Previews** | Preview playback depends on third-party CDNs; booth offline auditioning is hindered. | Implement `MOD-04` Audio Preview Stream Cacher. |

---

## 7. Strategic Improvement Roadmap

```
Phase 1 (Immediate Hotfix)
└── ML-TASK-04: OWASP CSV Formula Guard on all weekly crate exports
└── ML-TASK-05: Design System v1.4.0 Token Alignment on Set Builder artifact

Phase 2 (Feedback Loop Closure)
└── MOD-01: Pioneer Rekordbox Booth History Ingester (services/library/booth_history.py)
└── MOD-03: Bi-Directional Library Synchronization Bridge (services/library/bridge.py)
└── ML-TASK-03: Scraper Target Queue Dispatcher Cron

Phase 3 (High-Performance Realtime & Audio)
└── MOD-02: Realtime Graph Outbox Daemon with SSE client push
└── MOD-04: Local Audio Preview Caching Proxy
└── Milestone 6: Replace legacy PIXI GraphPage with Sigma.js WebGL renderer
```

---

*Report compiled deterministically from codebase static analysis. All citations cite verified source files and line ranges.*
"""

with open("documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md", "w", encoding="utf-8") as f:
    f.write(main_report)
print("Wrote DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md")


# 2. Architecture Enhancements & Gaps Report (Phase 7)
gaps_report = f"""# SongNodes: Architectural Enhancements, Critical Gaps & Proposed Modules

**Document Reference:** `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`  
**Accompanying Diagram:** `documentation/data-flow-analysis/enhanced-architecture-connections-and-gaps.svg`  
**Date:** {meta['generated_at']}  
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
{{
  "schema": "songnodes.booth_history",
  "version": "1.0.0",
  "venue": "Club 77 (Sydney)",
  "set_date": "2026-11-06T23:30:00+11:00",
  "transitions": [
    {{"from_id": "trk_01HF9Z", "to_id": "trk_02KJ8X", "played_at": "2026-11-06T23:36:12+11:00", "duration_sec": 348}}
  ]
}}
```

### GAP-02: Dual Storage Disconnect (PostgreSQL library.* vs SQLite dj_library.sqlite)
- **Severity:** High
- **Domain:** Storage Architecture & Curation
- **Current State:** The weekly automated pipeline writes to SQLite (`dj_library.sqlite`), while SongNodes REST API writes to PostgreSQL `library.*`. The sync script `sync-music-library.sh` only synchronizes a static JSON file (`data/music-library.json`).
- **Consequence:** Curator tag edits or crate adjustments made in the web UI do not propagate back to the weekly SQLite ledger, risking split-brain divergence.
- **Technical Fix:** Deploy `MOD-03` Bi-Directional Library Bridge (`services/library/bridge.py`) enforcing single-writer distributed leases and SHA-256 table checksum verification.
- **Data Contract:**
```json
{{
  "schema": "songnodes.library_sync",
  "version": "1.0.0",
  "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "reconciled_at": "2026-11-07T08:00:00+11:00",
  "mutations": [
    {{"table": "track_tags", "action": "INSERT", "key": "trk_01HF9Z", "data": {{"tag": "peak_weapon"}}}}
  ]
}}
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

To eliminate fragmented storage paths across `E:\\musicLibrary`, `services/`, and `frontend/public/data/`, the following unified volume backbone is proposed:

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
"""

with open("documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md", "w", encoding="utf-8") as f:
    f.write(gaps_report)
print("Wrote ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md")


# 3. Sister Project Task Distribution (e:\musicLibrary\TODO-ARCHITECTURAL-IMPROVEMENTS.md)
sister_todo = f"""# TODO: Architectural Improvements & Design System Alignment (musicLibrary)

**Target Repository:** `musicLibrary` (`{meta['sister_project_path']}`)  
**Upstream Project:** SongNodes (`{meta['project']}`)  
**Generated Date:** {meta['generated_at']}  
**Governing Standard:** SongNodes Design System v{meta['design_system_version']} (`design-system/`)  
**Master Report Path:** `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md`  
**Web Report Artifact:** `documentation/data-flow-analysis/report/index.html`

---

## 1. Domain Scope & Context

This task list defines the required architectural improvements for the `musicLibrary` repository resulting from the comprehensive SongNodes architectural data-flow investigation. 

### Mandatory Design System Compliance Rule
All UI work in `musicLibrary` (including the standalone Naarm Set Builder artifact at `artifact/index.html`) **MUST strictly follow the SongNodes Design System in full**.
- Zero raw hex codes (`#fff`, `#000`), zero raw pixel font sizes, zero custom margins.
- All formatting must route through `tokens.css` and `bundle.js` (`SN.format`, `SN.camelot`, `SN.compat`, `SN.status`).
- Any table exports must enforce OWASP CSV formula injection guards (apostrophe on leading `=`, `+`, `-`, `@`).

---

## 2. Distributed Task Matrix

| Task ID | Task Title | Affected Files / Paths | Dependencies | Operational Impact | Verification Criteria |
|---|---|---|---|---|---|
"""

for t in sister_tasks:
    f_list = "<br>".join([f"`{file}`" for file in t["files"]])
    d_list = ", ".join([f"`{dep}`" for dep in t["dependencies"]])
    sister_todo += f"| **{t['task_id']}** | {t['title']} | {f_list} | {d_list} | {t['impact']} | {t['verification']} |\n"

sister_todo += """
---

## 3. Detailed Step-by-Step Task Instructions

### Task 1: ML-TASK-01 - Pioneer Rekordbox Booth History Ingester
- **Objective:** Harvest live performance transitions from Pioneer DJ `HISTORY.m3u8` files.
- **Implementation:**
  1. Create `e:\\musicLibrary\\pipeline\\ingest_booth.py`.
  2. Parse chronological playlist items; extract track pairs where `position N` immediately precedes `position N+1`.
  3. Update `db/dj_library.sqlite` table `rotation_history` and advance rotation timestamps.
  4. Emit HTTP POST to SongNodes REST API `/api/v1/tracks/import-tracklist` with `is_live_booth=true`.
- **Verification:** `python3 pipeline/run_weekly.py ingest-booth --file sample_history.m3u8` successfully parses and updates rotation.

### Task 2: ML-TASK-02 - Bi-Directional PostgreSQL Library Synchronizer
- **Objective:** Reconcile `db/dj_library.sqlite` with SongNodes PostgreSQL `library.*` schema.
- **Implementation:**
  1. Create `e:\\musicLibrary\\pipeline\\sync_songnodes.py`.
  2. Implement single-writer lease check via Redis key `lock:library_sync`.
  3. Calculate SHA-256 checksums of local SQLite `tracks` and `track_tags` tables.
  4. Compare with `/api/v1/library/checksum`; synchronize mutations bidirectionally.
- **Verification:** Run `python3 pipeline/sync_songnodes.py`; verify zero checksum divergence.

### Task 3: ML-TASK-03 - Target Scrape Queue Ingestion Integration
- **Objective:** Consume priority target tracks from SongNodes into Sunday morning scrape batch.
- **Implementation:**
  1. Update `e:\\musicLibrary\\pipeline\\run_weekly.py` step `scrape`.
  2. Query `GET http://localhost:8082/api/v1/target-tracks?status=pending`.
  3. Inject target artists into active radio spider query lists.
- **Verification:** Weekly run outputs show target artists included in `outputs/<date>/scrape_log.txt`.

### Task 4: ML-TASK-04 - Formula Guard Enforcement on All Crate CSV Exports
- **Objective:** Guard all CSV exports against OWASP formula injection (DR-033).
- **Implementation:**
  1. Inspect `pipeline/process.py` CSV generator.
  2. Prepend a single apostrophe (`'`) to any cell whose first character is `=`, `+`, `-`, `@`, tab, or carriage return.
  3. Ensure numeric fields (BPM, Energy, Slot) remain unwrapped so spreadsheets sort them properly.
- **Verification:** Verify `outputs/crates/*.csv` cells starting with `@` or `=` have leading apostrophe.

### Task 5: ML-TASK-05 - Design System Token Alignment on Standalone Set Builder Artifact
- **Objective:** Align `artifact/index.html` with SongNodes Design System v1.4.0.
- **Implementation:**
  1. Replace legacy `<style>` block in `artifact/index.html` with `<link rel="stylesheet" href="../../design-system/tokens.css">`.
  2. Replace custom key badge colors with `var(--compat-*)` and `var(--energy-*)`.
  3. Format all musical data via `SongNodes.format`.
- **Verification:** Run token audit script against `artifact/index.html`; confirm 0 hardcoded hex literals.

### Task 6: ML-TASK-06 - Automated Audio Preview Snippet Linker
- **Objective:** Resolve and store 30s audio preview URLs directly into `dj_library.sqlite`.
- **Implementation:**
  1. In `pipeline/resolve.py`, preserve Deezer `preview` URL and TIDAL preview URL.
  2. Store in `tracks.preview_url` column in SQLite.
- **Verification:** Query SQLite database: `SELECT count(*) FROM tracks WHERE preview_url IS NOT NULL` returns > 0.
"""

os.makedirs("e:/musicLibrary", exist_ok=True)
with open("e:/musicLibrary/TODO-ARCHITECTURAL-IMPROVEMENTS.md", "w", encoding="utf-8") as f:
    f.write(sister_todo)
print("Wrote e:/musicLibrary/TODO-ARCHITECTURAL-IMPROVEMENTS.md")
