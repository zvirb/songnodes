HM1: Key and mood: where can I move next

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "HM1: Key and mood: where can I move next" on a branch starting with "hm1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:HM1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Bring back the "where can I move next" cards on /harmony: for the active key, one card each for same key, +1, -1, relative major/minor, energy boost +2 and energy lift +7, with the key, its verdict and how many library tracks are in it.

## Context (verified on main 2026-10-28)
frontend/src/features/camelot/CamelotPage.tsx has the wheel (CamelotWheel at 93-100, `showHarmonicSuggestions` at 99, `activeKey` state at 20) and the compatible-tracks table (heading at 152-154, rows 169-187). The move cards existed in the old frontend/src/pages/CamelotPage.tsx (see `git show e1cdbe48^:frontend/src/pages/CamelotPage.tsx`, lines ~235-340) and were dropped when P2 merged the two pages (commit e1cdbe48, PR #184); they used hand-rolled inline styles and Title Case labels, so rebuild rather than restore. Helpers to reuse, read-only: getModulationTargets() in frontend/src/utils/camelotUtils.ts:73 (exactMatch, relative, adjacentPlus1, adjacentMinus1, energyBoostPlus2, energyBoostPlus7); KeyCompat (frontend/src/components/ds/index.tsx:1659, SN.compat on two codes) and KeyBadge with `withName` (SN.keyName, 8A = A minor) from frontend/src/lib/songnodes.tsx; Card (`variant="list"` or neutral, compact) per design-system/api/components/Card.md; SN.format.count. On the Camelot wheel +7 steps is one semitone up; +2 steps is a whole tone up. Design system: read design-system/README.md and the cards in design-system/api/components/ for every component you use; UI copy is en-AU, sentence case, no emoji, missing values an en dash (`sn-none`), numbers, durations and dates through `SN.format`, keys through `SN.camelot`/`keyName`; tokens (`var(--…)`) and `sn-*` classes only, no hex, rgb(), named colours, px font sizes or raw z-index; never `alert`/`confirm`, one primary button per view.

## Owned paths
- frontend/src/features/camelot/CamelotPage.tsx
- frontend/src/features/camelot/MoveNext.tsx (new)
- frontend/src/features/camelot/camelotLogic.ts
- frontend/src/features/camelot/camelotLogic.test.ts
- frontend/src/features/camelot/camelot.test.tsx
- frontend/src/features/camelot/camelot.css

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/HM1/ if you need to record a decision.)

## Do
1. camelotLogic.ts: `moveTargets(key)` returns the six moves in a fixed order, each `{ id, label, hint, key }`, built on getModulationTargets: "Same key", "Up one" (+1), "Down one" (-1), "Relative major/minor" (label reads "Relative major" from A, "Relative minor" from B), "Energy boost +2", "Energy lift +7 (one semitone up)". Returns [] for a missing or invalid key.
2. MoveNext.tsx: section "Where can I move next" (SectionHeading) under the wheel grid, shown when `activeKey` is set, otherwise an EmptyPanel "Pick a key on the wheel to see where you can move next." Six cards in a responsive grid (tokens for gap; use existing `sn-*` grid classes or camelot.css with tokens only), each a button (whole card clickable, accessible name "Move to 9A, E minor") showing the move label, KeyBadge withName, KeyCompat from the active key, and "<n> tracks" via SN.format.count from the page's existing `counts` (keys with no tracks read "0 tracks").
3. Clicking a card sets activeKey to that key (the wheel and the "Tracks in" section follow).
4. CamelotPage renders <MoveNext activeKey counts onMove />; no other layout changes.
5. Tests: moveTargets('8A') gives 8A, 9A, 7A, 8B, 10A, 3A; 12B wraps to 1B and 2B; invalid input gives []. Render test: with activeKey 8A, six cards with the right accessible names; clicking "Up one" calls onMove('9A').

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open http://127.0.0.1:3006/harmony, click 8A on the wheel: six move cards appear (8A, 9A, 7A, 8B, 10A, 3A) with key names, a verdict pill and a track count. Click the 10A card: the wheel and the "Tracks in" section switch to 10A. Keyboard: Tab reaches each card and Enter activates it.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` and `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
