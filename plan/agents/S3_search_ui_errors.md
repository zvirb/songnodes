S3: Music search UI: show the real error

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "S3: Music search UI: show the real error" on a branch starting with "s3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:S3 BEGIN/END). Depends on: S2. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the music search box show the API's error message instead of a generic one or an empty result.

## Context (verified on main 2026-10-26)
frontend/src/components/MusicServiceSearch.tsx calls /api/v1/music-search/{service}; after S2 errors carry detail.code and detail.message.

## Owned paths
- frontend/src/components/MusicServiceSearch.tsx (error handling only)
- frontend/src/components/MusicServiceSearch.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/S3/ if you need to record a decision.)

## Do
1. Show detail.message for 424, 502 and 503 with the "connect in Settings" hint; keep partial results when one service fails; never show "No results" when the cause was an error.
2. Use the design system's banner or empty-state component; no new CSS.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With no TIDAL credentials, searching shows "TIDAL is not configured..." and not an empty list.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
