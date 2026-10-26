FE9: Add library tracks to target tracks

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "FE9: Add library tracks to target tracks" on a branch starting with "fe9-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:FE9 BEGIN/END). Depends on: R1. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add a row button in the library table that adds the track to target tracks.

## Context (verified on main 2026-10-26)
The library table is frontend/src/features/musicLibrary/LibraryPage.tsx; the row-actions cell has an "Add to set" icon button with classes sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon. Targets go through useUnifiedTracks().setTrackAsTarget (R1), which POSTs to /api/v1/target-tracks (routers/target_tracks.py: title, artist, priority, genres, search_terms).

## Owned paths
- frontend/src/features/musicLibrary/targetAction/**
- frontend/src/features/musicLibrary/LibraryPage.tsx (one edit: mount the button in the row-actions cell)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/FE9/ if you need to record a decision.)

## Do
1. Icon button with the same classes; icon name from design-system 14-identity-icons via SnIcon (do not invent one); accessible name "Add {artist} - {title} to target tracks".
2. Priority medium; search_terms from artist, title and mix; genres when known. Backend down: keep it locally and say "saved locally, will sync".
3. States with text and icon: idle, adding (aria-busy), added ("In target tracks"), error with retry; announce in an aria-live region. Detect existing targets by id, then by normalised artist + title.
4. Tests: renders with missing BPM/key; one click calls setTrackAsTarget once; double click does not duplicate; existing target shows added; backend-down message.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Click the new button on a library row: the track appears in /sources/targets.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
