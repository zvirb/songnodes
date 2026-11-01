DS23: Pipeline page shows a scrape job's stages with StagedProgress

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "DS23: Pipeline page shows a scrape job's stages with StagedProgress" on a branch starting with "ds23-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:DS23 BEGIN/END, added at the end of the file if missing). Depends on: SP14 (#475, merged) and JOBSTG (#477, the `GET /api/v1/jobs/{job_id}/stages` endpoint). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Show each unfinished scrape job on /pipeline with StagedProgress, mapped from the JOBSTG stages endpoint.

## Context (verified on main 2427bf9, 1 Nov 2026)
DS23 Step 0 (30 Oct) found that `GET /api/v1/jobs` alone gives only two honest stages. JOBSTG (#477) adds `GET /api/v1/jobs/{job_id}/stages` in services/rest_api/routers/jobs.py: steps queued, scrape ("Scraping and saving raw data", with `progress` pages/playlists/tracks or `progress: null` and a fixed detail), ingest to silver and graph projection, each with a StagedProgress state (`done`, `running`, `waiting`, `failed`) and `last_progress_at`. It never sends `stalled`: the page works that out. SP14 (#475) gave frontend/src/components/ds/StagedProgress.tsx the 1.4.0 `stalled` state with `secondsSinceProgress`, `stallSeconds` (default 60) and `onResume`. /pipeline is frontend/src/pages/ScraperProgressPage.tsx ("Scrape runs" section, about line 282) fed by frontend/src/features/pipeline/usePipelineTelemetry.ts (read-only for you).

## Owned paths
- frontend/src/features/pipeline/jobStages.ts (new: fetch the stages endpoint and map it to StagedProgress steps)
- frontend/src/features/pipeline/jobStages.test.ts (new)
- frontend/src/features/pipeline/ScrapeJobStages.tsx (new: the StagedProgress block for one job)
- frontend/src/features/pipeline/ScrapeJobStages.test.tsx (new)
- frontend/src/pages/ScraperProgressPage.tsx (the "Scrape runs" section only)
- frontend/src/pages/ScraperProgressPage.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/DS23/ if you need to record a decision.)

## Do
1. Read the StagedProgress card (design-system/api/components/StagedProgress.md, design-system/components/StagedProgress/README.md) first.
2. For each scrape job that is queued or running, poll its stages endpoint (about every 10 s while the page is visible; stop when the job finishes) and render StagedProgress. `secondsSinceProgress` is now minus `last_progress_at`; the component decides `stalled`. Try again on a stalled step uses the existing retry action only if the job is dead; otherwise leave `onResume` out.
3. Finished and dead jobs keep the existing table row and status pill. A stages request that fails shows an error that names the cause, never invented stages. A missing value is an en dash.
4. Unit test the mapping: each API state, `progress: null` with its detail, an unknown state shown as an en dash (not guessed), and the stall worked out from `last_progress_at`.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With the stack running, queue "Deadmau5 Strobe" on /pipeline: the job shows Queued, then Scraping and saving raw data with a rising page count, then Ingest and Projection done. Stop the unified scraper mid-scrape: within about a minute the scrape step shows "No progress for N s".

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; `python3 scripts/check_feature_imports.py --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
