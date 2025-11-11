# SongNodes: Developer Guide & Project Best Practices

This document outlines the architecture, development workflow, and best practices for the SongNodes project. Adherence to these guidelines is essential for maintaining a clean, scalable, and collaborative development environment.

## Guiding Principles

- **Modularity:** Components are designed as discrete, reusable units with single, well-defined responsibilities.
- **Resilience:** The system incorporates adaptive anti-detection mechanisms, robust error handling, and comprehensive data validation.
- **Scalability:** The architecture is designed for growth, with a clear path toward distributed and cloud-native deployment.
- **Data Integrity:** We prioritize accuracy and consistency through structured extraction, in-flight validation, and a canonical enrichment workflow.
- **GitOps-First:** All infrastructure and application changes flow through Git → Flux → Kubernetes. Manual kubectl operations are forbidden in production.

### Critical Data Quality Requirement: Artist Attribution

**⚠️ MANDATORY FILTERING RULE**

The graph visualization **REQUIRES** valid artist attribution on **BOTH endpoints** of every track transition (edge). Tracks with NULL, empty, or "Unknown Artist" attribution **MUST NOT** appear in the graph under any circumstances.

**Why This Is Non-Negotiable:**
- Artist names are the **primary data point** for the entire application
- The graph's core value proposition is showing **who plays what together**
- Without artist attribution, transitions are meaningless noise
- User experience degrades catastrophically with unknown artists

**Implementation Requirements:**

All layers of the stack MUST enforce this rule:

1. **Database Layer** (`graph_nodes` view): Returns NULL `artist_name` for tracks without valid `track_artists` relationships
2. **API Layer** (Graph Visualization API): Filters edges where either endpoint has NULL/Unknown artist
3. **Frontend Layer** (useDataLoader hook): Validates nodes have non-empty, non-unknown artist names
4. **ETL Layer** (Silver-to-Gold): Creates `track_artists` entries ONLY for tracks with valid artist names

**Valid Artist Names:**
- ✅ Non-empty strings
- ✅ Not "Unknown", "Unknown Artist", "Various Artists", "VA"
- ✅ Not prefixed with "Unknown Artist @", "VA @", etc.

**Invalid Artist Names (REJECT):**
- ❌ NULL
- ❌ Empty string ('')
- ❌ "Unknown", "Unknown Artist"
- ❌ "Various Artists", "Various", "VA"
- ❌ Any string starting with the above patterns

**Data Quality Strategy:**

Instead of relaxing filters to show more tracks, we must **improve data quality upstream**:

1. **Metadata Enrichment** (Section 5.1.5): Use Spotify/MusicBrainz APIs to backfill missing artists
2. **NLP Pipeline Enhancement**: Fix artist name extraction at the scraping source
3. **Manual Curation**: Tools for users to fix Unknown Artist tracks (ArtistAttributionManager)

**DO NOT:**
- ❌ Remove or relax artist name filters to "show more tracks"
- ❌ Allow Unknown Artist tracks "temporarily" with plans to fix later
- ❌ Create UI toggles to show/hide Unknown Artist tracks
- ❌ Modify the graph API to accept NULL artists

---

### Critical Scraper Workflow: Target Track Search Strategy

**⚠️ MANDATORY SEARCH PATTERN**

The scraper workflow is designed to find **setlists/playlists** that contain **target tracks**, not to search for individual tracks or artists in isolation.

**Correct Workflow:**

1. **Source**: Read from `target_track_searches` table in database
   - Columns: `target_artist`, `target_title`, `search_query`
   - Example row: `target_artist='Deadmau5'`, `target_title='Strobe'`, `search_query='Deadmau5 Strobe'`

2. **Search**: Use the `search_query` field (artist + title combined)
   - ✅ CORRECT: Search MixesDB for "Deadmau5 Strobe"
   - ❌ WRONG: Search for just "Deadmau5" (artist only)
   - ❌ WRONG: Search for just "Strobe" (title only)

3. **Find**: Locate setlists/mixes that **contain** that specific track
   - MixesDB returns pages like "2019-06-15 - Deadmau5 @ Ultra Music Festival"
   - These pages have full tracklists with setlist metadata

4. **Scrape**: Extract the **ENTIRE setlist** (all tracks in order)
   - Playlist metadata: DJ name, event, date, venue
   - All tracks: position, artist, title, timing
   - Track transitions: Track A → Track B → Track C (adjacency data)

5. **Store**: Save both playlist AND track transition data
   - `bronze_scraped_playlists`: Setlist with metadata
   - `bronze_scraped_tracks`: Individual tracks
   - Graph edges: Who plays what tracks together

**Why This Matters:**

- **Goal**: Build a graph showing "DJs who play Track X also play Track Y"
- **Method**: Find setlists containing Track X, scrape ALL tracks from those setlists
- **Result**: Transition data (X→Y, Y→Z) for graph visualization

**Example:**

```
Target: "Deadmau5 - Strobe"
Search: "Deadmau5 Strobe" on MixesDB
Finds: "2019-06-15 - Deadmau5 @ Ultra Music Festival"
Scrapes:
  1. Ghosts 'n' Stuff (0:00)
  2. Strobe (4:23)          ← Our target track
  3. I Remember (15:47)
  4. Some Chords (22:10)
Creates transitions:
  - Ghosts 'n' Stuff → Strobe
  - Strobe → I Remember
  - I Remember → Some Chords
```

**DO NOT:**
- ❌ Search for artist names only ("Deadmau5")
- ❌ Scrape individual track pages (no setlist context)
- ❌ Create scrapers that don't preserve track order
- ❌ Ignore playlist/setlist metadata

**Implementation:**

The CronJob MUST query `target_track_searches` and use the `search_query` field:

```sql
SELECT search_query, target_artist, target_title
FROM target_track_searches
WHERE scraper_name = 'mixesdb'
LIMIT 10;
```

Then call the unified scraper API with `search_query` parameter:

```json
{
  "source": "mixesdb",
  "search_query": "Deadmau5 Strobe",  // NOT just "Deadmau5"
  "limit": 5
}
```

---

## 1. Getting Started: Kubernetes-Native Deployment

### 1.1. Clone the Repository

```bash
git clone [repository-url]
cd songnodes
```

### 1.2. Prerequisites

**Required:**
- Kubernetes cluster (K3s recommended for local/edge deployment)
- kubectl configured to access your cluster
- Flux CLI (`flux` command)
- Skaffold for development workflow
- Helm 3.x

**Optional:**
- Local container registry (K3s includes one at `localhost:5000`)

### 1.3. Configure Secrets

Create Kubernetes secrets for the songnodes namespace:

```bash
# Create namespace
kubectl create namespace songnodes

# Create secrets from environment file
kubectl create secret generic songnodes-secrets \
  --from-literal=POSTGRES_PASSWORD=your_secure_password \
  --from-literal=REDIS_PASSWORD=your_redis_password \
  --from-literal=RABBITMQ_PASSWORD=your_rabbitmq_password \
  --from-literal=ANTHROPIC_API_KEY=your_anthropic_key \
  --from-literal=SPOTIFY_CLIENT_ID=your_spotify_id \
  --from-literal=SPOTIFY_CLIENT_SECRET=your_spotify_secret \
  -n songnodes
```

### 1.4. Deploy with Flux GitOps

Flux automatically deploys and manages the application from the Git repository:

```bash
# Flux will automatically sync from the main branch
# Check deployment status:
flux get kustomizations
flux get helmreleases -n flux-system

# Or manually trigger reconciliation:
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system
```

### 1.5. Development Workflow with Skaffold

For active development with hot-reload and automatic deployment:

```bash
# Deploy to K8s and watch for changes
skaffold dev

# Build and deploy without watching
skaffold run

# Clean up development deployment
skaffold delete
```

### 1.6. Verify Services

```bash
# Check pod status
kubectl get pods -n songnodes

# Check service endpoints
kubectl get svc -n songnodes

# View logs for a specific service
kubectl logs -f deployment/rest-api -n songnodes

# Check data integrity
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
```

---

## 2. Core Architecture

The project uses a microservices architecture to decouple concerns and enable independent scaling.

| Service | Port (External) | Description |
|:--------|:----------------|:------------|
| **Frontend** | `3006` | React/TypeScript SPA with PIXI.js for graph visualization. |
| **REST API** | `8082` | FastAPI backend for core business logic and audio analysis. |
| **Graph API** | `8084` | Manages graph-based data for visualization and analysis. |
| **WebSocket API** | `8083` | Provides real-time updates via RabbitMQ message fanout. |
| **NLP Processor** | `8086` | Tracklist extraction with Claude/Anthropic API. |
| **Scraping Subsystem** | `N/A` | **(See Section 5.1)** A resilient Scrapy-based system for data acquisition. |
| **PostgreSQL** | `5433` | Primary relational database with PostGIS and JSONB support. |
| **Redis** | `6380` | High-performance cache, session store, and task queue broker. |
| **RabbitMQ** | `5672`/`15672` | Asynchronous message bus for decoupling long-running tasks. |
| **Prometheus** | `9091` | Time-series database for collecting application and system metrics. |
| **Grafana** | `3001` | Dashboard for visualizing metrics and monitoring system health. |

### 2.1. Technology Stack

- **Frontend**: React 18.3.1, TypeScript 5.5.4, PIXI.js v8.5.2, D3.js, Vite, Zustand 4.5.5
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Scraping**: Scrapy 2.11+, scrapy-playwright (for dynamic content)
- **Infrastructure**: Docker Compose (development), Kubernetes (production)

---

## 3. Development Workflow & Git Best Practices

A disciplined workflow is critical for managing complexity and ensuring code quality.

### 3.1. Branching Strategy

We use a simplified GitFlow model:

- **`main`**: Represents the stable, production-ready code. Direct commits are **forbidden**.
- **`develop`**: The primary integration branch. All feature and bugfix branches are merged into `develop`.
- **Feature Branches**: All new work must be done on a feature branch created from `develop`.
  - **Naming Convention**: `feature/[ticket-id]-[short-description]` (e.g., `feature/SN-123-camelot-key-api`)
- **Bugfix Branches**: For fixing bugs found in `develop`.
  - **Naming Convention**: `bugfix/[ticket-id]-[short-description]` (e.g., `bugfix/SN-145-pixi-drag-event`)

### 3.2. Commit Hygiene: Conventional Commits

Your commit messages must follow the **Conventional Commits** specification. This practice enables automated changelog generation and makes the repository history highly readable.

**Format**: `type(scope): description`

- **`feat`**: A new feature (e.g., `feat(api): add fuzzy search endpoint`)
- **`fix`**: A bug fix (e.g., `fix(frontend): correct memory leak in graph component`)
- **`docs`**: Documentation changes (e.g., `docs(readme): update setup instructions`)
- **`style`**: Code style changes that don't affect logic (e.g., `style(scraper): apply black formatting`)
- **`refactor`**: Code changes that neither fix a bug nor add a feature.
- **`test`**: Adding or correcting tests.
- **`chore`**: Build process or tooling changes (e.g., `chore(docker): upgrade python base image`)

**Examples**:
```bash
git commit -m "feat(camelot-wheel): add harmonic compatibility visualization"
git commit -m "fix(graph): resolve PIXI.js memory leak in node cleanup"
git commit -m "docs(architecture): document scraping pipeline flow"
git commit -m "test(api): add unit tests for fuzzy search"
```

### 3.3. The Pull Request (PR) Process

1. **Create a Branch**:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/SN-123-my-feature
   ```

2. **Develop & Commit**: Make your changes and write clean, conventional commit messages.

3. **Run Local Tests**: Ensure all tests pass before pushing:
   ```bash
   npm test                           # Frontend unit tests
   docker compose exec rest-api pytest  # Backend tests
   npm run test:e2e                   # E2E tests (MANDATORY)
   ```

4. **Push and Create PR**:
   ```bash
   git push -u origin feature/SN-123-my-feature
   # Open a Pull Request targeting the 'develop' branch via GitHub/GitLab UI
   ```

5. **Describe Your PR**: Use the PR template to clearly explain the "what, why, and how" of your changes. Link to any relevant tickets.

6. **Pass CI Checks**: The CI pipeline will automatically run tests, linting, and other checks. All checks must pass.

7. **Code Review**: Request a review from at least one other team member. Address all feedback with new commits.

8. **Merge**: Once approved and all checks are green, merge the PR using **"Squash and Merge"**. This condenses your work into a single, clean commit on the `develop` branch.

### 3.4. GitOps-First Deployment Workflow

**⚠️ CRITICAL: All infrastructure and application changes MUST flow through GitOps**

**Correct Deployment Workflow:**

```
Code Change → Git Commit → Git Push → Flux Reconcile → Kubernetes Apply → Verify
```

**Step-by-Step Process:**

1. **Make Changes**: Edit code, Helm values, or Kubernetes manifests
2. **Commit to Git**: `git add . && git commit -m "feat(api): add new endpoint"`
3. **Push to Repository**: `git push origin main`
4. **Trigger Flux Sync** (if needed): `flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system`
5. **Verify Deployment**: `kubectl get pods -n songnodes` and check logs

**⚠️ FORBIDDEN COMMANDS IN PRODUCTION:**

These commands **bypass GitOps** and create configuration drift:

```bash
# ❌ NEVER USE IN PRODUCTION
kubectl edit deployment/rest-api -n songnodes
kubectl patch deployment/rest-api -n songnodes --patch '...'
kubectl apply -f local-manifest.yaml -n songnodes
kubectl set image deployment/rest-api rest-api=new-image:latest -n songnodes
```

**Why These Are Dangerous:**
- Changes are not tracked in Git (no audit trail)
- Flux will overwrite manual changes on next reconciliation
- Creates configuration drift between Git and cluster state
- Impossible to reproduce in other environments
- No rollback capability

**Emergency Situations Only:**

If you MUST make manual changes in an emergency:
1. Document the change in a Git issue immediately
2. Create a follow-up PR to codify the change in Git
3. Expect Flux to overwrite manual changes within minutes

**Image Pull Policy Enforcement:**

**⚠️ CRITICAL: All Helm charts MUST enforce `imagePullPolicy: Always` for `:latest` tags**

This prevents pods from running stale code when images are updated.

**Required Helm Template Pattern:**

```yaml
# deploy/helm/songnodes/templates/deployment.yaml
spec:
  containers:
  - name: {{ .Values.service.name }}
    image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
    imagePullPolicy: {{ if eq .Values.image.tag "latest" }}Always{{ else }}IfNotPresent{{ end }}
```

**Why This Is Mandatory:**
- Kubernetes caches images by tag
- With `IfNotPresent`, Kubernetes won't pull `:latest` if it already has an image with that tag
- Result: Pods run OLD code even after image is rebuilt
- `Always` forces Kubernetes to check the registry on every pod start

**Frontend Build Requirements:**

Before building frontend Docker images, you MUST run the production build:

```bash
# ❌ WRONG - Dockerfile copies stale dist/
docker build -t localhost:5000/songnodes-frontend:latest frontend/

# ✅ CORRECT - Build fresh production assets first
cd frontend
npm run build  # Creates fresh dist/ directory
cd ..
docker build -t localhost:5000/songnodes-frontend:latest frontend/
docker push localhost:5000/songnodes-frontend:latest
```

**Redeployment After Code Changes:**

**⚠️ DEVELOPMENT vs PRODUCTION Methods**

The correct redeployment method depends on your image tagging strategy:

**Development (`:latest` tags):**

```bash
# Step 1: Make code changes and commit
git add scrapers/spiders/mixesdb_spider.py
git commit -m "fix(scrapers): fix artist_name persistence bug"

# Step 2: Pull latest changes (if needed)
git pull --rebase

# Step 3: Build and push image
docker build -t localhost:5000/songnodes_scrapers:latest scrapers/
docker push localhost:5000/songnodes_scrapers:latest

# Step 4: Force pods to pull fresh image by deleting them
# (Kubernetes will recreate with imagePullPolicy: Always)
kubectl delete pods -n songnodes -l app=unified-scraper

# Step 5: Verify new pods are running
kubectl get pods -n songnodes -l app=unified-scraper
kubectl logs -n songnodes -l app=unified-scraper --tail=50
```

**Why delete pods instead of `kubectl rollout restart`?**
- Flux/GitOps doesn't detect `:latest` image changes (limitation of Kubernetes)
- `kubectl rollout restart` creates new pods but may still use cached images
- Deleting pods forces Kubernetes to pull fresh images from registry
- With `imagePullPolicy: Always`, new pods will get the latest image

**Production (versioned tags):**

```bash
# Step 1: Make code changes and commit
git add services/rest-api/main.py
git commit -m "feat(api): add new endpoint"

# Step 2: Update image tag in Helm values
# deploy/helm/songnodes/values.yaml
image:
  tag: "v1.2.3"  # Increment version

# Step 3: Commit version bump
git add deploy/helm/songnodes/values.yaml
git commit -m "chore(helm): bump rest-api to v1.2.3"
git push origin main

# Step 4: Build and push versioned image
docker build -t localhost:5000/songnodes_rest-api:v1.2.3 services/rest_api
docker push localhost:5000/songnodes_rest-api:v1.2.3

# Step 5: Trigger Flux reconciliation
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system

# Flux will detect the version change and deploy automatically
```

**⚠️ NEVER use these in production:**
- `kubectl rollout restart` - bypasses GitOps audit trail
- `kubectl edit` - changes not tracked in Git
- `kubectl apply -f local-file.yaml` - creates config drift

### 3.5. Kubernetes Development Loop

After making changes to service code, Skaffold automatically rebuilds and redeploys:

```bash
# Start Skaffold in development mode (watches for file changes)
skaffold dev

# Skaffold will:
# 1. Build changed container images
# 2. Push to local registry (localhost:5000)
# 3. Update Kubernetes deployments
# 4. Stream logs from all pods
```

**Manual Build and Deploy:**

```bash
# Build and push images without Skaffold
docker build -t localhost:5000/songnodes_rest-api:latest services/rest_api
docker push localhost:5000/songnodes_rest-api:latest

# Restart deployment to pull new image
kubectl rollout restart deployment/rest-api -n songnodes
kubectl rollout status deployment/rest-api -n songnodes
```

**Frontend Development:**

```bash
# For rapid frontend development with hot-reload
cd frontend
npm run dev

# Frontend will be accessible at http://localhost:5173
# API calls will proxy to K8s services via kubectl port-forward
```

### 3.6. File Management Rules

- **ALWAYS EDIT** existing files - never create new unless absolutely necessary
- **NO DUPLICATE CONFIGS** - Single source of truth in Helm charts
- **USE KUSTOMIZE OVERLAYS** - For environment-specific configurations

---

## 4. Testing Strategy

Comprehensive testing is mandatory before any code is merged into `develop`.

| Test Type | Command | When to Run |
|:----------|:--------|:------------|
| **Frontend Unit/Component** | `npm test` | During frontend development. |
| **Backend Unit/Integration** | `docker compose exec [service] pytest` | During backend development. |
| **End-to-End (E2E)** | `npm run test:e2e` | **MANDATORY.** Before any PR merge. |
| **Graph Tests** | `npm run test:graph` | When modifying PIXI.js graph visualization. |
| **PIXI.js Tests** | `npm run test:pixi` | When modifying PIXI.js components. |
| **Performance Tests** | `npm run test:performance` | Before production deployment. |

### 4.1. E2E Test Mandate

The Playwright E2E test suite **must pass with zero console errors** before any frontend changes are merged. This is our primary defense against regressions.

**Required checks**:
- No JavaScript errors
- No React errors
- No TypeScript errors
- No reference errors
- All components render correctly

**DO NOT deploy if**:
- Tests fail
- Console errors present
- Components don't render

### 4.2. Test Execution Guidelines

**CRITICAL: Sequential Test Execution**

Playwright tests **MUST** be run one at a time with a single worker to prevent resource conflicts and ensure reliable results.

**Correct test execution**:
```bash
# Run tests with single worker (-j 1 or --workers=1)
npx playwright test --workers=1

# Run specific test file
npx playwright test tests/e2e/design-system/button.spec.ts --workers=1

# Run single test by name
npx playwright test -g "should render all variants" --workers=1
```

**DO NOT**:
- ❌ Run tests in parallel with multiple workers
- ❌ Use default Playwright configuration (uses 8 workers)
- ❌ Run multiple test commands simultaneously

**Why this is mandatory**:
- Prevents browser resource conflicts
- Ensures consistent test results
- Avoids memory issues with PIXI.js/WebGL tests
- Allows proper cleanup between tests

---

## 5. Key Systems Deep Dive

### 5.1. Scraping Subsystem (Scrapy Framework)

The "Scraper Orchestrator" is a high-resilience data acquisition system built on the **Scrapy framework**, reflecting best practices for production web scraping. It is not a single service but a collection of Scrapy spiders designed for specific targets (1001tracklists, Mixesdb, etc.).

#### 5.1.1. Architecture: Chained Item Pipeline

The system uses a chained Item Pipeline architecture for a clear separation of concerns:

1. **Extraction (Spiders)**: Spiders extract raw data using `ItemLoaders` to apply initial, field-level cleaning.
2. **Validation Pipeline**: Performs holistic checks on the loaded item (e.g., required fields, data types).
3. **Enrichment Pipeline (Delegation Mode)**: Thin HTTP client that delegates ALL enrichment to the metadata-enrichment microservice. See Section 5.1.5 for details.
4. **Persistence Pipeline**: Saves the fully validated and enriched item to PostgreSQL using "upsert" logic to prevent duplicates.

#### 5.1.2. Resilience Features

The framework includes a coordinated suite of downloader middlewares:

- **Intelligent Proxy Rotation**: Manages a health-aware pool of proxies, superior to simple random selection.
- **Dynamic Header Management**: Generates realistic, browser-like headers to avoid simple bot detection.
- **Adaptive Rate Limiting**: Automatically adjusts request rates based on server responses (429, 503 status codes).
- **FREE Ollama CAPTCHA Solving**: Self-hosted AI vision model for CAPTCHA solving (no external costs, privacy-preserving). Legacy paid services (2Captcha, Anti-Captcha) deprecated but available.
- **Retry Logic**: Exponential backoff with jitter for failed requests.

#### 5.1.3. Dynamic Content Handling

For JavaScript-heavy sites, spiders surgically activate `scrapy-playwright` to control a headless browser, while standard requests use Scrapy's highly efficient default downloader.

**Example Spider Pattern**:
```python
from scrapy import Spider
from scrapy_playwright.page import PageMethod

class DynamicSiteSpider(Spider):
    name = "dynamic_site"

    def start_requests(self):
        yield scrapy.Request(
            url="https://example.com/page",
            meta={
                "playwright": True,
                "playwright_page_methods": [
                    PageMethod("wait_for_selector", ".track-list"),
                    PageMethod("evaluate", "window.scrollTo(0, document.body.scrollHeight)"),
                ],
            },
        )
```

#### 5.1.4. Testing Spiders

Spiders must be tested using the proper Scrapy framework invocation to maintain the Python package context required for relative imports.

**❌ INCORRECT - Using `runspider` with relative imports**:
```bash
# This command WILL FAIL with ImportError if the spider uses relative imports
docker compose exec scraper-orchestrator python -m scrapy runspider spiders/mixesdb_spider.py -a artist_name='Artist'
```

**Why it fails**: The `runspider` command executes a spider file directly, outside of its Python package context. When the spider contains relative imports (e.g., `from .improved_search_strategies import get_mixesdb_searches`), Python cannot resolve them because it doesn't recognize the parent package, resulting in:
```
ImportError: attempted relative import with no known parent package
```

**✅ CORRECT - Using `scrapy crawl` with spider name**:
```bash
# Method 1: Via Scrapy CLI (proper module loading)
docker compose exec scraper-orchestrator scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=1

# Method 2: Via Orchestrator API (recommended for production)
curl -X POST http://localhost:8012/scrape \
  -H "Content-Type: application/json" \
  -d '{"artist_name":"Deadmau5","limit":1}'
```

**Why it works**: The `scrapy crawl` command:
1. Loads the spider through Scrapy's project structure
2. Maintains the Python package hierarchy (`scrapers.spiders.mixesdb_spider`)
3. Properly resolves all relative imports within the package
4. Applies all configured settings, middlewares, and pipelines

**Testing Guidelines**:
- Always use `scrapy crawl [spider_name]` for testing
- Pass spider arguments using `-a key=value` format
- Use the orchestrator API endpoint for integration testing
- Never use `runspider` for spiders with relative imports
- If you must use `runspider`, convert all relative imports to absolute imports first

#### 5.1.5. Enrichment Delegation Architecture

The scraper enrichment pipeline has been refactored to eliminate code duplication and create a single source of truth for all track enrichment.

**Architecture Pattern**: **Delegation Mode**

Instead of inline API enrichment in the scraper pipeline, all enrichment is delegated to the `metadata-enrichment` microservice via HTTP.

**Before (Legacy - Removed)**:
```
Scraper → Inline API Calls → Spotify/MusicBrainz/Last.fm
         (1000 lines, basic retry, simple caching)
```

**After (Current)**:
```
Scraper (thin client, ~380 lines)
   ↓ HTTP POST /enrich
Metadata-Enrichment Service
   ↓ Circuit Breaker + Caching + Retries + DLQ
Spotify/MusicBrainz/Last.fm APIs
```

**Benefits**:

1. **Single Source of Truth**: All enrichment logic in one place
2. **Shared Resilience**: Circuit breaker, advanced caching, exponential backoff, DLQ
3. **62% Code Reduction**: Scraper pipeline: ~1000 → ~380 lines
4. **70% Cost Savings**: Improved cache hit rate (40% → 70-80%)
5. **Centralized API Keys**: Managed via database, not environment variables

**Pipeline Implementation** (`scrapers/pipelines/api_enrichment_pipeline.py`):

```python
class APIEnrichmentPipeline:
    """Thin client that delegates to metadata-enrichment service"""

    async def process_item(self, item, spider):
        # Extract track info
        artist = self._get_primary_artist(adapter)
        title = adapter.get('track_name')

        # Delegate to service
        enrichment_data = await self._enrich_via_service(
            track_id=adapter.get('track_id'),
            artist_name=artist,
            track_title=title
        )

        # Apply enrichment
        if enrichment_data and enrichment_data.get('status') == 'completed':
            self._apply_enrichment_data(adapter, enrichment_data)
```

**Service API Contract**:

**Request**: `POST http://metadata-enrichment:8020/enrich`
```json
{
  "track_id": "uuid",
  "artist_name": "Artist Name",
  "track_title": "Track Title",
  "existing_spotify_id": "optional",
  "existing_isrc": "optional"
}
```

**Response**:
```json
{
  "track_id": "uuid",
  "status": "completed|partial|failed",
  "sources_used": ["spotify", "musicbrainz"],
  "metadata_acquired": {
    "spotify_id": "...",
    "isrc": "...",
    "bpm": 128,
    "key": "A Minor"
  },
  "cached": false,
  "timestamp": "2025-10-10T..."
}
```

**Configuration Requirements**:

All scraper services must:
1. **Depend on** `metadata-enrichment` in docker-compose.yml
2. **Set** `METADATA_ENRICHMENT_URL=http://metadata-enrichment:8020` environment variable

**Example** (docker-compose.yml):
```yaml
scraper-mixesdb:
  environment:
    METADATA_ENRICHMENT_URL: http://metadata-enrichment:8020
  depends_on:
    - metadata-enrichment
```

**Monitoring**:

- **Success Rate**: `curl http://localhost:8022/stats`
- **Cache Hit Rate**: Target > 70%
- **Circuit Breaker**: `curl http://localhost:8022/health | jq '.api_clients'`

**Troubleshooting**:

| Issue | Solution |
|:------|:---------|
| Service unavailable | Check `docker compose ps metadata-enrichment` |
| Timeouts | Increase `ENRICHMENT_TIMEOUT` (default: 60s) |
| No enrichment data | Check circuit breaker status, reset if needed |
| High memory usage | Clear Redis cache: `enrichment:*` pattern |

**Migration Guide**: See `/mnt/my_external_drive/programming/songnodes/docs/ENRICHMENT_DELEGATION_MIGRATION.md`

### 5.2. Secrets Management

A unified, centralized secrets management system is enforced to prevent configuration drift and security vulnerabilities.

#### 5.2.1. Single Source of Truth

All credentials for local development are defined in the `.env` file.

```bash
# Standard password values
POSTGRES_PASSWORD=musicdb_secure_pass_2024
REDIS_PASSWORD=redis_secure_pass_2024
RABBITMQ_PASS=rabbitmq_secure_pass_2024
```

#### 5.2.2. Centralized Access

All services **must** use the `common.secrets_manager` module to access credentials. Direct access to environment variables (`os.getenv`) is forbidden.

**✅ Correct Pattern**:
```python
from common.secrets_manager import get_database_url, validate_secrets
import sys

# At service startup
if not validate_secrets(['POSTGRES_PASSWORD', 'REDIS_PASSWORD']):
    logger.error("❌ Required secrets are missing. Check your .env file.")
    sys.exit(1)

# Get a database URL for SQLAlchemy or other clients
db_url = get_database_url(async_driver=True, use_connection_pool=True)
# Returns: postgresql+asyncpg://musicdb_user:PASSWORD@db-connection-pool:6432/musicdb
```

**❌ Incorrect Patterns**:
```python
# ❌ Hardcoded password
password = "musicdb_pass"

# ❌ Inconsistent defaults
password = os.getenv('POSTGRES_PASSWORD', 'musicdb_pass')  # WRONG DEFAULT

# ❌ Direct environment access without fallback
password = os.environ['POSTGRES_PASSWORD']  # Crashes if not set
```

#### 5.2.3. Priority Order (Secrets Resolution)

1. **Docker Secrets** (`/run/secrets/postgres_password`) - Production
2. **Environment Variables** (`.env` file via docker-compose) - Development
3. **Default Values** (only for non-sensitive config like hostnames)

#### 5.2.4. Host vs Container Connection

```python
# For services running IN containers
db_config = get_database_config()  # Uses 'postgres' host, port 5432

# For scripts running ON HOST (testing/development)
db_config = get_database_config(
    host_override="localhost",
    port_override=5433  # External port from docker-compose
)
```

### 5.3. Resource & Memory Management

Memory leaks and unbounded resource usage are critical failures.

#### 5.3.1. Connection Pooling

All database and Redis connections **must** use a connection pool with configured size limits, timeouts, and health checks.

**Database Connection Pool**:
```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    db_url,
    pool_size=5,              # Minimum connections
    max_overflow=10,          # Maximum additional connections
    pool_timeout=30,          # Seconds to wait for connection
    pool_recycle=3600,        # Recycle connections after 1 hour
    pool_pre_ping=True        # Verify connections before use
)
```

**Redis Connection Pool**:
```python
import redis

pool = redis.ConnectionPool(
    host='redis',
    port=6379,
    max_connections=50,
    health_check_interval=30,
    socket_keepalive=True,
    socket_timeout=5
)
redis_client = redis.Redis(connection_pool=pool)
```

#### 5.3.2. Container Resource Limits

All services in `docker-compose.yml` have defined memory and CPU reservations and limits to prevent any single service from starving the host.

```yaml
services:
  rest-api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.5'
```

**Allocation Guidelines**:
- **Databases** (PostgreSQL): 1-2GB
- **APIs** (REST, Graph, WebSocket): 512MB
- **Scrapers**: 1GB
- **Frontend**: 256MB
- **AI/Ollama**: 8GB

#### 5.3.3. Frontend Cleanup

PIXI.js and other event-heavy libraries require meticulous cleanup. Use `useEffect` return functions to destroy objects, remove tickers, and detach event listeners.

**✅ Correct Pattern**:
```tsx
useEffect(() => {
  const app = new PIXI.Application({ ... });
  const ticker = new PIXI.Ticker();

  // Your logic here

  return () => {
    // Cleanup MUST be comprehensive
    ticker.destroy();
    app.stage.removeChildren();
    app.stage.destroy({ children: true, texture: true, baseTexture: true });
    app.renderer.destroy(true);
    app.destroy(true);
  };
}, []);
```

#### 5.3.4. Monitoring

Prometheus is configured to scrape key metrics (`db_pool_connections`, `redis_memory_usage`, `websocket_connections`, `process_memory`). Grafana dashboards are set up with alerts for high memory usage (>85%) or pool exhaustion (>80%).

**Health Check Pattern**:
```python
from fastapi import HTTPException

async def health_check():
    # Check database pool
    pool_usage = engine.pool.size() / (engine.pool.size() + engine.pool.overflow())
    if pool_usage > 0.8:
        raise HTTPException(status_code=503, detail="Database pool exhausted")

    # Check memory
    memory_percent = psutil.virtual_memory().percent
    if memory_percent > 85:
        raise HTTPException(status_code=503, detail="Memory usage critical")

    return {"status": "healthy"}
```

### 5.4. Graph Node Interactions (PIXI.js v8.5.2 + D3.js)

#### 5.4.1. Event Handling

Use `pointerdown`/`pointerup` (NOT `click` - unreliable during animations). Differentiate clicks from drags using distance calculation.

```tsx
let dragStart: Point | null = null;

sprite.on('pointerdown', (event) => {
  dragStart = event.global.clone();
});

sprite.on('pointerup', (event) => {
  if (dragStart) {
    const distance = Math.hypot(
      event.global.x - dragStart.x,
      event.global.y - dragStart.y
    );

    if (distance < 5) {
      // It's a click, not a drag
      handleNodeClick(node);
    }
  }
  dragStart = null;
});
```

#### 5.4.2. Multi-Select

Support Ctrl+click (toggle), Shift+click (range), regular click (single-select).

#### 5.4.3. Keyboard Shortcuts

- **D**: Debug mode
- **H**: Help
- **Space**: Pause
- **Escape**: Clear selection
- **Ctrl+A**: Select all

#### 5.4.4. Best Practices

- Debounce clicks (150ms)
- Visual feedback (tint changes)
- Extended hit areas for usability (visual radius + 10px)
- Proper event cleanup in useEffect
- Event listener management to prevent memory leaks

---

## 6. Deployment Architecture

### 6.1. GitOps with Flux

The application is deployed and managed entirely through Flux GitOps:

```bash
# Flux continuously monitors the Git repository
# Changes pushed to main branch trigger automatic deployment

# Check Flux status
flux get all -n flux-system

# View HelmRelease status
kubectl get helmrelease songnodes -n flux-system

# Manual sync (if needed)
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system
```

### 6.2. Development Deployment with Skaffold

```bash
# Development mode with hot-reload
skaffold dev

# One-time deployment
skaffold run

# Deploy with specific profile
skaffold run -p production
```

### 6.3. Production Features

**Infrastructure:**
- StatefulSets for PostgreSQL, Redis, RabbitMQ with persistent storage
- HorizontalPodAutoscalers for auto-scaling application pods
- NetworkPolicies for security isolation between services
- Resource limits and requests for all pods

**Data Persistence:**
- PostgreSQL: 20Gi PersistentVolume (migrated from Docker with 15,137 tracks)
- Redis: 5Gi PersistentVolume for caching
- RabbitMQ: 10Gi PersistentVolume for message queues

**High Availability:**
- Multiple frontend replicas (3 pods)
- Health checks and liveness/readiness probes
- Automatic pod restart on failure
- Rolling updates with zero downtime

**Monitoring:**
- Prometheus metrics collection
- Grafana dashboards
- Pod resource usage tracking
- Application-level metrics

---

## 7. Troubleshooting

| Issue | Solution |
|:------|:---------|
| Service connection errors | Check pod status: `kubectl get pods -n songnodes` |
| Import errors | Verify images are built and pushed to `localhost:5000` registry |
| Frontend can't reach API | Use port-forward: `kubectl port-forward svc/rest-api 8082:8082 -n songnodes` |
| Pod crashes | Check logs: `kubectl logs -f <pod-name> -n songnodes` |
| Memory leaks | Check cleanup in useEffect, verify connection pool limits |
| ImagePullBackOff | Verify local registry is running and images are pushed |
| Spider ImportError | Use `scrapy crawl [spider_name]` NOT `scrapy runspider` - see Section 5.1.4 |
| Flux sync issues | Force reconcile: `flux reconcile source git songnodes` |
| PVC mount issues | Check PV status: `kubectl get pv,pvc -n songnodes` |
| Stale code running | Check imagePullPolicy (must be `Always` for `:latest` tags) |

### 7.1. Common Kubernetes Commands

```bash
# Pod management
kubectl get pods -n songnodes                    # List all pods
kubectl logs -f <pod-name> -n songnodes          # Stream logs
kubectl exec -it <pod-name> -n songnodes -- bash # Shell access
kubectl describe pod <pod-name> -n songnodes     # Detailed info

# Deployment management
kubectl rollout restart deployment/<name> -n songnodes  # Restart deployment
kubectl rollout status deployment/<name> -n songnodes   # Check rollout status
kubectl scale deployment/<name> --replicas=3 -n songnodes  # Scale pods

# Service debugging
kubectl get svc -n songnodes                     # List services
kubectl port-forward svc/<service> 8080:8080 -n songnodes  # Forward port

# Resource monitoring
kubectl top pods -n songnodes                    # Resource usage
kubectl get events -n songnodes --sort-by='.lastTimestamp'  # Recent events

# Stale code detection
kubectl get pods -n songnodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.startTime}{"\n"}{end}'
# Compare pod age to code modification time to detect stale deployments
```

### 7.2. Orphaned Pod Detection

**⚠️ CRITICAL: Orphaned pods can cause confusing deployment failures**

Before diagnosing pod failures, ALWAYS check for multiple pod hash generations:

```bash
# Check for pods with different hash suffixes
kubectl get pods -n songnodes -l app=rest-api

# Example output indicating orphaned pods:
# rest-api-5d7c8b9f4d-abcde  1/1  Running     # Old generation (orphaned)
# rest-api-7f9d6c8a2b-xyzab  0/1  CrashLoop   # New generation (current)
```

**Orphaned Pod Symptoms:**
- Multiple pods with different hash suffixes for same deployment
- Old pod(s) running successfully
- New pod(s) crashing or failing health checks
- Deployment shows incorrect replica count

**Resolution:**

```bash
# 1. Identify orphaned pods (not managed by current deployment)
kubectl get pods -n songnodes -l app=rest-api

# 2. Get current deployment hash
kubectl get deployment/rest-api -n songnodes -o jsonpath='{.spec.template.metadata.labels.pod-template-hash}'

# 3. Delete pods that don't match current deployment hash
kubectl delete pod rest-api-<old-hash>-<id> -n songnodes

# 4. Verify only current-generation pods remain
kubectl get pods -n songnodes -l app=rest-api
```

**Prevention:**
- Always use `kubectl rollout restart` instead of manually deleting pods
- Monitor for pods with multiple hash generations during deployments
- Implement pod disruption budgets to prevent orphaned pods

### 7.3. Database Backup and Restore

```bash
# Backup PostgreSQL
kubectl exec -n songnodes postgres-0 -- pg_dump -U musicdb_user -Fc musicdb > backup-$(date +%Y%m%d).dump

# Restore PostgreSQL
cat backup.dump | kubectl exec -i -n songnodes postgres-0 -- pg_restore -U musicdb_user -d musicdb --clean

# Verify data
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
```

### 7.4. Flux GitOps Management

```bash
# Check Flux system status
flux check

# View all Flux resources
flux get all -n flux-system

# Force reconciliation
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system

# Suspend/Resume automatic sync
flux suspend helmrelease songnodes -n flux-system
flux resume helmrelease songnodes -n flux-system
```

### 7.5. Stale Code Diagnostics

**⚠️ CRITICAL: Verify pods are running latest code before debugging**

Kubernetes caches images and may run stale code even after rebuilding images.

**Detection Steps:**

```bash
# 1. Check when pods were last started
kubectl get pods -n songnodes -o wide

# 2. Check when code was last modified
git log -1 --format="%ai" -- services/rest_api/

# 3. If pod age > code modification time, pods are stale
# Example:
# Pod started: 2025-01-05 10:00:00
# Code modified: 2025-01-05 14:30:00
# Result: Pod is running code from BEFORE the changes

# 4. Check imagePullPolicy
kubectl get deployment/rest-api -n songnodes -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'
# MUST be "Always" for :latest tags

# 5. Force pod restart to pull fresh image
kubectl rollout restart deployment/rest-api -n songnodes
kubectl rollout status deployment/rest-api -n songnodes

# 6. Verify new pods are running
kubectl get pods -n songnodes -l app=rest-api
```

**Common Causes:**
- `imagePullPolicy: IfNotPresent` (WRONG for :latest tags)
- Kubernetes cached old image with :latest tag
- Image built but not pushed to registry
- Registry running stale image

**Resolution:**
1. Verify `imagePullPolicy: Always` in Helm chart
2. Delete pods to force image pull: `kubectl delete pod <pod-name> -n songnodes`
3. Or rollout restart: `kubectl rollout restart deployment/<name> -n songnodes`
4. Confirm fresh pods: `kubectl get pods -n songnodes` (check AGE column)

---

## 8. Anti-Patterns to Avoid

❌ **Unbounded collections**: Always use pagination or limits
❌ **Missing timeouts**: All network calls must have timeouts
❌ **No connection limits**: Use connection pools with max sizes
❌ **Event listener leaks**: Always clean up in useEffect return
❌ **No periodic cleanup**: Implement garbage collection for caches
❌ **Hardcoded credentials**: Use Kubernetes secrets
❌ **Manual deployments**: Use Flux GitOps for all changes
❌ **kubectl edit/patch in production**: Bypasses GitOps, creates config drift
❌ **imagePullPolicy: IfNotPresent for :latest**: Causes stale code in pods
❌ **Skipping tests**: E2E tests are mandatory before merge
❌ **Force pushes to main**: Protected branch
❌ **Unclear commit messages**: Use Conventional Commits
❌ **Using `runspider` with relative imports**: Use `scrapy crawl [spider_name]` instead
❌ **Docker Compose for production**: Kubernetes-only deployment
❌ **Ignoring orphaned pods**: Check for multiple pod hash generations
❌ **Building frontend without npm run build**: Results in stale dist/

---

## 9. Quick Reference

| Task | Command |
|:-----|:--------|
| **Check System Status** | `kubectl get pods -n songnodes` |
| **Deploy with Skaffold** | `skaffold dev` (development) or `skaffold run` (production) |
| **View Logs** | `kubectl logs -f deployment/[service] -n songnodes` |
| **Run Tests** | `npm run test:e2e` |
| **Test Spider in K8s** | `kubectl exec -n songnodes deployment/scraper-orchestrator -- scrapy crawl [spider_name] -a arg=value` |
| **Frontend Dev** | `cd frontend && npm run dev` |
| **Frontend Production Build** | `cd frontend && npm run build` |
| **Flux Status** | `flux get helmreleases -n flux-system` |
| **Force Flux Sync** | `flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system` |
| **Database Backup** | `kubectl exec -n songnodes postgres-0 -- pg_dump -U musicdb_user -Fc musicdb > backup.dump` |
| **Port Forward** | `kubectl port-forward svc/rest-api 8082:8082 -n songnodes` |
| **Scale Service** | `kubectl scale deployment/[service] --replicas=3 -n songnodes` |
| **Restart Deployment** | `kubectl rollout restart deployment/[service] -n songnodes` |
| **Check Pod Age** | `kubectl get pods -n songnodes -o wide` |
| **Check Orphaned Pods** | `kubectl get pods -n songnodes -l app=[service-name]` |
| **Verify ImagePullPolicy** | `kubectl get deployment/[service] -n songnodes -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'` |

---

## 10. System Startup

The SongNodes platform is configured for automatic startup on system reboot:

**K3s Auto-Start:**
- K3s service is enabled via systemd: `systemctl is-enabled k3s`
- Starts automatically on boot
- All pods are restored from persistent storage

**Data Persistence:**
- PostgreSQL: 15,137 tracks persisted to 20Gi PersistentVolume
- Redis: Cache data on 5Gi PersistentVolume
- RabbitMQ: Message queues on 10Gi PersistentVolume

**Post-Reboot Verification:**
```bash
# Check K3s is running
systemctl status k3s

# Verify all pods are healthy
kubectl get pods -n songnodes

# Verify data integrity
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"

# Check for stale pods (compare pod age to last git commit)
kubectl get pods -n songnodes -o wide
git log -1 --format="%ai"
```

---

This is the **only supported way** to develop and deploy SongNodes. The project has been fully migrated from Docker Compose to Kubernetes and is managed entirely through Flux GitOps.
