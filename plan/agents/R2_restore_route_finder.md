R2: Restore the route finder page

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "R2: Restore the route finder page" on a branch starting with "r2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:R2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Bring back the FE3 route finder page that the PR #136 CI fix deleted. Do not route it yet (P1 does).

## Context (verified on main 2026-10-26)
FE3 (PR #133, ccaca01) added frontend/src/features/pathfinder/{PathfinderPage.tsx, PathfinderPage.test.tsx, index.ts, useUnifiedTracks.ts}. PR #136 (ecdfe4a, "fix(ci): fix broken package.json ...") deleted all four. /paths still renders PlannedModulePage. The backend router services/rest_api/routers/pathfinder.py and the existing usePathfinder hook are still on main.

## Owned paths
- frontend/src/features/pathfinder/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/R2/ if you need to record a decision.)

## Do
1. `git checkout ccaca01 -- frontend/src/features/pathfinder`.
2. Fix only compile or test errors inside that folder (imports that moved). Keep its local useUnifiedTracks.ts; P1 swaps it for the shared hook.
3. Do not edit App.tsx or any route file.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/features/pathfinder` passes and the folder matches ccaca01 except the listed fixes.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
