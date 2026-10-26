TG4: Library: crate target-enrichment discovery banner

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "TG4: Library: crate target-enrichment discovery banner" on a branch starting with "tg4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:TG4 BEGIN/END). Depends on: TG2, FE9. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add an enrichment opportunity banner to LibraryPage when crate tracks are not yet in the target queue.

## Context (verified on main 2026-10-26)
DJs exploring crates in LibraryPage frequently spot un-enriched tracks. A banner informing them of high-rotation un-targeted tracks bridges crate browsing with crawler enrichment.

## Owned paths
- frontend/src/features/musicLibrary/targetAction/DiscoveryBanner.tsx
- frontend/src/features/musicLibrary/targetAction/DiscoveryBanner.test.tsx
- frontend/src/features/musicLibrary/LibraryPage.tsx (one edit: mount banner)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/TG4/ if you need to record a decision.)

## Do
1. Create DiscoveryBanner component using design system Banner pattern (sn-banner).
2. Show count of tracks in the current view that lack BPM/key or graph adjacencies and are not yet targeted.
3. Provide 'Target top un-enriched' quick action (invokes setTrackAsTarget in batch up to 5 tracks) and a dismiss button.
4. Mount inside LibraryPage between keyed-coverage banner and the data table.
5. Tests: banner renders when un-targeted tracks present; action triggers batch targeting; dismiss hides banner.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open /library with un-targeted tracks: banner appears; clicking action targets them and updates coverage.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
