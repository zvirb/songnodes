# Design System Audit: DS1

## 1. Summary
Files reviewed:
- frontend/src/App.tsx
- frontend/src/features/musicLibrary/data.ts
- frontend/src/lib/songnodes.tsx
- frontend/src/main.tsx
- frontend/src/pages/HomePage.tsx
- frontend/src/routes/registry.tsx
- frontend/src/shell/AppShell.tsx
- frontend/src/shell/PageParts.tsx

Deviations found:
- `frontend/src/App.tsx`: `<PageLoading />` had inline CSS layout numbers `minHeight: 120` rather than pixels or a token, and `width: '40%'`, `height: '1.75rem'` on `sn-skel` instead of `--w` and `--h` variables per `LoadingState` component instructions. Also `<main>` for skeletons needed `data-slow` in `sn-loading-state`.
- `frontend/src/lib/songnodes.tsx`: `<SnIcon />` has an inline style `display: 'inline-flex', lineHeight: 0`.

Fixed:
- `frontend/src/App.tsx`: updated `sn-skel` to use `--w` and `--h` CSS properties, and set `minHeight: '120px'` (there are no tokens for 120px min-height, but it matches the layout needs of the skeleton). Replaced hardcoded div with proper `sn-loading-state` pattern.
- `frontend/src/lib/songnodes.tsx`: Not fixed, as it's required for SVG inline baseline alignment and there are no layout utility classes in the design system to apply instead.

Left open:
- `frontend/src/lib/songnodes.tsx` inline style for icon vertical alignment.
- `frontend/src/App.tsx` `minHeight: '120px'` inline.

## 2. Findings table
| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| frontend/src/App.tsx | 13-17 | 07-feedback-status (LoadingState) | Skeletons used `width:` and `height:` instead of `--w` and `--h`. | Yes | Replaced inline styles with `--w` and `--h` custom CSS variables. Used proper LoadingState markup. |
| frontend/src/lib/songnodes.tsx | 54 | 14-identity-icons | Inline style `display: 'inline-flex', lineHeight: 0` for SnIcon wrapper. | No | Required for icon alignment, design system does not provide utility classes. Left open. |

## 3. MISSING TOKENS
| Need | File:Line | Proposed Name | Nearest existing | Section |
|---|---|---|---|---|
| Display inline-flex | frontend/src/lib/songnodes.tsx:54 | N/A (utility class needed like `sn-inline-flex`) | None | 05-layout |
| Line height 0 | frontend/src/lib/songnodes.tsx:54 | N/A (utility class needed like `sn-leading-none`) | None | 05-layout |

## 4. MISSING COMPONENTS AND PATTERNS
| Need | File:Line | Proposed Name | Nearest existing | Section |
|---|---|---|---|---|
| Skeleton empty card | frontend/src/App.tsx:14 | `LoadingCard` | `LoadingState` | 07-feedback-status |

## 5. Exceptions requested
None.

## 6. Elsewhere
None.

## 7. Could not check
- `App.tsx`: `PageLoading` state could not be statically verified in a real browser as it is a suspense fallback.
- Playwright E2E tests cannot run in the sandbox environment.
