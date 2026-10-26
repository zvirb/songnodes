L6: Script: import the musicLibrary SQLite into the running stack

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L6: Script: import the musicLibrary SQLite into the running stack" on a branch starting with "l6-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L6 BEGIN/END). Depends on: L1, L3, L4. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add scripts/import-music-library.sh, which loads one musicLibrary SQLite file into the running dev stack through the existing importer.

## Context (verified on main 2026-10-26)
The owner's weekly DJ library refresh writes E:\musicLibrary\db\dj_library.sqlite on the laptop. services/library/importer (PR #158) reads that SQLite and posts it to POST /api/v1/library/ingest with Idempotency-Key import-<md5 of the file>, so the same file never imports twice. Nothing runs it yet, so the Library page shows an empty library.

## Owned paths
- scripts/import-music-library.sh
- docs/library-import.md

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L6/ if you need to record a decision.)

## Do
1. Usage: `bash scripts/import-music-library.sh <path-to-dj_library.sqlite>`. Refuse with a clear message if the file is missing or the rest-api service is not healthy (`docker compose -f compose.dev.yaml ps`).
2. docker cp the file into the rest-api container under /tmp, run `python -m library.importer --sqlite /tmp/<name> --api-url http://localhost:8082/api/v1/library/ingest` there (rest-api listens on 8082 inside its container, see services/rest_api/Dockerfile; the importer's default 8080 is wrong) with `docker compose -f compose.dev.yaml exec -T`, then remove the copy. Never mount or write the owner's folder.
3. Poll GET /api/v1/jobs for the returned job id until it succeeds or fails (bounded, with a message naming what it waited for); print the result counts; exit non-zero on failure. Append one dated line to a log file given by --log (optional).
4. docs/library-import.md: what it does, how to run it, and a one-line Windows Task Scheduler entry (Git Bash) to run it weekly after the refresh.

## Done when (the reviewer's under-10-minute check; put it in the PR)
On the laptop, running the script twice with the same SQLite file creates one ingest job and the second run reports it as already imported; /library then shows the library's track count (the reviewer runs this; say in the PR that your sandbox could not).

## Checks
`bash -n scripts/import-music-library.sh` and shellcheck if available. Docker is not available in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
