SB4: Set builder: save and delete sets through the per-set API

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SB4: Set builder: save and delete sets through the per-set API" on a branch starting with "sb4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SB4 BEGIN/END). Depends on: L3. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the Set builder save, list and delete sets through the saved-sets endpoints as the backend defines them.

## Context (verified on main 2026-10-26)
frontend/src/features/musicLibrary/data.ts writeSavedSetsAsync sends PUT /api/v1/library/sets with the whole list, but the backend (services/rest_api/routers/library_ingest.py, PR #158) only has GET /api/v1/library/sets, PUT and DELETE /api/v1/library/sets/{set_id} (set_id is an integer, library.sets.id). The PUT fails, the page saves to localStorage only, and on reload GET returns the database's list, so saved sets vanish. The frontend's SavedSet.id is a string.

## Owned paths
- frontend/src/features/musicLibrary/data.ts
- frontend/src/features/musicLibrary/data.test.ts

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SB4/ if you need to record a decision.)

## Do
1. Save one set with PUT /api/v1/library/sets/{id} and delete with DELETE; map the API's integer id to and from SavedSet.id in data.ts only.
2. If the API is unreachable or answers an error, show that honestly through the existing error path instead of silently keeping a local-only copy; keep localStorage only as the documented offline cache it already is.
3. Unit test with a mocked fetch: save, list after reload, delete, and an API error.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With QA7's fixture, `bash scripts/e2e-docker.sh sets` passes: a saved set survives a reload and can be deleted.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
