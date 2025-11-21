# SongNodes: Developer Guide

## Guiding Principles

- **Modularity:** Components are discrete, reusable units with single responsibilities
- **Resilience:** Adaptive anti-detection, robust error handling, comprehensive validation
- **Scalability:** Cloud-native architecture with distributed deployment support
- **Data Integrity:** Structured extraction, validation, and canonical enrichment workflow
- **GitOps-First:** All changes flow through Git → Flux → Kubernetes. Manual kubectl operations forbidden in production

---

## Critical Requirements

### Artist Attribution (MANDATORY)

Graph visualization **REQUIRES** valid artist attribution on **BOTH** endpoints of every track transition. NULL/empty/"Unknown Artist" tracks **MUST NOT** appear.

**Valid:** Non-empty strings excluding "Unknown", "Unknown Artist", "Various Artists", "VA", or similar patterns
**Stack Enforcement:** Database view (NULL for missing `track_artists`) → API (filter NULL/Unknown) → Frontend (validate non-empty) → ETL (create entries only for valid artists)

**Data Quality Strategy:**
1. Metadata enrichment via Spotify/MusicBrainz APIs
2. NLP pipeline enhancement
3. Manual curation tools (ArtistAttributionManager)

**DO NOT:** Relax filters, allow temporary Unknown Artists, create UI toggles, or modify API to accept NULL artists

### Scraper Workflow (MANDATORY)

**Target:** Find **setlists/playlists** containing target tracks (not individual tracks/artists)

**Workflow:**
1. **Source:** Query `target_track_searches` table (`search_query`, `target_artist`, `target_title`)
2. **Search:** Use combined `search_query` (e.g., "Deadmau5 Strobe") — NOT artist/title alone
3. **Find:** Locate setlists containing the target track
4. **Scrape:** Extract ENTIRE setlist (metadata, all tracks, positions, transitions)
5. **Store:** Save playlist + track transition data for graph edges

**Example:** Search "Deadmau5 Strobe" → Find "2019-06-15 Deadmau5 @ Ultra" → Scrape full tracklist (Ghosts 'n' Stuff → Strobe → I Remember → Some Chords) → Create transition edges

### Unified Scraper Deployment (MANDATORY)

**Deployment:** `unified-scraper` is the ONLY scraper pod allowed in production and development

**Forbidden:** Individual scraper deployments (`scraper-1001tracklists`, `scraper-mixesdb`, `scraper-beatport`, etc.) are **strictly prohibited**

**Architecture:** All spider types (mixesdb, 1001tracklists, beatport, etc.) run through the unified-scraper API (`POST http://unified-scraper:8012/scrape`)

**Benefits:**
- Memory efficiency: Single 1GB pod vs. 12+ individual pods (12GB+)
- Centralized resilience: Shared proxy rotation, rate limiting, retry logic
- Simplified management: One deployment to monitor, update, and scale
- Unified configuration: Single source of truth for all scraping parameters

**DO NOT:** Create separate Kubernetes deployments for individual spiders (e.g., Helm chart entries for `scraper-mixesdb-deployment`)

---

## 1. Setup

### Prerequisites
- Kubernetes cluster (K3s recommended), kubectl, Flux CLI, Skaffold, Helm 3.x
- Optional: Local registry (K3s includes `localhost:5000`)

### Secrets Configuration
```bash
kubectl create namespace songnodes
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
flux get kustomizations
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system

# Development (Skaffold)
skaffold dev  # Watch mode with hot-reload
skaffold run  # One-time deployment
```

### Verification
```bash
kubectl get pods -n songnodes
kubectl logs -f deployment/rest-api -n songnodes
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
```

---

## 2. Architecture

### Services
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3006 | React/TypeScript SPA with PIXI.js graph visualization |
| REST API | 8082 | FastAPI backend for business logic and audio analysis |
| Graph API | 8084 | Graph data for visualization |
| WebSocket API | 8083 | Real-time updates via RabbitMQ |
| NLP Processor | 8086 | Tracklist extraction with Claude/Anthropic |
| Scrapers | N/A | Scrapy-based data acquisition (Section 5.1) |
| PostgreSQL | 5433 | Primary database with PostGIS and JSONB |
| Redis | 6380 | Cache, sessions, task queue broker |
| RabbitMQ | 5672/15672 | Async message bus |
| Prometheus | 9091 | Metrics collection |
| Grafana | 3001 | Monitoring dashboards |

### Technology Stack
- **Frontend:** React 18.3.1, TypeScript 5.5.4, PIXI.js v8.5.2, D3.js, Vite, Zustand 4.5.5
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Scraping:** Scrapy 2.11+, scrapy-playwright
- **Infrastructure:** Kubernetes (production), Docker Compose (local dev only)

---

## 3. Development Workflow

### Branching Strategy
- **main:** Production-ready (direct commits forbidden)
- **develop:** Integration branch for all features/bugfixes
- **Feature branches:** `feature/[ticket-id]-[description]` (from `develop`)
- **Bugfix branches:** `bugfix/[ticket-id]-[description]` (from `develop`)

### Commit Convention
**Format:** `type(scope): description`
**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**
```bash
git commit -m "feat(camelot-wheel): add harmonic compatibility visualization"
git commit -m "fix(graph): resolve PIXI.js memory leak in node cleanup"
```

### Pull Request Process
1. Create branch: `git checkout -b feature/SN-123-my-feature`
2. Develop with conventional commits
3. Run tests: `npm test`, `pytest`, **`npm run test:e2e` (MANDATORY)**
4. Push and create PR to `develop`
5. Pass CI checks, get code review
6. Merge using "Squash and Merge"

### GitOps Deployment (CRITICAL)

**Correct Workflow:**
```
Code Change → Git Commit → Push → Flux Reconcile → K8s Apply → Verify
```

**Forbidden Commands (bypass GitOps):**
```bash
❌ kubectl edit deployment/rest-api -n songnodes
❌ kubectl patch deployment/rest-api -n songnodes --patch '...'
❌ kubectl apply -f local-manifest.yaml -n songnodes
❌ kubectl set image deployment/rest-api rest-api=new-image:latest -n songnodes
```

**Emergency Only:** Document immediately, create follow-up PR to codify changes

### Image Pull Policy (CRITICAL)

**Helm Template Required:**
```yaml
imagePullPolicy: {{ if eq .Values.image.tag "latest" }}Always{{ else }}IfNotPresent{{ end }}
```

**Why:** Kubernetes caches `:latest` tags; `IfNotPresent` causes stale code. `Always` forces registry check on pod start.

### Redeployment After Code Changes

**Development (`:latest` tags):**
```bash
# 1. Commit changes
git add scrapers/spiders/mixesdb_spider.py
git commit -m "fix(scrapers): fix artist_name bug"

# 2. Build and push
docker build -t localhost:5000/songnodes_scrapers:latest scrapers/
docker push localhost:5000/songnodes_scrapers:latest

# 3. Force pods to pull fresh image
kubectl delete pods -n songnodes -l app=unified-scraper

# 4. Verify
kubectl get pods -n songnodes -l app=unified-scraper
kubectl logs -n songnodes -l app=unified-scraper --tail=50
```

**Why delete pods?** Flux doesn't detect `:latest` changes; `kubectl rollout restart` may use cached images. Deleting forces fresh pull with `imagePullPolicy: Always`.

**Production (versioned tags):**
```bash
# 1. Update Helm values: image.tag: "v1.2.3"
# 2. Commit and push
git add deploy/helm/songnodes/values.yaml
git commit -m "chore(helm): bump rest-api to v1.2.3"
git push origin main

# 3. Build versioned image
docker build -t localhost:5000/songnodes_rest-api:v1.2.3 services/rest_api
docker push localhost:5000/songnodes_rest-api:v1.2.3

# 4. Flux auto-deploys
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system
```

**Frontend Build Requirements:**
```bash
# ✅ CORRECT
cd frontend && npm run build  # Create fresh dist/
cd .. && docker build -t localhost:5000/songnodes-frontend:latest frontend/
docker push localhost:5000/songnodes-frontend:latest

# ❌ WRONG - Copies stale dist/
docker build -t localhost:5000/songnodes-frontend:latest frontend/
```

### File Management Rules
- **ALWAYS EDIT** existing files — never create new unless absolutely necessary
- **NO DUPLICATE CONFIGS** — Single source of truth in Helm charts
- **USE KUSTOMIZE OVERLAYS** — For environment-specific configurations

---

## 4. Testing Strategy

| Test Type | Command | When |
|-----------|---------|------|
| Frontend Unit | `npm test` | Frontend development |
| Backend Unit | `pytest` | Backend development |
| **E2E (MANDATORY)** | `npm run test:e2e` | **Before PR merge** |
| Graph | `npm run test:graph` | PIXI.js graph changes |
| PIXI.js | `npm run test:pixi` | PIXI.js component changes |
| Performance | `npm run test:performance` | Before production deploy |

### E2E Test Requirements
- **Zero console errors** before merge (JavaScript, React, TypeScript, reference errors)
- All components render correctly
- **DO NOT deploy** if tests fail or console errors present

### Test Execution (CRITICAL)
**Sequential execution required** to prevent resource conflicts:
```bash
npx playwright test --workers=1  # REQUIRED: Single worker
npx playwright test tests/e2e/design-system/button.spec.ts --workers=1
npx playwright test -g "should render all variants" --workers=1
```

**Why:** Prevents browser resource conflicts, ensures consistent results, avoids memory issues with PIXI.js/WebGL

---

## 5. Key Systems

### 5.1. Scraping Subsystem (Scrapy)

**Architecture:** Chained Item Pipeline
1. **Extraction (Spiders):** Raw data extraction with `ItemLoaders`
2. **Validation Pipeline:** Holistic checks (required fields, types)
3. **Enrichment Pipeline:** Delegates to `metadata-enrichment` microservice (Section 5.1.5)
4. **Persistence Pipeline:** Upsert to PostgreSQL (prevent duplicates)

**Resilience Features:**
- Intelligent proxy rotation (health-aware pool)
- Dynamic header management (realistic browser headers)
- Adaptive rate limiting (responds to 429/503)
- FREE Ollama CAPTCHA solving (self-hosted AI vision)
- Retry logic with exponential backoff + jitter

**Dynamic Content:** `scrapy-playwright` for JavaScript-heavy sites

**Testing Spiders:**
```bash
# ✅ CORRECT
scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=1  # Proper module loading
curl -X POST http://localhost:8012/scrape -d '{"artist_name":"Deadmau5","limit":1}'  # API

# ❌ WRONG - Fails with relative imports
scrapy runspider spiders/mixesdb_spider.py -a artist_name='Artist'
```

**Why:** `scrapy crawl` loads spider through project structure, maintains package hierarchy, resolves relative imports. `runspider` executes file directly, breaks imports.

### 5.1.5. Enrichment Delegation Architecture

**Pattern:** Thin client delegates ALL enrichment to `metadata-enrichment` microservice

**Benefits:**
- Single source of truth for enrichment logic
- Shared resilience (circuit breaker, caching, retries, DLQ)
- 62% code reduction (1000 → 380 lines)
- 70% cost savings (cache hit: 40% → 70-80%)
- Centralized API key management

**API Contract:**
```json
POST http://metadata-enrichment:8020/enrich
{
  "track_id": "uuid",
  "artist_name": "Artist Name",
  "track_title": "Track Title",
  "existing_spotify_id": "optional",
  "existing_isrc": "optional"
}

Response:
{
  "track_id": "uuid",
  "status": "completed|partial|failed",
  "sources_used": ["spotify", "musicbrainz"],
  "metadata_acquired": {"spotify_id": "...", "isrc": "...", "bpm": 128, "key": "A Minor"},
  "cached": false,
  "timestamp": "2025-10-10T..."
}
```

**Configuration:**
```yaml
# docker-compose.yml
scraper-mixesdb:
  environment:
    METADATA_ENRICHMENT_URL: http://metadata-enrichment:8020
  depends_on:
    - metadata-enrichment
```

**Monitoring:** `curl http://localhost:8022/stats` (cache hit rate >70% target)

### 5.2. Secrets Management

**Single Source of Truth:** `.env` file for local dev, Kubernetes secrets for production

**Correct Pattern:**
```python
from common.secrets_manager import get_database_url, validate_secrets

if not validate_secrets(['POSTGRES_PASSWORD', 'REDIS_PASSWORD']):
    sys.exit(1)

db_url = get_database_url(async_driver=True, use_connection_pool=True)
```

**Incorrect Patterns:**
```python
❌ password = "musicdb_pass"  # Hardcoded
❌ password = os.getenv('POSTGRES_PASSWORD', 'wrong_default')  # Wrong default
❌ password = os.environ['POSTGRES_PASSWORD']  # No fallback
```

**Priority Order:** Docker Secrets → Environment Variables → Default Values (non-sensitive only)

### 5.3. Resource & Memory Management

**Connection Pooling (REQUIRED):**
```python
# Database
engine = create_async_engine(
    db_url,
    pool_size=5, max_overflow=10, pool_timeout=30,
    pool_recycle=3600, pool_pre_ping=True
)

# Redis
pool = redis.ConnectionPool(
    host='redis', port=6379, max_connections=50,
    health_check_interval=30, socket_keepalive=True, socket_timeout=5
)
```

**Container Resource Limits:**
```yaml
deploy:
  resources:
    limits: {memory: 512M, cpus: '1.0'}
    reservations: {memory: 256M, cpus: '0.5'}
```

**Allocation Guidelines:** Databases (1-2GB), APIs (512MB), Scrapers (1GB), Frontend (256MB), AI/Ollama (8GB)

**Frontend Cleanup (PIXI.js):**
```tsx
useEffect(() => {
  const app = new PIXI.Application({ ... });
  const ticker = new PIXI.Ticker();

  return () => {
    ticker.destroy();
    app.stage.removeChildren();
    app.stage.destroy({ children: true, texture: true, baseTexture: true });
    app.renderer.destroy(true);
    app.destroy(true);
  };
}, []);
```

**Monitoring:** Prometheus scrapes `db_pool_connections`, `redis_memory_usage`, `websocket_connections`, `process_memory`. Grafana alerts for >85% memory or >80% pool exhaustion.

### 5.4. Graph Node Interactions (PIXI.js v8.5.2 + D3.js)

**Event Handling:** Use `pointerdown`/`pointerup` (NOT `click` — unreliable during animations). Differentiate clicks from drags:
```tsx
sprite.on('pointerdown', (event) => { dragStart = event.global.clone(); });
sprite.on('pointerup', (event) => {
  if (dragStart && Math.hypot(event.global.x - dragStart.x, event.global.y - dragStart.y) < 5) {
    handleNodeClick(node);  // Click, not drag
  }
  dragStart = null;
});
```

**Multi-Select:** Ctrl+click (toggle), Shift+click (range), regular click (single-select)

**Keyboard Shortcuts:** D (debug), H (help), Space (pause), Escape (clear selection), Ctrl+A (select all)

**Best Practices:** Debounce clicks (150ms), visual feedback, extended hit areas (+10px), proper cleanup in useEffect

---

## 6. Deployment Architecture

### 6.1. GitOps with Flux
```bash
flux get all -n flux-system
kubectl get helmrelease songnodes -n flux-system
flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system
```

### 6.2. Skaffold Development
```bash
skaffold dev  # Hot-reload
skaffold run  # One-time
skaffold run -p production  # Specific profile
```

### 6.3. Production Features
- **Infrastructure:** StatefulSets (PostgreSQL, Redis, RabbitMQ), HorizontalPodAutoscalers, NetworkPolicies, resource limits
- **Data Persistence:** PostgreSQL (20Gi, 15,137 tracks), Redis (5Gi), RabbitMQ (10Gi)
- **High Availability:** 3 frontend replicas, health checks, auto-restart, rolling updates
- **Monitoring:** Prometheus metrics, Grafana dashboards, resource tracking

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| Service connection errors | `kubectl get pods -n songnodes` |
| Import errors | Verify images built/pushed to `localhost:5000` |
| Frontend can't reach API | `kubectl port-forward svc/rest-api 8082:8082 -n songnodes` |
| Pod crashes | `kubectl logs -f <pod-name> -n songnodes` |
| Memory leaks | Check useEffect cleanup, verify connection pool limits |
| ImagePullBackOff | Verify local registry running, images pushed |
| Spider ImportError | Use `scrapy crawl [spider_name]` NOT `runspider` |
| Flux sync issues | `flux reconcile source git songnodes` |
| Stale code | Check imagePullPolicy (`Always` for `:latest`) |

### Orphaned Pod Detection (CRITICAL)
```bash
kubectl get pods -n songnodes -l app=rest-api  # Check for multiple hash suffixes

# Resolution
kubectl delete pod rest-api-<old-hash>-<id> -n songnodes
kubectl get pods -n songnodes -l app=rest-api  # Verify only current-gen pods
```

**Symptoms:** Multiple pods with different hashes, old pod running, new pod crashing

**Prevention:** Use `kubectl rollout restart`, monitor for multiple hash generations

### Stale Code Detection (CRITICAL)
```bash
kubectl get pods -n songnodes -o wide  # Check pod age
git log -1 --format="%ai" -- services/rest_api/  # Check last code change

# If pod age > code modification, pods are stale
kubectl get deployment/rest-api -n songnodes -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'  # Must be "Always"

# Force fresh image
kubectl rollout restart deployment/rest-api -n songnodes
kubectl rollout status deployment/rest-api -n songnodes
```

**Causes:** `imagePullPolicy: IfNotPresent` (wrong for `:latest`), Kubernetes cached old image, image not pushed

### Database Backup/Restore
```bash
kubectl exec -n songnodes postgres-0 -- pg_dump -U musicdb_user -Fc musicdb > backup-$(date +%Y%m%d).dump
cat backup.dump | kubectl exec -i -n songnodes postgres-0 -- pg_restore -U musicdb_user -d musicdb --clean
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
```

---

## 8. Anti-Patterns to Avoid

❌ Unbounded collections (use pagination/limits)
❌ Missing timeouts (all network calls need timeouts)
❌ No connection limits (use connection pools with max sizes)
❌ Event listener leaks (clean up in useEffect return)
❌ Hardcoded credentials (use Kubernetes secrets)
❌ Manual deployments (use Flux GitOps)
❌ kubectl edit/patch in production (bypasses GitOps, creates drift)
❌ imagePullPolicy: IfNotPresent for :latest (causes stale code)
❌ Skipping tests (E2E mandatory before merge)
❌ Force pushes to main (protected branch)
❌ Unclear commit messages (use Conventional Commits)
❌ Using `runspider` with relative imports (use `scrapy crawl`)
❌ Docker Compose for production (Kubernetes-only)
❌ Ignoring orphaned pods (check for multiple hash generations)
❌ Building frontend without `npm run build` (stale dist/)

---

## 9. Quick Reference

| Task | Command |
|------|---------|
| Check System Status | `kubectl get pods -n songnodes` |
| Deploy with Skaffold | `skaffold dev` / `skaffold run` |
| View Logs | `kubectl logs -f deployment/[service] -n songnodes` |
| Run Tests | `npm run test:e2e` |
| Test Spider | `kubectl exec -n songnodes deployment/scraper-orchestrator -- scrapy crawl [spider_name] -a arg=value` |
| Frontend Dev | `cd frontend && npm run dev` |
| Frontend Build | `cd frontend && npm run build` |
| Flux Status | `flux get helmreleases -n flux-system` |
| Force Flux Sync | `flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system` |
| Database Backup | `kubectl exec -n songnodes postgres-0 -- pg_dump -U musicdb_user -Fc musicdb > backup.dump` |
| Port Forward | `kubectl port-forward svc/rest-api 8082:8082 -n songnodes` |
| Restart Deployment | `kubectl rollout restart deployment/[service] -n songnodes` |
| Check Orphaned Pods | `kubectl get pods -n songnodes -l app=[service-name]` |
| Verify ImagePullPolicy | `kubectl get deployment/[service] -n songnodes -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'` |

---

## 10. System Startup

**K3s Auto-Start:** Systemd-enabled (`systemctl is-enabled k3s`), starts on boot, restores all pods

**Data Persistence:** PostgreSQL (20Gi, 15,137 tracks), Redis (5Gi), RabbitMQ (10Gi)

**Post-Reboot Verification:**
```bash
systemctl status k3s
kubectl get pods -n songnodes
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
kubectl get pods -n songnodes -o wide && git log -1 --format="%ai"  # Check for stale pods
```

---

**This is the only supported way to develop and deploy SongNodes.** The project has been fully migrated from Docker Compose to Kubernetes and is managed entirely through Flux GitOps.
