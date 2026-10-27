LY4: Layout debt: pipeline page and export dialog

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md (section 4, the design system, is mandatory). No access to the user's laptop, local data or secrets; work from the repo only. Open one PR against main titled "LY4: Layout debt: pipeline page and export dialog" on a branch starting with "ly4-"; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:LY4 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below.

## Why
These files use `sn-*` class names that no design-system stylesheet defines. An undefined class renders nothing, so those elements have no padding, gap, margin or type style, which is why parts of these pages look cramped and unfinished. `scripts/check_design_system.py --check` lists every undefined class in `frontend/design-system-layout-baseline.txt`; that list may only shrink.

## Read first
1. design-system/README.md, 05-layout.md, 13-page-patterns.md (Page container), 17-governance.md (The sn- namespace, Conformance checking), and the sections for whatever the elements are (11-data-display, 12-inputs, 07-feedback-status, 04-typography).
2. frontend/src/styles/design-system/bundle.css and tokens.css: the only real `sn-*` classes and `--*` tokens. Grep them; never take a class or token name from memory, from another file in the app, or from this brief.
3. design-system/api/components/<Comp>.md and design-system/components/<Comp>/README.md for every component you use, and frontend/src/lib/songnodes.tsx and frontend/src/shell/ for the React helpers.

## Task
For every undefined class below, in your owned files only:
- Replace it with what the design system actually provides: a shipped component (Banner, InlineMessage, Card, Field, DataTable, StatusPill and so on) or a defined `sn-*` class from bundle.css, chosen by what the element IS, not by its old name.
- Spacing-only helpers (`sn-mt-*`, `sn-mb-*`, `sn-ml-*`, `sn-gap-*`, `sn-u-*` and similar) become the layout the design system describes (stack/cluster with gaps from the page or card pattern) or, if nothing fits, an inline style using only `var(--space-*)` tokens that exist in tokens.css. Put `border` before padding/gap/margin in an inline style object.
- Text helpers (`sn-body`, `sn-label`, `sn-color-*` and similar) become the type classes and colour tokens in 04-typography and 03-colour.
- NEVER invent an `sn-` class, never add CSS that defines one, and never edit design-system/ or frontend/src/styles/design-system/. If the system has no class or component for something a page genuinely needs, keep the element working with `var(--space-*)` inline styles and record it under MISSING PATTERNS in your audit file.
- Behaviour, copy and data must not change. Keep en-AU sentence case.

| Undefined class | Your files using it | Also used outside your package |
|---|---|---|
| `sn-banner--info` | `ScraperProgressPage.tsx` | none: remove the line when fixed |
| `sn-banner--warning` | `ExportDialog.tsx` | none: remove the line when fixed |
| `sn-btn--outline` | `ScraperProgressPage.tsx` | none: remove the line when fixed |
| `sn-export-dialog` | `ExportDialog.tsx` | none: remove the line when fixed |
| `sn-field__input` | `ExportDialog.tsx` | none: remove the line when fixed |
| `sn-mb-3` | `ExportDialog.tsx` | `frontend/src/examples/spatialIndexUsage.example.tsx`, `frontend/src/features/aiSetlists/AISetlistsPage.tsx` |
| `sn-page__actions` | `ScraperProgressPage.tsx` | none: remove the line when fixed |
| `sn-page__header` | `ScraperProgressPage.tsx` | none: remove the line when fixed |
| `sn-page__title-group` | `ScraperProgressPage.tsx` | none: remove the line when fixed |

## The baseline file
In frontend/design-system-layout-baseline.txt, remove a `class` line only when, after your change, no file anywhere under frontend/src uses that class (grep for it). If a class is still used in a file you do not own (third column), leave its line; the last package to clear it removes it. Never add a line. `python scripts/check_design_system.py --check` fails on a stale line and on a new undefined class, so it tells you which lines to remove.

## Audit file (required)
Create docs/design-system/audits/LY4.md: files reviewed, each class replaced and with what (file:line), lines removed from the baseline, lines left and why, MISSING PATTERNS (need, where, nearest existing class or component and why it is not enough), and checks not run.

## Owned paths
- frontend/src/pages/ScraperProgressPage.tsx
- frontend/src/features/setBuilder/ExportDialog.tsx
- frontend/src/features/setBuilder/ExportDialog.test.tsx
- frontend/design-system-layout-baseline.txt (remove lines only)
- docs/design-system/audits/LY4.md

(Files listed are the complete set. Test files may be updated only to keep them passing after your fixes.)

## Checks (run all you can; say which you could not)
- `python scripts/check_design_system.py --check` (must pass with your baseline lines removed)
- `cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (oxlint warnings must not increase)
- `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
- If you can run a browser, open each changed page at 390px and 1440px wide and check that text never touches the viewport edge or its container border (16px and 32px page gutters) and that nothing is clipped. Otherwise say the Playwright E2E and visual tests could not run in your sandbox.

## Hand-back
Classes cleared, baseline lines removed, lines left for other packages, missing patterns reported.
