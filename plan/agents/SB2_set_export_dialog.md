SB2: Set builder: export dialog

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SB2: Set builder: export dialog" on a branch starting with "sb2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SB2 BEGIN/END). Depends on: SB1. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add an export dialog to the set builder, using the SB1 exporters.

## Context (verified on main 2026-10-26)
features/setBuilder/exporters.ts (SB1) provides the formats and the missing-field summary.

## Owned paths
- frontend/src/features/setBuilder/ExportDialog.tsx
- frontend/src/features/setBuilder/ExportDialog.test.tsx
- frontend/src/features/musicLibrary/SetBuilderPage.tsx (one edit: mount the export button)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SB2/ if you need to record a decision.)

## Do
1. Design-system Dialog: format choice, preview of the first rows, CopyButton, file download; the missing-field summary before export.
2. Tests: each format selectable; summary shown; download triggered.

## Done when (the reviewer's under-10-minute check; put it in the PR)
On /sets, export a set as M3U8 and see the summary first.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx vitest run src && npx vite build`. If `npm ci` fails on the lockfile (QA2 not merged yet), use `npm install --no-package-lock` instead, say so, and never commit package-lock.json. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
