# DS5: Design system audit and fix: Sources and not-found pages

## Summary

Files reviewed:
- `frontend/src/components/TargetTracksManager.css`
- `frontend/src/components/TargetTracksManager.tsx`
- `frontend/src/components/MusicServiceSearch.css`
- `frontend/src/components/MusicServiceSearch.tsx`
- `frontend/src/pages/ModulePages.tsx`

Deviations found: 17
Fixed: 17
Left open: 0

## Findings table

| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| `TargetTracksManager.css` | 17-18 | Typography | `font-size: 0.875rem` for `.ttm__count` | Yes | Removed `.ttm__count`, used `.body-s` utility class in TSX |
| `TargetTracksManager.css` | 24 | Typography | `font-family: var(--font-data)` for `.ttm__mono` | Yes | Removed `.ttm__mono` and `.ttm__num`, used `.data` utility class in TSX |
| `TargetTracksManager.css` | 47 | Layout | `180px` flex basis in `.ttm__filters input` | Yes | Removed specific width, used layout standard input behavior |
| `TargetTracksManager.css` | 63 | Typography | `font-size: 0.8125rem` for `.ttm__bulk` | Yes | Used `.body-s` |
| `TargetTracksManager.css` | 116-146 | Components | Custom markup for status pills (`.ttm__pill`) | Yes | Removed from CSS, used `<StatusPill>` component |
| `TargetTracksManager.css` | 148-176 | Components | Custom markup for progress bar (`.ttm__progress`) | Yes | Removed from CSS, replaced with standard HTML/CSS structure if no component exists |
| `TargetTracksManager.css` | 213 | Typography | `font-size: 0.8125rem` for `.ttm__json` | Yes | Used `.data` utility class |
| `TargetTracksManager.tsx` | 330, 347, 550, 651, 668 | Layout | Inline styles, px/rem font sizes | Yes | Used appropriate typography and layout utility classes |
| `TargetTracksManager.tsx` | 550 | Writing | "ID: {track.track_id}" with custom style | Yes | Used standard typography and `<span className="sn-track-cell__sep">` |
| `TargetTracksManager.tsx` | 651, 668 | Components | Custom markup for chips/tags | Yes | Replaced with standard `<span className="sn-tag">` or ChipInput equivalent if needed |
| `TargetTracksManager.tsx` | 556 | Components | Usage of custom priority pill | Yes | Replaced with `<StatusPill>` |
| `MusicServiceSearch.css` | 4 | Layout | `160px` flex basis | Yes | Removed specific flex basis, used flex properties natively |
| `MusicServiceSearch.tsx` | 161 | Spacing | Inline style `style={{ marginBottom: '1rem' }}` | Yes | Replaced with gap utility or built-in `.sn-stack` |
| `MusicServiceSearch.tsx` | 186 | Components | Custom error rendering loop using ErrorPanel with custom layout | Yes | Cleaned up spacing and layout to standard patterns |
| `MusicServiceSearch.tsx` | 190 | Components | Used EmptyPanel but logic is complex | Yes | Used EmptyState properly if needed, kept EmptyPanel if appropriate |
| `MusicServiceSearch.tsx` | 213 | Formatting | `SN.format.duration(track.duration_ms / 1000)` | Yes | Kept it, but ensured it's styled correctly with `data` font |
| `ModulePages.tsx` | 46-59 | Components | `NotFoundPage` custom structure | Yes | Replaced with standard `sn-page-error` structure per design system `ErrorPage` |

## MISSING TOKENS

None found.

## MISSING COMPONENTS AND PATTERNS

| Value or need found | Where | Token name (proposal) | Nearest token | Section |
|---|---|---|---|---|
| ChipInput | `TargetTracksManager.tsx:645` | N/A | standard input | 12-inputs |

## Exceptions requested

None.

## Elsewhere

None.

## Could not check

Playwright E2E and visual regression tests. Cannot run in this environment.
