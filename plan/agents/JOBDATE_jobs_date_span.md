JOBDATE: Date span filters on GET /api/v1/jobs

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "JOBDATE: Date span filters on GET /api/v1/jobs" on a branch starting with "jobdate-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:JOBDATE BEGIN/END, added at the end of the file if missing). Depends on: JOBSTG (#477; it also edits services/rest_api/routers/jobs.py, so rebase on it). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add `created_from` and `created_to` to `GET /api/v1/jobs`.

## Context (verified on main 2427bf9, 1 Nov 2026)
`GET /api/v1/jobs` (services/rest_api/routers/jobs.py, `list_jobs`) filters by status, kind, limit (at most 200) and offset only, through `list_jobs` in services/common/datalayer/jobs.py. Succeeded jobs are pruned after JOB_RETENTION_DAYS (default 14; services/worker/celery_app.py). docs/integration/DS24/decision.md asks for this so a date filter on /pipeline is honest. Note: this code has no digit, so scripts/scope_guard.py prints "not a work package" and does not check owned paths; the reviewer checks them by hand.

## Owned paths
- services/rest_api/routers/jobs.py (the list endpoint only)
- services/common/datalayer/jobs.py (`list_jobs` only)
- tests/rest_api/test_jobs_date_span.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/JOBDATE/ if you need to record a decision.)

## Do
1. `created_from` and `created_to` are date-only ISO strings read as Australia/Melbourne calendar days: from 00:00 on `created_from` to the end of `created_to`, inclusive. Either may be left out. A bad date or `created_from` after `created_to` is a 422 with a sentence.
2. The response header `X-Job-Retention-Days` (from JOB_RETENTION_DAYS, default 14) tells the page how far back succeeded jobs go.
3. Tests: the bounds across the 4 Oct 2026 DST change, open-ended spans, the 422s, the existing filters unchanged.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`curl "http://127.0.0.1:8082/api/v1/jobs?kind=scrape&created_from=2026-10-30&created_to=2026-10-31"` lists only scrape jobs created on 30 or 31 Oct Melbourne time and carries `X-Job-Retention-Days: 14`.

## Checks
`python -m pytest tests/rest_api -q`; `cd services && python -m pytest common/tests -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
