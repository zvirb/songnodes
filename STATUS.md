# Implementation status

## Current task: sync dependency upgrades

24 Oct 2026, branch `chore/upgrade-dependencies-on-work`.
Scope: publish the already-committed dependency upgrades and compatibility fixes without changing
the separate design-system branch.
Next concrete step: push this integration branch to `origin` and verify the remote commit.

The dependency upgrade commit is `b88f950`; integration and compatibility fixes are in
`9486b72`. The dependency set covers frontend, Node services, Python services and workflow actions.

Maintained plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

Started: 2026-10-24 (Australia/Sydney).

## Progress

- Inspected the checkout; no existing STATUS.md or AGENTS.md was found.
- Earlier baseline: frontend production build passes; type checking reports 124 errors; browser graph requests fail without backend services.
- Added a minimal development Compose stack for PostgreSQL, Redis, graph API, and REST API.
- Fixed graph async pool configuration, Redis cleanup/auth defaults, shared-module Docker copy path, and transition queries to match the checked-in occurrence_count schema.
- Restricted timestamp injection to production builds, fixing the Vite client __BASE__ exception.
- Frontend initial loading now uses the combined silver-schema graph endpoint.
- A real database/API/browser smoke test passes and cleans up its temporary records.
- Current task started: record reproducible commands and verify startup repeatability and the production build.
- Added AGENTS.md to preserve the requirement to update this file for every task.
- Unified shared DJ/catalog track and API-key types, corrected DJ mode values and graph selection calls, and added an explicit REST-to-client path adapter.
- Added missing XState/D3 runtime dependencies and Vitest/Three/D3 type dependencies with an updated npm lockfile.
- Updated disabled renderer and reference-example types for current PIXI APIs; that archived renderer remains outside live runtime validation.
- Added focused path conversion and slotted-button regression tests and a `test:unit` script.
- Documented all eight milestones, decisions, dependencies, and exit criteria in docs/IMPLEMENTATION_PLAN.md, linked from README.md and AGENTS.md.
- Added ordered real-set fixtures, canonical 1–10 energy/bands/provenance, energy search facets, contextual wave routing and shadow validation, move-coloured edges/wave chart, and multi-method audio calibration against user library ratings to the relevant milestones.
- Added VITE_ENABLE_WAVE_ROUTING as a default-off visibility gate. It does not implement wave routing; leave it unset until milestone 6 is validated.
- Probed REST/graph endpoints against the running database: legacy operational-table queries and the absent target queue produced reproducible 500s.
- Extracted shared silver-catalog graph read models for nodes, directed induced edges, pagination, bounded neighborhoods, substring search, statistics, and combined graph aliases. Combined graph reads use a repeatable-read snapshot; removed stale graph-read caches.
- Added an idempotent target-queue migration and JSON create/update/delete routes, preserving 400/404/422 statuses. Startup applies the migration to existing development volumes without resetting data.
- Fixed target-client proxy routing, response wrapping, and empty 204 handling. Browser verification now opens the Targets UI and exercises its client CRUD calls.
- Fixed manual silver metadata updates to preserve omitted/null fields, validate IDs/BPM/text, and store genres as arrays. Current energy semantics are unchanged.
- Replaced legacy catalog read queries with a silver-catalog router and dedicated response models, separating catalog reads from strict scraper input validators. Unknown sources are not labelled as Spotify or Gold.
- Added track detail aliases for the frontend, literal track/artist searches, UUID/BPM/pagination validation, and artist provenance from bronze lineage. Current artist counts/filtering explicitly use exact canonical-name matching, not a fabricated FK.
- Added ordered setlist/detail aliases preserving repeated tracks, position gaps, and unknown cue times. Loaded versus source-declared counts remain distinct. All new ordered-set tests are synthetic, not real-set evaluation data.
- Saved the full uploaded metadata specification at docs/requirements/TRACK_METADATA_RETRIEVAL.md and integrated WP1–WP5 into the maintained eight-milestone plan.
- Confirmed current metadata transport gaps by code inspection: the initial graph API adapter omits fields; useDataLoader invents BPM 128, key 8A, energy 5 and duration 240 when missing. The next task must audit all graph-to-track transformations, including DJInterface/utilities, and preserve factual unknowns.
- Scheduled official provider clients, reversible metadata/Camelot schema corrections, per-field waterfall/consensus, graph exposure and resumable backfill before Memgraph; audio-dependent consensus/calibrated energy remains milestone 8.
- Preserved requirements for live provider contracts, independent source evidence, calibrated energy (null without ratings), real before/after coverage plus a fixed sample of 50, parallel implementation ownership, and a PR with results. These are pending acceptance gates, not completed checks.

- Completed shared stored-metadata extraction for graph and REST reads, including optional JSONB Camelot/energy-scale/provider IDs/record label/mix fields. Core silver NULLs remain authoritative over stale JSONB.
- Replaced duplicate initial/reload/desktop/mobile mappings with one adapter; preserved zero, unknowns, millisecond/second units and record/display label separation. Same-count node refreshes now invalidate DJ track memoization.
- Removed fabricated durations from legacy timed-route requests; missing durations produce an explicit error. This does not change the routing algorithm or implement wave behavior.
- Energy displays now show raw stored energy with its recorded scale (or state that the scale is absent); no uncalibrated percentage/1–10 conversion is applied.

- Added `scripts/metadata_coverage.py`: read-only consistent database capture, shared stored-field extraction, stable seeded sample of up to 50 IDs, all/fixed-sample coverage and before/after cohort comparisons. Existing evidence files cannot be overwritten; added/deleted records and surviving-record field gains/losses remain separate.
- Documented commands, metric definitions, sample rules, schema gaps and source-binding inventory in `docs/METADATA_BASELINE.md`. No credential values were read or exported for this inventory.
- Captured two empty-catalog snapshots and a comparison under ignored `.local-dev/coverage/`. All six inventory entity counts are zero; no real-data coverage baseline, complete real set or 50-track sample is established. Agreement remains explicitly unassessed.
- Found a pending TIDAL startup wiring issue: database `tidal_keys` are retrieved but client construction uses environment variables. Recorded it for WP1; provider behavior was not changed or tested live.

## Dependency upgrade merge (2026-10-24)

- Conflicts: `frontend/package.json` (upgrade pins plus work's `@xstate/react`, `xstate`, `d3-transition`, `@types/d3-transition`, `@types/three`, `vitest`, taken at latest majors: xstate 5, @xstate/react 6, vitest 5, @types/three 0.186), `frontend/package-lock.json` (regenerated), `Graph3D.tsx` (work's null-safe `linkEndpointId` kept, React 19 ref typing kept) and `CamelotHelix3D.tsx` (`three/addons` path).
- Ported `PathfinderPanel/pathfinder.machine.ts` and its `useMachine` call to the XState 5 API (`setup`, `fromPromise`, `guard`, `input`/`output`); added `pathfinder.machine.test.ts`.
- Gateway proxies now use `pathFilter` (http-proxy-middleware 4 strips the mount prefix, which broke `pathRewrite`).
- Test conftests for graphql-api, rest_api and websocket-api use `httpx.ASGITransport` (httpx 0.28 removed `AsyncClient(app=)`).
- Checks run: frontend `tsc --noEmit` 0 errors; `vite build` passed; `vitest run src` 41 tests passed; both Python API apps and all work-added modules import under the installed new majors; Splink 5 calls smoke-tested. Gateway proxy path rewriting verified against a local upstream.
- Not run: Docker builds, database-backed API tests, Chromium smoke, Playwright E2E, Python service test suites.
- Known, not caused by the upgrade: `scrapers/llm_scraper_engine.py` uses the removed OpenAI `ChatCompletion` API; Node service Dockerfiles still use `node:18-alpine` and need a base-image bump to meet the new `engines` ranges; Node services have no lockfiles.

## Validation results

- `bash scripts/start-dev.sh`: passed, including a repeat run retaining the existing database volume. All four services reported healthy.
- REST `/health`: passed with `database_connected: true`.
- Graph `/api/graph/data`: passed for an empty catalog and for temporary test tracks/transition.
- `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node frontend/scripts/smoke-dev.mjs` (run from repository root): passed twice; verifies database-backed graph response, transition weight, and browser canvas with no page exceptions. Temporary test records were removed.
- `npm run build` in frontend: passed after changes.
- Before this task, `npm run type-check` failed with 124 pre-existing errors. After cleanup: passed with zero errors.
- `npm run test:unit` in frontend: 33 tests passed across three files (29 spatial-index tests, two REST-path adapter tests, and two button-slot tests).
- Production build and database-backed Chromium smoke test passed again after the TypeScript cleanup. Full platform readiness is not claimed.
- Shell syntax, Compose configuration, and `git diff --check`: passed.
- Plan/feature-gate update: frontend type check and production build passed; all eight milestones and documentation targets checked. No routing or full-platform behavior was claimed or newly tested for this documentation task.
- Latest API increment: 10 database-backed unittest regression tests passed. Reapplying the queue migration twice preserved the test record; the suite cleans up only its own fixtures.
- Latest browser increment: graph canvas and Targets UI/client CRUD passed through Vite, with no page exceptions. Frontend type checking and production build passed after the API-client changes.
- Catalog-read increment: all 19 database-backed API tests passed (nine new catalog tests plus the prior ten workflow tests). The setlist/direct-track provenance consistency assertion also passed on a targeted rerun.
- Browser smoke passed after catalog changes: track-detail client, graph canvas, Targets UI, and target CRUD. API images built and started successfully; Python compilation and `git diff --check` passed. Synthetic data cleanup was verified. Frontend application code was unchanged in this catalog-read task.
- Metadata-request planning: verified the saved specification against the upload, eight milestone headings, document links, and diff formatting. No new provider calls, enrichment backfill, coverage improvement, or metadata transport fixes were executed in this planning task.

- Metadata transport: startup/rebuild succeeded; 20 database-backed API tests and 38 frontend unit tests passed. Type checking and production build passed. Extended Chromium smoke passed for initial/API-reload metadata, desktop/mobile adapters, detail client, canvas and Targets CRUD. Fixtures are synthetic and cleaned up; no provider enrichment/real-data coverage improvement is claimed.

- Coverage increment: all 26 development API/coverage tests passed, including six new coverage checks. The six coverage checks passed again after the final CLI/report update. Tested fixed sample selection, null/zero/blank semantics, immutable files, empty denominators, cohort attrition, and real CLI capture/update/insert/compare with synthetic fixtures and cleanup. Empty-catalog CLI snapshot/compare commands succeeded. No frontend code changed in this increment; prior 38 frontend unit tests/typecheck/build/browser results remain prior validation.

## Resume point

Read docs/DEVELOPMENT.md for startup and smoke-test commands. Development API
containers and Vite were left running in the cloud instance; live processes do
not necessarily survive a new session. This checkpoint includes the implementation
and plan changes; use Git history to identify its commit. The accumulated API, metadata, coverage and plan changes are committed and
published on `origin/work` (implementation checkpoint `f7eb5cc`).

Begin the next task by updating this file. Metadata transport is complete for the
validated read paths; latest checks are 20 API tests, 38 frontend unit tests,
type checking, production build, and the extended browser smoke.
Catalog inventory and coverage tooling are now complete for the minimal stack.
Next audit the remaining legacy catalog writes against silver storage/shared metadata
contracts, starting with create/update and artist assignment/rename/merge/import.
No real library data or complete real-set fixtures have been supplied here.
For real backfill, first capture a new populated baseline/sample using
docs/METADATA_BASELINE.md; preserve the empty-catalog evidence separately.
Follow the plan's WP1–WP5 dependencies; inspect existing credential bindings when
provider work starts and verify official contracts live before claiming API behavior.
After that review legacy write contracts (artist/track creation, artist rename/merge/
assignment, tracklist import). They still refer to older
operational tables; do not create competing canonical tables or claim full REST readiness.
Target-search dispatch, graph debug/structured-filter paths, RabbitMQ, external
providers, the full Playwright suite, and archived renderer behavior remain unvalidated.
Follow the maintained implementation plan. Wave routing remains scheduled for
milestone 6 after canonical energy definitions, not for the current route finder.
Exact energy band boundaries/names and calibration policy are decisions for
milestone 3; availability of complete real-set fixtures must be checked in milestone 1.

## Next steps

1. Audit remaining legacy catalog writes against silver storage and shared metadata contracts. Preserve partial-update/null semantics and provenance.
2. Obtain/import authorised real catalog/set fixtures when available; capture a new populated fixed-sample baseline and representative workload performance measurements.
3. Continue domain consolidation and canonical identity/outbox work with the planned metadata provider/schema/consensus work packages.

Update this file whenever a new task begins and when work stops or a milestone completes.
