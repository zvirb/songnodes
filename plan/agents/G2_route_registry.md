G2: Route registry: each page registers its own route

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "G2: Route registry: each page registers its own route" on a branch starting with "g2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:G2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make pages register their routes from their own folder, so adding a page no longer edits the shared App.tsx.

## Context (verified on main 2026-10-26)
Every new page so far needed an App.tsx edit by a separate wiring package; three finished pages (FE5 camelot, FE10 AI setlists, FE3 route finder) are still unrouted. Navigation items come from the design system's modules (lib/songnodes.tsx MODULE_ROUTES); do not change navigation.

## Owned paths
- frontend/src/App.tsx
- frontend/src/routes/**
- frontend/src/features/musicLibrary/route.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/G2/ if you need to record a decision.)

## Do
1. frontend/src/routes/registry.tsx: collect `import.meta.glob('../features/*/route.tsx', { eager: true })`; each module exports `route = { path, element }` (lazy element allowed). Keep a static list for today's pages that live outside features/ (home, graph, harmony, sources, pipeline, settings, not-found, the /paths placeholder).
2. A discovered route replaces a static entry with the same path; two discovered routes with the same path is an error (throw in dev and fail the test).
3. App.tsx renders static plus discovered routes inside the existing AppShell; the OAuth callback routes stay outside the shell, unchanged.
4. Move /library and /sets into features/musicLibrary/route.tsx.
5. Test: render every current URL in a MemoryRouter and assert the same page heading as before.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Every URL in today's App.tsx still opens the same page; the registry test lists them.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
