UX8: QuickSearch dialog: recent commands and track completions

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "UX8: QuickSearch dialog: recent commands and track completions" on a branch starting with "ux8-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:UX8 BEGIN/END). Depends on: UX1, UX3. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add recent search memory and module route completions to the QuickSearch dialog.

## Context (verified on main 2026-10-26)
frontend/src/components/QuickSearch.tsx provides app-wide Cmd/Ctrl+K search, but starts blank without recent navigation history or keyword suggestions.

## Owned paths
- frontend/src/components/QuickSearch.tsx
- frontend/src/components/QuickSearch.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/UX8/ if you need to record a decision.)

## Do
1. Store and display recently opened tracks, modules, and setlists using recentSearches under namespace 'quick-search'.
2. Provide keyword prefix suggestions for navigation shortcuts (e.g. 'lib' -> /library, 'set' -> /sets, 'har' -> /harmony).
3. Maintain full keyboard accessibility (ArrowDown/Up, Enter, Esc).
4. Tests: opening QuickSearch shows recent items; typing filters options; selecting navigation item redirects.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Press Cmd/Ctrl+K: recent items appear; typing 'set' selects /sets route.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
