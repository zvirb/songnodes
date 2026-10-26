P3: Sources: route the AI setlists page

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "P3: Sources: route the AI setlists page" on a branch starting with "p3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:P3 BEGIN/END). Depends on: G2, R1. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the finished AI setlists page reachable, in the place the design system's information architecture gives it.

## Context (verified on main 2026-10-26)
FE10 (PR #94) built frontend/src/features/aiSetlists/AISetlistsPage.tsx; it was never routed. /sources redirects to /sources/targets. design-system 02-information-architecture and 10-navigation decide how a second Sources page is reached (NavDrawer only; no site tabs).

## Owned paths
- frontend/src/features/aiSetlists/**
- frontend/src/pages/ModulePages.tsx (only an entry point on the Sources page, if the IA calls for one)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/P3/ if you need to record a decision.)

## Do
1. Read the IA sections and pick the path and entry point they prescribe; quote the rule in the PR. If they give no place, register the route, add no navigation, and report it as a design-system gap.
2. Add features/aiSetlists/route.tsx and switch to the shared hook (delete TEMP_useUnifiedTracks.ts).
3. The page keeps its AI calls as they are (SEC6 moves keys off the browser later).

## Done when (the reviewer's under-10-minute check; put it in the PR)
The page opens at its route and is reachable the way the PR describes.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
