FL4: Design system: MiniAudioPreview component

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "FL4: Design system: MiniAudioPreview component" on a branch starting with "fl4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:FL4 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add accessible MiniAudioPreview component for 30-second track audio preview with play/pause and progress.

## Context (verified on main 2026-10-26)
Curation and set-building require listening to snippets of tracks without navigating away or opening external music players.

## Owned paths
- frontend/src/components/ds/MiniAudioPreview.tsx
- frontend/src/components/ds/MiniAudioPreview.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/FL4/ if you need to record a decision.)

## Do
1. MiniAudioPreview: compact inline player (32px height) with play/pause button (SnIcon play/pause), time display, and mini progress bar using design-system tokens.
2. Audio element lifecycle: stop playback on unmount, handle missing or 404 preview URLs with quiet disabled state.
3. Global singleton audio manager ensuring only one preview plays at a time across the entire application.
4. Tests: play/pause state toggle; time update; unmount cleans up audio instance; graceful error when audio fails to load.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/components/ds/MiniAudioPreview.test.ts` passes.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
