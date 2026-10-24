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
- **GitOps-First:** Git → Flux → Kubernetes (manual kubectl forbidden in production)
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

**Deployment:** `unified-scraper` is the ONLY scraper pod allowed
**Forbidden:** Individual scraper deployments (`scraper-1001tracklists`, `scraper-mixesdb`, etc.)
**Benefits:** 1GB pod vs 12GB+ (12+ pods), centralized resilience, single source of truth

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

### Prerequisites
Kubernetes (K3s), kubectl, Flux CLI, Skaffold, Helm 3.x, local registry `localhost:5000`

### Secrets
```bash
kubectl create secret generic songnodes-secrets \
  --from-literal=POSTGRES_PASSWORD=your_password \
  --from-literal=REDIS_PASSWORD=your_password \
  --from-literal=RABBITMQ_PASSWORD=your_password \
  --from-literal=ANTHROPIC_API_KEY=your_key \
  --from-literal=SPOTIFY_CLIENT_ID=your_id \
  --from-literal=SPOTIFY_CLIENT_SECRET=your_secret \
  -n songnodes
```

### Deployment
```bash
# GitOps (automatic)
flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system

# Development
skaffold dev  # Hot-reload
```

---

## 2. Architecture

### Services
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3006 | React/PIXI.js graph visualization |
| REST API | 8082 | FastAPI backend |
| Graph API | 8084 | Graph data |
| WebSocket API | 8083 | Real-time updates |
| NLP Processor | 8086 | Tracklist extraction (Claude) |
| Unified Scraper | 8012 | ALL spider types (single pod) |
| PostgreSQL | 5433 | Primary database |
| Redis | 6380 | Cache, sessions |
| RabbitMQ | 5672/15672 | Message bus |

### Stack
- **Frontend:** React 19, TypeScript, react-router, PIXI.js v8, D3.js, Zustand; styled only by the SongNodes design system (`design-system/`)
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Scraping:** Scrapy 2.11+, scrapy-playwright
- **Infrastructure:** Kubernetes only (Docker Compose forbidden)

---

## 3. Development Workflow

### Branching
- **main:** Production (direct commits forbidden)
- **develop:** Integration branch
- **feature/bugfix:** `feature/[ticket]-[description]` from develop

### Commits
**Format:** `type(scope): description`
**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### GitOps (CRITICAL)
**Correct:** Code → Git → Push → Flux → K8s
**Forbidden:** `kubectl edit/patch/apply` (bypasses GitOps)

### Image Pull Policy (CRITICAL)
```yaml
imagePullPolicy: {{ if eq .Values.image.tag "latest" }}Always{{ else }}IfNotPresent{{ end }}
```
**Why:** Kubernetes caches `:latest`; `IfNotPresent` causes stale code

### Redeployment (`:latest` tags)
```bash
# 1. Build and push
docker build -t localhost:5000/songnodes_scrapers:latest scrapers/
docker push localhost:5000/songnodes_scrapers:latest

# 2. Force fresh pull
kubectl delete pods -n songnodes -l app=unified-scraper

# 3. Verify
kubectl logs -n songnodes -l app=unified-scraper --tail=50
```

**Frontend:** MUST run `npm run build` before `docker build` (fresh dist/)

---

## 4. Testing

| Test | Command | When |
|------|---------|------|
| **E2E (MANDATORY)** | `npm run test:e2e` | **Before PR merge** |
| Frontend Unit | `npm run test:unit` | Frontend dev |
| **Design system sync (MANDATORY)** | `scripts/sync-design-system.sh --check` | **Every UI change** |
| Backend Unit | `pytest` | Backend dev |

**E2E Requirements:** Zero console errors, sequential execution (`--workers=1`)

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
curl -X POST http://unified-scraper:8012/scrape -H "Content-Type: application/json" \
  -d '{
    "spider_name": "mixesdb",
    "search_params": {
      "search_query": "Deadmau5 Strobe",
      "limit": 5
    }
  }'
```

### 5.2. Secrets Management

**Single Source:** `.env` (local) or Kubernetes secrets (production)

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

### GitOps (Flux)
```bash
flux get helmreleases -n flux-system
flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system
```

### Skaffold
```bash
skaffold dev  # Hot-reload
skaffold run -p production  # Specific profile
```

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| Service errors | `kubectl get pods -n songnodes` |
| Pod crashes | `kubectl logs -f <pod> -n songnodes` |
| Stale code | Check `imagePullPolicy: Always`, delete pods to force pull |
| Orphaned pods | `kubectl get pods -l app=rest-api` (check for multiple hashes) |
| Spider ImportError | Use `scrapy crawl [spider]` NOT `runspider` |

**Stale Code Detection:**
```bash
kubectl get pods -n songnodes -o wide  # Check pod age
git log -1 --format="%ai" -- services/rest_api/  # Last code change
# If pod age > code modification → stale pods
kubectl rollout restart deployment/rest-api -n songnodes
```

**Database Backup:**
```bash
kubectl exec -n songnodes postgres-0 -- pg_dump -U musicdb_user -Fc musicdb > backup-$(date +%Y%m%d).dump
```

---

## 8. Anti-Patterns

### General
❌ Hardcoded credentials (use secrets)
❌ `kubectl edit/patch` in production (bypasses GitOps)
❌ `imagePullPolicy: IfNotPresent` for `:latest` (stale code)
❌ Skipping E2E tests
❌ Building frontend without `npm run build`

### Design-System-Specific
❌ **Hex, rgb() or named colours, px font sizes, raw z-index numbers** in app code (use tokens)
❌ **Editing `frontend/src/styles/design-system/`** (it is synced; change the source and re-sync)
❌ **Emoji in the UI**, Title Case labels, "N/A"/"Unknown" for missing values
❌ **Hand-formatted dates, BPM, keys or energy** (use `SN.format`, `SN.camelot`, `EnergyBar`)
❌ **`alert()` / `confirm()`**, a second primary button, a visible nav bar or site tabs
❌ **New Tailwind classes or new legacy `--color-*` variables** (both are being removed)

### Scraper-Specific
❌ **Individual scraper deployments** (unified-scraper only)
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
| System Status | `kubectl get pods -n songnodes` |
| Deploy | `skaffold dev` |
| View Logs | `kubectl logs -f deployment/[service] -n songnodes` |
| **Trigger Scrape** | `curl -X POST http://unified-scraper:8012/scrape -d '{"spider_name":"mixesdb","search_params":{"search_query":"Deadmau5 Strobe","limit":5}}'` |
| Check Bronze | `kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM bronze_scraped_playlists;"` |
| Flux Sync | `flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system` |
| Restart Service | `kubectl rollout restart deployment/[service] -n songnodes` |

---

**Kubernetes-only deployment via Flux GitOps. Docker Compose not supported.**
