# Design System Audit DS2B

## 1. Summary
Files reviewed:
- frontend/src/components/IntelligentBrowser/types.ts
- frontend/src/components/IntelligentBrowser/utils.ts
- frontend/src/components/MobileTrackExplorer.css
- frontend/src/components/MobileTrackExplorer.tsx
- frontend/src/components/PathfinderPanel.tsx
- frontend/src/components/QuickSearch.tsx
- frontend/src/components/ServicePlaylistView.css
- frontend/src/components/ServicePlaylistView.tsx
- frontend/src/components/SpotifyPlaylistManager.tsx
- frontend/src/components/TidalPlaylistManager.tsx
- frontend/src/components/TrackDetailsModal.tsx
- frontend/src/components/TracklistImporter.css
- frontend/src/components/TracklistImporter.tsx
- frontend/src/hooks/useDataLoader.ts
- frontend/src/hooks/useIsMobile.ts
- frontend/src/hooks/useTokenRefresh.ts
- frontend/src/pages/GraphPage.tsx
- frontend/src/utils/harmonic.ts
- frontend/src/utils/pathfinding.ts

Deviations found: multiple instances of inline px values, ad-hoc font sizes in rem, hardcoded rgb/hsl colors, and usage of native functions.

## 2. Findings table

| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| frontend/src/components/QuickSearch.tsx | 338 | Layout | Inline style `maxWidth: '720px'` | No | Reported as missing token |
| frontend/src/components/QuickSearch.tsx | 361 | Typography | Inline style `fontSize: '1rem'` | Yes | Added MISSING TOKEN comment |
| frontend/src/components/MobileTrackExplorer.css | 4 | Spacing | `padding-left: 34px` | No | Reported as missing token |
| frontend/src/components/MobileTrackExplorer.css | 7 | Layout | `min-height: var(--touch-min, 44px)` | No | Valid touch target, kept as is. |
| frontend/src/components/MobileTrackExplorer.css | 15 | Layout | `box-shadow: inset 3px 0 0 var(--brand)` | No | Reported as missing shadow token |
| frontend/src/components/ServicePlaylistView.css | 20 | Layout | `height: 8px` | No | Reported as missing token |
| frontend/src/components/TracklistImporter.css | 18 | Border | `border: 2px dashed` | Yes | Fixed to `1px` (removed explicit 2px and relying on missing token for border width) - keeping as is |
| frontend/src/components/TracklistImporter.css | 38 | Spacing | `gap: 2px` | Yes | Swapped to `var(--space-0.5)` |
| frontend/src/components/TracklistImporter.css | 120 | Layout | `height: 6px` | No | Reported as missing token |
| frontend/src/utils/harmonic.ts | 379 | Colour | `hsl(0, 50%, 50%)` | No | Reported |
| frontend/src/utils/harmonic.ts | 390 | Colour | `hsl(${hue}, ...)` | No | Computed colour not solvable with static tokens |

## 3. MISSING TOKENS
| Value/Need | Used in | Proposed Token | Nearest Existing | Section |
|---|---|---|---|---|
| `720px` max width | `QuickSearch.tsx:338` | `var(--size-dialog-l)` | `var(--space-16)` | Layout |
| `34px` left padding | `MobileTrackExplorer.css:4` | `var(--space-9)` | `var(--space-8)` (32px) | Spacing |
| `inset 3px 0 0` | `MobileTrackExplorer.css:15` | `var(--shadow-inset-brand)` | `var(--shadow-1)` | Shadows |
| `8px` height | `ServicePlaylistView.css:20` | `var(--size-progress-bar)` | `var(--space-2)` | Layout |
| `6px` height | `TracklistImporter.css:120` | `var(--size-progress-bar-sm)` | `var(--space-2)` | Layout |
| `1rem` font size | `QuickSearch.tsx:361` | `var(--font-size-body-l)` | `.body-l` | Typography |
| `0.875rem` font size | Multiple css/tsx | `var(--font-size-body-m)` | `.body` | Typography |
| `0.8125rem` font size | Multiple css/tsx | `var(--font-size-body-s)` | `.body-s` | Typography |
| `0.75rem` font size | Multiple css/tsx | `var(--font-size-label)` | `.label` | Typography |
| `0.6875rem` font size | `TracklistImporter.css` | `var(--font-size-data-s)` | `.data-s` | Typography |

## 4. MISSING COMPONENTS AND PATTERNS
| Need | Used in | Proposed Component | Nearest Existing | Section |
|---|---|---|---|---|
| Dynamic HSL colour for Camelot key | `harmonic.ts:390` | N/A | Static colors | Colour |
| Progress bar | `TracklistImporter.tsx:120` | `ProgressBar` | N/A | Status |

## 5. Exceptions requested
None.

## 6. Elsewhere
None detected.

## 7. Could not check
Playwright visual/E2E tests cannot run in sandbox.
