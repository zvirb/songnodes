AX1: Accessibility fixes on Target tracks and Pipeline

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "AX1: Accessibility fixes on Target tracks and Pipeline" on a branch starting with "ax1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:AX1 BEGIN/END). Depends on: none. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make /sources/targets and /pipeline pass the axe test (no serious or critical violations, dark and light) in chromium, firefox and webkit.

## Context (verified on main 2026-10-28)
frontend/tests/e2e/accessibility.spec.ts runs AxeBuilder with WCAG 2.2 AA tags on every SHELL_ROUTES entry (frontend/tests/e2e/fixtures.ts line 30) in dark and light; on the owner's laptop today it fails on /sources/targets and /pipeline with color-contrast and button-name. /sources/targets renders SourcesPage (frontend/src/pages/ModulePages.tsx, owned by NV1, read-only here) which lazy-loads frontend/src/components/TargetTracksManager.tsx (+ TargetTracksManager.css; MusicServiceSearch.tsx in the Search tab, line 646). /pipeline renders frontend/src/pages/ScraperProgressPage.tsx, which also embeds TargetTracksManager (line 535). Likely causes, verify with axe before fixing:
- Colour: `color: 'var(--fg-3)'` inline on surfaces where 03-colour.md line 25-28 allows fg-3 only on bg/surface-1 (TargetTracksManager line 587 at 0.6875rem; ScraperProgressPage lines 221, 356 icons and `var(--fg-2)` captions on sn-card surfaces); TargetTracksManager.css rules using fg-3, opacity or mod colours on raised surfaces.
- Button name: icon-only buttons and OverflowMenu triggers without a label (TargetTracksManager lines 445, 621; the chip remove buttons at 688/705 have labels), the Sync button's icon has aria-label="Sync" on the svg (ScraperProgressPage line 204; the svg should be aria-hidden, the button already has text).
- ScraperProgressPage line 509 still uses the Tailwind `truncate` class and `style={{ maxWidth: "300px" }}` (px); replace them here (TW2 leaves this to you).
The design system decides every fix: tokens and sn-* classes only (design-system/03-colour.md, 06-interaction-accessibility.md, docs/design-system/CODE_REFERENCE.md); no hex, rgb or px, no new legacy --color-* variables. Do not add axe exceptions.

## Owned paths
- frontend/src/components/TargetTracksManager.tsx and frontend/src/components/TargetTracksManager.css
- frontend/src/components/MusicServiceSearch.tsx
- frontend/src/pages/ScraperProgressPage.tsx and frontend/src/pages/ScraperProgressPage.css (new, if a page rule is needed for the error cell)
- frontend/src/components/TargetTracksManager.test.tsx and frontend/src/pages/ScraperProgressPage.test.tsx (update for changed labels only)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/AX1/ if you need to record a decision.)

## Do
1. Reproduce: `cd frontend && npm ci && npx playwright install --with-deps chromium firefox webkit && npx playwright test tests/e2e/accessibility.spec.ts -g "sources/targets|pipeline"` (playwright.config.ts starts `npm run dev` when PLAYWRIGHT_BASE_URL is unset; the APIs being down shows the error/empty states, which must pass too). Record each failing rule and node in the PR.
2. Fix contrast with the token the colour doc allows on that surface (fg-2 on surface-2/3, status ink tokens for status text), and move inline colour styles into sn-* classes or TargetTracksManager.css using tokens.
3. Give every button an accessible name: visible text, or aria-label for icon-only buttons and menu triggers (for example "Actions for <track name>"). Mark decorative lucide icons aria-hidden.
4. Replace `truncate` and the 300px max width on the last-error cell with a class (for example in ScraperProgressPage.css: max-width in ch, overflow hidden, text-overflow ellipsis, white-space nowrap) and keep the full text in title.
5. Re-run step 1 in all three browsers, dark and light, until clean; run the unit tests.
6. Your PR must change code, not only STATUS.md; check `git diff --stat origin/main...HEAD` before opening it.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd frontend && npx playwright test tests/e2e/accessibility.spec.ts -g "sources/targets|pipeline"` passes in chromium, firefox and webkit (4 tests each: 2 routes x dark and light), and the two pages look unchanged apart from the colour fixes.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src/components/TargetTracksManager.test.tsx src/pages/ScraperProgressPage.test.tsx && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups (violations caused by shared components such as components/ds or the shell, which are not yours).
