TG3: TargetTracksManager: suggested tracks discovery rail

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "TG3: TargetTracksManager: suggested tracks discovery rail" on a branch starting with "tg3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:TG3 BEGIN/END). Depends on: TG2. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Mount a 'Suggested for Discovery' card carousel in TargetTracksManager with one-click '+ Add Target' buttons.

## Context (verified on main 2026-10-26)
frontend/src/components/TargetTracksManager.tsx displays a table of targets, but has no discovery mechanism when the list is sparse.

## Owned paths
- frontend/src/components/TargetTracksManager.tsx
- frontend/src/components/TargetTracksManager.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/TG3/ if you need to record a decision.)

## Do
1. Mount a horizontal card deck above or alongside the target table when suggestions exist.
2. Each card shows: Track title, Artist, Rationale pill (e.g. 'Played on 3 shows'), '+ Add Target' button (sn-btn--quiet sn-btn--sm), and 'Dismiss' button.
3. Clicking '+ Add Target' calls promoteSuggestion with optimistic feedback and announces via aria-live.
4. Empty/error state: if no suggestions available, render nothing or polite empty indicator without layout jump.
5. Tests: suggestions render in deck; clicking '+ Add' promotes track to target list; dismissing card removes it from view.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open /sources/targets: suggested tracks appear in deck; clicking '+ Add' moves track into target table.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
