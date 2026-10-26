FL2: Set builder: harmonic and energy transition suggestions

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "FL2: Set builder: harmonic and energy transition suggestions" on a branch starting with "fl2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:FL2 BEGIN/END). Depends on: SB3. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add pure transition matching utility and 'Suggest Next Track' drawer in SetBuilderPage.

## Context (verified on main 2026-10-26)
frontend/src/features/musicLibrary/SetBuilderPage.tsx calculates transition checks, but cannot proactively suggest the next compatible track from the library.

## Owned paths
- frontend/src/features/setBuilder/transitions.ts
- frontend/src/features/setBuilder/transitions.test.ts
- frontend/src/features/musicLibrary/SetBuilderPage.tsx (suggest next track action)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/FL2/ if you need to record a decision.)

## Do
1. transitions.ts: findCompatibleTracks(currentTrack, candidateTracks, options): scores candidates by Camelot key distance (same, +/-1 step, or relative major/minor), BPM delta (+/- 4%), and smooth energy progression.
2. In SetBuilderPage: add 'Suggest next' button on empty slot or below last track.
3. Opens a compact popover listing the top 5 compatible tracks from the crate with compatibility badges ('Key match 8A', 'BPM +1.2%').
4. Clicking a candidate slots it directly into the set.
5. Tests: key compatibility scoring handles edge cases (12A -> 1A); BPM tolerance filtering; slotting track updates set.

## Done when (the reviewer's under-10-minute check; put it in the PR)
On /sets with a track in slot 1: clicking 'Suggest next' lists harmonically compatible crate tracks; clicking one adds it to slot 2.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
