FL1: Keyboard navigation: table row selection and quick actions

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "FL1: Keyboard navigation: table row selection and quick actions" on a branch starting with "fl1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:FL1 BEGIN/END). Depends on: UX4. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add keyboard navigation (J/K row navigation, Space preview, T add to target) for the crate table.

## Context (verified on main 2026-10-26)
Professional DJs use keyboard shortcuts for rapid library curation without reaching for the mouse.

## Owned paths
- frontend/src/hooks/useTableKeyboardNav.ts
- frontend/src/hooks/useTableKeyboardNav.test.ts

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/FL1/ if you need to record a decision.)

## Do
1. Read design-system/components/DataTable/README.md, 'Keyboard row navigation' (design system 1.2.0). Create useTableKeyboardNav({ rowIds, activeId, onActiveChange, onOpen, shortcuts, describe }): J/ArrowDown next, K/ArrowUp previous (clamped), Enter calls onOpen, single-letter shortcuts (' ' preview, 't' add to target, 'x' toggle selection) call shortcuts[key](id).
2. Return props for the table scroll box ({ tabIndex: 0, 'data-keyboard': '', 'aria-keyshortcuts': 'J K Enter Space T X', onKeyDown }) and a polite announcement string ('4 of 120: Bicep – Glue', from describe(id)) for a live region. The caller marks the active row with data-active (2px focus outline, separate from selection) and scrolls it into view; a table is not a grid, so do not use aria-activedescendant.
3. Ignore keys when focus is inside text fields, selects, contenteditable or dialogs, and when Ctrl/Meta/Alt are held.
4. Tests: pressing J moves active index down; K moves up; input focus suppresses navigation.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/hooks/useTableKeyboardNav.test.ts` passes.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
