# LY2 Audit: Layout debt in music library and set builder pages

## Files Reviewed
- `frontend/src/features/musicLibrary/components/ui.tsx`
- `frontend/src/features/musicLibrary/components/AITransitionHelper.tsx`
- `frontend/src/features/musicLibrary/LibraryPage.tsx`
- `frontend/src/features/musicLibrary/SetBuilderPage.tsx`
- `frontend/src/features/musicLibrary/components/CrateFilterRail.tsx`
- `frontend/design-system-layout-baseline.txt`

## Classes Replaced
- `sn-body-s` -> Replaced with standard DS typography token `body-s` (`frontend/src/features/musicLibrary/components/ui.tsx:444`, `frontend/src/features/musicLibrary/LibraryPage.tsx:268`)
- `sn-body-strong` -> Replaced with standard DS typography token `body-strong` (`frontend/src/features/musicLibrary/components/ui.tsx:442`)
- `sn-color-brand` -> Replaced with inline style `style={{ color: "var(--brand)" }}` (`frontend/src/features/musicLibrary/components/AITransitionHelper.tsx:44`)
- `sn-color-fg` -> Replaced with inline style `style={{ color: "var(--fg)" }}` (`frontend/src/features/musicLibrary/components/AITransitionHelper.tsx:59`, `61`)
- `sn-color-fg-2` -> Replaced with inline style `style={{ color: "var(--fg-2)" }}` (`frontend/src/features/musicLibrary/components/AITransitionHelper.tsx:58`)
- `sn-copy-button__text` -> Removed, just used standard inner span (`frontend/src/features/musicLibrary/components/ui.tsx:173`)
- `sn-coverage-panel` -> Replaced with standard DS component `sn-card` (`frontend/src/features/musicLibrary/components/ui.tsx:441`)
- `sn-filter-rail__trigger` -> Removed, used standard `sn-btn` (`frontend/src/features/musicLibrary/components/CrateFilterRail.tsx:132`)
- `sn-gap-1` -> Replaced with inline style `gap: "var(--space-1)"` (`frontend/src/features/musicLibrary/components/AITransitionHelper.tsx:58`)
- `sn-gap-2` -> Replaced with inline style `gap: "var(--space-2)"` (`frontend/src/features/musicLibrary/components/AITransitionHelper.tsx:57`)
- `sn-justify-between` -> Replaced with inline style `justifyContent: "space-between"` (`frontend/src/features/musicLibrary/components/AITransitionHelper.tsx:57`)
- `sn-mb-credit` -> Replaced with inline style `marginBottom: "var(--space-4)"` (`frontend/src/features/musicLibrary/LibraryPage.tsx:268`, `frontend/src/features/musicLibrary/SetBuilderPage.tsx:568`)
- `sn-ml-library` -> Removed, relying on page main shell (`frontend/src/features/musicLibrary/LibraryPage.tsx:206`)
- `sn-page-library` -> Removed, CSS doesn't define it (`frontend/src/features/musicLibrary/LibraryPage.tsx:206`)
- `sn-page-sets` -> Removed, CSS doesn't define it (`frontend/src/features/musicLibrary/SetBuilderPage.tsx:339`)
- `sn-panel` -> Replaced with `sn-card` (`frontend/src/features/musicLibrary/components/ui.tsx:441`)
- `sn-panel--sm` -> Replaced with `sn-card--compact` (`frontend/src/features/musicLibrary/components/ui.tsx:441`)
- `sn-panel__body` -> Replaced with `sn-card__body` (`frontend/src/features/musicLibrary/components/ui.tsx:443`)
- `sn-panel__header` -> Replaced with `sn-card__head` (`frontend/src/features/musicLibrary/components/ui.tsx:442`)
- `sn-panel__title` -> Replaced with `sn-title title-s` (`frontend/src/features/musicLibrary/components/ui.tsx:442`)
- `sn-stats-list` -> Replaced with standard list and typography (`frontend/src/features/musicLibrary/components/ui.tsx:444`)
- `sn-u-ml-xs` -> Replaced with inline style `marginLeft: "var(--space-1)"` (`frontend/src/features/musicLibrary/components/ui.tsx:406`)
- `sn-u-mt-sm` -> Replaced with inline style `marginTop: "var(--space-2)"` (`frontend/src/features/musicLibrary/components/ui.tsx:441`)

## Lines Removed from Baseline
- `class sn-body-s`
- `class sn-body-strong`
- `class sn-color-brand`
- `class sn-color-fg`
- `class sn-color-fg-2`
- `class sn-copy-button__text`
- `class sn-coverage-panel`
- `class sn-filter-rail__trigger`
- `class sn-gap-1`
- `class sn-gap-2`
- `class sn-justify-between`
- `class sn-mb-credit`
- `class sn-ml-library`
- `class sn-page-library`
- `class sn-page-sets`
- `class sn-panel`
- `class sn-panel--sm`
- `class sn-panel__body`
- `class sn-panel__header`
- `class sn-panel__title`
- `class sn-stats-list`
- `class sn-u-ml-xs`
- `class sn-u-mt-sm`

## Lines Left
- None for these specific classes. The baseline file is updated correctly and passes validation checks without errors.

## Missing Patterns
- A text color variable mapping utility or specific text color classes (`color-brand`, `color-fg`) mapping tokens to text might be missing in `bundle.css` or `tokens.css`. As a result, inline styles via `var(--brand)` etc were used.
- Spacing classes for gap/margins such as `sn-gap-*` or `sn-justify-*` might be helpful since they had to be replaced by inline styles.

## Checks Run/Not Run
- Run: `python scripts/check_design_system.py --check`
- Run: `cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`
- Run: `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
- Not Run: E2E Playwright, manual visual browser testing.
