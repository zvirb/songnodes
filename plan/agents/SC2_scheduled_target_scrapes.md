SC2: Scrape target tracks on a schedule

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SC2: Scrape target tracks on a schedule" on a branch starting with "sc2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SC2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the worker search for every active target track on its own, so adding a target track leads to scraped playlists without anyone calling /api/v1/scrape/trigger.

## Context (verified on main 2026-10-26)
Target tracks live in the target_tracks table (sql/migrations/012_target_tracks_up.sql: track_id, artist, title, priority low/medium/high, is_active, archived, last_searched, playlists_found). Scrapes run only as 'scrape' jobs (services/common/datalayer/handlers.py, @handler('scrape'), payload source + search_query 'Artist Title'), which today are created only by POST /api/v1/scrape/trigger (services/rest_api/routers/jobs.py). The worker's beat (services/worker/celery_app.py, schedule_async) enqueues only projection_consume, graph_projection_consume and ingest_pending. The old scraper-orchestrator service that used last_searched is not in compose.dev.yaml and does not run. So on 28 Oct the target 'Skober – Phoenix Rose', added at 16:43, still had last_searched null. CLAUDE.md section 2: search MixesDB and 1001Tracklists for complete playlists containing the target, search query is artist and title together.

## Owned paths
- services/common/datalayer/target_scrape.py (new: the selection query and the job creation)
- services/common/datalayer/handlers.py (register one new handler 'scrape_targets' that calls target_scrape; do not change other handlers)
- services/worker/celery_app.py (schedule_async: one more recurring kind, and its interval setting)
- services/common/tests/test_target_scrape.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SC2/ if you need to record a decision.)

## Do
1. New recurring job 'scrape_targets' every SCRAPE_TARGETS_INTERVAL_SECONDS (default 3600), enqueued in schedule_async exactly like the others (time-bucketed idempotency key). SCRAPE_TARGETS_ENABLED (default 'true'; 'false' turns it off).
2. The handler picks at most SCRAPE_TARGETS_PER_RUN (default 2) targets with is_active and not archived, whose last_searched is null or older than TARGET_RESEARCH_DAYS (default 7): order by priority high, medium, low, then last_searched nulls first, then added_at. Lock the rows (FOR UPDATE SKIP LOCKED) so two workers never pick the same target.
3. For each target, enqueue one 'scrape' job per source in SCRAPE_TARGET_SOURCES (default 'mixesdb,1001tracklists') with payload {source, search_query: '<artist> <title>', target_track_id} and idempotency key 'target:<track_id>:<source>:<UTC date>', then set last_searched = now() and updated_at = now(). Use jobs.enqueue from services/common/datalayer/jobs.py.
4. Return a summary {selected, enqueued, skipped_existing} and log one info line per run. Never scrape a target with an empty artist or title (the table forbids them, but skip defensively).
5. Do not touch the scrape handler, the spiders or the REST routers. Updating playlists_found after a scrape is a follow-up; say so in the PR.
6. Tests with a fake connection in the style of services/common/tests: selection order and limit, the idempotency keys, last_searched updated, disabled flag enqueues nothing, archived and inactive targets are never picked.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With the stack running, add a target track on /sources/targets; within the interval (set SCRAPE_TARGETS_INTERVAL_SECONDS=60 to check quickly) GET /api/v1/jobs?kind=scrape lists two jobs for it (mixesdb and 1001tracklists) and the target's last_searched is set.

## Checks
`cd services && python -m pytest common/tests/test_target_scrape.py -q` and `python -m pytest` for anything else you touch. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
