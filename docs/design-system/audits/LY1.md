# LY1 Layout Debt Audit

## Files reviewed
- `frontend/src/features/aiSetlists/AISetlistsPage.tsx`
- `frontend/src/features/aiSetlists/components/ui.tsx`

## Classes replaced
### `AISetlistsPage.tsx`
- `sn-card--danger` (307) replaced with `<ErrorPanel status="bad" title="Validation Errors">`
- `sn-field--inline` (285, 292) replaced with inline styles for flex row and gap.
- `sn-layout-grid` (235, 316) removed class, using existing inline grid styles.
- `sn-layout-stack` (233, 317) removed class, using inline flex column style and existing gap.
- `sn-list` (308, 331) replaced with inline list styles (`display: flex`, `flexDirection: column`, `gap: var(--space-2)`).
- `sn-mb-2` (323, 330) replaced with inline style `marginBottom: 'var(--space-2)'`.
- `sn-mb-3` (234, 256, 264, 276) replaced with inline style `marginBottom: 'var(--space-3)'`.
- `sn-mb-4` (315) replaced with inline style `marginBottom: 'var(--space-4)'`.
- `sn-mb-6` (316, 330) replaced with inline style `marginBottom: 'var(--space-6)'`.
- `sn-ml-2` (294) replaced with inline style `marginLeft: 'var(--space-2)'`.
- `sn-ml-auto` (334) replaced with inline style `marginLeft: 'auto'`.
- `sn-mt-2` (381) replaced with inline style `marginTop: 'var(--space-2)'`.
- `sn-mt-3` (260, 271, 302) replaced with inline style `marginTop: 'var(--space-3)'`.
- `sn-mt-4` (377) replaced with inline style `marginTop: 'var(--space-4)'`.
- `sn-mt-6` (264, 369) replaced with inline style `marginTop: 'var(--space-6)'`.
- `sn-page__body` (222) removed class (rhythm provided by parent).
- `sn-row--compact` (284) replaced with inline styles (`display: flex`, `alignItems: center`, `gap: var(--space-2)`).
- `sn-stat` (317, 321, 325, 329) replaced with `.sn-figure-tile`.

### `ui.tsx`
- `sn-inline-msg`, `sn-inline-msg__icon`, `sn-inline-msg__text` (8-12) replaced with `.sn-inline-message` and standard markup.
- `sn-mr-2` (28) replaced with inline style `marginRight: 'var(--space-2)'`.

## Lines removed from the baseline
- `class sn-card--danger`
- `class sn-field--inline`
- `class sn-inline-msg`
- `class sn-inline-msg__icon`
- `class sn-inline-msg__text`
- `class sn-layout-grid`
- `class sn-layout-stack`
- `class sn-list`
- `class sn-mb-2`
- `class sn-mb-4`
- `class sn-mb-6`
- `class sn-ml-2`
- `class sn-ml-auto`
- `class sn-mr-2`
- `class sn-mt-2`
- `class sn-mt-3`
- `class sn-mt-4`
- `class sn-mt-6`
- `class sn-row--compact`
- `class sn-stat`

## Lines left and why
- `class sn-mb-3`: Also used in `frontend/src/examples/spatialIndexUsage.example.tsx`, `frontend/src/features/setBuilder/ExportDialog.tsx`.
- `class sn-page__body`: Also used in `frontend/src/features/pathfinder/PathfinderPage.tsx`.

## Missing Patterns
- A standard `<Stack>` and `<Grid>` component could be added to avoid repetitive inline styles for simple layouts.
- `<List>` or `<UnorderedList>` component.

## Checks not run
- Playwright E2E and visual tests (sandbox constraint).
