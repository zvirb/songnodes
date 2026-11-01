MDB1: MixesDB tracks reach silver linked to their bronze row

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "MDB1: MixesDB tracks reach silver linked to their bronze row" on a branch starting with "mdb1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:MDB1 BEGIN/END, added at the end of the file if missing). Depends on: BRZ1 (same file; merge BRZ1 first, then rebase). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Link each MixesDB silver track to its positioned bronze row so it is no longer skipped for a missing bronze_id.

## Context (verified on main 2427bf9, 1 Nov 2026)
SC6 found (STATUS.md SC6 "Found, not fixed"): MixesDB yields a standalone track item before each playlist track item. In scrapers/pipelines/persistence_pipeline.py the standalone item creates the silver track (`_process_track_item`, then `_insert_songs_batch`), but only the positioned item gets a bronze row, so `_insert_songs_batch` logs "Missing bronze_id FK reference" and skips it: 7 of 7 silver tracks in the SC6 fixture.

## Owned paths
- scrapers/pipelines/persistence_pipeline.py (`_process_track_item` and `_insert_songs_batch` only)
- scrapers/tests/test_silver_links_bronze.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/MDB1/ if you need to record a decision.)

## Do
1. The silver track is queued from the item that has the bronze row (the positioned one), or takes that item's `_bronze_id`; a standalone item with no positioned twin is still skipped, with the existing log.
2. The title::artist dedupe still means one silver row per track per job.
3. Bronze writes and job counts are unchanged (SC5, SC6, BRZ1).
4. Test on the SC6 fixture (2 playlists x 5 tracks, spider yield order): every silver track gets a bronze_id, no "Missing bronze_id" log.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd scrapers && python -m pytest tests/test_silver_links_bronze.py -q` passes and fails on main.

## Checks
`cd scrapers && python -m pytest tests -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
