# LY4 Audit: Layout debt in pipeline page and export dialog

## Files Reviewed
- `frontend/src/pages/ScraperProgressPage.tsx`
- `frontend/src/features/setBuilder/ExportDialog.tsx`
- `frontend/src/features/setBuilder/ExportDialog.test.tsx`
- `frontend/design-system-layout-baseline.txt`

## Classes Replaced
- `sn-banner--info` -> `data-status="info"` on the generic `sn-banner` class (`ScraperProgressPage.tsx:122`)
- `sn-banner--warning` -> `data-status="warn"` on the generic `sn-banner` class (`ExportDialog.tsx:102`)
- `sn-btn--outline` -> `sn-btn` or `sn-btn--quiet` per design system guidelines (`ScraperProgressPage.tsx:109, 360`)
- `sn-export-dialog` -> completely replaced by `<Dialog>` component (`ExportDialog.tsx:90`)
- `sn-field__input` -> replaced via the `<SelectField>` component (`ExportDialog.tsx:105`)
- `sn-page__actions` -> replaced with layout inline styles on `header` (`ScraperProgressPage.tsx:107`)
- `sn-page__header` -> replaced with layout inline styles on `header` (`ScraperProgressPage.tsx:68, 100`)
- `sn-page__title-group` -> replaced with layout inline styles and `SectionHeading` (`ScraperProgressPage.tsx:12, 69, 101`)

## Baseline Lines Removed
- `class sn-banner--info`
- `class sn-banner--warning`
- `class sn-btn--outline`
- `class sn-export-dialog`
- `class sn-field__input`
- `class sn-page__actions`
- `class sn-page__header`
- `class sn-page__title-group`

## Baseline Lines Left
- `class sn-mb-3` was left because it is also used in `frontend/src/examples/spatialIndexUsage.example.tsx` and `frontend/src/features/aiSetlists/AISetlistsPage.tsx`.

## Missing Patterns
No missing patterns encountered that couldn't be satisfied with existing `var(--space-*)` inline layout styles.

## Checks Run
- `python scripts/check_design_system.py --check` (passed)
- `cd frontend && npx vitest run src/features/setBuilder/ExportDialog.test.tsx` (passed after test updates)
