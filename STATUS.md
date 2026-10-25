# Implementation status

## Current task: merge PR #90 to main

Started at Markus's request. Scope: verify PR #90 checks, review status and merge
state; then fast-forward local `main` and update the development frontend. All GitHub
checks passed and GitHub marked the PR mergeable (`CLEAN`). There were no reviewer
approvals; Markus explicitly directed proceeding without one. Next: sync this update,
wait for its checks, then squash-merge and update local `main`.

## Current task: commit and sync verified local fixes

Started at Markus's request. Scope: preserve the verified local frontend, search,
Compose and startup-script changes, commit them on a feature branch (not `main`), and
push/sync them using the repository's PR workflow. Exclude untracked test snapshots.

Committed the nine tracked files as `0573e79` (`fix(app): restore pages and sync local stack`) on
`fix/local-stack-and-page-wiring`; pushed the branch to `origin`. The two untracked
desktop snapshot directories were not included. Opened PR #90 to `main` using the
repository template and corrected the pending-review checkbox. Branch is synced; GitHub
Build, CodeQL, Semgrep, Trivy and design-system conformance checks are pending. No
unresolved local sync issue. Next: review CI and approvals on PR #90 before merging.

## Current task: link the Pipeline and Camelot pages

Started at Markus's request after confirming the pages from PRs #87 and #88 were not
visible. Scope: verify whether their routes were registered, mount the existing pages,
and avoid presenting the Pipeline page's fixture telemetry as live data.

Diagnosis: the local frontend container was current, not stale. PRs #87 (Pipeline) and
#88 (Camelot) added their page components but did not change `App.tsx`; the routes
remained wired to `PlannedModulePage`. The route registration now points `/pipeline` at
`ScraperProgressPage` and `/harmony` at `CamelotPage`. The Pipeline component's former
"Run Scrapers" action only changed sample values, its refresh randomized those values,
and its WebSocket target `/api/ws` does not exist. The route now disables that connection and the fake run/refresh actions; the displayed
fixture metrics are explicitly marked as sample data, with no freshness stamp implying
a live sync. The home-page description now matches this limitation. Added E2E
assertions for both routes and the Pipeline sample-data notice.

Rebuilt and force-recreated the frontend container from the working tree; it is healthy
and all eight Compose services report healthy. Validation passed:

- `npm run type-check`
- `npm run test:unit` (84/84)
- `docker compose -f compose.dev.yaml build frontend` (passed; runs the production build)
- In PowerShell from `frontend`: `$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3006'; npm run test:e2e -- tests/e2e/routes.smoke.spec.ts --project=chromium` (13/13, including both new pages, no console errors)
- `scripts/sync-design-system.sh --check` (with `PYTHONUTF8=1` for Windows Python)
- `git diff --check`

Changes remain local and uncommitted. Existing unrelated local changes and the
pre-existing untracked E2E snapshot directories have been preserved. Unresolved:
Pipeline worker/job figures remain fixtures; no live worker telemetry is wired into
that page. Next task: connect Pipeline to real job and worker status data before
removing its sample-data notice.

## Current task: fix music-service search query serialization

Started 25 Oct 2026 (Australia/Melbourne) at Markus's request, based on 422 errors
where `/api/v1/music-search/{provider}?params=[object Object]`. Fixed
`MusicServiceSearch.tsx`: `api.get` expects query parameters directly, not nested under
`params`. Added a typed response shape and filters out malformed provider entries.
The malformed URL reproduces 422; valid `q`/`limit` requests through the frontend
proxy return 200 for Spotify and TIDAL (development mock data). Frontend type-check,
production build and unit tests (84/84) passed. Rebuilt/recreated the frontend; all
eight Compose services report healthy. E2E was not run. No unresolved issue for this
fix; live provider search is not verified because local API returned development mock
results.

## Current task: local code and running-version check — complete

25 Oct 2026 (Australia/Melbourne). Local `main` and `origin/main` match at `95c51eb`.
Rebuilt and recreated all five application services from that checkout; all eight
Compose services now report healthy. The existing PostgreSQL volume was preserved;
migrations 012–014 ran idempotently. The frontend now serves on container port 8080,
matching its Dockerfile.

Found and fixed two local development workflow issues: Compose mapped/health-checked
frontend port 80 although nginx listens on 8080; and the startup script's raw image
builds were not causing Compose to replace unchanged app containers. Updated the port
mapping/health check and made the script force-recreate only the five app services
after building. `bash scripts/start-dev.sh` completed successfully; frontend, REST,
graph and unified-scraper HTTP smoke checks returned 200. `docker compose ps` showed
all eight services healthy. Verified all five application container image IDs match
their newly built local images. The existing `songnodes-dev_dev-postgres` volume stayed
mounted and was not reset. `docker compose config --quiet` and `git diff --check`
passed. No E2E suite was run.

This confirms application code/images are current to local `main`, not that every
external base or infrastructure image is the latest available upstream. Those images
were not pulled; dependencies remain governed by the repository's image tags and lock
files. Next task: commit or PR the local Compose/startup fixes if Markus wants them
shared; otherwise await the next request.

## Previous task: final PR #86 disposition — complete

25 Oct 2026 (Australia/Melbourne). At Markus's request, reviewed the last open PR.
Closed #86 without merging: it conflicts with current `main` in all four changed files,
main has since advanced with newer implementations of those files, and the PR reported
no CI checks. The branch was not force-merged or deleted; any remaining token cleanup
should be proposed as a focused PR against current `main`.

Validation: `git diff --check origin/main...FETCH_HEAD` passed. `git merge-tree
--write-tree origin/main FETCH_HEAD` confirmed conflicts in all four changed files.
`gh pr checks 86` reported no checks. No tests or E2E were run because the stale,
conflicting branch was discarded rather than merged.

No unresolved PR merge work from this batch. Next task: await Markus's next requested
PR review or implementation.

## Previous task: resolve PR conflicts, review green PRs, and update `main`

Restarted 25 Oct 2026 (Australia/Melbourne) at Markus's request; the open PR set had
reduced and merge conflicts had appeared. #77 was already merged.

- **#78**: merged the PR branch with `main` at `a72cfcb`, resolving the
  `TargetTracksManager.css` conflict with design-system tokens; later merged the
  `d77e16a` backup/restore security fix without conflicts. Removed duplicated AI-key
  controls from `PreferencesPanel`, shortened provider labels, refreshed four Settings
  screenshots, and removed the now-stale `camelotData.ts` conformance exemption.
  Validation passed: `npm run type-check`; `npm run test:unit` (79 passed);
  `npm run build`; `scripts/sync-design-system.sh --check`; focused visual tests (4/4);
  and `scripts/e2e-docker.sh` (307 passed). The full E2E run was against the rebuilt
  frontend before the backend-only `d77e16a` merge. GitHub checks on `a106b3d` passed:
  build, CodeQL, Semgrep, Trivy and design-system conformance. Merged as
  `db8558f` on 25 Oct 2026; local `main` is fast-forwarded to that commit.
- **#79**: rebased locally onto `db8558f`, retaining `main`'s `SN.status` mapping and
  `useId` Tabs fallback; ported documented `TextLink` and `Switch` exports and fixed
  Switch `aria-describedby` so it references only rendered descriptions. Added tests for
  external-link attributes and description/reason combinations. The PR's old bridge had
  a full-file conflict; its outdated CopyButton/ProgressBar implementations were not
  copied. Type-check, focused tests (5), full unit tests (84), build, and
  `scripts/sync-design-system.sh --check` passed. The full `scripts/e2e-docker.sh`
  run against the rebuilt frontend passed (307/307). `npx eslint` could not run because
  ESLint 9 has no config in this checkout. Pushed commit `7207aa7` with
  `--force-with-lease` after confirming the remote head was `a59b66a`. Fresh GitHub
  Build, CodeQL, Semgrep, Trivy and design-system conformance checks passed. Squash
  merged as `95c51eb` on 25 Oct 2026; local `main` is fast-forwarded to that commit.
- **#80**: closed on Markus's instruction as redundant. It duplicated AI-key management
  already on `main` and stored keys in a path the current AI service does not read.
- **#86**: left open on Markus's instruction; no checks were reported.

At that point, the Docker Compose frontend port mismatch remained (nginx listens on
8080, Compose targeted port 80); it was corrected in the current task above. PRs #78
and #79 are merged; #80 and #86 are closed.

## Previous task: Compose not Kubernetes, same-origin API, design system 1.1.1

25 Oct 2026. Three requests from Markus, one PR each, E2E run against each frontend
change before merge:

- **No Kubernetes for now** (#64, `docs/compose-not-kubernetes`): CLAUDE.md drops the
  Kubernetes-only and Compose-forbidden rules and documents the Compose stack
  (`scripts/start-dev.sh`, rebuild-and-recreate, Compose commands, `scripts/e2e-docker.sh`
  as the E2E gate); SDLC.md and the PR template follow. `deploy/` and `k8s/` are kept.
  This resolves the deployment contradiction flagged below. `README.md` still has
  Kubernetes sections (not changed).
- **Hard-coded localhost fixed** (#65, `fix/api-base-urls`): 14 sites used
  `http://localhost:8082`/`127.0.0.1` as the API base. `frontend/src/lib/apiBase.ts` now
  makes the API same-origin (proxied by Vite and nginx) unless `VITE_API_BASE_URL` is set;
  OAuth redirect URIs use the page origin, or `VITE_OAUTH_REDIRECT_ORIGIN` to pin the URI
  registered with Spotify/TIDAL. Unit 79 passed (4 new); built bundle has no loopback
  addresses; E2E 307 passed. Not tested: the real Spotify and TIDAL OAuth round trips.
- **Exceptions added upstream** (this PR, `feat/design-system-1.1.1`): EX-001 and EX-002
  are rows in the "Approved exceptions" register of `17-governance.md`, published to the
  design-system artifact (version 10) as design system 1.1.1 (only the version changes in
  `tokens.json` and `bundle.js`, rebuilt with the build scripts), mirrored, synced
  (`VERSION` 1.1.1), docs references regenerated and the standalone reference artifact
  republished. The settings E2E test reads `VERSION` instead of a hard-coded version.
  Results on this branch (frontend image built from it, dev stack up): `scripts/e2e-docker.sh`
  307 passed, zero console errors; `npm run type-check` 0 errors; `npm run test:unit` 75
  passed; `npm run build` passed; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
  in sync (1.1.1); conformance scan passes; `build_tokens.py` contrast report: all pairs pass.

## Previous task: bring `main` to a fully verified state

Started 24 Oct 2026 (Australia/Melbourne). Scope: CLAUDE.md §4 gates on `main`
(sync check, unit, type-check, build, root pytest, full sequential Playwright with
zero console errors), CI green, branches tidied. Steps: 1 pytest collection
(`fix/pytest-collection`), 2 Playwright environment (`fix/e2e-environment`),
3 design-system phase 3 (`refactor/ds-phase3`, after 1 and 2 merge), 4 branch
tidy-up, 5 close-out.

Deployment contradiction (flagged at the time; resolved 25 Oct 2026 by #64): CLAUDE.md
said Kubernetes only and Docker Compose forbidden, but the documented and tested stack is
`compose.dev.yaml` (`scripts/start-dev.sh`). All checks here used that stack.

### Close-out (step 5)

Merged 25 Oct 2026, in order, each with green CI: #60 (step 1), #61 (step 2), #59
(minimap port; E2E 307/307 against its build), #62 (step 3; E2E 307/307).

Final verification of `main` at 4ccf400 (25 Oct 2026, clean detached worktree, dev
stack up; frontend image rebuilt from 4ccf400; REST, graph and worker images unchanged
since 2ddfa36 apart from `scrapers/`, which the suites below do not exercise):

| Gate (CLAUDE.md §4) | Command | Result |
|---|---|---|
| Design-system sync | `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check` | in sync (1.1.0) |
| Conformance scan | the `design-system.yml` scan step, run locally | passes |
| Type-check | `cd frontend && npm run type-check` | 0 errors |
| Frontend unit | `npm run test:unit` | 75 passed |
| Build | `npm run build` | passed, no warnings |
| Python collection | `python -m pytest --collect-only -q` | 78 collected, 0 errors |
| Root pytest | `python -m pytest` | 73 passed, 5 skipped (1 would start a real scrape; 4 live provider tests, opt-in) |
| Shared library | `cd services && python -m pytest common/tests` | 112 passed |
| E2E | `scripts/e2e-docker.sh` (`npx playwright test --workers=1`, chromium/firefox/webkit) | 307 passed, 0 failed, 0 skipped, zero console errors (11.0 min) |
| CI on `main` | design-system, trivy, Security Scan, CodeQL at 4ccf400; python-tests at afe7eca (last Python change) | all success |

Branches: 26 stale branches archived as `archive/<name>` tags and deleted, plus the
`archive/work` test branch; the graph-HUD minimap fix was ported (#59); this task's
merged branches (#59–#62) deleted. Kept: `main`, `chore/upgrade-dependencies-on-work`,
the three Dependabot branches, and `pr-review/55` (a ref on another remote, not on the
list). Local worktrees `E:\songnodes-pr55-fix` and `E:\songnodes-pr58` predate this task
and were left alone.

Open, for a decision:
- E2E in CI needs the Compose dev stack on the runner (now allowed by #64; not built).
- Graph node/edge behaviour is untested until a real scrape; the 1001tracklists spider
  fixes (step 1) are untested against the live site.
- 30 files in `frontend/design-system-pending.txt` (phases 4–6).

Next task: the real-world scrape (Markus), then graph E2E assertions on its data.

### Step 1: Python test collection (`fix/pytest-collection`)

Changes:
- `pytest.ini`: header `[tool:pytest]` → `[pytest]`, so `testpaths = tests`, markers
  and options now apply and the duplicate `services/*/tests/conftest.py` files are no
  longer crawled. Removed options that are invalid under `--strict-config` or need
  absent packages: `collect_ignore` (replaced by `norecursedirs = reports fixtures
  utils coverage __pycache__ .*`), `cov_config` (pytest-cov reads `.coveragerc` by
  default), `deselect_markers` (not a pytest option; slow tests were never actually
  deselected, and are still not), `mock_use_standalone_module` (needs the `mock`
  package; tests use `unittest.mock`), and `--html`/`--self-contained-html`
  (pytest-html is not in `tests/requirements-test.txt`).
- Deleted `tests/pytest.ini`: as the nearest config to `tests/`, it silently replaced
  the root config for every `pytest tests/...` call (with a wrong `testpaths`).
- `tests/integration/conftest.py`: puts `tests/integration` on `sys.path` (bare-name
  sibling imports in the `test_dev_*` modules). Its autouse legacy-service check (8100,
  8020, 8024) skipped every integration module, including `test_dev_*`; it and the
  fixtures only the deleted modules used are removed.
- `tests/unit/scrapers/conftest.py` (new) puts `scrapers/` on `sys.path`, as the
  scraper image does; the spider test imports `spiders.1001tracklists_spider` and
  `items` (the old `musicdb_scrapy` package no longer exists).
- Deleted as obsolete (Markus's decision, 24 Oct 2026):
  `tests/unit/services/test_scraper_orchestrator.py` (tested `TaskQueue`,
  `ScraperManager` and `execute_scraping_task`, which no longer exist in
  `services/scraper-orchestrator/main.py`), and `tests/e2e/test_complete_workflows.py`,
  `tests/integration/test_api_endpoints.py`, `test_graph_api_comprehensive.py` (they
  targeted the pre-unified services on ports 8001, 8020–8022, 8080, 8088, 8090 and
  8100, none of which is in the dev stack; the `test_dev_*` suite covers the current
  stack).
- Spider defects fixed in `scrapers/spiders/1001tracklists_spider.py` (Markus approved
  fixing all; found while rewriting its tests for the current API):
  - `parse_tracklist` and `parse_search_results` called their generator `_impl`
    methods without `yield from`, so the spider emitted nothing after the start
    request.
  - HTML pages went straight to an NLP branch that used `enable_nlp_fallback`,
    `extract_via_nlp_sync` and an undefined `_is_json_response`; the class did not
    inherit the NLP mixin, so it raised and the CSS extraction never ran on real pages.
    Now CSS extraction runs first and `NLPFallbackSpiderMixin` is used only when it
    finds no tracks.
  - The LLM branch called the missing `is_remix_track`/`is_mashup_track` (added, same
    patterns as `parse_track_string`) and set a `duration` field `EnhancedTrackItem`
    does not have. The NLP item builder set nonexistent `track_url`/`source_platform`
    fields (now `external_urls`/`metadata`) and defaulted to "Unknown Artist"/"Unknown
    Track"; tracks without an artist or title are now dropped (CLAUDE.md artist rule).
  - Not fixed, noted: `parse_track_string` keeps the artist in a mashup's title
    ("Artist - A vs. B" gives the title "Artist - A vs. B").
- The spider test is rewritten for `parse_tracklist`/`parse_search_results` and the
  `Enhanced*` items: 17 tests, no network (credentials, Redis, robots.txt and the
  Ollama LLM extractor are stubbed), about 1 s instead of 25 s per test.
- `.gitignore`: `**/tests/reports/`. New CI workflow `python-tests.yml` runs the
  `services/common` tests, the root collection check and `tests/unit`. `tests/README.md` documents every Python suite command.
- Per-service `services/*/tests/` folders contain no test modules (only a conftest and
  empty packages); `services/common/tests` is the only service suite. Documented.

Results (Windows, Python 3.13, dev stack up):
- `python -m pytest --collect-only -q`: 78 collected, 0 errors, no config warnings
  (before: 26 errors).
- `python -m pytest` (root): 73 passed, 5 skipped, 0 failed. Skips:
  `test_dev_worker` real-scrape test (1, would scrape external sites) and
  `tests/live` (4, opt-in with `RUN_LIVE_PROVIDER_TESTS=1` and real credentials).
- `cd services && python -m pytest common/tests`: 112 passed.
- `python -m pytest tests/integration -k test_dev_`: 56 passed, 1 skipped.
  `python -m unittest discover -s tests/integration -p 'test_dev_*.py'` runs the same
  57 tests (56 + 1 skipped); the earlier "57 passed, 1 skipped" was a miscount.
- `python -m pytest tests/unit/scrapers`: 17 passed.

### Step 2: Playwright E2E (`fix/e2e-environment`)

Classification of the old suite before any change. The earlier stopped run (21 of
2,103) failed 16: 15 missing screenshot baselines (all `-win32`, so made for the
wrong OS) and 1 test defect (`nav.first().tagName` is not a Locator method). A
classification run of the chromium-based projects was stopped at 101 of 981 (about
25 s per test): 90 failed.

| Cause | Count | Example |
|---|---|---|
| Expected element absent (pre-migration UI: graph at `/`, removed `data-testid`s, deleted ui-kit components) | 62 | `design-system/badge.spec.ts`, `components/intelligent-browser.spec.ts` |
| Missing screenshot baseline | 23 | `accessibility-error-handling.desktop.spec.ts` |
| Test defect: port typo `localhost:30006` | 3 | `debug-*.spec.ts` |
| Test defect: `nav.first().tagName` | 1 | `accessibility-error-handling.desktop.spec.ts` |
| Text mismatch | 1 | `backend-fix-verification.spec.ts` |
| WebGL unavailable / backend graph fetch | 0 | after the SwiftShader flags and with the dev stack up |

Only one `data-testid` (`dj-interface`) is left in `src/`. Decision (Markus,
25 Oct 2026): retire the 70 pre-migration specs and their helpers and write a suite
for the current app; no synthetic or mocked graph data (graph assertions wait for a
real-world run).

Changes:
- `playwright.config.ts`: chromium, firefox, webkit only; one worker; no retries;
  en-AU, Australia/Melbourne; `PLAYWRIGHT_BASE_URL` to test a running frontend.
  Chromium runs WebGL on SwiftShader (`--use-angle=swiftshader
  --enable-unsafe-swiftshader --ignore-gpu-blocklist`); `--disable-software-rasterizer`
  was what made WebGL unavailable. Global setup now throws if WebGL is unavailable.
- New specs in `frontend/tests/e2e/` (see `frontend/tests/README.md`): routes smoke,
  shell/NavDrawer, library, set builder, settings, graph route structure, per-route
  design rules, axe, visual. `fixtures.ts` fails every test on any console error or
  uncaught page error; nothing is filtered.
- `scripts/e2e-docker.sh` runs the suite in `mcr.microsoft.com/playwright:v1.64.1-noble`
  on the dev stack network. Baselines are made only there.
- 28 visual baselines (chromium-linux), reviewed by eye against the design system and
  committed separately. The library crate is captured at viewport height: the page is
  9,281 px, over SwiftShader's 8,192 px texture limit, and a full-page capture wrapped.
- `@axe-core/playwright` 4.14.0 (dev dependency) for SDLC gate V2.
- Approved design-system exceptions (Markus, 25 Oct 2026), recorded in
  `docs/design-system/EXCEPTIONS.md`; the upstream register in the design-system artifact
  still needs these rows: EX-001 AppHeader wordmark contrast (4.33:1 in dark; a logotype
  under WCAG 1.4.3) and EX-002 LauncherCard accessible name (WCAG 2.5.3; the design
  system's own markup). Each excludes one rule on one element only.

Backend checked before running: REST `/health`, graph `/api/graph/data`, scraper
`/health` and the frontend all returned 200 (dev stack via `scripts/start-dev.sh`,
existing Postgres volume kept). The dev database has no graph data.

Results (25 Oct 2026, dev stack up, frontend image built from `main` 2ddfa36; this
branch changes no app code):
- `scripts/e2e-docker.sh` (`npx playwright test --workers=1` in the Linux image, all
  three browsers): **307 passed, 0 failed, 0 skipped, 0 flaky**, 11.8 min. Zero console
  errors or page errors (enforced per test by `fixtures.ts`). Visual specs run in
  chromium only by configuration (firefox/webkit `testIgnore`), not skipped.
- Host chromium (Windows, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3006`), per spec while
  writing: all non-visual specs pass; visual baselines are Linux-only by design.
- `npm run type-check` 0 errors; specs type-check under `tsc --strict`;
  `npm run test:unit` 75 passed; `npm run build` passed (graph chunk over 1 MB warning);
  `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check` in sync (1.1.0).
- Defects found and handled: two design-system accessibility findings (EX-001, EX-002
  above). No app defect was found by the new suite; graph data behaviour is untested
  until a real scrape.

Not covered: a CI job for E2E. It needs the dev Compose stack on the runner, which
touches the Compose-vs-Kubernetes contradiction flagged above, so it is left for a
decision. Hard-coded `http://localhost:8082` API bases remain in several components
(`APIKeyManager`, `EditTrackModal`, `PathBuilder`, `PathfinderPanel`, settings and
playlist managers, `useTokenRefresh`); none is hit by the current suite, but they will
fail behind the nginx proxy in a deployed build.

Merged 25 Oct 2026: #60 (step 1) and #61 (step 2), rebase merges, CI green on both.

### Step 3: design-system phase 3 (`refactor/ds-phase3`)

Scope decided by Markus (25 Oct 2026): every target file was unreferenced, so delete
what `19-songnodes-migration.md` lists as unused or retired, move StatsPanel onto
tokens, then widen the CI scan.

- Deleted: `Graph3D`, `CamelotHelix3D`, `GraphModeToggle`, `GraphVisualizationWrapper`
  (3D graph and helix retired by the plan), `InfoCard` with `useInfoCard` and
  `infoCardUtils`, and `DataQualityReview` with its CSS (77 hex; its REST endpoint
  `/api/data-quality/tracks/needs-review` is commented out, so it could not be mounted
  as the plan's review queue yet). Dropped `three`, `@types/three` and
  `react-force-graph-3d` (nothing else used them). The Ctrl+Shift+3 shortcut was
  already gone.
- `StatsPanel.tsx` (not mounted; not on the unused list): 12 hex and the d3
  `schemeCategory10` palette replaced by tokens through inline SVG styles (`--fg`,
  `--fg-3`, `--line`, `--chart-N`, `--key-*`; the invented HSL key colours are gone and
  unknown keys stay neutral). px font sizes replaced by `data-s`, `data-strong`,
  `body-strong` and `caption`; chart copy in sentence case.
- Also removed: the unused hex `getContrastColor` in `lib/utils.ts` and an emoji in a
  `useStore.ts` log.
- CI conformance (`.github/workflows/design-system.yml`) now scans every tracked file
  in `frontend/src` except the synced copy, `lib/graphColours.ts` and the 30 files in
  `frontend/design-system-pending.txt`. A listed file that becomes clean or is deleted
  fails CI until it is removed, so the list only shrinks. Checked locally: passes on
  this branch, fails on a hex added to a clean page, fails on a stale pending entry.
- Optional bundle item done: the graph chunk was 1.1 MB because its group came before
  `pixi-vendor` and took pixi with it. With the vendor groups first: `pixi-vendor`
  889 kB, `graph-visualization` 197 kB, no chunk-size warning.

Results (25 Oct 2026, this branch rebased on `main` 9789e6f, dev stack up, frontend
image built from this branch):
- `scripts/e2e-docker.sh` (`--workers=1`, chromium/firefox/webkit): **307 passed**,
  0 failed, 0 skipped, zero console errors (10.9 min). Visual baselines unchanged.
- `npm run type-check` 0 errors; `npm run test:unit` 75 passed; `npm run build` passed
  with no chunk-size warning; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
  in sync (1.1.0); conformance scan run locally: passes.
- `python -m pytest --collect-only -q` 78, 0 errors; `python -m pytest` 73 passed,
  5 skipped; `cd services && python -m pytest common/tests` 112 passed.

Still pending migration: the 30 files in `frontend/design-system-pending.txt`
(DJInterface folder, legacy CSS `global.css`/`globals.css`/`tokens.css`, Camelot and
energy utilities, SetlistBuilder, EditTrackModal, IntelligentBrowser.legacy, examples,
and others), phases 4 to 6 of the plan.

## Previous run: full test suite — completed with blockers

Run: 2026-10-24 (Australia/Sydney). No application code changed.

Passed:
- `cd services; python -m pytest common/tests`: 112 passed.
- With the documented development stack running,
  `python -m unittest discover -s tests/integration -p 'test_dev_*.py' -v`:
  57 passed, 1 skipped (the test that would scrape external sites).
- `cd frontend; npm run test:unit`: 75 passed across 6 files.
- `cd frontend; npm run type-check`: passed.
- `cd frontend; npm run build`: passed; Vite warned that the graph visualization
  chunk exceeds 1 MB.
- `docker compose -f compose.dev.yaml build`: passed.
- `git diff --check`: passed.

Blocked/incomplete:
- Root `python -m pytest` stopped during collection: 182 items found and 26
  collection errors, including duplicate `tests.conftest` names in service
  directories and unresolved test imports. `python -m pytest tests` narrowed
  this to 11 collection errors, including missing `hygiene`, `musicdb_scrapy`,
  and scraper-orchestrator imports.
- `cd frontend; npm test -- --workers=1` started 2,103 Playwright tests. It was
  stopped after 21 tests (15 failed, 4 passed, 2 skipped); the initial failures
  include absent screenshot snapshot baselines, and setup reported WebGL
  unsupported. The full browser suite did not complete.

The documented Compose stack was built and started for integration tests, then
stopped afterward; its named Postgres volume was preserved. No live provider
tests were run.

Next task: repair Python test discovery/import setup and establish or validate
the required Playwright screenshot baselines, then rerun the full sequential
browser suite (2,103 tests) and root Python tests.

## Current task: design system as the single source of truth

24 Oct 2026, branch `feature/design-system` (from `main` 677180f).
Scope:
- Deploy the SongNodes design system 1.1.0.
- Make it the single source of truth for formatting and design.
- Move the frontend onto it.
- Bring the music library (Naarm Set Builder) into SongNodes.

### Commit 1: design system, docs, shell, music library

**Design system and sync**
- `design-system/`: 499 files from the published artifact (version 1.1.0, including `04-typography.md`).
- The 109 Lucide SVGs in `design-system/assets/Icons/` were regenerated from `bundle.js`. The icon assets could not be downloaded from the artifact. Rebuilding with `source/build_bundle.py` reproduces the published `bundle.js` byte for byte.
- `scripts/sync-design-system.sh` (with `--check`) copies runtime files to `frontend/src/styles/design-system/` and writes `VERSION` 1.1.0.

**Docs and process**
- README, CLAUDE.md (new mandatory section 4), AGENTS.md, CONTRIBUTING, the PR template and IMPLEMENTATION_PLAN name the design system as the single source of truth.
- New `docs/sdlc/SDLC.md`, with design-system gates D1–O1 and WP0–WP7.
- New decision record `docs/decisions/2026-10-24-design-system-source-of-truth.md`.
- New CI workflow `.github/workflows/design-system.yml`.
- New `docs/design-system/`: README, `reference.html` (rendered), `reference.standalone.html` (self-contained, published as an artifact) and `CODE_REFERENCE.md` (code only, all 92 components and 222 tokens; generated by `gen_code_reference.py`).

**Frontend**
- `main.tsx` imports in design-system order, followed by `legacy-aliases.css`, which bridges the old `--color-*` variables to tokens. `index.html` applies saved preferences before first paint. Favicon is the "SN" tile.
- `App.tsx` uses a react-router shell with AppHeader and NavDrawer. Home is a launcher. Settings has the PreferencesPanel. Sources lists target tracks. Pathfinder, Key & mood and Pipeline have placeholder pages. Unknown routes show a not-found page. OAuth callbacks render without the shell.
- Removed the Vite `?v=` cache-bust plugin. It made lazy chunks load the entry script a second time, so the app booted twice. Content hashes already bust caches.
- Removed the retired debug and demo pages and the unused `lib/tokens.ts`.

**Music library**
- `/library` and `/sets` in `frontend/src/features/musicLibrary/`. The artifact's set-building algorithm is ported to `setBuilder.ts` with 34 tests.
- Data is `frontend/public/data/music-library.json`, refreshed with `scripts/sync-music-library.sh`.
- Saved sets keep the artifact's shape. "Export sets for the weekly run" writes `artifact_sets.json` for `musicLibrary/inbox/`.

**Checks run:** `tsc --noEmit` 0 errors · `vitest run src` 77/77 · `vite build` OK · `sync-design-system.sh --check` OK · Playwright screenshots of Home, Settings, Library and Set builder in dark and light, desktop and phone, with 0 page errors.

### Commit 2: graph route restyle

**DJInterface**
- Now a slim design-system toolbar: Play/Plan as a segmented control, neutral count tags, Filters, Settings and a More actions menu.
- The right panel uses design-system Tabs. `?mode=` and `?tab=` are kept in sync with the URL.
- Clear queue goes through a ConfirmDialog and a Toast.
- The onboarding overlay is removed.

**Graph colours**
- `src/lib/graphColours.ts` reads tokens at runtime and recolours the PIXI graph on a theme change.
- Neutral nodes, with rings for selected (lavender), now playing (amber), path and hover.
- No glows. Labels in Inter 600 with a halo.

**Child panels**
- Moved onto tokens: IntelligentBrowser, KeyMoodPanel, CamelotWheel, PathfinderPanel, the TIDAL and Spotify panels, TargetTracksManager, TrackDetailsModal, ContextMenu, Settings, APIKeyManager and others.
- Shared design-system pieces live in `components/ds/`.
- Energy always renders as a 1–10 bar (`displayEnergy`). The Camelot wheel uses the standard mapping.
- Invented fallbacks removed: no random waveform and no default energy.
- Touched files go from 433 hex lines to 0, 299 rgba lines to 0, 289 emoji to 0, 25 alert/confirm calls to 0, and 9 z-index literals of 100 or more to 0.

**Also**
- Removed the tracked debug pages `public/debug-storage.html` and `public/test-credentials.html`.

**Checks run:** `tsc` 0 errors · `vitest` 77/77 · `vite build` OK · Playwright screenshots of /graph in Play and Plan, Key & mood, dark and light, plus mocked data, the theme switch, the dialog and the context menu; 0 page errors.

**Left on the graph route:**
- No "Colour by" control or minimap dock yet.
- The tab strip has no overflow menu.
- EdgeDetailsModal should become a Popover.
- The toast region is per page; it should move into the shell.
- `DataQualityReview.css` and the duplicate Camelot tables still need migrating.

### Open
- Migration phases 3–6 are still to do: ConfirmDialog and Toast everywhere, Track detail and Settings pages, deleting the legacy CSS, Tailwind and the `components/ui` kit, and widening CI conformance to all of `src/`.
- The ESLint flat config is broken (pre-existing).
- Music library data: none of the 294 tracks has a key or BPM yet, so sets are shaped on energy alone.
- The music library length target overshoots: 90 min gives about 1 h 39 min. This is the artifact's own behaviour and is kept until decided.

## Previous task: data layer

Completed 2026-10-24 on `feature/catalog-writes-silver` (not merged or pushed): the data layer is code-complete and tested
with synthetic data only, so the first real scrape can be run. Scope was narrowed by the user: audio processing is out
(Milestone 8, WP3 audio/calibration); search, graph projection, wave routing and the Sigma renderer (M5-M7) were not part
of this pass. No data was imported. Everything is documented in [docs/DATA_LAYER.md](docs/DATA_LAYER.md); the redeploy and
first-scrape procedure is [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md).
Next implementation task: after the first real scrape, capture the populated coverage baseline and run the credential-gated
live provider checks; then M5-M7 if wanted. Do not claim any provider, threshold or throughput until measured on real data.

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

## Catalog writes on silver (2026-10-24)

- Artist create/rename/merge/delete, assign-artist, track create, tracklist import, `/artists/dirty` and `/tracks/missing-artist` now use `silver_enriched_artists`, `silver_enriched_tracks`, `silver_enriched_playlists`, `silver_playlist_tracks`, bronze lineage and `silver_track_transitions`. They previously queried `artists`/`track_artists`/`tracks`/`songs`/`song_adjacency`, which the minimal stack lacks, so every call returned 500.
- Silver keeps the primary artist as `artist_name` text equal to `canonical_name`, so artist changes update artist and tracks (and DJ-set ownership) in one transaction. Rename keeps the old name as an alias; merge unions aliases/bronze ids and records `merged_artist_ids`.
- Behaviour decisions: delete returns 409 while tracks or sets still use the artist (silver requires a valid artist); only role `primary` is stored; assign-artist only replaces an empty/generic placeholder; manual rows are `needs_review` with `enrichment_metadata.source = 'manual'` and unknown fields stay NULL; `POST /api/v1/tracks` now requires `artist_name`; duplicate tracks (case-insensitive artist+title) return 409; merge reports `repeated_titles` for review instead of deleting rows.
- Tracklist import writes bronze first (positions kept as `source_track_id`), then silver tracks (exact case-insensitive match; fuzzy resolution stays Milestone 4), canonical-artist reuse by normalized name, an optional silver set when `dj_artist` is given, and directed N -> N+1 transitions with `occurrence_count`. Invalid rows are reported and break the chain rather than bridging a gap. Replaying an identical ordered list is a no-op (`replayed: true`, content-digest keyed).
- Not changed: the two Gold-layer reads (`/api/v1/tracks/{id}/preview`, `/api/graph/*` legacy), scraper trigger, Celery/job status.

Checks: 10 new database-backed tests in `tests/integration/test_dev_catalog_writes.py`; all 36 dev integration tests pass (`PYTHONIOENCODING=utf-8`, see below); synthetic rows cleaned (all catalog tables back to 0 rows).
Known: `scripts/metadata_coverage.py` prints `->` arrows that fail under Windows' cp1252 when output is piped (one coverage CLI test errors without `PYTHONIOENCODING=utf-8`); not changed here.

## Ingestion jobs (2026-10-24)

- Migration `sql/migrations/013_ingestion_jobs_up.sql` (+ down), wired into compose init and `scripts/start-dev.sh`. Domain in `services/rest_api/jobs.py` (enqueue idempotent on `(kind, idempotency_key)`, lease-based `FOR UPDATE SKIP LOCKED` claim, `fail` with exponential backoff capped at 1 h, dead-letter after `max_attempts`, `retry_dead`); HTTP in `routers/jobs.py`: `POST /api/v1/scrape/trigger` (202, optional `Idempotency-Key`, no key = new job), `GET /api/v1/jobs[?status&kind]`, `GET /api/v1/jobs/{id}`, `POST /api/v1/jobs/{id}/retry`.
- Jobs stay `queued`: nothing consumes them in the minimal stack, and the response says so. Claim/complete/fail are worker APIs, not exposed over HTTP.
- `/api/v1/tracks/{id}/preview` now reads `silver_enriched_tracks` (id, `song_` prefix or spotify id), takes provider ids through the shared stored-metadata extractor, and returns `preview_url: null` (no audio is stored).
- All GET endpoints of the REST API (excluding the provider auth routers) return non-5xx against the dev stack.
- Checks: 5 new tests (`tests/integration/test_dev_jobs.py`) including a retry/backoff/dead-letter/lease/5-way concurrent claim scenario on real Postgres; all 41 dev integration tests pass with `PYTHONIOENCODING=utf-8`; synthetic rows cleaned (all tables 0 rows). Not run: Celery/RabbitMQ, the unified scraper, Playwright.

## Data layer (2026-10-24)

Built (all on `feature/catalog-writes-silver`, commits from `f3083c2` to `d51f65c`+):
- `common/metadata`: shared `to_camelot` (golden tests for all 24 keys, enharmonics, Open Key; the retired converters shifted
  every minor key by seven), tempo folding (genre-justified; ambiguous or out-of-range input is not folded), versioned energy
  contract `energy-1` (1-10, provisional bands Warm 1.0-3.9 / Building 4.0-6.9 / Peak 7.0-10.0), BPM/key consensus (independent
  sources, manual correction final, 0.5% tempo tolerance), version-aware matching (ISRC first, +-10 s duration guard,
  `unique_exact` policy for unknown durations), per-field resolution (durations within 2 s agree), deterministic parsing.
- `common/providers`: TIDAL v2, Deezer, MusicBrainz, Discogs, Last.fm (HTTPS), GetSongBPM (disabled until terms verified);
  rate limiting, Retry-After backoff, no secrets in URLs; `ENRICHMENT_PROVIDERS` allow-list; `CHANGE_ME` placeholders ignored.
- `common/datalayer`: jobs (idempotent, leased, bounded retries, dead-letter), transactional outbox with a commit-order-safe
  cursor, rebuildable `projection_tracks`, reversible track/artist merges with redirects, evidence and Camelot repair,
  canonical bronze->silver ingestion (complete playlists only, replay-safe, adopts legacy silver rows, concurrency-safe),
  enrichment waterfall, resumable backfill, entity-resolution shadow mode, job handlers and runner.
- `services/worker` (Celery + RabbitMQ) drains `ingestion_jobs`; migration runner `migrate.py`; compose, Helm chart 0.1.15
  (worker, hook Job), Flux HelmRelease, Skaffold and the build script updated.
- Migration `014_data_layer_up.sql` (idempotent, reversible, verified on a fresh volume) also adds the bronze
  `playlist_id`/`position` columns the scraper pipeline writes but no migration created.
- Removed: Spotify audio features everywhere (guard test), 38 committed database/broker/encryption secret defaults including a
  literal credential (guard test).
- REST: job enqueue/status/retry, review queue, merges/revert/canonical id, resolution review, outbox status, attributions;
  canonical energy, band and review state exposed through REST and graph reads; frontend attribution footer.

Checks run (all synthetic data; database left empty): `services/common` 111 unit tests; 57 integration tests twice in a row,
none skipped (real Postgres, real Celery worker end to end, REST and graph APIs); frontend type-check 0 errors, 43 unit tests,
production build; `helm lint` and render of chart and dev values; `start-dev.sh` end to end with 8 healthy containers (adds unified-scraper and frontend);
fresh-volume init and `migrate.py` from an empty database, repeated; live provider tests skip without credentials.

Deployment target is now plain Docker Compose (`compose.dev.yaml`, `docs/DEPLOYMENT_CHECKLIST.md`); the Docker Desktop Kubernetes
overlay was removed. The Helm/Flux files remain but are unused. Worker-to-scraper contract fixed (`POST /scrape {source, search_query, ...}`
on container port 8000, synchronous, 30-minute scrape lease, invalid requests dead-lettered at once). The real scraper persistence pipeline
was run once against the Compose schema with a synthetic playlist: bronze (playlist_id, positions) and silver writes succeeded, rows removed;
it logs harmless errors for the absent legacy `artists`/`song_adjacency` tables. Docker secrets/fallback password literals removed (guard test).
CLAUDE.md still says "Kubernetes only; Docker Compose forbidden" - not edited, needs your decision.

NOT done / NOT verified:
- No provider client has run against a live API with credentials. Docs for Deezer, GetSongBPM, MusicBrainz, Discogs could not
  be read; TIDAL OAS was read but not its live responses (BPM/key population, array-filter style, auth form unconfirmed).
- Playwright E2E (mandatory before merge per CLAUDE.md): only `basic-validation.desktop.spec.ts` was run (chromium): 7 of 9 pass,
  including the zero-console-errors test. The 2 failures are a pixel-baseline test (no win32 baseline exists) and a test-code bug
  (`Route is already handled`); not proven unrelated to the upgrades. The other 63 specs were not run. Also not run: real spiders against live sites,
  real playlists.
- ER thresholds and tempo/genre ranges are judgement calls validated on synthetic cases; automatic merging is off.
- Energy bands are provisional until ratified.
- Legacy `data-transformer` ETL and the scraper pipeline's direct silver writes still exist (adopted, not removed).
- Committed RabbitMQ runtime files under `data/rabbitmq/` and the historical credential in git history remain.

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

1. Redeploy per `docs/DEPLOYMENT_CHECKLIST.md`, run the live provider checks, then one real scrape and inspect jobs, bronze
   positions, transitions and the review queue before scaling up.
2. Run the Playwright E2E suite and resolve failures before any merge to `main`.
3. Capture the populated before/after coverage baseline; then tune thresholds, bands and provider priorities on real data.
4. Optional later work: Milestones 5-7 (search, graph projection and wave routing, renderer) and 8 (audio), retire the legacy ETL.

Update this file whenever a new task begins and when work stops or a milestone completes.

## Design-system check exclusion — committed and synced (2026-10-24)

On PR #58, removed `frontend/src/lib/graphColours.ts` from the migrated-product
colour, emoji and browser-dialog scan list; the module implements design-system
token resolution and its `rgb()` regex example caused a false positive. The
workflow explicitly documents that the design-system token implementation
is excluded. Commit `5014bbc` was pushed to PR #58 from the isolated worktree
at `E:\songnodes-pr58`; the worktree is clean.

Validation:
- Exact migrated-code conformance scans: passed (Git Bash).
- `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`: passed.
- `git diff --check`: passed.
- The sync check without `PYTHONUTF8=1` hit Windows Python's default cp1252
  decoding; retrying in UTF-8 mode passed.
- CI type-check, unit tests, and production build were not run.
- Four GitHub Actions runs were created for commit `5014bbc` and were in
  progress at the time of verification.

Unresolved: the four CI runs have not completed yet.
Next task: monitor PR #58 checks and address any remaining failures.

## PR review and merge — review complete; merge blocked (2026-10-24)

Reviewed all 10 open PRs (#47–#56), all targeting `main`. GitHub reported each
as mergeable with its Build, CodeQL, SAST, and Trivy checks successful. The
review found no material issues in #47–#54 or #56. No touched code is marked
deprecated; the current Pixi graph remains active pending the planned
Milestone 7 renderer evaluation.

PR #55 re-enables `GraphMiniMap`. Its async Pixi initialization can complete
after unmount, when cleanup has already run and the app ref is still null,
leaking the renderer. This needs a cancellation-safe cleanup before merge.

Combined validation in a temporary integration worktree:

```text
npm ci                                      passed (540 packages; 0 vulnerabilities)
npm run type-check                          passed
npm run test:unit                           passed (49 tests)
npm run build                               passed
npm run test:e2e -- --config=playwright.pr-review.config.ts --workers=1
                                             started 2,103 tests; stopped at test #52 after failures
```

The full E2E run did not complete or pass: browser logs included graph-fetch
failures and the test setup reported WebGL unavailable. REST and graph health
URLs returned HTTP 200. Node 25 also emitted a Vitest engine warning. No PR was
merged or closed: the mandatory pre-merge E2E gate is not satisfied, and #55
has the renderer-lifecycle issue. GitHub merges automatically close PRs, so no
separate archive action was performed.

Unresolved: fix and validate #55; run the complete sequential E2E suite in a
supported browser/backend environment. Next task: make the minimap
initialization cancellation-safe, then rerun integration validation and merge
only after the required E2E suite passes.

## PR #55 follow-up — in progress (2026-10-24)

The user authorized a direct, surgical fix to PR #55 and continued validation.
Scope is limited to making `GraphMiniMap` initialization safe when unmounted
while Pixi `Application.init()` is pending. Next step: implement and test the
cleanup on the PR branch, then rerun integration validation.

## Container rebuild and deployment — completed 2026-10-24

Rebuilt the five `songnodes-dev` application images and deployed the full
Compose stack. The Windows host had no usable WSL shell, so the documented
`scripts/start-dev.sh` sequence was run directly with Docker Compose: existing
Postgres/Redis were retained, migrations 012–014 were applied idempotently, and
all services were started with health checks. No database volume was reset.

Checks passed:

```text
docker compose -f compose.dev.yaml build graph-api rest-api worker unified-scraper frontend
docker compose -f compose.dev.yaml up -d --no-build --wait --wait-timeout 120
docker compose -f compose.dev.yaml exec -T worker python migrate.py --check
```

All eight containers reported healthy; REST `/health`, graph `/api/graph/data`,
scraper `/health`, and frontend `/` each returned HTTP 200. The worker schema
check reported `data layer schema is complete`.

Unresolved deployment issues: none observed. No live provider checks or
scraping were run. Next task: once ready for real data, complete the documented
credential-gated live provider checks before the first real scrape.

## SEC3 Apply pending dependency security updates (2026-10-25)

Started working on security updates from Dependabot branches:
- Applied `js-yaml` bump in `frontend/package.json` to ^4.1.1
- Applied `filelock` bump in `tests/requirements.txt` to 4.2.1
- Applied `pip` group updates in `services/data-transformer/requirements.txt` and synced them to the remaining python services.
- Verified `npm audit --omit=dev` finds 0 vulnerabilities.
- Documented remaining `pip-audit` issues in `docs/security/dependency-updates.md` (which are deferred due to dependency resolution conflicts on `starlette` making it a breaking change).
- Encountered issues executing python tests via `pytest` because `httpx` is missing in the `pipx` container, indicating dependencies need to be installed in the isolated environment or a different testing strategy is expected.
