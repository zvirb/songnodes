## SEC4 2026-10-25 Start

Starting SEC4 CI scanning implementation.

# Implementation status

## Current task: merge PR #90 to main

Started at Markus's request. Scope: verify PR #90 checks, review status and merge
state; then fast-forward local `main` and update the development frontend. All GitHub

- `npm run type-check` in frontend: passed (zero errors).
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

## SEC4 2026-10-25 End

Completed implementation of SEC4 CI Scanning tasks.
- Created `.github/workflows/security-secrets-deps.yml` configuring Gitleaks secret scanning, frontend `npm audit`, and backend `pip-audit`.
- Pinned external GitHub actions by SHA and confirmed actionlint success.
- Established `.github/dependabot.yml` setting up update schedules for frontend, services, and actions.
- Documented process in `docs/security/ci-scanning.md`.
- Created `.gitleaksignore` file for known false positives.
