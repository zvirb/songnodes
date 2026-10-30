# SongNodes: Developer Guide

## Application Purpose

**SongNodes** captures and visualizes **proven track pairings** from professional DJ mixes. Track transitions are the foundation — each represents a validated pairing used in real performances, not algorithmic suggestions.

**Value:** If 50 DJs transitioned from "Deadmau5 - Strobe" to "Eric Prydz - Opus", this is a **high-confidence pairing** validated by the DJ community.

### Medallion Architecture (Bronze → Silver → Gold → Operational)

```
Scraper → Bronze (raw playlists) → Silver (validated transitions) → Gold (analytics) → Operational (graph DB) → Frontend (PIXI.js)
```

**Bronze:** Raw scraped playlists with positions preserved in `bronze_scraped_playlists` + `bronze_scraped_tracks`
**Silver:** Canonical tracks + transitions (`silver_track_transitions`) with occurrence counting
**Gold:** Pre-computed analytics (quality scores, confidence ratings)
**Operational:** Graph nodes/edges optimized for visualization

**Transition Creation:** Sequential track positions (`N → N+1`) create edges. Multiple DJs using same transition increases `occurrence_count` and edge weight.

## Guiding Principles

- **Modularity:** Single-responsibility components
- **Resilience:** Anti-detection, error handling, validation
- **Git-First:** every change reaches `main` through a pull request; the running stack is rebuilt from Git, never patched in place
- **Data Integrity:** Bronze → Silver → Gold flow, no layer skipping

---

## Critical Requirements

### 1. Artist Attribution (MANDATORY)

**Valid artists REQUIRED on BOTH endpoints** of every transition. NULL/"Unknown Artist" **MUST NOT** appear in graph.

**Enforcement:** Database view → API filter → Frontend validation → ETL (valid artists only)

### 2. Scraper Workflow (MANDATORY)

**Target:** Find **complete playlists** containing target tracks (not individual tracks)

**Steps:**
1. Query `target_track_searches` for `search_query` (e.g., "Deadmau5 Strobe")
2. Search sources (MixesDB, 1001Tracklists) for playlists containing target
3. Scrape **ENTIRE** playlist with ALL tracks and sequential positions
4. Persist to bronze layer with positions 1, 2, 3... (no gaps)
5. ETL creates transitions from `position N → position N+1`

**Critical:** Complete playlists only (partial = invalid), positions preserved, all tracks captured

### 3. Unified Scraper (MANDATORY)

**Deployment:** `unified-scraper` is the ONLY scraper container allowed
**Forbidden:** Individual scraper services (`scraper-1001tracklists`, `scraper-mixesdb`, etc.)
**Benefits:** one 1GB container instead of 12+ (12GB+), centralized resilience, single source of truth

### 4. Design System (MANDATORY): single source of truth for formatting and design

**Source:** [`design-system/`](design-system/README.md), the SongNodes design system (version in `design-system/tokens.json`, mirrored from the published design-system artifact). It decides **every** formatting and design question in the frontend and in the music library: colour, typography, spacing, radius, shadow, z-index, motion, icons, copy, date/number formatting, component markup and page patterns. If anything else disagrees (older CSS, a component, a library default or taste), the design system wins. A conflict that the system does not settle is a change to the system, not a local override.

**Read before UI work:** `design-system/README.md` (brand book and component index), then the sections the task touches (`01-writing` … `19-songnodes-migration`, including `04-typography`), and the card `design-system/api/components/<Comp>.md` plus `components/<Comp>/README.md` for every component you use. Quick references: [`docs/design-system/README.md`](docs/design-system/README.md) (how it works here), [`docs/design-system/reference.html`](docs/design-system/reference.html) (rendered examples), [`docs/design-system/CODE_REFERENCE.md`](docs/design-system/CODE_REFERENCE.md) (code only).

**How the frontend consumes it:**
- `scripts/sync-design-system.sh` copies `tokens.css`, `bundle.css`, `bundle.js`, fonts and types into `frontend/src/styles/design-system/` and writes `VERSION`. Never edit that folder. `--check` fails CI if it drifts.
- Import order (`frontend/src/main.tsx`): legacy CSS → `design-system/tokens.css` → `design-system/bundle.css` → `legacy-aliases.css` → `app.css`.
- React: `frontend/src/lib/songnodes.tsx` (`SN` helpers, `SnIcon`, `Title`, `EnergyBar`, `KeyBadge`, `Bpm`, `StatusPill`, `CompatPill`, `MODULE_ROUTES`) and `frontend/src/shell/` (`AppShell` with `usePageHeader`, `PageHeader`, `EmptyState`, `SectionHeading`, `LauncherCard`, `PreferencesPanel`).

**Rules:**
- **Colour and values:** no hex, `rgb()`, named colours, px font sizes, ad-hoc radii, shadows or z-index numbers in app code. Use tokens (`var(--…)`) and `sn-*` classes only.
- **Type:** Sora titles (thin–bold: dimmed lead-in plus bold title), Inter body, JetBrains Mono for BPM, keys, durations and IDs.
- **Writing:** en-AU, sentence case, Australia/Melbourne 24-hour time. Missing values are an en dash (`sn-none`). No emoji in the interface. Lucide icons plus a word.
- **Formatting and mapping:** dates, durations, counts and BPM go through `SN.format`. Keys go through `SN.camelot`/`keyName` (8A = A minor). Transitions go through `SN.compat`/`energyStep`/`bpmStep`. Statuses go through `SN.status`, shown as glyph plus word.
- **Interaction:** one primary button per view. Never `alert`/`confirm`/`prompt`: use `ConfirmDialog` and `Toast`. The NavDrawer is the only site navigation.
- **Changing the system:** change it at the source (the design-system artifact, or `design-system/source/*` followed by `build_tokens.py` and `build_bundle.py`), bump the version per `design-system/17-governance.md`, then re-sync. Never patch it downstream.

---

## 1. Setup

SongNodes runs as plain Docker containers from `compose.dev.yaml` (Compose project
`songnodes-dev`). There is no Kubernetes deployment for now; the Helm chart and Flux
config under `deploy/` and `k8s/` are kept only for a possible later move and are not
used. The full run and first-scrape procedure is `docs/DEPLOYMENT_CHECKLIST.md`.

### Prerequisites
Docker with Compose v2, Git Bash on Windows (`scripts/*.sh`), Node 26 (CI and frontend image; 22.12+ locally), Python 3.13–3.15 (`PYTHONUTF8=1` on Windows)

### Secrets
Put credentials in your shell environment or an untracked `.env` next to `compose.dev.yaml`
(never commit them). Provider keys, for example `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`,
`LASTFM_API_KEY`, `DISCOGS_API_TOKEN`, plus `ENRICHMENT_PROVIDERS` to opt in (default `none`).
Values starting `CHANGE_ME` count as not configured.

### Start
```bash
bash scripts/start-dev.sh   # applies migrations, builds every image, docker compose up --wait
```
Re-run it after any code change. The Postgres volume `songnodes-dev_dev-postgres-18` is kept;
never reset it to fix a problem. The old Postgres 16 volume `songnodes-dev_dev-postgres` is also kept and is never removed.

---

## 2. Architecture

### Services (`compose.dev.yaml`)
| Service | On your machine | Description |
|---------|------|-------------|
| `frontend` | http://127.0.0.1:3006 | React/PIXI.js app behind nginx; proxies `/api` to the APIs |
| `rest-api` | http://127.0.0.1:8082 | FastAPI backend (routers self-register via `G3`) |
| `graph-api` | http://127.0.0.1:8084 | Graph data |
| `unified-scraper` | http://127.0.0.1:8012 (container port 8000) | ALL spider types (single container) |
| `worker` | – | Celery jobs: scrape, ingest, projection, enrichment |
| `postgres`, `redis`, `rabbitmq` | not published | Database, cache, message bus (Compose network only) |

### Stack
- **Frontend:** React 19, TypeScript 7, Oxlint (`frontend/LINTING.md`), react-router (feature routes self-register via `G2`), PIXI.js v8, D3.js, Zustand; styled only by the SongNodes design system (`design-system/`)
- **Backend:** Python 3.15 (`python:3.15-slim` in the rest-api, graph-api, worker and unified-scraper images; 3.15 in CI), FastAPI, asyncpg / SQLAlchemy 2.0, Pydantic v2
- **Scraping:** Scrapy 2.11+, scrapy-playwright
- **Infrastructure:** Docker Compose (`compose.dev.yaml`); no Kubernetes for now

---

## 3. Development Workflow

See [`AGENTS.md`](AGENTS.md) and [`plan/RESTRUCTURE.md`](plan/RESTRUCTURE.md) for the mandatory small-batch work-package rules (one job, explicit owned paths enforced by `G1`, ~400-line diff budget, two-attempt stop rule, and `STATUS.md` slot rules).

### Branching and PRs
- **main:** Single integration and production branch (direct commits forbidden; there is no `develop` branch).
- **Work-package branches:** `<code-lower>-<slug>` branched directly off `main`, with PR title `<CODE>: <task>` (validated by `scripts/scope_guard.py` once `G1` merges).
- **Merge rule:** Rebase/update from `main` immediately before merging, one PR at a time in wave order (`plan/RESTRUCTURE.md` §5).

### Commits
**Format:** `type(scope): description` or concise step summary per `AGENTS.md` Rule 4 (one commit per verified step)
**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Git-First (CRITICAL)
**Correct:** Code → branch → pull request → `main` → rebuild the stack from Git
**Forbidden:** editing files inside running containers or hand-patching images

### Rebuild after a change
```bash
bash scripts/start-dev.sh                       # everything
# or one service, e.g. after changing the scraper:
docker build -f scrapers/Dockerfile.unified -t songnodes-dev-unified-scraper scrapers/
docker compose -f compose.dev.yaml up -d --no-build --force-recreate unified-scraper
docker compose -f compose.dev.yaml logs --tail=50 unified-scraper
```

**Stale code:** a container runs the image it was created from. After changing code,
rebuild that image and recreate the container (`--force-recreate`); the frontend image
runs `npm run build` itself.

---

## 4. Testing

| Test | Command | When |
|------|---------|------|
| **Scope guard (`G1`)** | `python scripts/scope_guard.py --base origin/main --head HEAD --title "<CODE>: ..." --branch "<code>-..."` | **Every work-package PR** |
| **E2E (MANDATORY)** | `scripts/e2e-docker.sh` (Playwright Linux image, against the running stack) | **Before PR merge (on host with Docker)** |
| Frontend Type + Lint + Unit | `cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` | Frontend dev |
| **Design system sync (MANDATORY)** | `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check` | **Every UI change** |
| Backend | `python -m pytest` (root), `cd services && python -m pytest common/tests` | Backend dev |

**E2E Requirements:** Zero console errors, sequential execution (`--workers=1`), run against a frontend image rebuilt from the code under test. See `frontend/tests/README.md` and `tests/README.md`.

---

## 5. Key Systems

### 5.1. Scraping (Scrapy)

**Pipeline:** Extraction → Validation → Enrichment (delegates to `metadata-enrichment:8020`) → Bronze Persistence

**Resilience:** Proxy rotation, rate limiting, Ollama CAPTCHA solving, retry logic

**Testing:**
```bash
# ✅ CORRECT - Combined search query
scrapy crawl mixesdb -a search_query='Deadmau5 Strobe' -a limit=1

# ❌ WRONG - Artist only
scrapy crawl mixesdb -a search_query='Deadmau5'

# ❌ WRONG - runspider breaks imports
scrapy runspider spiders/mixesdb_spider.py
```

**Bronze Schema:**
```sql
CREATE TABLE bronze_scraped_playlists (
  id UUID PRIMARY KEY,
  source VARCHAR(100),
  source_url TEXT UNIQUE,
  event_name TEXT,
  artist_name VARCHAR(500),
  event_date DATE,
  raw_metadata JSONB
);

CREATE TABLE bronze_scraped_tracks (
  id UUID PRIMARY KEY,
  playlist_id UUID REFERENCES bronze_scraped_playlists,
  position INTEGER NOT NULL,  -- Sequential: 1, 2, 3...
  artist_name VARCHAR(500),
  track_title VARCHAR(500),
  raw_metadata JSONB,
  UNIQUE(playlist_id, position)
);
```

**Transition ETL (Bronze → Silver):**
```sql
INSERT INTO silver_track_transitions (source_track_id, target_track_id, playlist_id)
SELECT t1.canonical_track_id, t2.canonical_track_id, t1.playlist_id
FROM bronze_scraped_tracks t1
JOIN bronze_scraped_tracks t2 ON t1.playlist_id = t2.playlist_id AND t2.position = t1.position + 1
WHERE t1.canonical_track_id IS NOT NULL AND t2.canonical_track_id IS NOT NULL;
```

**Unified Scraper API:**
```bash
curl -X POST http://127.0.0.1:8012/scrape -H "Content-Type: application/json" \
  -d '{
    "spider_name": "mixesdb",
    "search_params": {
      "search_query": "Deadmau5 Strobe",
      "limit": 5
    }
  }'
```

### 5.2. Secrets Management

**Single Source:** the shell environment or an untracked `.env` next to `compose.dev.yaml`

```python
from common.secrets_manager import get_database_url, validate_secrets
if not validate_secrets(['POSTGRES_PASSWORD']): sys.exit(1)
db_url = get_database_url(async_driver=True, use_connection_pool=True)
```

### 5.3. Resource Management

**Connection Pools:**
```python
engine = create_async_engine(db_url, pool_size=5, max_overflow=10, pool_recycle=3600)
pool = redis.ConnectionPool(max_connections=50, health_check_interval=30)
```

**Resource Limits:** Databases (1-2GB), APIs (512MB), Scrapers (1GB), Frontend (256MB)

**PIXI.js Cleanup:**
```tsx
useEffect(() => {
  const app = new PIXI.Application({...});
  return () => {
    app.stage.destroy({ children: true, texture: true, baseTexture: true });
    app.renderer.destroy(true);
    app.destroy(true);
  };
}, []);
```

### 5.4. Graph Interactions (PIXI.js)

**Events:** Use `pointerdown`/`pointerup` (NOT `click` — unreliable during animations)

```tsx
sprite.on('pointerdown', (e) => { dragStart = e.global.clone(); });
sprite.on('pointerup', (e) => {
  if (Math.hypot(e.global.x - dragStart.x, e.global.y - dragStart.y) < 5) {
    handleNodeClick(node);  // Click, not drag
  }
});
```

**Multi-Select:** Ctrl+click (toggle), Shift+click (range)
**Shortcuts:** D (debug), Space (pause), Escape (clear), Ctrl+A (select all)

---

## 6. Deployment

The deployment is the Compose stack built from `main`:

```bash
git switch main && git pull
bash scripts/start-dev.sh
docker compose -f compose.dev.yaml ps   # every service healthy
```

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| Service errors | `docker compose -f compose.dev.yaml ps` |
| Container crashes | `docker compose -f compose.dev.yaml logs -f <service>` |
| Stale code | Rebuild the image and `up -d --no-build --force-recreate <service>` (see §3) |
| Spider ImportError | Use `scrapy crawl [spider]` NOT `runspider` |

**Stale Code Detection:**
```bash
docker compose -f compose.dev.yaml ps --format '{{.Service}} {{.CreatedAt}}'   # container age
git log -1 --format="%ai" -- services/rest_api/                               # last code change
# If the code is newer than the container, rebuild and recreate it
```

**Database Backup:**
```bash
docker compose -f compose.dev.yaml exec -T postgres pg_dump -U songnodes -Fc songnodes > backup-$(date +%Y%m%d).dump
```

---

## 8. Anti-Patterns

### General
❌ Hardcoded credentials (use secrets)
❌ Editing running containers or hand-patching images (rebuild from Git)
❌ Testing against a container built from older code (stale code)
❌ Resetting the Postgres volume to fix a problem
❌ Skipping E2E tests

### Design-System-Specific
❌ **Hex, rgb() or named colours, px font sizes, raw z-index numbers** in app code (use tokens)
❌ **Editing `frontend/src/styles/design-system/`** (it is synced; change the source and re-sync)
❌ **Emoji in the UI**, Title Case labels, "N/A"/"Unknown" for missing values
❌ **Hand-formatted dates, BPM, keys or energy** (use `SN.format`, `SN.camelot`, `EnergyBar`)
❌ **`alert()` / `confirm()`**, a second primary button, a visible nav bar or site tabs
❌ **New Tailwind classes or new legacy `--color-*` variables** (both are being removed)

### Scraper-Specific
❌ **Individual scraper services** (unified-scraper only)
❌ **Partial tracklists** (complete playlists only)
❌ **Searching individual tracks** (search playlists containing tracks)
❌ **Ignoring positions** (positions create edges)
❌ **Missing position gaps** (validate 1→2→3, no jumps)
❌ **Skipping bronze layer** (all data to bronze first)
❌ **Using `runspider`** (use `scrapy crawl`)

---

## 9. Quick Reference

| Task | Command |
|------|---------|
| System Status | `docker compose -f compose.dev.yaml ps` |
| Start / rebuild | `bash scripts/start-dev.sh` |
| View Logs | `docker compose -f compose.dev.yaml logs -f [service]` |
| **Trigger Scrape** | `curl -X POST "http://127.0.0.1:8082/api/v1/scrape/trigger?source=mixesdb&search_query=Deadmau5%20Strobe" -H "Idempotency-Key: <unique>"` |
| Check Bronze | `docker compose -f compose.dev.yaml exec postgres psql -U songnodes -d songnodes -c "SELECT COUNT(*) FROM bronze_scraped_playlists;"` |
| Restart Service | `docker compose -f compose.dev.yaml restart [service]` |
| E2E | `bash scripts/e2e-docker.sh` |

---

**Docker Compose deployment (`compose.dev.yaml`, `scripts/start-dev.sh`). No Kubernetes for now.**
