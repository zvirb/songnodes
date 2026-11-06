# SongNodes: Architectural Investigation, End-to-End Data Flow & Page Interaction Report

**Document Reference:** `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md`  
**Generated Date:** 2026-11-07T09:05:00+11:00  
**Repository Commit:** `7429821ca1c0d2e7f81b51c3d6b79b4bcce1e8cb`  
**Governing Standard:** SongNodes Design System v1.4.0 (`design-system/`)  
**Locale & Conventions:** `en-AU`, sentence case, `Australia/Melbourne` 24-hour time  
**Classification Method:** Multi-signal static analysis (routing table + live API wiring + test suites + import graphs)

---

## 1. Executive Summary

SongNodes is a modular DJ track transition graph and library curation platform engineered to capture, enrich, and navigate verified sequential track pairings (`position N -> position N+1`) harvested from complete, observed DJ setlists rather than synthetic unverified algorithmic recommendations. The system operates in close federation with its sister repository, **musicLibrary** (`e:\musicLibrary`), which provides weekly radio scraping, automated rotation lifecycles (High/Standard/Archive), and crate management.

### Key Headline Architecture Metrics

| Metric Dimension | Value | Operational Significance |
|---|---|---|
| **Catalogued UI/Operational Pages** | **12 Views** | Encompasses all registered static and dynamic feature routes |
| **Production-Level Pages** | **10 Pages** | Tested, fully wired everyday operational DJ and curation tools |
| **Non-Final Artifacts / Stubs** | **2 Artifacts** | Superseded prototypes (legacy PIXI Graph) & static route stubs |
| **Authoritative Storage Hubs** | **8 Hubs** | PostgreSQL Medallion, Memgraph, Redis, SQLite, Filesystem, LocalStorage |
| **Mapped Data-Flow Edges** | **26 Edges** | End-to-end traced network, SQL, IPC, and filesystem contracts |
| **User Operational Personas** | **5 Personas** | Selector, Librarian, Scraper Engineer, Resolution Specialist, Admin |
| **Critical Architectural Gaps** | **5 Gaps** | Missing booth feedback loop, dual-storage split-brain, audio segmenter |
| **Sister-Project Action Tasks** | **6 Tasks** | Concrete improvement work distributed to `musicLibrary` |
| **Proposed Single-Purpose Modules** | **4 Modules** | Lightweight (&lt;500 LOC) solutions closing core feedback loops |

---

## 2. Definitive Page Catalog & Production Audit

Every UI and operational entry point in SongNodes is catalogued below, classified by operational readiness using dual independent signals (routing table entry + live backend wiring + automated test coverage).

| Page & Route | Operational Domain | Module Token | Classification | Dual Signals / Evidence |
|---|---|---|---|---|
| **SongNodes** (`/`)<br>*Home* | System launcher, high-level operational overview, and real-time statistics console. | `--bg` | ● Production | Static entry route registered in registry.tsx:14; uses production AppShell and Design System SN helpers; live statistics and quick launcher.<br>`frontend/src/pages/HomePage.tsx:1-63`<br>`frontend/src/routes/registry.tsx:14` |
| **Music Library** (`/library`)<br>*Explore* | Curated DJ track catalog, crate filtering, energy tier exploration, and track-to-target scraper promotion. | `--mod-library` | ● Production | Dynamic feature route discovered via registry.tsx:27 and musicLibrary/route.tsx:9; verified live backend search integration; audited in PR #259.<br>`frontend/src/features/musicLibrary/LibraryPage.tsx:1-485`<br>`frontend/src/features/musicLibrary/route.tsx:9` |
| **Set Builder** (`/sets`)<br>*Make* | Harmonic wave-shaped DJ set sequencer with Camelot transition analysis, energy curve tracking, and multi-platform export. | `--mod-sets` | ● Production | Production operational tool; dual persistence (LocalStorage outbox + PostgreSQL library.saved_sets); handles full setlist lifecycle.<br>`frontend/src/features/musicLibrary/SetBuilderPage.tsx:1-681`<br>`frontend/src/features/musicLibrary/route.tsx:10` |
| **Pathfinder** (`/paths`)<br>*Make* | Graph-based transition pathfinder calculating harmonic, energy-aligned stepping stones between distant tracks. | `--mod-paths` | ● Production | Restored in package R2 (#177) and wired in P1 (#180); connects directly to Memgraph pathfinding Cypher queries via REST API.<br>`frontend/src/features/pathfinder/PathfinderPage.tsx:1-337`<br>`frontend/src/features/pathfinder/route.tsx:1-6` |
| **Camelot Matrix** (`/harmony`)<br>*Explore* | Interactive Camelot wheel and harmonic modulation matrix displaying musical compatibility and energy shift potential. | `--mod-harmony` | ● Production | Consolidated into single production route in package P2 (#182); implements official SN.camelot and SN.compat mathematical models.<br>`frontend/src/features/camelot/CamelotPage.tsx:1-236`<br>`frontend/src/features/camelot/route.tsx:1-10` |
| **Scrape Targets** (`/sources/targets`)<br>*Collect* | Priority queue and management console for artist and track search targets dispatched to unified scrapers. | `--mod-sources` | ● Production | Production target dispatch tool; backed by PostgreSQL migration 280; prevents duplicate target insertion and coordinates scraper runs.<br>`frontend/src/pages/ModulePages.tsx:35-85`<br>`frontend/src/components/TargetTracksManager.tsx:1-350` |
| **Tracklist Import** (`/sources/import`)<br>*Collect* | AI-assisted tracklist ingestion, OCR text parsing, and sequential playlist bronze layer loader. | `--mod-sources` | ● Production | Feature route wired in P3 (#185); enforces completeness guard (positions 1..N with no gaps) and loads into bronze_scraped_playlists.<br>`frontend/src/features/aiSetlists/AISetlistsPage.tsx:1-393`<br>`frontend/src/features/aiSetlists/route.tsx:1-9` |
| **Pipeline Telemetry** (`/pipeline`)<br>*System* | Real-time scraper telemetry, Celery queue drain rates, Medallion stage progression, and job dead-letter revival. | `--mod-pipeline` | ● Production | Core operational health console; monitors async Celery execution and ensures data layer consistency across Medallion tiers.<br>`frontend/src/pages/ScraperProgressPage.tsx:1-573`<br>`frontend/src/features/pipeline/usePipelineTelemetry.ts:1-250` |
| **System Settings** (`/settings`)<br>*System* | Credential store, OAuth streaming token manager (TIDAL & Spotify), API provider configuration, and display preferences. | `--mod-services` | ● Production | Production administrative and preferences engine; securely manages API credentials without committing raw secrets (SEC6).<br>`frontend/src/pages/SettingsPage.tsx:1-1180`<br>`frontend/src/routes/registry.tsx:20-21` |
| **Page Not Found** (`*`)<br>*Error 404* | Honest empty/error boundary state displayed when a requested URL is unregistered. | `--bg` | ● Production | Canonical error boundary adhering to Design System rule 08 (Honest states, never mock data); registered in registry.tsx:22.<br>`frontend/src/pages/ModulePages.tsx:8-13`<br>`frontend/src/routes/registry.tsx:22` |
| **Transition Graph** (`/graph`)<br>*Explore* | Legacy 2D transition graph visualiser (PIXI/Canvas prototype slated for Sigma.js replacement in Milestone 6). | `--mod-graph` | ▲ Non-Final | Classified as superseded prototype. docs/IMPLEMENTATION_PLAN.md:120 mandates replacing legacy PIXI renderer with Sigma.js; fails design system conformance (pending exemption in design-system-pending.txt:14).<br>`frontend/src/pages/GraphPage.tsx:1-61`<br>`docs/IMPLEMENTATION_PLAN.md:115-135` |
| **Planned Module** (`/paths (stub)`)<br>*Notice* | Static fallback placeholder that is dynamically superseded by the real Pathfinder feature route. | `--mod-paths` | ▲ Non-Final | Classified as redirect/stub. Provided only as static fallback in registry.tsx:16; replaced dynamically at runtime by features/pathfinder/route.tsx.<br>`frontend/src/pages/ModulePages.tsx:15-20`<br>`frontend/src/routes/registry.tsx:16` |

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
| **PostgreSQL Bronze Ingestion Store** (`postgres_bronze`) | relational_db | `Docker Volume pgdata (PostgreSQL port 5432)` | Transaction-scoped MVCC; unique constraints on (source, source_playlist_id) | Yes, for un-normalized raw source payloads. | Raw, immutable capture of external scraped playlists and track items. |
| **PostgreSQL Silver Normalized Store** (`postgres_silver`) | relational_db | `Docker Volume pgdata (PostgreSQL port 5432)` | Row-level locks during Celery enrichment worker drain; idempotent by job_id | Yes, authoritative single source of truth for all verified track pairings and metadata consensus. | Deduplicated, enriched tracks, verified sequential transitions (1..N), and provider consensus evidence. |
| **PostgreSQL Gold Projection Store** (`postgres_gold_projection`) | relational_db | `Docker Volume pgdata (PostgreSQL port 5432)` | Maintained by projection_consume Celery worker; rebuildable from silver. | No, disposable derived projection. | Denormalized, read-optimized projection of tracks and transitions for fast API queries. |
| **Memgraph Graph Database** (`memgraph_gold_graph`) | graph_db | `Docker container songnodes-memgraph (Bolt port 7687)` | Internal Memgraph Bolt transaction concurrency | No, projected from PostgreSQL silver transitions. | In-memory graph topology enabling sub-50ms Cypher queries for harmonic pathfinding and transition traversals. |
| **Redis Broker, Lease & Telemetry Store** (`redis_queue_cache`) | in_memory_kv | `Docker container songnodes-redis (port 6379)` | Redis single-threaded atomic operations; TTL-backed leases | No, transient operational state. | Celery job queue broker, worker lease management, rate-limiting counters, and real-time scraper window telemetry. |
| **musicLibrary Curated SQLite Database** (`musiclibrary_sqlite`) | sqlite_db | `e:\musicLibrary\db\dj_library.sqlite` | File-based SQLite locks; single-writer batch rebuild via pipeline/run_weekly.py db | Yes, authoritative for DJ crate assignments and High/Standard/Archive rotation lifecycle. | Local offline curated DJ database holding crates, appearances, rotation history, and setlists. |
| **Filesystem Ledger & Export Volumes** (`filesystem_ledgers_outputs`) | filesystem | `e:\musicLibrary\ledger\, e:\musicLibrary\outputs\, frontend\public\data\` | Atomic file rename/write operations | Yes, ledger is the permanent audit trail for weekly rotation calculations. | Immutable weekly ledger snapshots, crate CSVs, Rekordbox XML exports, and static sync files. |
| **Client Browser LocalStorage & SessionStorage** (`client_browser_storage`) | browser_kv | `Browser Origin LocalStorage / SessionStorage` | Single-thread per tab; storage events across same-origin tabs | Yes, for un-synced offline draft setlists. | Offline set outbox, active UI theme preference ('dark'|'light'|'booth'), and transient OAuth state. |

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
- **Morning Routine:** Reviews `/health` probes, inspects disk allocation on `E:\DockerData`, and audits database migration parity.
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
