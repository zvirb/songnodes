BRZ1: One bad bronze row no longer loses or miscounts its batch

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "BRZ1: One bad bronze row no longer loses or miscounts its batch" on a branch starting with "brz1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:BRZ1 BEGIN/END, added at the end of the file if missing). Depends on: SC5 and SC6 (merged). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Give each bronze row insert its own savepoint so one failing row is skipped and counted, and the rest of the batch is written.

## Context (verified on main 2427bf9, 1 Nov 2026)
SC5 found (STATUS.md SC5 "Found, not fixed"): in scrapers/pipelines/persistence_pipeline.py, `_flush_batch` opens one transaction per batch, and `_insert_bronze_tracks_batch` / `_insert_bronze_playlists_batch` catch a row's exception and carry on. In real Postgres the first error aborts the transaction, so later rows fail, the batch COMMIT becomes a rollback, and `bronze_*_written` still counts the rows before the error. The SC5 test (scrapers/tests/test_scrape_counts_agree.py) uses a fake pool that does not model the abort.

## Owned paths
- scrapers/pipelines/persistence_pipeline.py (`_flush_batch` bronze branches, `_insert_bronze_tracks_batch`, `_insert_bronze_playlists_batch` only)
- scrapers/tests/test_bronze_batch_bad_row.py (new)
- scrapers/tests/test_scrape_counts_agree.py (only if its fake needs savepoint support)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/BRZ1/ if you need to record a decision.)

## Do
1. Wrap each bronze row insert in a nested transaction (asyncpg savepoint), so a failing row rolls back alone and the batch commits the others.
2. `bronze_*_written` counts only rows whose savepoint was released; the failure is logged once per row with the source URL and position.
3. Do not change silver, artist or adjacency batches, the spiders or the job result fields (SC5).
4. Test with a fake connection that aborts the transaction after an error unless a savepoint is used: 10 queued, one bad row, 9 written and counted, data loss 1.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd scrapers && python -m pytest tests/test_bronze_batch_bad_row.py tests/test_scrape_counts_agree.py -q` passes; the new test fails on main.

## Checks
`cd scrapers && python -m pytest tests -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
