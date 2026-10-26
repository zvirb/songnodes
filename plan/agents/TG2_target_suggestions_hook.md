TG2: Target suggestions: frontend data hook and actions

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "TG2: Target suggestions: frontend data hook and actions" on a branch starting with "tg2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:TG2 BEGIN/END). Depends on: TG1. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add useTargetSuggestions hook with fetch, dismiss, and promote-to-target actions.

## Context (verified on main 2026-10-26)
Frontend components need a typed, resilient data hook to query suggested target tracks and convert them into actual targets via api.post('/target-tracks').

## Owned paths
- frontend/src/hooks/useTargetSuggestions.ts
- frontend/src/hooks/useTargetSuggestions.test.ts

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/TG2/ if you need to record a decision.)

## Do
1. Create useTargetSuggestions() hook: state for suggestions, loading, error, and dismissedIds.
2. Functions: promoteSuggestion(suggestion) (POSTs to /api/v1/target-tracks and removes from suggestion list), dismissSuggestion(id) (persists to sn-dismissed-suggestions).
3. Graceful fallback: if endpoint returns 404 or backend down, set honest error state without crashing.
4. Tests: successful load, promoteSuggestion calls API and updates local state, dismissSuggestion persists to local storage.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/hooks/useTargetSuggestions.test.ts` passes.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
