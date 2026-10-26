SB1: Set exporters: M3U8, Rekordbox XML and a TIDAL list

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SB1: Set exporters: M3U8, Rekordbox XML and a TIDAL list" on a branch starting with "sb1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SB1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add pure, tested functions that turn a set's tracks into M3U8, Rekordbox XML and a TIDAL id list. No UI.

## Context (verified on main 2026-10-26)
features/musicLibrary/SetBuilderPage.tsx has energy waves, transition checks and saved sets but no DJ-format export. BPM, key and duration are often null.

## Owned paths
- frontend/src/features/setBuilder/exporters.ts
- frontend/src/features/setBuilder/exporters.test.ts

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SB1/ if you need to record a decision.)

## Do
1. M3U8 with #EXTINF and safe path/URL handling; Rekordbox XML with escaping and missing duration/BPM/key handled; TIDAL as a JSON list of ids/URLs only (no network).
2. A missing-field summary helper ("12 tracks have no BPM") for the dialog in SB2.
3. Golden-string tests including special characters and empty fields.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/features/setBuilder` passes; the PR shows one golden output per format.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
