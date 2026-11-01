DS24B: Scheduled scrapes honour a date window

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "DS24B: Scheduled scrapes honour a date window" on a branch starting with "ds24b-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:DS24B BEGIN/END, added at the end of the file if missing). Depends on: DS24A (#476, merged). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Store one scheduled-scrape date window and make the hourly target scheduler queue nothing outside it.

## Context (verified on main 2427bf9, 1 Nov 2026)
Owner decision 1 Nov 2026 (DS24): the first real date-span use is a scheduled-scrape window on /pipeline. The hourly scheduler is `scrape_targets` in services/common/datalayer/target_scrape.py, run as a recurring job from services/worker/celery_app.py (`SCRAPE_TARGETS_INTERVAL_SECONDS`, default 3600). There is no settings table yet; migration 260 is free. Write routes are already protected by the token middleware (services/rest_api/security/auth.py). The card that sets the window is DS24C, not this package.
Assumed meaning (confirm with Markus before step 2 if unsure): the window limits the days on which scheduled target scrapes are queued. It does not filter mixes by their date (no spider supports that). Manual scrapes from /pipeline are never limited.

## Owned paths
- sql/migrations/260_scrape_window_up.sql (new)
- sql/migrations/260_scrape_window_down.sql (new)
- scripts/start-dev.sh (one line that applies 260, next to the other migrations)
- services/rest_api/routers/scrape_window.py (new, exposes register(app))
- services/common/datalayer/target_scrape.py
- services/common/tests/test_target_scrape.py
- tests/rest_api/test_scrape_window.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/DS24B/ if you need to record a decision.)

## Do
1. Migration 260: a one-row table for the window: `starts_on DATE NULL`, `ends_on DATE NULL` (both null = no window, scrapes every day), `updated_at`, CHECK `starts_on <= ends_on` when both are set. Up and down.
2. `GET /api/v1/scrape/window` returns `{starts_on, ends_on, updated_at}`; `PUT` takes the same dates (date-only ISO strings or null) and returns 422 with a sentence for a bad date or a reversed span.
3. `scrape_targets` reads the window first. When today's Melbourne date (Australia/Melbourne, not UTC) is outside it, it selects and enqueues nothing, leaves `last_searched` alone and returns `{selected: 0, enqueued: 0, skipped_existing: 0, outside_window: true, starts_on, ends_on}`. A missing table or row means no window.
4. Tests with fakes in the style of the existing ones: inside, before and after the window, open-ended windows, the Melbourne date at 2026-10-03T15:30Z being 4 Oct, the router's 422s.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`curl -X PUT http://127.0.0.1:8082/api/v1/scrape/window -H "Content-Type: application/json" -d '{"starts_on":"2026-12-01","ends_on":"2026-12-31"}'` (with the API token), then with SCRAPE_TARGETS_INTERVAL_SECONDS=60 the next `scrape_targets` job result says `outside_window: true` and no new scrape jobs appear in `GET /api/v1/jobs?kind=scrape`.

## Checks
`cd services && python -m pytest common/tests/test_target_scrape.py -q`; `python -m pytest tests/rest_api/test_scrape_window.py -q`; `bash -n scripts/start-dev.sh`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
