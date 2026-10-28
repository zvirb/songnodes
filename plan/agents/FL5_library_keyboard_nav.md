FL5: Library crate: keyboard row navigation

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "FL5: Library crate: keyboard row navigation" on a branch starting with "fl5-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:FL5 BEGIN/END). Depends on: FL1. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Wire the FL1 hook useTableKeyboardNav into the Library crate table so J/K and the arrow keys move through rows and single keys act on the active row.

## Context (verified on main 2026-10-26)
frontend/src/hooks/useTableKeyboardNav.ts (FL1, #316) exists but nothing uses it. frontend/src/features/musicLibrary/LibraryPage.tsx renders the crate as `div.sn-tablebox.sn-data-table__box > table.sn-table`, one row per visible track (`visible`), with TargetActionButton (add to target tracks) and an 'Add to set' button (`addToSet(t)`) in `td.sn-data-table__actions`. Design system 1.2.0 documents the pattern: design-system/components/DataTable/README.md, 'Keyboard row navigation', and the CSS `.sn-table tr[data-active]` and `.sn-data-table__box[data-keyboard]:focus-visible` already ship in bundle.css.

## Owned paths
- frontend/src/features/musicLibrary/LibraryPage.tsx (the crate table and its keyboard wiring only)
- frontend/src/features/musicLibrary/LibraryPage.keyboard.test.tsx (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/FL5/ if you need to record a decision.)

## Do
1. Read design-system/components/DataTable/README.md ('Keyboard row navigation') and frontend/src/hooks/useTableKeyboardNav.ts. Use the hook as it is; do not edit it.
2. Keep the active row id in LibraryPage state. Spread the hook's boxProps on the `.sn-data-table__box` div and set `data-active` on the active `<tr>`; scroll it into view with `scrollIntoView({ block: 'nearest' })`. Clear the active row when it leaves `visible` (filters or sort change).
3. Shortcuts: Enter and 't' press the active row's own TargetActionButton (find the button in that row and call click()), so its status, announcement and API call stay in one place; do not edit TargetActionButton. 'a' calls addToSet for the active track. Space does nothing yet (there is no preview source). Set the box's aria-keyshortcuts to the keys you actually handle: 'J K ArrowDown ArrowUp Enter T A'.
4. Render the hook's announcement in a visually hidden polite live region (`<p className="sn-sr" aria-live="polite">`) next to the table, describe(id) = 'Artist – Title'.
5. Do not change columns, sorting, filters, the row action buttons or any other part of the page. No new sn-* classes, no inline colours or px sizes.
6. Tests (LibraryPage.keyboard.test.tsx, jsdom, with the existing library fixture approach used by other LibraryPage tests or a small mocked library): J moves the active row down and sets data-active, K moves up, typing in the search field does not move rows, 't' on the active row clicks that row's target button, the live region names the active row.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open /library, click the table (or Tab to it), press J three times: the third row has the focus outline and a screen reader hears '3 of N: Artist – Title'; press T: the row's target button shows it was added.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
