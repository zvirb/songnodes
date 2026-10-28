FL3: Crate filter presets: save and recall favorite filter views

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "FL3: Crate filter presets: save and recall favorite filter views" on a branch starting with "fl3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:FL3 BEGIN/END). Depends on: UX2, UX5. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add saved filter preset chips to CrateFilterRail using favoriteQueries storage.

## Context (verified on main 2026-10-26)
DJs need to save recurring filter combinations (e.g. 'Opening Warmup 118-122', 'Peak Acid Techno') and recall them in one click.

## Owned paths
- frontend/src/features/musicLibrary/components/FilterPresets.tsx
- frontend/src/features/musicLibrary/components/FilterPresets.test.tsx
- frontend/src/features/musicLibrary/components/CrateFilterRail.tsx (mount presets section)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/FL3/ if you need to record a decision.)

## Do
1. Read design-system/components/FilterChip/README.md, 'Preset' variant (design system 1.2.0). FilterPresets renders a 'Presets' sn-filter-chip-group: each preset is li.sn-filter-chip-preset with an apply chip (button.sn-chip.sn-filter-chip, aria-pressed when the current filters equal it) and button.sn-filter-chip-preset__remove ('Delete preset <name>', x icon); the group head has a quiet small 'Save current filters' button with the save icon, disabled while no filter is set, that asks for a name (TextField in the existing Dialog, at most 40 characters, sentence case).
2. Store presets with utils/favoriteQueries under namespace 'library-crate-presets'. Clicking a preset applies its CrateFilters state at once and updates the URL search params.
3. Delete removes the preset at once and offers Undo with showToast (components/ds); no confirm().
4. Tests: saving current filters creates preset; clicking preset updates filters; deleting removes preset.

## Done when (the reviewer's under-10-minute check; put it in the PR)
In /library: customize filters, click '+ Save preset', name it 'Warmup': chip appears; resetting filters and clicking 'Warmup' restores state.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
