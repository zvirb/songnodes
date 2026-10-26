# SongNodes: DJ Track Transition Graph and Library Platform

SongNodes captures, enriches and visualises proven track pairings from real DJ mixes alongside curated DJ library crates and wave-shaped setlists. Track transitions in SongNodes represent observed sequential pairings (`position N -> position N+1`) from complete playlists rather than unverified algorithmic suggestions.

---

## 1. Governing plans and current architecture direction

SongNodes is actively transitioning from a sprawling microservice checkout into a **modular, small-batch architecture** governed by strict scope boundaries, self-registering feature and router registries, and a single design system.

| Document | Role |
|---|---|
| [`plan/RESTRUCTURE.md`](plan/RESTRUCTURE.md) | **Single active execution plan.** Defines the small-batch work packages (`R`, `G`, `C`, `S`, `L`, `E`, `SB`, `P`, `FE9`, `SEC`, `U`, `DS`, `QA`), wave ordering, merge protocol, and independent audit findings. |
| [`AGENTS.md`](AGENTS.md) | **Mandatory contributor and agent rules.** Enforces the One Job Rule, explicit owned paths (`G1` CI scope guard), ~400-line diff budget, two-attempt stop rule, honest UI/API states (never mock data), and `STATUS.md` slot hygiene. |
| [`STATUS.md`](STATUS.md) | **Live progress record.** Contains per-package `<!-- SLOT:<CODE> -->` blocks and scheduled-run audit logs. |
| [`CLAUDE.md`](CLAUDE.md) | **Developer guide.** Covers the `compose.dev.yaml` container stack, Medallion data flow, unified scraper rules, and design-system requirements. |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | **Tested local development baseline.** Startup (`scripts/start-dev.sh`), migrations, verification commands, and catalog read contracts. |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | **Long-term architecture reference.** Milestones 1–8 (domain consolidation, canonical 1–10 energy scale, entity resolution, server search, Memgraph wave routing, Sigma.js renderer, Essentia audio calibration). Execution is sequenced via [`plan/RESTRUCTURE.md`](plan/RESTRUCTURE.md). |

---

## 2. Design system: single source of truth

Every formatting, layout, colour, typography, icon and copy decision in SongNodes—and in the companion Naarm Set Builder (`musicLibrary`)—comes from the SongNodes design system in [`design-system/`](design-system/README.md). Where existing code or legacy stylesheets disagree with the design system, the design system wins.

| Resource | Path |
|---|---|
| Brand book, 19 guideline sections, 92 components, tokens, build scripts | [`design-system/`](design-system/README.md) (`design-system/tokens.json`) |
| Integration guide and workflow | [`docs/design-system/README.md`](docs/design-system/README.md) |
| Rendered visual reference | [`docs/design-system/reference.html`](docs/design-system/reference.html) |
| Code-only quick reference | [`docs/design-system/CODE_REFERENCE.md`](docs/design-system/CODE_REFERENCE.md) |
| Synced frontend copy (never edit directly) | `frontend/src/styles/design-system/` via `scripts/sync-design-system.sh` (`--check` in CI) |
| React helpers and application shell | `frontend/src/lib/songnodes.tsx` (`SN`), `frontend/src/shell/` (`AppShell`) |
| SDLC gates | [`docs/sdlc/SDLC.md`](docs/sdlc/SDLC.md) |

### Core design-system rules
- Never write raw hex, `rgb()`, named colours, `px` font sizes, ad-hoc radii, shadows or `z-index` literals in application code. Use design-system tokens (`var(--...)`) and `sn-*` classes.
- Format all dates, times, durations, counts, BPM and keys through `SN.format`, `SN.camelot` and `SN.compat`.
- Map all operational statuses through `SN.status` (always rendered as glyph + word, never colour alone).
- Typography: **Sora** for display/titles (dimmed lead-in + bold title), **Inter** for body copy, **JetBrains Mono** for tabular/musical data (BPM, Camelot keys, durations, IDs).
- Locale and copy: `en-AU` spelling, sentence case, `Australia/Melbourne` 24-hour time, missing values shown as an en dash (`sn-none`, never `"N/A"` or `"Unknown"`), and no emoji anywhere in the interface.
- Navigation: `NavDrawer` is the single site navigation pattern; one primary button per view; never use native `alert()`, `confirm()` or `prompt()`.

---

## 3. Target modular architecture

### 3.1 Medallion + Library Overlay data flow

```text
unified-scraper
   │  (complete playlists only; sequential positions 1..N)
   ▼
Bronze (PostgreSQL: bronze_scraped_playlists, bronze_scraped_tracks)
   │  (durable ingestion_jobs queue drained by Celery worker)
   ▼
Silver (PostgreSQL: silver_enriched_tracks, silver_enriched_artists,
        silver_track_transitions, silver_track_metadata_evidence)
   ├──◄ Local-first Enrichment Waterfall (ref_mb local MusicBrainz DB -> TIDAL v2 -> Deezer -> Discogs -> Last.fm)
   ├──◄ Library Overlay (library.* schema: crates, rotation history, appearances, saved sets, track_xref)
   │
   ▼  (transactional outbox: outbox_events -> outbox_consumers)
Projections & Read Models
   ├── PostgreSQL rebuildable projection (projection_tracks)
   └── Graph projection consumer (services/graph-projection -> Memgraph)
   │
   ▼
APIs (rest-api :8082, graph-api :8084)
   │
   ▼
Frontend (React 19 + Vite + PIXI.js :3006)
```

### 3.2 Modular frontend structure (Wave 1–4 target)
- **Feature-folder isolation:** Each page lives in `frontend/src/features/<page>/` with its own `route.tsx`, one primary data hook, and co-located unit tests.
- **Self-registering routes (`G2`):** `frontend/src/routes/registry.tsx` discovers `../features/*/route.tsx` via `import.meta.glob`, eliminating merge collisions on `frontend/src/App.tsx`.
- **Shared boundaries:** Shared frontend code is strictly limited to `lib/`, `shell/`, `components/ds/`, `hooks/useUnifiedTracks.ts` (`R1`), and `types/`. Features do not import from other features.
- **Honest states:** Every page renders real catalog/library data, an explicit empty state (`EmptyState`), or an error banner naming the exact upstream cause—never fabricated fallback tracks or random BPM/key placeholders.

### 3.3 Modular backend structure (Wave 1–3 target)
- **Shared domain package (`services/common/`):** Pure domain logic (`datalayer/`, `metadata/`, `providers/`, `refmb/`) lives in `services/common/` and is tested independently of HTTP and Celery transports.
- **Self-registering REST routers (`G3`):** Routers in `services/rest_api/routers/` expose `register(app)` and are discovered automatically by `services/rest_api/router_registry.py`, avoiding concurrent edits to `services/rest_api/main.py`.
- **Reserved migration ranges:** SQL migrations in `sql/migrations/` use non-overlapping numeric ranges per work package (`contracts/ownership.yaml`) with paired `*_up.sql` and `*_down.sql` scripts.
- **Server-side credential security (`SEC5`, `SEC6A`, `SEC6B`):** Provider and AI API keys stay encrypted on the server (`API_KEY_ENCRYPTION_SECRET`), never in browser `localStorage` or query strings.

---

## 4. Running stack (`compose.dev.yaml`)

SongNodes runs locally via Docker Compose (`compose.dev.yaml`, project name `songnodes-dev`). Kubernetes/Helm/Flux manifests under `deploy/` and `k8s/` are retained for reference only and are not used in active development.

| Service | Host binding | Role |
|---|---|---|
| `frontend` | `http://127.0.0.1:3006` | React 19 / PIXI.js UI behind nginx; proxies `/api/*` to `rest-api` and `graph-api` |
| `rest-api` | `http://127.0.0.1:8082` | FastAPI catalog, target tracks, library overlay, setlists, and job-trigger API |
| `graph-api` | `http://127.0.0.1:8084` | FastAPI graph visualization, neighborhood, and subgraph read API |
| `unified-scraper` | `http://127.0.0.1:8012` | Single unified Scrapy + Playwright service (container port `8000`) for all spiders |
| `worker` | Compose network only | Celery beat + worker draining `ingestion_jobs`, enrichment, and outbox projections |
| `postgres` | Compose network only | PostgreSQL (`songnodes` database: bronze, silver, outbox, and `library` schemas) |
| `redis` | Compose network only | Redis cache and connection pool |
| `rabbitmq` | Compose network only | RabbitMQ broker for Celery tasks |

---

## 5. Quick start

### Prerequisites
- Docker Engine and Docker Compose v2 (`docker compose up --wait`)
- Git Bash (on Windows) to run `scripts/*.sh`
- Node.js 26 (or 22.12+ for local dev; CI and frontend image use Node 26, TypeScript 7, and Oxlint)
- Python 3.13–3.15 for local test execution (`PYTHONUTF8=1` on Windows)

### Start the stack
From the repository root:

```bash
bash scripts/start-dev.sh
```

`scripts/start-dev.sh` builds the 5 application images (`graph-api`, `rest-api`, `worker`, `unified-scraper`, `frontend`), starts `postgres` and `redis`, applies idempotent migrations (`012_target_tracks_up.sql`, `013_ingestion_jobs_up.sql`, `014_data_layer_up.sql`, `101_library_schema_up.sql`, `240_library_search_indexes_up.sql`), brings up all containers, and verifies `http://127.0.0.1:8084/api/graph/data`.

> **Known issue on `main` at `bbc695a` (PR #158):** PR #158 introduced a top-level circular import in `services/common/datalayer/handlers.py` (`from library.ingest.handler import library_ingest`) and added `library` imports to `rest-api` and `worker` without copying `services/library` into their Dockerfiles. See [`plan/RESTRUCTURE.md`](plan/RESTRUCTURE.md) section 1.1 for the pre-Wave-1 hotfix required before rebuilding `rest-api` and `worker`.

For hot-reload frontend development against the running backend containers:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:3006` (use `127.0.0.1` rather than `localhost` so Spotify and TIDAL OAuth loopback redirect URIs match).

---

## 6. Verification and testing

| Area | Command | Notes |
|---|---|---|
| Scope guard (`G1`, once merged) | `python scripts/scope_guard.py --base origin/main --head HEAD --title "<CODE>: ..." --branch "<code>-..."` | Verifies changed/deleted files stay inside the brief's owned paths |
| Design-system sync | `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check` | Mandatory on every UI change (`QA5` makes `PYTHONUTF8=1` automatic on Windows) |
| Frontend type-check, lint, unit tests, build | `cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` | Uses TypeScript 7 and Oxlint (`frontend/LINTING.md`) |
| Shared domain unit tests | `cd services && python -m pytest common/tests` | 112 unit tests covering Camelot, tempo, energy, consensus, matching, ER, and providers |
| Dev stack integration tests | `python -m unittest discover -s tests/integration -p 'test_dev_*.py' -v` | Runs against the live `compose.dev.yaml` stack using isolated synthetic records |
| E2E Playwright suite | `bash scripts/e2e-docker.sh` | Runs Playwright inside Linux container against rebuilt stack |

---

## 7. Small-batch workflow and wave schedule

All engineering work is organized into small, single-job work packages generated by:
- [`plan/build_rs_prompts.py`](plan/build_rs_prompts.py) — recovery (`R1`–`R3`), guards/registries (`G1`–`G3`), cleanup (`C1`–`C2`), search (`S1`–`S3`), library (`L1`–`L5`), local MusicBrainz enrichment (`E1`–`E3`), set builder export/reorder (`SB1`–`SB3`), page routing (`P1`–`P3`, `FE9`), and security (`SEC5`, `SEC6A`, `SEC6B`).
- [`plan/build_upgrade_prompts.py`](plan/build_upgrade_prompts.py) — runtime and image upgrades (`U1`–`U29`: Python 3.15, Node 26, Redis 8.10, RabbitMQ 4.3, Postgres 18.6).
- [`plan/build_ds_prompts.py`](plan/build_ds_prompts.py) — per-page design-system audits and fixes (`DS1`–`DS16`).

### Wave execution sequence (see [`plan/RESTRUCTURE.md`](plan/RESTRUCTURE.md) for full details)
1. **Pre-Wave-1 Hotfix + Wave 1A (Guards & Registries):** Fix PR #158's circular import and Dockerfile `COPY` gap, then land `G1` (scope guard), `G2` (frontend route registry), and `G3` (backend router registry).
2. **Wave 1B (Recover & Foundations):** Restore deleted work (`R1` track bridge, `R2` route finder, `R3` graph projection), clean up duplicate resolvers (`C1`) and root scratch scripts (`C2`), and add isolated foundation modules (`QA5`, `S1`, `E2`, `SB1`).
3. **Wave 2 (Wire Pages & Providers):** Wire `/paths` (`P1`), consolidate `/harmony` (`P2`), route AI setlists (`P3`), add library-to-target action (`FE9`), remove REST search mocks (`S2`), add local MusicBrainz provider (`E1`), add set export dialog (`SB2`), add server-side AI proxy (`SEC6A`), and stabilize tests (`QA4`, `QA6`).
4. **Wave 3 (Integration & Hardening):** Surface real search UI errors (`S3`), complete library reconciliation and replay reports (`L5`, `E3`), add keyboard track reordering (`SB3`), enforce REST token auth (`SEC5`), add AI proxy frontend client (`SEC6B`), and add `graph-api` unit tests (`QA3`).
5. **Wave `up` & `up-legacy` (Runtime Upgrades):** Upgrade running services (`U1`–`U5`) and legacy services (`U6`, `U9`–`U29`) to Python 3.15 / Node 26 / Redis 8.10 / RabbitMQ 4.3 after Wave 1 structural recovery is verified.
6. **Wave 4 (Design-System Audits):** Re-generate and run per-page design-system compliance packages (`DS1`–`DS15`, then `DS16`) and pin GitHub Actions (`U8`).

---

## 8. Repository layout

```text
songnodes/
├── AGENTS.md                 # Mandatory small-batch rules for all contributors and AI agents
├── CLAUDE.md                 # Developer guide: Compose stack, medallion flow, design system
├── STATUS.md                 # Per-package progress slots (<!-- SLOT:<CODE> -->) and run logs
├── compose.dev.yaml          # Tested local Docker Compose stack (songnodes-dev)
├── contracts/                # Shared schemas, normalisation vectors, fixtures, ownership ranges
├── design-system/            # Single source of truth for tokens, CSS/JS bundles, and component specs
├── docs/                     # Architecture, development baseline, SDLC, and integration records
├── frontend/                 # React 19 + TypeScript 7 + Vite + PIXI.js application
│   └── src/
│       ├── components/       # Shared and legacy UI components (migrating to features/ and ds/)
│       ├── features/         # Self-contained feature modules (aiSetlists, camelot, musicLibrary, pathfinder, pipeline)
│       ├── hooks/            # Shared data hooks (useUnifiedTracks)
│       ├── lib/              # SongNodes design-system helpers (songnodes.tsx) and API client
│       ├── pages/            # Static pages (migrating to features/*/route.tsx via G2)
│       ├── routes/           # G2 automatic feature route registry
│       ├── services/         # API and track synchronisation adapters
│       ├── shell/            # AppShell, NavDrawer, PageHeader, EmptyState
│       └── styles/           # Synced design-system tokens/bundles (read-only) and app styles
├── plan/                     # Restructure plan (RESTRUCTURE.md), prompt builders, Jules launcher
│   └── agents/               # 80 atomic work-package briefs (<CODE>_*.md)
├── scrapers/                 # Unified Scrapy + Playwright service (Dockerfile.unified)
├── scripts/                  # Dev startup (start-dev.sh), design-system sync, E2E runner, scope guard
├── services/                 # Backend services and shared domain packages
│   ├── common/               # Shared domain logic: datalayer, metadata, providers, refmb
│   ├── graph-projection/     # Outbox-to-Memgraph consumer (restored by R3)
│   ├── graph-visualization-api/ # FastAPI graph read service (:8084)
│   ├── library/              # DJ library overlay model, importer, and ingest handler
│   ├── metadata-enrichment/  # Provider search and enrichment service
│   ├── reference_data/       # Local MusicBrainz (ref_mb) resolver (consolidated by C1)
│   ├── rest_api/             # FastAPI main backend (:8082) and self-registering routers/
│   └── worker/               # Celery worker + beat draining durable ingestion_jobs
├── sql/migrations/           # Versioned PostgreSQL migrations (medallion, data layer, library, ref_mb)
└── tests/                    # Integration, resolver, and contract test suites
```

---

## 9. Data sources and attribution

This application uses data from **MusicBrainz** (MetaBrainz Foundation), made available under the **CC0 1.0 Universal Public Domain Dedication** (core and canonical data) and the **Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported Licence** (`CC BY-NC-SA 3.0`, derived and tag/genre datasets). Raw dumps and derived databases (`ref_mb`) are never committed to Git.
