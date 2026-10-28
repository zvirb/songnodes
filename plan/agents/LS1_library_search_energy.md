LS1: Library search: energy filter and speed check

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "LS1: Library search: energy filter and speed check" on a branch starting with "ls1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:LS1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
GET /api/v1/library/search filters by energy (a 1-10 range and the Warm/Building/Peak band) and logs how long each search takes against the 150 ms target.

## Context (verified on main 2026-10-28)
services/rest_api/routers/library_search.py:45-56 takes q, pillar, tier, rotation, source, crate, tags, label, limit, offset; there is no energy filter, and tier and crate are accepted but never used. The query reads projection_tracks pt joined to library.tracks and returns pt.energy_canonical as `e` (:66). projection_tracks has energy_canonical and energy_band (sql/migrations/014_data_layer_up.sql:159, index idx_projection_tracks_band :173); services/common/datalayer/projection.py:31 sets energy_band = energy.classify_band(value, calibrated), so only calibrated readings get a band. Bands are defined in services/common/metadata/energy.py:31-35: warm 1.0-3.9, building 4.0-6.9, peak 7.0-10.0 (contract 'energy-1', provisional). The frontend reads this endpoint in frontend/src/features/musicLibrary/data.ts (read-only for you); new response fields must be optional. The router is registered in services/rest_api/main.py:731 (read-only). Filters build numbered asyncpg parameters ($n) from `params`; keep that pattern, never format values into SQL.

## Owned paths
- services/rest_api/routers/library_search.py
- tests/rest_api/test_library_search_energy.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/LS1/ if you need to record a decision.)

## Do
1. New query parameters: energy_min and energy_max (float, ge=1, le=10; 422 when min > max), filtering on pt.energy_canonical; tracks with no energy are excluded only when a bound is given. energy_band: one or more of the band keys from energy.BANDS (comma-separated, case-insensitive; unknown key returns 422 listing the valid ones), filtering on pt.energy_band = ANY($n). Import the band keys from common.metadata.energy; do not repeat the numbers.
2. Add an optional `eb` field (band key or null) to LibraryTrackSearchResponse, selected from pt.energy_band.
3. Timing: measure the database fetch with time.perf_counter(); log one info line per request with elapsed ms, row count and which filters were used (names only, not the text query); log a warning when it exceeds LIBRARY_SEARCH_SLOW_MS (default 150). Add an `X-Search-Ms` response header.
4. Tests with a fake pool that records the SQL and params: energy_min/max add the right clauses with parameters, not literals; energy_band 'Peak,warm' passes ['peak','warm']; unknown band and min > max return 422; existing filters still work; the header is present; a slow fake fetch (sleep 0.2 s) logs the warning.
5. Do not implement tier or crate; list them as follow-ups.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`curl -i "http://127.0.0.1:8082/api/v1/library/search?energy_band=peak&limit=5"` returns only tracks with eb = "peak" and an X-Search-Ms header; `?energy_min=8&energy_max=6` returns 422; the rest-api log shows one timing line per search.

## Checks
`python -m pytest tests/rest_api/test_library_search_energy.py tests/rest_api/test_router_registry.py -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, the measured ms on the local library if you could run it, follow-ups (tier and crate filters; the Library page energy control).
