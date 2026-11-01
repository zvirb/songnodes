SC2B: Target tracks record how many playlists were found

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SC2B: Target tracks record how many playlists were found" on a branch starting with "sc2b-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SC2B BEGIN/END, added at the end of the file if missing). Depends on: SC2 (merged) and JOBSTG (#477; it also edits services/common/datalayer/handlers.py, so rebase on it). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
After a scrape job for a target track, set target_tracks.playlists_found from bronze.

## Context (verified on main 2427bf9, 1 Nov 2026)
`target_tracks.playlists_found` (sql/migrations/012_target_tracks_up.sql) is shown on the target tracks page (frontend/src/components/TargetTracksManager.tsx) but nothing writes it (SC2 follow-up). Scheduled scrapes carry `target_track_id` in their payload (services/common/datalayer/target_scrape.py, read-only for you). The scrape handler is `scrape` in services/common/datalayer/handlers.py; the unified scraper has written bronze before it returns. Bronze tracks: `bronze_scraped_tracks` (artist_name, track_title, playlist_id, position; migrations medallion/001 and 014).

## Owned paths
- services/common/datalayer/target_results.py (new: the count and the update)
- services/common/datalayer/handlers.py (the `scrape` handler only: one call when the payload has target_track_id)
- services/common/tests/test_target_results.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SC2B/ if you need to record a decision.)

## Do
1. `record_playlists_found(conn, target_track_id)`: set `playlists_found` to the number of distinct bronze playlists (any source) holding a positioned track whose trimmed, case-insensitive artist and title match the target's, and `updated_at = now()`. A recount, never an increment, so a retried or repeated scrape cannot inflate it.
2. Call it from the scrape handler after a successful response when `payload.target_track_id` is a UUID; a missing or archived target is skipped and said in the result (`target_playlists_found: null`). Run it in a savepoint (nested transaction), because the runner completes the job in the same transaction; a failure is logged and never fails the scrape job.
3. Do not change the scheduler, the spiders or the REST routers.
4. Tests with a fake connection: the recount, a retry gives the same number, the handler call only with a target id.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Run one scheduled target scrape (SCRAPE_TARGETS_INTERVAL_SECONDS=60): on /sources/targets the target shows "N playlists", and N equals `select count(distinct playlist_id) from bronze_scraped_tracks where lower(trim(artist_name)) = lower('<artist>') and lower(trim(track_title)) = lower('<title>');`.

## Checks
`cd services && python -m pytest common/tests -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
