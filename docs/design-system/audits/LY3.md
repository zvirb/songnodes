# LY3 Layout Debt Audit

## Files reviewed
- `frontend/src/features/camelot/CamelotPage.tsx`
- `frontend/src/features/pathfinder/PathfinderPage.tsx`
- `frontend/src/components/CamelotWheel.tsx`

## Classes replaced
| Class | Replaced with | Location |
|-------|---------------|----------|
| `sn-camelot-page` | `sn-page__main` | `frontend/src/features/camelot/CamelotPage.tsx:82` |
| `sn-camelot-page__list-card` | `sn-card` | `frontend/src/features/camelot/CamelotPage.tsx:149` |
| `sn-camelot-page__wheel-container` | inline `position: 'relative'` | `frontend/src/features/camelot/CamelotPage.tsx:93` |
| `sn-camelot-wheel__summary` | `body-s` & inline `marginTop: 'var(--space-4)'` | `frontend/src/components/CamelotWheel.tsx:321` |
| `sn-dropdown` | `sn-list` + standard styling tokens | `frontend/src/features/pathfinder/PathfinderPage.tsx:149, 197` |
| `sn-inline-message__text` | inline `sn-inline-message sn-inline-message--boxed` | `frontend/src/features/pathfinder/PathfinderPage.tsx:104` |
| `sn-input-icon` | `sn-search-field__icon` | `frontend/src/features/pathfinder/PathfinderPage.tsx:126, 175` |
| `sn-input-wrap` | `sn-search-field__box` + `sn-search-field__end` | `frontend/src/features/pathfinder/PathfinderPage.tsx:125, 174` |
| `sn-page__head` | `PageHeader` component from shell | `frontend/src/features/pathfinder/PathfinderPage.tsx:76` |
| `sn-track-cell__primary` | `sn-track-cell__title` + `sn-track-cell__name` | `frontend/src/features/camelot/CamelotPage.tsx:173` |
| `sn-track-cell__secondary` | `sn-track-cell__meta` + `sn-track-cell__mix` | `frontend/src/features/camelot/CamelotPage.tsx:175` |
| `sn-inline-msg` | `sn-inline-message` | `frontend/src/features/aiSetlists/components/ui.tsx:8` |
| `sn-inline-msg__icon` | standard inline message | `frontend/src/features/aiSetlists/components/ui.tsx:8` |
| `sn-inline-msg__text` | standard inline message | `frontend/src/features/aiSetlists/components/ui.tsx:8` |

## Lines removed from baseline
- `class sn-camelot-page`
- `class sn-camelot-page__list-card`
- `class sn-camelot-page__wheel-container`
- `class sn-camelot-wheel__summary`
- `class sn-dropdown`
- `class sn-inline-message__text`
- `class sn-inline-msg`
- `class sn-inline-msg__icon`
- `class sn-inline-msg__text`
- `class sn-input-icon`
- `class sn-input-wrap`
- `class sn-page__head`
- `class sn-track-cell__primary`
- `class sn-track-cell__secondary`

## Lines left and why
- `class sn-page__body`: This class is still used in `frontend/src/features/aiSetlists/AISetlistsPage.tsx:222` which is outside the scope of my owned files.

## Missing Patterns
- `DataTable`, `TrackCell`, `Popover`, `SearchField`, and `InlineMessage` are documented in `design-system/api/components/` as standard `<SongNodes.*>` React components, but they are not exported from `frontend/src/components/ds/index.tsx`. The current implementation requires falling back to standard CSS classes from `bundle.css` or reimplementing standard DS component markup inline (like for `SearchField` and `Popover`).

## Checks run / not run
- Run: `python scripts/check_design_system.py --check`
- Run: `npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`
- Run: `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
- Not Run: E2E and visual tests in Playwright could not run in the sandbox since I cannot run a browser.
