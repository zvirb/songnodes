UX2: Favorite queries: starred queries and filter preset storage

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "UX2: Favorite queries: starred queries and filter preset storage" on a branch starting with "ux2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:UX2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add a pure, typed utility to store, toggle, and retrieve starred queries and filter presets in localStorage.

## Context (verified on main 2026-10-26)
DJs repeatedly apply the same complex filter combinations (e.g. specific BPM range, Camelot keys, and rotation status) or search for recurring labels/artists without a quick recall mechanism.

## Owned paths
- frontend/src/utils/favoriteQueries.ts
- frontend/src/utils/favoriteQueries.test.ts

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/UX2/ if you need to record a decision.)

## Do
1. Implement FavoriteItem<T> interface { id: string; label: string; payload: T; createdAt: number }.
2. Implement getFavorites<T>(namespace: string): FavoriteItem<T>[], saveFavorite<T>(namespace: string, item: Omit<FavoriteItem<T>, 'id' | 'createdAt'>): FavoriteItem<T>, removeFavorite(namespace: string, id: string), isFavorite(namespace: string, label: string): boolean.
3. Store under key prefix 'sn-favs-' + namespace with JSON serialization and schema guards.
4. Unit tests: adding a favorite, duplicate prevention, removal, custom payload retrieval, invalid JSON recovery.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/utils/favoriteQueries.test.ts` passes.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
