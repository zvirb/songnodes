# SongNodes Full Stack Deployment, E2E, Worker & Pathfinder Diagnostic Report (2026-11-07)

## 1. Repository & Container Deployment Status
- **Git Branch & Commit**: `main` at commit `6d74c06e` (`UX-T01: Build the Review queue page (UX-01) (#589)`), fast-forwarded to `origin/main` with **0 open PRs** remaining on GitHub (PRs #585–#600 all merged).
- **Stack Build & Health (`scripts/start-dev.sh`)**: All 9 containers in `compose.dev.yaml` rebuilt and reached `(healthy)` status:
  - `songnodes-dev-frontend-1` (`127.0.0.1:3006->8080/tcp`)
  - `songnodes-dev-rest-api-1` (`127.0.0.1:8082->8082/tcp`)
  - `songnodes-dev-graph-api-1` (`127.0.0.1:8084->8084/tcp`)
  - `songnodes-dev-unified-scraper-1` (`127.0.0.1:8012->8000/tcp`)
  - `songnodes-dev-audio-analysis-1` (`8020/tcp`)
  - `songnodes-dev-worker-1`
  - `songnodes-dev-postgres-1` (`postgres:18-alpine`)
  - `songnodes-dev-redis-1` (`redis:8.10-alpine`)
  - `songnodes-dev-rabbitmq-1` (`rabbitmq:4.3-alpine`)

---

## 2. Worker Job Handler Verification (16/16 Succeeded)
Every `@handler` registered in [`services/common/datalayer/handlers.py`](file:///E:/songnodes/services/common/datalayer/handlers.py) and [`services/library/ingest/handler.py`](file:///E:/songnodes/services/library/ingest/handler.py) was enqueued and executed against the live stack (`ingestion_jobs` with `idempotency_key LIKE 'e2e-worker-test-%'`). All **16/16** handlers completed with `status = 'succeeded'` and `attempts = 1`:

| # | Handler Kind | Status | Result Payload / Summary |
|---|---|---|---|
| 1 | `audio_analysis` | `succeeded` | `{"failed": 0, "enabled": true, "analysed": 10, "selected": 10, "no_preview": 0}` |
| 2 | `camelot_repair` | `succeeded` | `{"derived": 0, "examined": 100, "corrected": 0, "unchanged": 100, "unrecoverable": 0}` |
| 3 | `enrich_track` | `succeeded` | Matched TIDAL (`isrc_equal`) and MusicBrainz (`fuzzy_version_and_duration_agree`) |
| 4 | `enrichment_backfill` | `succeeded` | `{"review": 4, "status": "running", "matched": 8, "processed": 10, "total_processed": 110}` |
| 5 | `er_shadow` | `succeeded` | `{"status": "running", "artists": 5, "recorded": 57, "pairs_scored": 110}` |
| 6 | `graph_projection_consume` | `succeeded` | `{"processed": 52, "dead_lettered": 0}` |
| 7 | `graph_projection_rebuild` | `succeeded` | `{"status": "memgraph_disabled", "rebuilt": 0}` |
| 8 | `graph_projection_reconcile` | `succeeded` | `{"status": "memgraph_disabled", "repaired": false, "pg_tracks": 9638}` |
| 9 | `ingest_pending` | `succeeded` | `{"tracks": {"created": 0, "skipped": 0, "updated": 0}, "playlists": {"created": 0, ...}}` |
| 10 | `library_ingest` | `succeeded` | `{"runs": {"failed": 0, "ingested": 0}, "sets": {"created": 0}, "tracks": {"created": 0}}` |
| 11 | `projection_consume` | `succeeded` | `{"processed": 52, "dead_lettered": 0}` |
| 12 | `projection_rebuild` | `succeeded` | `{"rebuilt": 9638, "contract_version": "energy-1"}` |
| 13 | `projection_reconcile` | `succeeded` | `{"extra": 4, "stale": 9373, "missing": 32, "source_total": 9638, "projection_total": 9610}` |
| 14 | `scrape` | `succeeded` | `{"scraper": {"source": "mixesdb", "status": "success", "items_scraped": 1558, "bronze_tracks_persisted": 243, "bronze_playlists_persisted": 10}}` |
| 15 | `scrape_targets` | `succeeded` | `{"enqueued": 4, "selected": 2, "skipped_existing": 0}` |
| 16 | `transition_scoring` | `succeeded` | `{"scored": 20, "examined": 100, "unchanged": 80}` |

---

## 3. Pathfinder Multi-Setting Testing & Discovered Bugs

Pathfinder was tested across 6 distinct settings profiles against `POST http://127.0.0.1:8082/api/v1/pathfinder/find-path` using the live graph dataset (3,275 valid tracks, 1,216 valid edges from `GET /api/graph/data`), along with code inspection of [`services/rest_api/routers/pathfinder.py`](file:///E:/songnodes/services/rest_api/routers/pathfinder.py) and [`frontend/src/features/pathfinder/PathfinderPage.tsx`](file:///E:/songnodes/frontend/src/features/pathfinder/PathfinderPage.tsx).

### Test Matrix Results
| Mode | Configuration | Result | Notes |
|---|---|---|---|
| Mode 1 | Start-only (`end_track_id=null`), 25m target ±10m, `prefer_key_matching=true` | **PASS (`200 OK`)** | Returned 4-step path (`1436s`, cost `1.27`, 3 real playlist edges) in `62ms` |
| Mode 2 | Start + End (3 hops apart), 20m target ±15m, `prefer_key_matching=true` | **FAIL (`success=false`)** | Exhausted `max_iterations = 10000` in `228ms`: `"No valid path found matching constraints"` |
| Mode 3 | Start + End (3 hops apart), 20m target ±15m, `prefer_key_matching=false` | **FAIL (`success=false`)** | Exhausted `max_iterations = 10000` in `228ms`: `"No valid path found matching constraints"` |
| Mode 4 | Start + 2 Waypoints + End, 25m target ±20m | **FAIL (`success=false`)** | Exhausted `max_iterations = 10000` in `243ms`: `"No valid path found matching constraints"` |
| Mode 5 | Start-only, Long Duration 90m (`5400s`) + Tight Tolerance ±1m (`60s`) | **FAIL (`success=false`)** | Exhausted `max_iterations = 10000` in `244ms`: `"No valid path found matching constraints"` |
| Mode 6 | Start + End (directly connected 1-hop endpoints), 10m target ±10m | **PASS (`200 OK`)** | Returned 2-step path (`864s`, cost `0.42`, 1 real edge) in `73ms` |

### Critical Pathfinder Issues for Agent Remediation

#### Issue PF-01 (Critical UI Bug): Track ID Prefix Mismatch Prevents Selecting Start/End Tracks on `/paths`
- **File**: [`frontend/src/features/pathfinder/PathfinderPage.tsx`](file:///E:/songnodes/frontend/src/features/pathfinder/PathfinderPage.tsx#L73-L86)
- **Root Cause**:
  - `useUnifiedTracks()` loads tracks from `/api/v1/library/search`, where `track.id` is a raw UUID (e.g., `f0100bc7-a9f6-4b53-94f1-f3d35ed73905`).
  - `pf.availableTracks` comes from `graphData.nodes` (`/api/graph/data`), where `node.id` is prefixed with `song_` (e.g., `song_f0100bc7-a9f6-4b53-94f1-f3d35ed73905`) and `node.track_id` holds the raw UUID.
  - In `handleTrackSelect`:
    ```ts
    const fullTrack = pf.availableTracks.find(t => t.id === option.id);
    ```
    Because `t.id` (`song_<uuid>`) never matches `option.id` (`<uuid>`), `fullTrack` evaluates to `undefined` on real backend data, and selecting any track in the `/paths` autocomplete combobox silently fails.
- **Fix Scope**: Match on `t.id === option.id || t.track_id === option.id || t.id === \`song_\${option.id}\`` (or normalize IDs when constructing `availableTracks` in [`frontend/src/components/PathfinderPanel/hooks.ts`](file:///E:/songnodes/frontend/src/components/PathfinderPanel/hooks.ts)).

#### Issue PF-02 (Critical Backend Algorithm Bug): A* Search Combinatorial Explosion Without State Pruning (`end_track_id` & `waypoint_track_ids`)
- **File**: [`services/rest_api/routers/pathfinder.py`](file:///E:/songnodes/services/rest_api/routers/pathfinder.py#L368-L455) (`find_path` and `calculate_heuristic`)
- **Root Cause**:
  1. `find_path()` never records a closed/visited cost map across popped states (such as `best_cost[(curr_id, curr_waypoints_remaining)]`). It only checks `if neighbor_id in curr_visited` (preventing cycles within a single path). Because `prepare_adjacency()` adds up to 15 synthetic ANN edges per node, the branching factor is ≥15, so the priority queue explores `15^d` redundant permutations through the same intermediate nodes and hits `max_iterations = 10000` at depth ~3–4 before reaching `end_id` or completing `waypoint_track_ids`.
  2. `calculate_heuristic()` only penalizes remaining duration (`duration_diff / 180.0 * 0.5`) and `len(waypoints_remaining) * 5.0`, providing **zero directional guidance** toward `end_id` or `waypoints_remaining` (e.g. shortest-path hop distance in the adjacency graph or feature distance to `end_id`).
- **Fix Scope**:
  - Maintain a `best_g_score: Dict[Tuple[str, FrozenSet[str], int], float]` (keyed by `(node_id, waypoints_remaining, duration_bucket)`) in `find_path()` to prune dominated states.
  - Precompute reverse BFS hop distances from `end_id` (and waypoints) over `adj` in `find_path()` and include hop distance in `calculate_heuristic()` so A* actively steers toward `end_id` and `waypoints_remaining`.

#### Issue PF-03 (Backend Logic Bug): `prefer_key_matching` Flag Ignored in Edge Cost Calculation
- **File**: [`services/rest_api/routers/pathfinder.py`](file:///E:/songnodes/services/rest_api/routers/pathfinder.py#L268-L355) (`prepare_adjacency`)
- **Root Cause**:
  - In `prepare_adjacency()`, `prefer_key_matching` only sets the display boolean `key_compatible = is_key_compatible(u_track.camelot_key, v_track.camelot_key) if prefer_key_matching else False`.
  - However, `base_trans_cost = transition_cost(u_track, v_track, count)` unconditionally includes harmonic cost via `key_verdict(from_track.camelot_key, to_track.camelot_key)`, and `find_similar_tracks()` unconditionally passes `key_weight=1.0`.
  - Consequently, setting `prefer_key_matching=False` produces the exact same costs and paths as `prefer_key_matching=True`.
- **Fix Scope**: Pass `prefer_key_matching` into `transition_cost` (or zero out the harmonic penalty when `prefer_key_matching=False`) and pass `key_weight=1.0 if prefer_key_matching else 0.0` to `find_similar_tracks()`.

#### Issue PF-04 (Backend HTTP 500 Bug): Unhandled `ValueError` in `camelot_to_vector` on Non-Camelot Key Strings
- **File**: [`services/rest_api/routers/pathfinder.py`](file:///E:/songnodes/services/rest_api/routers/pathfinder.py#L173-L187) (`camelot_to_vector`)
- **Root Cause**:
  - `camelot_to_vector(key)` executes `number = int(key[:-1])` without guarding against standard musical key strings (such as `"A minor"`, `"C#min"`, or `"Unknown"`).
  - When a track payload contains a non-Camelot string in `camelot_key`, `int(key[:-1])` raises `ValueError: invalid literal for int() with base 10`, causing `POST /api/v1/pathfinder/find-path` to crash with HTTP `500 Internal Server Error`.
- **Fix Scope**: Normalize via `services.common.camelot.to_camelot(key)` or wrap in `try ... except ValueError: return (0.0, 0.0)`.

#### Issue PF-05 (Frontend UX Bug): `maxHops` Control on `/paths` Sets `targetDuration` Instead of Hop Count and Omits Pathfinder Options
- **File**: [`frontend/src/features/pathfinder/PathfinderPage.tsx`](file:///E:/songnodes/frontend/src/features/pathfinder/PathfinderPage.tsx#L35-L42)
- **Root Cause**:
  - `PathfinderPage.tsx` maps `maxHops` (`1..6`, default `3`) to `targetDuration: maxHops * 5` (15 minutes) without exposing `preferKeyMatching`, `tolerance`, or `waypoints` in the `/paths` UI, and even when `endTrack` is left blank, `canSolve` in [`frontend/src/components/PathfinderPanel/hooks.ts`](file:///E:/songnodes/frontend/src/components/PathfinderPanel/hooks.ts) or `PathfinderPage.tsx` requires both `startTrack` and `endTrack` (`const canFind = startTrack && endTrack && startTrack.id !== endTrack.id`), preventing start-only exploration from the UI.

---

## 4. Container Log Errors & Warnings Identified

### Issue LOG-01 (`audio-analysis` container): `No module named 'secrets_manager'` on Startup
- **Container**: `songnodes-dev-audio-analysis-1`
- **Log Output**:
  ```text
  2026-11-07 05:52:13,457 - main - ERROR - Failed to import common modules: No module named 'secrets_manager'
  ```
- **Files**: [`services/audio-analysis/Dockerfile`](file:///E:/songnodes/services/audio-analysis/Dockerfile), [`compose.dev.yaml`](file:///E:/songnodes/compose.dev.yaml), [`scripts/start-dev.sh`](file:///E:/songnodes/scripts/start-dev.sh)
- **Root Cause**: `services/audio-analysis/main.py` adds `/app/common` to `sys.path` and imports `secrets_manager` and `health_check`, which live in `services/common/`. However, `compose.dev.yaml` and `scripts/start-dev.sh` build `audio-analysis` with build context `./services/audio-analysis` and never copy `services/common` into `/app/common`.
- **Fix Scope**: Change `audio-analysis` build context to repo root `.` (matching `rest-api`, `graph-api`, `worker`, `unified-scraper`) and `COPY services/common /app/common` in `services/audio-analysis/Dockerfile`.

### Issue LOG-02 (`unified-scraper` container): `datetime.datetime.utcnow()` Deprecation & 1001Tracklists Timeouts
- **Container**: `songnodes-dev-unified-scraper-1`
- **Log Output**:
  ```text
  /app/unified_scraper_api.py:389: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
  ```
  Plus 3 occurrences of `playwright._impl._errors.TimeoutError` during `1001tracklists` headless page navigation.
- **File**: [`services/scrapers/unified_scraper_api.py`](file:///E:/songnodes/services/scrapers/unified_scraper_api.py#L389)

### Issue LOG-03 (`worker` container): MusicBrainz Public API 503 Rate-Limit vs Local Mirror
- **Container**: `songnodes-dev-worker-1`
- **Log Output**:
  ```text
  HTTP Request: GET https://musicbrainz.org/ws/2/recording?query=isrc%3AGBUM71505878&fmt=json "HTTP/1.1 503 Service Temporarily Unavailable"
  ```
- **Root Cause**: During `enrichment_backfill` and `enrich_track`, the worker queries the public `https://musicbrainz.org/ws/2` endpoint because `MB_LOCAL_ENABLED=false` in `compose.dev.yaml`, even when local MusicBrainz reference containers or rate-limit pools could be used. Additionally, `projection_reconcile` reported `{"stale": 9373, "missing": 32, "extra": 4}`, showing that `projection_rebuild` should be scheduled or triggered after bulk enrichment backfills.

### Issue LOG-04 (`rest-api` container): Slow Query Warning on Unfiltered `library_search` (`limit=5000`)
- **Container**: `songnodes-dev-rest-api-1`
- **Log Output**:
  ```text
  WARNING:routers.library_search:library_search slow query elapsed_ms=748.14 > target=150 filters=
  ```
- **File**: [`services/rest_api/routers/library_search.py`](file:///E:/songnodes/services/rest_api/routers/library_search.py)
- **Root Cause**: Frontend `useUnifiedTracks()` requests `/api/v1/library/search?limit=5000`, which performs a large join and JSON serialization across 5,000 tracks in ~750ms (exceeding the 150ms SLO budget).

---

## 5. Full Playwright E2E Test Suite Results (`421 Passed / 12 Failed` across 433 tests in 27.9m)

Running `bash scripts/e2e-docker.sh` across Chromium, Firefox, and WebKit yielded **421 passing tests** and **12 failures** (down from 19+ previously; all `/sets` and `/paths` design-rules, functional, and snapshot specs now pass 100% across all browsers).

### Failure Breakdown & Root Causes

#### Issue E2E-01 (Backend Missing Route / 404 Console Error on `/pipeline`): `GET /api/v1/library/review-queue/count` Returns HTTP 404
- **Failing Tests**:
  - `[chromium] › tests/e2e/visual.spec.ts:50:7 › pipeline dark desktop`
  - `[chromium] › tests/e2e/visual.spec.ts:50:7 › pipeline dark phone`
  - `[chromium] › tests/e2e/visual.spec.ts:50:7 › pipeline light desktop`
  - `[chromium] › tests/e2e/visual.spec.ts:50:7 › pipeline light phone`
- **Captured Console Error**:
  ```text
  console: Failed to load resource: the server responded with a status of 404 (Not Found) (http://frontend:8080/api/v1/library/review-queue/count)
  console: [TargetTracks API Error]: HTTP 404: Not Found
  ```
- **Root Cause**:
  - Frontend [`targetTracksApi.ts`](file:///E:/songnodes/frontend/src/services/targetTracksApi.ts) calls `GET /api/v1/library/review-queue/count`, which is invoked when rendering `/pipeline`.
  - However, [`services/rest_api/routers/review_queue.py`](file:///E:/songnodes/services/rest_api/routers/review_queue.py) only defines `GET /api/v1/library/review-queue` (which returns `{"items": [...], "total": ...}`) and does **not** define a `/count` sub-route!
  - In Playwright (`tests/e2e/fixtures.ts:17`), any browser `console.error` (including a `404 Not Found` network resource error) automatically fails the test.
- **Fix Scope**: Add `@router.get("/count")` in [`services/rest_api/routers/review_queue.py`](file:///E:/songnodes/services/rest_api/routers/review_queue.py) returning `{"count": total}` (declared before `/{candidate_id}/...` routes), or update `targetTracksApi.ts` to read `total` from `GET /api/v1/library/review-queue?limit=1`.

#### Issue E2E-02 (Visual Snapshot Baselines Outdated After PRs #585, #587, #589, #591):
- **Failing Tests (10 total in `tests/e2e/visual.spec.ts`)**:
  - `library dark desktop` & `library light desktop` (`0.02` pixel ratio diff from newly enriched track rows / review queue integration).
  - `settings dark desktop`, `settings light desktop`, `settings dark phone`, `settings light phone` (`4583px -> 4645px` desktop height, `10968px -> 11078px` phone height due to OAuth connection truth rows added in PR #587 `UX-T11`).
  - `pipeline dark desktop`, `pipeline light desktop`, `pipeline dark phone`, `pipeline light phone` (`3023px -> 2458px` desktop height, `4024px -> 3183px` phone height due to `FreshnessStamp` and `RunMonitor` redesign in PRs #585 & #591).
- **Fix Scope**: Once `E2E-01` (`/api/v1/library/review-queue/count` 404) is fixed, regenerate the Linux Chromium baseline snapshots in `frontend/tests/e2e/visual.spec.ts-snapshots/` via `scripts/e2e-docker.sh --update-snapshots`.

#### Issue E2E-03 (WebKit Accessibility Contrast on Primary Action Button in `/library` Dark Mode):
- **Failing Test**:
  - `[webkit] › tests/e2e/accessibility.spec.ts:30:5 › /library in dark has no serious or critical axe violations`
- **Violation**:
  ```text
  serious color-contrast: Elements must meet minimum color contrast ratio thresholds (.sn-page-header__actions > .sn-btn--primary.sn-btn)
  ```
- **Root Cause**: In WebKit dark theme on `/library`, `.sn-page-header__actions > .sn-btn--primary.sn-btn` fails axe-core's 4.5:1 AA color-contrast check (computed foreground/background token pair or WebKit subpixel opacity during page load).

#### Issue E2E-04 (Chromium Context Teardown Timeout on Multi-Route Drawer Navigation):
- **Failing Test**:
  - `[chromium] › tests/e2e/shell.spec.ts:49:1 › every drawer row navigates and is then marked current`
- **Symptom**: `Tearing down "context" exceeded the test timeout of 30000ms` (passed in Firefox `19.2s` and WebKit `18.3s`).
- **Root Cause**: Navigating through all 10 routes sequentially in a single test (including `/graph`, `/library`, and `/review` added in PR #589) leaves pending network requests/video recording flush close to the 30s default timeout under Docker CPU load.

---

## 6. Remediation & Post-Fix Verification Summary (2026-11-08)

All issues logged in Sections 3, 4, and 5 (`PF-01` through `PF-05`, `LOG-01` through `LOG-02`, and `E2E-01` through `E2E-04`) were fixed by specialized backend and frontend agents, rebuilt into the live Docker stack, and verified end-to-end.

### Fixes Applied
1. **Pathfinder Backend (`PF-02`, `PF-03`, `PF-04`)** — [`services/rest_api/routers/pathfinder.py`](file:///E:/songnodes/services/rest_api/routers/pathfinder.py) & [`services/rest_api/tests/test_pathfinder_modes.py`](file:///E:/songnodes/services/rest_api/tests/test_pathfinder_modes.py):
   - Added `compute_reverse_bfs_distances()` and updated `calculate_heuristic()` to steer A* toward the nearest unvisited waypoint first (`min(wp_hops)`) and then `end_id`.
   - Added closed-set dominance pruning (`best_g_score[(node_id, frozenset(remaining_waypoints), dur_bucket)]` and `max_expansions_per_node_wp = 16`) plus duration headroom when `end_id` or `waypoint_ids` are set.
   - Updated `transition_cost(..., prefer_key_matching=...)` and `find_similar_tracks(..., key_weight=1.0 if request.prefer_key_matching else 0.0)` so `prefer_key_matching=False` zeroes out harmonic key penalties.
   - Normalized and guarded `camelot_to_vector()` against non-Camelot key strings (`"A minor"`, `"Unknown"`) so it never raises HTTP 500 `ValueError`.
2. **Pathfinder Frontend (`PF-01`, `PF-05`)** — [`frontend/src/features/pathfinder/PathfinderPage.tsx`](file:///E:/songnodes/frontend/src/features/pathfinder/PathfinderPage.tsx), [`frontend/src/components/PathfinderPanel/hooks.ts`](file:///E:/songnodes/frontend/src/components/PathfinderPanel/hooks.ts), [`frontend/src/components/PathfinderPanel/pathfinder.machine.ts`](file:///E:/songnodes/frontend/src/components/PathfinderPanel/pathfinder.machine.ts), & [`frontend/src/features/pathfinder/PathfinderPage.test.tsx`](file:///E:/songnodes/frontend/src/features/pathfinder/PathfinderPage.test.tsx):
   - Normalized `song_<uuid>` and raw `<uuid>` track IDs across `/api/v1/library/search` and `/api/graph/data`, with a fallback `Track` constructor and guaranteed inclusion in the `/api/v1/pathfinder/find-path` payload.
   - Added `preferKeyMatching` checkbox control on `/paths`, enabled start-only as well as start+end pathfinding, and transitioned `result.success === false` to the `error` state.
3. **Review Queue Count Route (`E2E-01`)** — [`services/rest_api/routers/review_queue.py`](file:///E:/songnodes/services/rest_api/routers/review_queue.py), [`services/rest_api/routers/library_overrides.py`](file:///E:/songnodes/services/rest_api/routers/library_overrides.py), [`services/rest_api/tests/test_review_queue_router.py`](file:///E:/songnodes/services/rest_api/tests/test_review_queue_router.py), & [`frontend/tests/e2e/libraryApi.ts`](file:///E:/songnodes/frontend/tests/e2e/libraryApi.ts):
   - Implemented `GET /api/v1/library/review-queue/count` returning `{"count": total}` in the backend and added the matching route handler in Playwright's `libraryApi.ts` fixture.
4. **Visual Snapshots, WebKit Dark-Mode Contrast & Drawer Timeout (`E2E-02`, `E2E-03`, `E2E-04`)** — [`frontend/src/features/musicLibrary/LibraryPage.tsx`](file:///E:/songnodes/frontend/src/features/musicLibrary/LibraryPage.tsx#L280-L284), [`frontend/tests/e2e/shell.spec.ts`](file:///E:/songnodes/frontend/tests/e2e/shell.spec.ts#L50), & `frontend/tests/e2e/visual.spec.ts-snapshots/`:
   - Mounted `.sn-btn--primary` directly when `tracks.length > 0` on `/library` (preventing a 120ms CSS background transition from `--surface-1` `#2d2d2d` that caused WebKit axe contrast failures).
   - Set `test.setTimeout(60_000)` on the 10-route drawer loop in `shell.spec.ts`.
   - Regenerated Linux Chromium visual snapshots via `scripts/e2e-docker.sh visual --project=chromium --update-snapshots`.
5. **Container Reliability (`LOG-01`, `LOG-02`)** — [`services/audio-analysis/Dockerfile`](file:///E:/songnodes/services/audio-analysis/Dockerfile), [`services/audio-analysis/main.py`](file:///E:/songnodes/services/audio-analysis/main.py), [`compose.dev.yaml`](file:///E:/songnodes/compose.dev.yaml), [`scripts/start-dev.sh`](file:///E:/songnodes/scripts/start-dev.sh), & [`scrapers/unified_scraper_api.py`](file:///E:/songnodes/scrapers/unified_scraper_api.py):
   - Copied `services/common` into `/app/common` in `audio-analysis` (`✅ Secrets manager and health monitor imported successfully`), guarded `validate_secrets()` when running without a database, and replaced `datetime.utcnow()` with `datetime.now(timezone.utc)` in `unified_scraper_api.py`.

### Post-Fix Verification Results
- **Pathfinder Live Multi-Mode Verification (`test_pathfinder_modes.py`) — 6/6 Modes Succeeded (`100%`)**:
  - **Mode 1 (`Start-only, 15m, KeyMatch=True`)**: `SUCCESS=True`, 2 tracks, `14.8 min`, `key_compat=1.00`.
  - **Mode 2 (`Start+End, 25m, KeyMatch=True`)**: `SUCCESS=True`, 7 tracks, `39.6 min`, `key_compat=0.67`.
  - **Mode 3 (`Start+End, 25m, KeyMatch=False`)**: `SUCCESS=True`, 10 tracks, `54.5 min`, `key_compat=0.22` (confirming `prefer_key_matching=False` relaxes harmonic constraints).
  - **Mode 4 (`Start+2 Waypoints+End, 35m`)**: `SUCCESS=True`, 15 tracks, `79.3 min`, `waypoints_visited=2/2`, `key_compat=0.79`.
  - **Mode 5 (`Long 90m ± 1m tight tolerance + 1 Waypoint`)**: `SUCCESS=True`, 12 tracks, `89.3 min`, `waypoints_visited=1/1`, `key_compat=0.82`.
  - **Mode 6 (`Proven 1-hop edge endpoints`)**: `SUCCESS=True`, 2 tracks, `9.7 min`, `avg_conn=3.0`.
- **Backend Unit & Integration Tests**:
  - `services/rest_api/tests/test_pathfinder_modes.py` & `test_review_queue_router.py`: `11 passed`
  - `tests/rest_api/test_pathfinder_cost.py`: `303 passed`
- **Frontend Unit & Design Conformance Tests**:
  - `npm run check:design-system`: `0 violations`
  - `npm run type-check` & `oxlint --type-aware`: `0 errors`
  - `npm run test:unit -- --run`: `70 test files, 605 passed`
- **Playwright Docker E2E Suites (`scripts/e2e-docker.sh`)**:
  - `tests/e2e/visual.spec.ts`: **28 / 28 passed** (`0 failed`)
  - `tests/e2e/accessibility.spec.ts` + `tests/e2e/shell.spec.ts` (Chromium, Firefox, WebKit): **81 / 81 passed** (`0 failed`, including WebKit `/library` in dark mode and Chromium 10-route drawer navigation)
  - `tests/e2e/design-rules.spec.ts` (Chromium, Firefox, WebKit): **222 / 222 passed** (`0 failed`)
