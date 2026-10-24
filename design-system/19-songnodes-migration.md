# SongNodes migration

The concrete plan to move `frontend/` of the SongNodes repo onto this system. Work in phases; each phase ships on its own and ends with acceptance checks that run in CI. Paths are relative to `frontend/`.

## What is there today

| Problem | Evidence |
|---|---|
| Four styling systems at once | (1) `src/styles/tokens.css` + `src/styles/globals.css` (imported in `main.tsx`, Matrix green `--color-brand-primary: #00ff41`); (2) legacy `src/styles/global.css` (imported in `App.tsx`, its own `--color-accent-primary: #00ff41`, 37 hex values); (3) Tailwind classes (≈900 `className` utilities) and `tailwind.config.js`; (4) inline `style={{…}}` objects (827) with hard-coded hex (701 literals). Plus CSS modules in `DJInterface/` and `IntelligentBrowser/`, and `DataQualityReview.css` (77 hex). |
| Tailwind is not compiled | `@import "tailwindcss"` lives only in `src/index.css`, which nothing imports. Every Tailwind class (`bg-green-400`, `text-gray-…`) renders as nothing. |
| iOS palette in code | #8E8E93 (121 uses), #7ED321 (65), #4A90E2 (47), #F5A623 (17), #F56565 (15), #00FF41 (16) |
| Graph colours hard-coded | `COLOR_SCHEMES` in `components/GraphVisualization.tsx` (0x4a90e2 nodes, 0xff1744 now playing, genre map) |
| Three-plus Camelot tables | `utils/camelotData.ts` (wrong: 1A = "C Major", all A codes major), `utils/harmonic.ts` `CAMELOT_WHEEL` (correct), `components/CamelotWheel.tsx` inline table (codes right, Open Key wrong), compat lists in `utils/harmonicMatching.ts` and `components/DJInterface/utils/camelotHelpers.ts` |
| Three energy drawings | % (`energy * 100` in `SetlistBuilder.tsx`, `EdgeDetailsModal.tsx`, `SmartTooltip.tsx`, `PathBuilder.tsx`), "7/10" (`MobileTrackExplorer.tsx`), blue→red meter (`utils/energyUtils.ts`, `EnergyMeter.tsx`, `Graph3D.tsx`) |
| Two compat palettes | `utils/harmonicUtils.ts` `COMPATIBILITY_PROPS` (green/yellow/orange/red, ✓✓ ✓ ~ ✗) and `IntelligentBrowser/utils.ts` `getScoreColor` (#7ED321/#F5A623/#FFA500) |
| z-index chaos | 9999, 10000 (×5), 10001, 1000 (×5), 2000 across `ContextMenu`, `TrackDetailsModal`, `SettingsPanel`, `RadialMenu`, `useToast` … |
| Browser dialogs | 25 `alert`/`confirm` calls (`DJInterface.tsx`, `TargetTracksManager.tsx`, `SettingsPanel.tsx`, `APIKeyManager.tsx`, `PathBuilder.tsx`, …) |
| Emoji UI | ≈300 emoji, worst in `GraphVisualization.tsx` (79), `SettingsPanel.tsx` (23), `DJInterface.tsx` (20) |
| Duplicated shortcuts | `App.tsx` (1–4, Ctrl+R/F/P), `hooks/useKeyboardShortcuts.ts` (1–5, b, r, Delete), `QuickSearch.tsx` (Ctrl/Cmd+K, `/`), `SetlistBuilder/index.tsx` (Ctrl+S, Ctrl+/), `GraphModeToggle.tsx` (Ctrl+Shift+3). Ctrl+R and Ctrl+F override the browser. |
| Shadowed duplicates | `components/DJInterface.tsx` shadows `components/DJInterface/` (Vite resolves the file first); `SetlistBuilder.tsx` shadows `SetlistBuilder/index.tsx`; `IntelligentBrowser.legacy.tsx`; `EditTrackModal.tsx` vs `TrackEditModal.tsx`; `GraphVisualization.disabled/` |
| Unused code | `components/ui/*` kit (only imported by itself, `layouts/BentoGrid.tsx`, `DesignTrendsShowcase.tsx`), `AdvancedSearch`, `DualRangeSlider`, `InfoCard`, `MultiSelect`, `PerformanceMonitor`, `RadialMenu`, `SidePanel`, `SmartTooltip`, `GraphVisualizationWrapper` (+ `Graph3D`, `CamelotHelix3D`), `DataQualityReview` (not mounted) |
| Routing by pathname | `App.tsx` checks `window.location.pathname` for OAuth; `react-router-dom` 7 installed, unused |
| Shell | `index.html`: system fonts, `#0a0a0a`, green "INITIALIZING DJ INTERFACE" loader, no-cache meta, service-worker killer; `main.tsx` blocks double-tap zoom everywhere |

## Decisions

- **Remove Tailwind.** It is not compiled, so removing it changes nothing on screen, and mapping it to tokens would keep a fifth vocabulary alive. Delete `tailwind.config.js`, `src/index.css`, `postcss.config.js` (or reduce to autoprefixer), and the deps `tailwindcss`, `@tailwindcss/postcss`, `tailwind-merge`, `class-variance-authority`. Replace utilities with `sn-*` classes or a component's CSS module that uses tokens only.
- **One token source.** `src/styles/design-system/tokens.css` + `bundle.css` (synced, never edited). Delete `src/styles/tokens.css`, `globals.css`, `global.css`, `src/styles/README.md`, `src/lib/tokens.ts`.
- **3D graph and Camelot helix retired.** The 2D PIXI graph is the only graph. Delete `Graph3D.tsx`, `CamelotHelix3D.tsx`, `GraphModeToggle.tsx` and `GraphVisualizationWrapper.tsx` (plus `GraphVisualization.disabled/`), drop `react-force-graph-3d` and `three`, and remove the Ctrl+Shift+3 shortcut. No 2D/3D toggle anywhere; `GraphControls` carries a "Colour by" control instead. The two modes stay "Play" and "Plan" (sentence case in UI, `?mode=play|plan`).
- **Graph colours from tokens.** PIXI needs numbers: read CSS variables once per theme change. Node fill follows the "Colour by" choice (Neutral default, Energy, Key, Genre).

```ts
// src/lib/graphColours.ts
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim();
const hex = (n: string) => parseInt(css(n).replace("#", ""), 16);
export function graphColours() {
  return {
    node: { default: hex("fg-2"), selected: hex("brand"), now: hex("now"), path: hex("mod-paths"), hovered: hex("fg") }, // now = amber, selected = lavender
    edge: { default: hex("fg-3"), selected: hex("brand"), path: hex("mod-paths") },
    chart: Array.from({ length: 8 }, (_, i) => hex(`chart-${i + 1}`)),
    key: (code: string) => hex(`key-${code.toLowerCase()}`),
    energy: (e: number) => hex(`energy-${e}`),
    faded: Number(css("opacity-faded")), edgeAlpha: Number(css("opacity-edge")),
  };
}
// re-run on theme change: new MutationObserver(cb).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
```

Alias tokens resolve to hex through `getComputedStyle` (`now` is its own amber token, no longer an alias of `brand`); `rgba()` values are not used for graph marks.

## iOS and Matrix palette → tokens

| Old | Where it means | Token |
|---|---|---|
| #4A90E2 | Accent, selected tab, default node, "strong" edge | `brand` (selection/accent), `fg-3` (default node), `mod-graph` (links to Graph) |
| #7ED321 | Success, "excellent", hover node, DJ mode button | `status-ok` / `compat-perfect` (verdicts); hover = `fg` ring; buttons = `brand` |
| #F5A623 | Warning, "good", waypoint | `status-warn` / `compat-possible`; waypoint `mod-paths` |
| #F56565 | Error, delete | `status-bad`; destructive button `.sn-btn--danger` |
| #8E8E93 | Secondary text, inactive tab, default edge | `fg-2` (text), `fg-3` (captions, edges), `line-strong` (borders) |
| #00FF41, #00ff00 | Brand, focus, success, path edge, loader | `brand` (brand, focus), `status-ok` (success), `mod-paths` (path) |
| #0a0a0a, #1a1a1a | Backgrounds | `bg`, `surface-1` |
| #FF1744, 0xff1744 | Now playing, path edges | `now`, `mod-paths` |
| #FF6B35 | Selected node/edge | `brand` |
| #1DB954 | Spotify tab | `svc-spotify` only on Connect Spotify and the Spotify source badge; tabs are neutral |
| rgba(74,144,226,0.2) | Selected tab fill | none: `Tabs` underline in `--m` |

## z-index → tokens

| Old | Token |
|---|---|
| 2, 3, 10 | `z-sticky` |
| 50, 60, 90, 100 (panels, headers) | `z-header` or `z-drawer` |
| 1000 (modals, filter panel) | `z-dialog` (scrim `z-overlay`) |
| 10000, 10001 (context menu, radial menu, tooltip) | `z-popover` / `z-tooltip` |
| 9999 (toasts, loader) | `z-toast` (loader removed) |

## File-by-file

| File | Change | Component(s) |
|---|---|---|
| `index.html` | Inline prefs script, `color-scheme` meta, `<title>SongNodes</title>`, font preloads, remove loader, no-cache meta and SW killer | `AppHeader` shell |
| `public/favicon.svg` | Replace with "SN" brand tile; add PNG sizes and `manifest.webmanifest` | Identity |
| `public/debug-storage.html`, `fix-structure.html`, `test-credentials.html`; root `setlist-demo.html`, `visualization-controls-demo.html`, `test-component-structure.html`, `DESIGN_TRENDS_2025.md` | Delete (not product UI) | – |
| `src/main.tsx` | Import design-system CSS; drop global `touchend` block; keep canvas-only context-menu block; mount `RouterProvider` | – |
| `src/App.tsx` | Becomes `Shell` + router (see Navigation); delete classic interface, `ToolbarButton`, `djModeEnabled`, inline styles, key handler | `AppHeader`, `NavDrawer`, `CommandPalette`, `ShortcutSheet` |
| `components/DJInterface.tsx` | Split into `GraphExplorerPage` (Play/Plan via `?mode=`), right tabs via `?tab=`; header buttons into `PageHeader` overflow | `PageHeader`, `SegmentedControl`, `Tabs`, `OverflowMenu` |
| `components/DJInterface/` | Delete after the split (shadowed, never rendered); reuse `PlayModePanel`/`PlanModePanel` code only as reference | – |
| `components/GraphVisualization.tsx` | `COLOR_SCHEMES` → `graphColours()`; remove glow textures (no glow); emoji logs out; edge dash patterns by type | `GraphStyles`, `GraphControls` |
| `components/GraphVisualization.disabled/`, `GraphVisualizationWrapper.tsx`, `Graph3D.tsx`, `CamelotHelix3D.tsx`, `GraphModeToggle.tsx` | Delete: the 3D graph and Camelot helix are retired. Drop `react-force-graph-3d`, `three` | – |
| `components/IntelligentBrowser/` | Rows → `TrackCell` + `CompatibilityBadge` + score band; `utils.ts` `getScoreColor` deleted | `TrackCell`, `CompatibilityBadge` |
| `components/IntelligentBrowser.legacy.tsx` | Delete | – |
| `components/SetlistBuilder.tsx` vs `SetlistBuilder/` | Keep the folder version (autosave, M3U/CSV export) as the base; delete the shadowing file; rebuild as `SetBuilderPage` | `SetSlot`, `TransitionNote`, `EnergyWave`, `SetCard` |
| `components/PathBuilder.tsx`, `PathfinderPanel.tsx` | Energy curve presets → set shapes; "E:73%" → `EnergyBar`; alerts → `InlineMessage` | `ChartFrame`, `EnergyWave`, `EnergyBar` |
| `components/TrackDetailsModal.tsx`, `EdgeDetailsModal.tsx` | → `TrackDetailPage` + `SideSheet`; edge detail → `Popover` | `KeyValueGrid`, `KeyBadge`, `BpmReadout` |
| `components/TrackEditModal.tsx`, `EditTrackModal.tsx` | Keep one (`TrackEditModal`), as a `Dialog` form | `Dialog`, `TextField`, `KeyPicker` |
| `components/ContextMenu.tsx`, `RadialMenu.tsx` | `ContextMenu` on tokens, emoji out; delete `RadialMenu` | `ContextMenu` |
| `components/SettingsPanel.tsx`, `APIKeyManager.tsx` | → `SettingsPage`; keys in `SecretField`; confirms → `ConfirmDialog` | `PreferencesPanel`, `SecretField`, `ServiceStatus` |
| `components/TidalPlaylistManager.tsx`, `SpotifyPlaylistManager.tsx`, `MusicServiceSearch.tsx` | Plan-mode tabs on tokens; service colours only on connect buttons | `Tabs`, `Button`, `SourceBadge` |
| `components/TargetTracksManager.tsx` | → `LogPage` (target tracks); import/export per Print and export | `DataTable`, `FileDrop`, `ConfirmDialog` |
| `components/TracklistImporter.tsx`, `ArtistAttributionManager.tsx` | → `TracklistPaste` / `LogPage` | `TracklistPaste`, `StagedProgress` |
| `components/DataQualityReview.tsx` + `.css` | Mount as review queue (`LogPage` variant); delete the CSS file | `StatusPill`, prev/next, `Toast` with Undo |
| `components/StatsPanel.tsx` | → `MatrixPage`/stats; export names per rules | `FigureTile`, `ChartFrame` |
| `components/QuickSearch.tsx`, `AdvancedSearch.tsx`, `TrackSearch.tsx` | `QuickSearch` → `CommandPalette`; delete `AdvancedSearch`; `TrackSearch` → `SearchField` | `CommandPalette`, `SearchField` |
| `components/FilterPanel.tsx`, `GraphFilterPanel.tsx` | → `FilterRail` (library) and `GraphControls` (graph) | `FilterRail`, `FilterChip`, `RangeSlider` |
| `components/KeyMoodPanel.tsx`, `CamelotWheel.tsx`, `HarmonicCompatibility.tsx`, `MoodVisualizer.tsx` | Wheel from `key-*` tokens; badges via `CompatibilityBadge` | `CamelotWheel`, `CompatibilityBadge` |
| `components/EnergyMeter.tsx`, `NowPlayingDeck.tsx`, `MobileTrackExplorer.tsx` | `EnergyBar`; mobile explorer → phone layout of `LibraryPage`/`GraphExplorerPage` | `EnergyBar`, `TrackCell` |
| `components/OAuthCallback.tsx` | → `AuthCallbackPage` route | `AuthCallbackPage` |
| `components/OnboardingOverlay.tsx`, `LiveDataLoader.tsx`, `GraphMiniMap.tsx` | Tokens, emoji out; onboarding → `Dialog`; loader → `LoadingState` | `Dialog`, `LoadingState`, `ConnectionStatus` |
| `components/ui/*`, `layouts/BentoGrid.tsx`, `DesignTrendsShowcase.tsx`, `examples/`, unused list above | Delete | – |
| `hooks/useKeyboardShortcuts.ts` | The one shortcut registry (feeds `ShortcutSheet`); remove handlers from `App.tsx`, `QuickSearch.tsx`, `SetlistBuilder`; no Ctrl+R/F/P overrides | `ShortcutSheet` |
| `hooks/useToast.tsx`, `sonner` | One toast system: `Toast` on `z-toast`; drop the other | `Toast` |
| `utils/camelotData.ts`, `camelotUtils.ts`, `harmonic.ts`, `harmonicCompatibility.ts`, `harmonicMatching.ts`, `harmonicUtils.ts`, `DJInterface/utils/camelotHelpers.ts` | One module `utils/camelot.ts` wrapping `SongNodes.camelot`, `keyName`, `compat` (port the parser and table into TS); delete `camelotData.ts` and `COMPATIBILITY_PROPS`; scores keep their maths but return 0–100 | `KeyBadge`, `CompatibilityBadge` |
| `utils/energyUtils.ts`, `utils/trackMetadata.ts` | `getEnergyColor` deleted; add `displayEnergy(value, scale)` per Data display; `formatStoredEnergy` stays for logs only | `EnergyBar` |
| `store/useStore.ts` | Remove panel-open state that moves to the URL; emoji in logs out | – |
| `nginx/nginx.conf` (repo root) | Add `404.html`, `50x.html` to the frontend image | `ErrorPage` |

## Phases

| Phase | Scope | Acceptance checks |
|---|---|---|
| 0 Foundations | `scripts/sync-design-system.sh`; `src/styles/design-system/`; `index.html` head; fonts self-hosted; favicon | Sync script copies and writes `VERSION`; no theme flash on reload (Playwright screenshot at first paint); Lighthouse: no external font or CDN requests |
| 1 Domain truth | `utils/camelot.ts`, `displayEnergy`, compat and score bands; delete wrong tables | Unit tests: 24 keys round-trip `camelot(keyName(c)) === c`; `compat` table from Data display; `energyStep`/`bpmStep` thresholds; `legacy_0_1` 0.73 → 7; `grep -r "camelotData\|getEnergyColor\|COMPATIBILITY_PROPS" src` empty |
| 2 Shell and routes | Router, `Shell`, `AppHeader`, `NavDrawer`, `CommandPalette`, `ShortcutSheet`, `AuthCallbackPage`, `ErrorPage` | Every route reachable from the drawer; Back/Forward restore filters, tab, mode; OAuth works for Spotify and TIDAL; axe: zero serious |
| 3 Surfaces and feedback | `Dialog`, `ConfirmDialog`, `SideSheet`, `Toast`, `Popover`; z-index tokens | ESLint `no-alert` passes; `grep -rE "zIndex: *[0-9]{3,}" src` empty; one dialog at a time (test) |
| 4 Pages | Library, Set builder, Graph explorer, Track detail, Settings, Log pages, review queue | Snapshot tests in dark/light/booth; one primary button per view (lint test on rendered DOM); phone width 375 without horizontal scroll |
| 5 Graph | `graphColours()`, edge patterns, node states, theme switch live | Switching theme recolours the canvas without reload; no hex literals in `GraphVisualization.tsx` |
| 6 Clean-up | Delete legacy CSS, Tailwind, ui kit, duplicates, disabled folder, demo pages; drop unused deps | `npm run build` passes; stylelint "no hex outside design-system" passes; emoji grep empty; bundle size not larger than before phase 0 |

Rules during migration: no new hex, emoji or `alert` from phase 0 on (CI enforces on changed files); each phase removes what it replaces in the same pull request; ship behind no flags except Phase 4 pages, which may live at their new routes while the old `DJInterface` stays at `/` until Phase 4 ends.
