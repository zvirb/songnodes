UX7: Music service search: query history and suggestion chips

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "UX7: Music service search: query history and suggestion chips" on a branch starting with "ux7-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:UX7 BEGIN/END). Depends on: UX1, S3. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add recent search chips and clearable query history to MusicServiceSearch.

## Context (verified on main 2026-10-26)
frontend/src/components/MusicServiceSearch.tsx enables searching TIDAL and Spotify. When DJs search for tracks to target, they frequently query the same artist or label names.

## Owned paths
- frontend/src/components/MusicServiceSearch.tsx
- frontend/src/components/MusicServiceSearch.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/UX7/ if you need to record a decision.)

## Do
1. Connect search submission to recentSearches with namespace 'music-service'.
2. Render a row of recent search chips (FilterChip style) beneath the search bar when the query is empty.
3. Clicking a chip executes the search immediately; quiet 'Clear history' button clears the list.
4. Tests: executed search adds to recent list; clicking recent chip triggers search; clear history removes chips.

## Done when (the reviewer's under-10-minute check; put it in the PR)
In MusicServiceSearch: after searching 'Mall Grab', returning to empty search displays 'Mall Grab' chip; clicking it re-executes search.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
