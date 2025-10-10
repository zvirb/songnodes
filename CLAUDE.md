# SongNodes: Developer Guide & Project Best Practices

This document outlines the architecture, development workflow, and best practices for the SongNodes project. Adherence to these guidelines is essential for maintaining a clean, scalable, and collaborative development environment.

## Guiding Principles

- **Modularity:** Components are designed as discrete, reusable units with single, well-defined responsibilities.
- **Resilience:** The system incorporates adaptive anti-detection mechanisms, robust error handling, and comprehensive data validation.
- **Scalability:** The architecture is designed for growth, with a clear path toward distributed and cloud-native deployment.
- **Data Integrity:** We prioritize accuracy and consistency through structured extraction, in-flight validation, and a canonical enrichment workflow.

---

## 1. Getting Started: Local Environment Setup

### 1.1. Clone the Repository

```bash
git clone [repository-url]
cd songnodes
```

### 1.2. Configure Secrets

A single `.env` file is the source of truth for all local development credentials. This file **must never be committed to Git.**

```bash
# Copy the template to create your local environment file
cp .env.example .env

# Open .env in your editor and fill in any required values
# The defaults are generally sufficient for local development.
```

### 1.3. Launch the System

All services are managed via Docker Compose. This ensures network isolation, service discovery, and consistent environments.

```bash
# Build all container images and start the services in detached mode
docker compose up -d --build
```

### 1.4. Verify Services

```bash
# Check that all containers are running and healthy
docker compose ps

# View the logs for a specific service (e.g., the REST API)
docker compose logs -f rest-api
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

### 3.4. Local Development Loop

After making changes to backend code or Docker configuration, you **must** rebuild the relevant container image.

```bash
# Rebuild a specific service and restart the system
docker compose build [service-name] && docker compose up -d

# Example: After changing the REST API code
docker compose build rest-api && docker compose up -d
```

**Frontend Exception**: For a faster development experience, you can use Vite's hot-reload server. This is the **only service** that should be run outside of Docker Compose for development.

```bash
cd frontend
npm run dev
```

### 3.5. File Management Rules

- **ALWAYS EDIT** existing files - never create new unless absolutely necessary
- **NO OVERLAY FILES** - Single `docker-compose.yml` only
- **NO DUPLICATES** - No alternative/backup versions

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

## 6. Deployment Options

### 6.1. Local Development

```bash
docker compose up -d  # All services
cd frontend && npm run dev  # Frontend hot-reload (exception)
```

### 6.2. Production (Kubernetes)

```bash
# See k8s/README.md for complete instructions
kubectl apply -f k8s/base/namespace.yaml
kubectl create secret generic songnodes-secrets --from-env-file=.env -n songnodes
kubectl apply -k k8s/base/
kubectl apply -k k8s/overlays/production/
```

**Key Features**:
- StatefulSets for PostgreSQL, Redis, RabbitMQ
- HorizontalPodAutoscalers for auto-scaling (3-10 replicas)
- NetworkPolicies for security isolation
- Ingress with TLS/SSL support
- Prometheus + Grafana monitoring
- Resource limits and health checks

---

## 7. Troubleshooting

| Issue | Solution |
|:------|:---------|
| Service connection errors | Use Docker Compose - same network required |
| Import errors | Run via Docker Compose |
| Frontend can't reach API | Ensure all services running (`docker compose ps`) |
| Port issues | Use `ports:` not `expose:` in docker-compose.yml |
| Memory leaks | Check cleanup in useEffect, verify connection pool limits |
| Stale code in containers | Rebuild: `docker compose build [service] && docker compose up -d` |
| Spider ImportError (relative imports) | Use `scrapy crawl [spider_name]` NOT `scrapy runspider` - see Section 5.1.4 |

### 7.1. Common Docker Commands

```bash
docker compose ps                      # Check status
docker compose logs -f [service]       # View logs
docker compose build [service]         # Rebuild
docker compose restart [service]       # Restart
docker compose exec [service] /bin/bash  # Shell access
docker stats                           # Monitor resources
```

### 7.2. Volume Backup

```bash
docker run --rm \
  -v musicdb_postgres_data:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup_$(date +%Y%m%d).tar.gz -C /source .
```

---

## 8. Anti-Patterns to Avoid

❌ **Unbounded collections**: Always use pagination or limits
❌ **Missing timeouts**: All network calls must have timeouts
❌ **No connection limits**: Use connection pools with max sizes
❌ **Event listener leaks**: Always clean up in useEffect return
❌ **No periodic cleanup**: Implement garbage collection for caches
❌ **Hardcoded credentials**: Use secrets manager
❌ **Direct service execution**: Use Docker Compose
❌ **Skipping tests**: E2E tests are mandatory
❌ **Force pushes to main**: Protected branch
❌ **Unclear commit messages**: Use Conventional Commits
❌ **Using `runspider` with relative imports**: Use `scrapy crawl [spider_name]` instead

---

## 9. Quick Reference

| Task | Command |
|:-----|:--------|
| **Start All Services** | `docker compose up -d` |
| **Rebuild Service** | `docker compose build [service] && docker compose up -d` |
| **View Logs** | `docker compose logs -f [service]` |
| **Run Tests** | `npm run test:e2e` |
| **Test Spider** | `docker compose exec scraper-orchestrator scrapy crawl [spider_name] -a arg=value` |
| **Frontend Dev** | `cd frontend && npm run dev` |
| **Production Deploy** | `kubectl apply -k k8s/overlays/production/` |

---

This is the **only supported way** to develop and deploy SongNodes. No exceptions.
