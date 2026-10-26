SEC6B: AI proxy: frontend client and migration note

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SEC6B: AI proxy: frontend client and migration note" on a branch starting with "sec6b-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SEC6B BEGIN/END). Depends on: SEC6A. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add a typed frontend client for /api/v1/ai/complete and document how pages switch to it.

## Context (verified on main 2026-10-26)
SEC6A adds the route. aiService.ts and the AI setlists page still call providers directly; they switch in a later package.

## Owned paths
- frontend/src/services/aiProxyClient.ts
- frontend/src/services/aiProxyClient.test.ts
- docs/security/ai-proxy.md

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SEC6B/ if you need to record a decision.)

## Do
1. Client with timeouts and error mapping; do not edit aiService.ts or any page.
2. Doc: how aiService and the AI setlists page switch over, and how to clear the old localStorage keys.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Unit test with a mocked fetch covers success, 429 and timeout.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
