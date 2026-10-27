# Missing Design System Tokens and Components

## 1. MISSING TOKENS

| Value/Need | Uses | File:Line | Proposed token | Nearest existing | Section | Source File under design-system/source/ | Reasoning |
|---|---|---|---|---|---|---|---|
| Native Media Query Variable | 1 | `frontend/src/features/camelot/camelot.css:7` | N/A (Build Step enhancement) | `--bp-desktop: 1100px` | 05-layout | `design-system/source/05-layout.css` | Need native support for media queries to use design system breakpoints instead of hardcoded 960px. |
| Display inline-flex | 1 | `frontend/src/lib/songnodes.tsx:54` | `sn-inline-flex` | None | 05-layout | `design-system/source/05-layout.css` | A utility class is needed for `display: inline-flex` as no direct token exists. |
| Line height 0 | 1 | `frontend/src/lib/songnodes.tsx:54` | `sn-leading-none` | None | 05-layout | `design-system/source/05-layout.css` | A utility class is needed for `line-height: 0` as no direct token exists. |
| Page centering layout | 1 | `frontend/src/components/OAuthCallback.tsx:279` | `sn-page-auth` | N/A | 13-page-patterns | `design-system/source/13-page-patterns.css` | Need a layout utility to centrally align elements for AuthCallbackPage. |
| 300px max height | 3 | `frontend/src/components/AIAssistantModal.css:164`, `frontend/src/features/setBuilder/ExportDialog.tsx:134`, `frontend/src/features/aiSetlists/components/ui.tsx:58` | `--max-h-dropdown: 300px` | `--space-16` (64px) | 05-layout | `design-system/source/05-layout.css` | The largest available token `--space-16` is too short for dropdowns/preview logs. |
| 16px exact height | 1 | `frontend/src/components/AIAssistantModal.css:210` | `--space-4: 16px` | `--space-4` | 05-layout | `design-system/source/05-layout.css` | Existing token is for spacing, but explicit size is needed for standard exact height matching control scale. |
| A cursor style for draggable canvas interaction | 1 | `frontend/src/examples/spatialIndexUsage.example.tsx:125` | `--cursor-crosshair: crosshair` | None | 06-interaction | `design-system/source/06-interaction.css` | Essential for UI feedback on draggable canvas interaction. |
| A cursor style for interactive hover elements | 1 | `frontend/src/examples/spatialIndexUsage.example.tsx:49` | `--cursor-pointer: pointer` | None | 06-interaction | `design-system/source/06-interaction.css` | Standard interactive element feedback. |
| 720px max width | 1 | `frontend/src/components/QuickSearch.tsx:338` | `--size-dialog-l: 720px` | `--space-16` (64px) | 05-layout | `design-system/source/05-layout.css` | Needed for large dialog modals; nearest is far too small. |
| 34px left padding | 1 | `frontend/src/components/MobileTrackExplorer.css:4` | `--space-9: 34px` | `--space-8` (32px) | 05-layout | `design-system/source/05-layout.css` | Existing token 32px is closest but 34px explicitly required for this specific mobile alignment. |
| inset 3px 0 0 | 1 | `frontend/src/components/MobileTrackExplorer.css:15` | `--shadow-inset-brand: inset 3px 0 0 var(--brand)` | `--shadow-1` | 05-layout | `design-system/source/05-layout.css` | No existing inset shadows exist; `--shadow-1` is an external drop shadow. |
| 8px height | 1 | `frontend/src/components/ServicePlaylistView.css:20` | `--size-progress-bar: 8px` | `--space-2` (8px) | 05-layout | `design-system/source/05-layout.css` | While `--space-2` is 8px, semantic size token needed for components like progress bars. |
| 6px height | 1 | `frontend/src/components/TracklistImporter.css:120` | `--size-progress-bar-sm: 6px` | `--space-2` (8px) | 05-layout | `design-system/source/05-layout.css` | Closest space token is 8px but need 6px for smaller component visual weight. |
| 1rem font size | 1 | `frontend/src/components/QuickSearch.tsx:361` | `--font-size-body-l: 1rem` | `.body-l` | 04-typography | `design-system/source/04-typography.css` | Should use existing TSX typography class `.body-l` directly. |
| 0.875rem font size | 1 | `frontend/src/components/TracklistImporter.tsx:45` | `--font-size-body-m: 0.875rem` | `.body` | 04-typography | `design-system/source/04-typography.css` | Should use existing TSX typography class `.body` directly. |
| 0.8125rem font size | 1 | `frontend/src/components/QuickSearch.tsx:112` | `--font-size-body-s: 0.8125rem` | `.body-s` | 04-typography | `design-system/source/04-typography.css` | Should use existing TSX typography class `.body-s` directly. |
| 0.75rem font size | 1 | `frontend/src/components/QuickSearch.tsx:125` | `--font-size-label: 0.75rem` | `.label` | 04-typography | `design-system/source/04-typography.css` | Should use existing TSX typography class `.label` directly. |
| 0.6875rem font size | 1 | `frontend/src/components/TracklistImporter.css:18` | `--font-size-data-s: 0.6875rem` | `.data-s` | 04-typography | `design-system/source/04-typography.css` | Should use existing TSX typography class `.data-s` directly. |
| minmax(240px, 1fr) | 1 | `frontend/src/pages/ScraperProgressPage.tsx:137` | `--layout-grid-card-min: minmax(240px, 1fr)` | N/A | 05-layout | `design-system/source/05-layout.css` | Need dynamic grid behavior token for standard card lists. |

## 2. MISSING COMPONENTS AND PATTERNS

| Value/Need | Uses | File:Line | Proposed Name | Nearest Existing | Section | Source File under design-system/source/ | Reasoning |
|---|---|---|---|---|---|---|---|
| Skeleton empty card | 1 | `frontend/src/App.tsx:14` | `LoadingCard` | `LoadingState` | 07-feedback-status | `design-system/source/07-feedback-status.css` | `LoadingState` is full view; need localized skeleton card. |
| Multi-step progress indicator | 1 | `frontend/src/components/OAuthCallback.tsx:319` | `StagedProgress` | `LoadingPanel` | 07-feedback-status | `design-system/source/07-feedback-status.css` | `LoadingPanel` not appropriate for long/staged jobs. |
| Dual Range Slider | 1 | `frontend/src/components/DualRangeSlider.tsx:10` | `<DualSlider>` | `<Slider>` | 12-inputs | `design-system/source/12-inputs.css` | Existing `<Slider>` likely only supports single point tracking. |
| Radial Menu | 1 | `frontend/src/components/RadialMenu.tsx:65` | `<RadialMenu>` | N/A | 10-navigation | `design-system/source/10-navigation.css` | Advanced specialized navigation pattern required. |
| A utility class to place content at extremities (`justify-content: space-between`). | 1 | `frontend/src/features/setBuilder/ExportDialog.tsx:140` | `sn-row--between` | `sn-row` | 05-layout | `design-system/source/05-layout.css` | `sn-row` only provides flex with gap; explicit space-between utility needed. |
| Dynamic HSL colour for Camelot key | 1 | `frontend/src/utils/harmonic.ts:390` | N/A | Static colors | 03-color | `design-system/source/03-color.css` | Computed colors cannot be cleanly provided by static tokens. |
| Progress bar | 1 | `frontend/src/components/TracklistImporter.tsx:120` | `ProgressBar` | N/A | 07-feedback-status | `design-system/source/07-feedback-status.css` | Needed to visualize linear progress completion dynamically. |
| ChipInput | 1 | `frontend/src/features/musicLibrary/targetAction/TargetTracksManager.tsx:645` | N/A | standard input | 12-inputs | `design-system/source/12-inputs.css` | Advanced input for multiple tokenized text entries needed. |
| Component wrapper for `SecretField` | 1 | `frontend/src/components/APIKeyManager.tsx:28` | `SecretField` | `TextField` | 12-inputs | `design-system/source/12-inputs.css` | Requires specialized hidden/reveal state management unlike standard `TextField`. |

## 3. Exceptions requested

None requested.

## 4. Version Bump and Maintainer Instructions

**Proposed Version Bump:** `1.2.0` (Minor version bump as new tokens and components are backwards compatible).

**Maintainer Instructions:**

1. Edit the token files in `design-system/source/` and update `design-system/tokens.json` to bump the `"version"` field to `"1.2.0"`.
2. Add the missing tokens with their specific unit values to `design-system/tokens.json` under the appropriate categories.
3. Edit the relevant CSS and JS source files in `design-system/source/` (like `05-layout.css`, `12-inputs.css`) to add the proposed components or utility classes.
4. Run `python3 source/build_tokens.py` to regenerate `tokens.json`, `tokens.css`, and output the contrast report.
5. Run `python3 source/build_bundle.py` to compile and bundle the CSS and JS artifacts (`components/bundle.css` and `components/bundle.js`).
6. Run `bash scripts/sync-design-system.sh` to copy the newly generated assets over to `frontend/src/styles/design-system/`.

## 5. Clean Audit Pages

The following audit pages were completely clean (no missing tokens or components found):
- `DS3.md`
- `DS4.md`
- `DS6.md`
- `DS7.md`
- `DS12.md`
- `DS13.md`
- `DS15.md`
