DS24C: Pipeline page card for the scheduled-scrape window

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "DS24C: Pipeline page card for the scheduled-scrape window" on a branch starting with "ds24c-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:DS24C BEGIN/END, added at the end of the file if missing). Depends on: DS24B (the window endpoint) and DS23 (both edit ScraperProgressPage.tsx; merge DS23 first). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add a /pipeline card that shows and sets the scheduled-scrape window with DateRangeField.

## Context (verified on main 2427bf9, 1 Nov 2026)
DS24A (#476) added frontend/src/components/ds/DateField.tsx (`DateField`, `DateRangeField`; value is a `[from, to]` tuple of date-only ISO strings, presets, calendar button opening DateRange). DS24B adds `GET`/`PUT /api/v1/scrape/window` (`{starts_on, ends_on, updated_at}`; both null = every day). /pipeline is frontend/src/pages/ScraperProgressPage.tsx; its one primary button is "Queue scrape", so this card's Save is a default button (Q11 default).

## Owned paths
- frontend/src/features/pipeline/ScrapeWindowCard.tsx (new)
- frontend/src/features/pipeline/ScrapeWindowCard.test.tsx (new)
- frontend/src/pages/ScraperProgressPage.tsx (mount the card only)
- frontend/src/pages/ScraperProgressPage.test.tsx
- frontend/tests/e2e/visual.spec.ts (stub `/api/v1/scrape/window` in `stubEmptyPipeline` only)
- frontend/tests/e2e/visual.spec.ts-snapshots/pipeline-*-chromium-linux.png (the card makes /pipeline taller)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/DS24C/ if you need to record a decision.)

## Do
1. Read the DateField and DateRange cards (design-system/api/components/ and design-system/components/) first.
2. The card loads the window, shows it as a sentence ("Scheduled scrapes run from Tue 1 – Thu 31 Dec 2026" via SN.format.range, or "Scheduled scrapes run every day" when open), and edits it with DateRangeField plus Save and Clear. Toast on save; an error names the cause. No min/max on days (Q16 unanswered).
3. Say on the card that manual scrapes are not limited.
4. Tests: load, save, clear, a 422 from the API shown as the field's error.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open /pipeline, set 1–31 Dec 2026 and save: reload shows the same window; `GET /api/v1/scrape/window` returns it. Clear: the card says scheduled scrapes run every day.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; `python3 scripts/check_feature_imports.py --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
