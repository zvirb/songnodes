# Frontend linting and type-checking

Updated 26 Oct 2026. Lint: **Oxlint** (`oxlint` 1.89) with type-aware rules from **oxlint-tsgolint** 7.0.2005, which is built on TypeScript 7. Type-check: **TypeScript 7.0.2** `tsc`. Node 26.

## Why not ESLint
ESLint 10 cannot be used with TypeScript 7 here: `typescript-eslint` supports TypeScript below 6.1 only (no TypeScript 7 compiler API exists yet), and `eslint-plugin-react` 7.37.5 supports ESLint up to 9. Oxlint covers the React, React hooks, jsx-a11y, import, unicorn and Vitest rules plus 59 of typescript-eslint's 61 type-aware rules.

## Commands
```bash
cd frontend
npm run type-check   # tsc --noEmit (TypeScript 7)
npm run lint         # oxlint --type-aware src
```
Config: `frontend/.oxlintrc.json`. CI runs both in `.github/workflows/design-system.yml`.

## Baseline (the code had never been linted)
Lint passes today because every rule that currently fails is set to `warn`. Each line below is a rule that should go back to `error` once its findings are fixed, by small per-folder packages.

- Off, because `tsconfig.json` has `strictNullChecks` disabled and the rules report nothing useful without it: `typescript/no-unnecessary-boolean-literal-compare`, `typescript/no-useless-default-assignment`.
- `react-hooks/rules-of-hooks` stays `error` everywhere except `src/components/GraphMiniMap.tsx`, which calls `useDynamicRendering` inside callbacks (lines 318 and 335). That is a real bug; fix it and remove the override.

| Rule (now warn) | Findings |
|---|---|
| `no-unused-vars` | 141 |
| `jsx-a11y/prefer-tag-over-role` | 68 |
| `react/set-state-in-effect` | 27 |
| `jsx-a11y/click-events-have-key-events` | 23 |
| `jsx-a11y/no-static-element-interactions` | 20 |
| `react/refs` | 19 |
| `jsx-a11y/label-has-associated-control` | 18 |
| `react/purity` | 13 |
| `no-useless-escape` | 12 |
| `jsx-a11y/control-has-associated-label` | 11 |
| `typescript/unbound-method` | 11 |
| `jsx-a11y/no-noninteractive-element-interactions` | 9 |
| `react/immutability` | 9 |
| `typescript/no-redundant-type-constituents` | 8 |
| `typescript/restrict-template-expressions` | 7 |
| `jsx-a11y/role-supports-aria-props` | 5 |
| `vitest/require-mock-type-parameters` | 4 |
| `react/preserve-manual-memoization` | 4 |
| `jsx-a11y/interactive-supports-focus` | 3 |
| `vitest/no-conditional-expect` | 3 |
| `typescript/no-base-to-string` | 3 |
| `react/incompatible-library` | 2 |
| `unicorn/no-useless-fallback-in-spread` | 2 |
| `no-control-regex` | 2 |
| `typescript/await-thenable` | 2 |
| `jsx-a11y/no-noninteractive-tabindex` | 1 |
| `oxc/erasing-op` | 1 |
| `react/no-children-prop` | 1 |
| `jsx-a11y/media-has-caption` | 1 |
| `jsx-a11y/no-autofocus` | 1 |

## Findings by folder (all rules, warnings included)

| Folder | Findings | Top rules |
|---|---|---|
| `src/utils` | 109 | `typescript/no-unnecessary-type-assertion` 34, `typescript/no-unsafe-type-assertion` 24, `no-unused-vars` 23 |
| `src/components/GraphVisualization.tsx` | 162 | `typescript/no-unsafe-type-assertion` 52, `typescript/no-unnecessary-type-assertion` 20, `no-unused-vars` 19 |
| `src/features/musicLibrary` | 138 | `typescript/no-unnecessary-type-assertion` 26, `typescript/no-unsafe-type-assertion` 20, `jsx-a11y/prefer-tag-over-role` 19 |
| `src/hooks` | 39 | `typescript/no-unsafe-type-assertion` 7, `no-unused-vars` 6, `react/purity` 6 |
| `src/components/DJInterface` | 34 | `typescript/no-unsafe-type-assertion` 11, `typescript/no-unnecessary-type-assertion` 10, `import/no-named-as-default` 6 |
| `src/features/aiSetlists` | 33 | `no-unused-vars` 8, `typescript/no-unsafe-type-assertion` 8, `typescript/no-floating-promises` 3 |
| `src/components/IntelligentBrowser` | 23 | `jsx-a11y/prefer-tag-over-role` 7, `typescript/no-unsafe-type-assertion` 5, `unicorn/no-array-sort` 3 |
| `src/components/DJInterface.tsx` | 37 | `typescript/no-unnecessary-type-assertion` 12, `typescript/no-unsafe-type-assertion` 6, `no-unused-vars` 5 |
| `src/components/SetlistBuilder` | 17 | `no-unused-vars` 3, `typescript/no-floating-promises` 3, `jsx-a11y/click-events-have-key-events` 2 |
| `src/components/ds` | 29 | `typescript/no-unsafe-type-assertion` 8, `jsx-a11y/prefer-tag-over-role` 5, `typescript/no-unnecessary-type-assertion` 4 |
| `src/features/pipeline` | 29 | `typescript/no-unsafe-type-assertion` 15, `typescript/no-unnecessary-type-assertion` 4, `no-unused-vars` 3 |
| `src/examples` | 25 | `no-unused-vars` 7, `react/refs` 6, `react-hooks/exhaustive-deps` 4 |
| `src/components/FilterPanel.tsx` | 27 | `typescript/no-unsafe-type-assertion` 10, `typescript/no-unnecessary-type-assertion` 9, `unicorn/no-array-sort` 6 |
| `src/components/ContextMenu.tsx` | 26 | `no-unused-vars` 9, `typescript/no-unsafe-type-assertion` 6, `typescript/no-unnecessary-type-assertion` 3 |
| `src/components/TargetTracksManager.tsx` | 25 | `typescript/no-floating-promises` 11, `jsx-a11y/label-has-associated-control` 2, `jsx-a11y/prefer-tag-over-role` 2 |
| `src/components/TrackSearch.tsx` | 23 | `typescript/no-floating-promises` 6, `no-unused-vars` 4, `react/set-state-in-effect` 3 |
| `src/lib` | 14 | `typescript/no-unsafe-type-assertion` 4, `typescript/no-unnecessary-type-assertion` 3, `no-control-regex` 2 |
| `src/components/ArtistAttributionManager.tsx` | 22 | `typescript/no-floating-promises` 5, `jsx-a11y/prefer-tag-over-role` 3, `jsx-a11y/click-events-have-key-events` 3 |
| `src/components/PathfinderPanel` | 15 | `no-unused-vars` 5, `typescript/no-unnecessary-type-assertion` 4, `typescript/no-unsafe-type-assertion` 3 |
| `src/services` | 15 | `typescript/no-unnecessary-type-conversion` 6, `typescript/no-unsafe-type-assertion` 3, `no-unused-vars` 2 |
| `src/features/camelot` | 10 | `no-shadow` 2, `import/no-named-as-default` 1, `no-unused-vars` 1 |
| `src/components/TidalPlaylistManager.tsx` | 18 | `no-unused-vars` 5, `no-shadow` 4, `typescript/no-unnecessary-type-conversion` 3 |
| `src/shell` | 14 | `jsx-a11y/prefer-tag-over-role` 4, `typescript/no-unsafe-type-assertion` 4, `react/exhaustive-effect-dependencies` 1 |
| `src/components/SetlistBuilder.tsx` | 18 | `jsx-a11y/click-events-have-key-events` 4, `jsx-a11y/no-static-element-interactions` 4, `no-unused-vars` 2 |
| `src/components/PathBuilder.tsx` | 16 | `typescript/no-unsafe-type-assertion` 4, `no-unused-vars` 3, `jsx-a11y/label-has-associated-control` 2 |
| `src/components/StatsPanel.tsx` | 17 | `unicorn/no-array-sort` 6, `typescript/no-unnecessary-type-assertion` 5, `typescript/no-unsafe-type-assertion` 5 |
| `src/pages` | 6 | `no-unused-vars` 3, `typescript/no-base-to-string` 1, `typescript/restrict-template-expressions` 1 |
| `src/components/TracklistImporter.tsx` | 15 | `jsx-a11y/prefer-tag-over-role` 5, `unicorn/consistent-function-scoping` 2, `no-useless-escape` 2 |
| `src/components/APIKeyManager.tsx` | 12 | `react/immutability` 2, `react/set-state-in-effect` 2, `typescript/no-floating-promises` 2 |
| `src/components/SpotifyPlaylistManager.tsx` | 13 | `no-shadow` 4, `typescript/no-floating-promises` 2, `no-unused-vars` 1 |
| `src/components/SmartTooltip.tsx` | 12 | `no-unused-vars` 6, `typescript/consistent-return` 2, `typescript/no-unsafe-type-assertion` 2 |
| `src/components/IntelligentBrowser.legacy.tsx` | 11 | `typescript/no-unsafe-type-assertion` 4, `unicorn/no-array-sort` 3, `typescript/no-unnecessary-type-assertion` 2 |
| `src/components/GraphMiniMap.tsx` | 10 | `no-unused-vars` 3, `typescript/consistent-return` 3, `react-hooks/rules-of-hooks` 2 |
| `src/components/LiveDataLoader.tsx` | 10 | `unicorn/prefer-add-event-listener` 4, `typescript/no-floating-promises` 2, `react/immutability` 1 |
| `src/components/MobileTrackExplorer.tsx` | 10 | `typescript/no-unsafe-type-assertion` 5, `import/no-named-as-default` 1, `no-unused-vars` 1 |
| `src/components/GraphFilterPanel.tsx` | 10 | `unicorn/no-array-sort` 3, `no-unused-vars` 2, `react/purity` 1 |
| `src/components/AdvancedSearch.tsx` | 9 | `jsx-a11y/label-has-associated-control` 4, `react/set-state-in-effect` 3, `jsx-a11y/no-static-element-interactions` 1 |
| `src/components/SettingsPanel.tsx` | 9 | `no-unused-vars` 2, `unicorn/consistent-function-scoping` 2, `import/no-named-as-default` 1 |
| `src/main.tsx` | 8 | `import/no-unassigned-import` 7, `typescript/no-unnecessary-type-assertion` 1 |
| `src/components/CamelotWheel.tsx` | 8 | `typescript/restrict-template-expressions` 4, `jsx-a11y/prefer-tag-over-role` 3, `typescript/no-unsafe-type-assertion` 1 |
| `src/components/PathfinderPanel.tsx` | 8 | `typescript/no-unnecessary-type-assertion` 2, `typescript/no-unsafe-type-assertion` 2, `no-unused-vars` 1 |
| `src/store` | 6 | `no-shadow` 2, `no-unused-vars` 2, `typescript/no-unsafe-type-assertion` 2 |
| `src/components/QuickSearch.tsx` | 7 | `react/set-state-in-effect` 2, `typescript/no-unsafe-type-assertion` 2, `jsx-a11y/click-events-have-key-events` 1 |
| `src/components/MoodVisualizer.tsx` | 7 | `typescript/no-unnecessary-type-assertion` 3, `jsx-a11y/prefer-tag-over-role` 2, `no-unused-vars` 1 |
| `src/components/MusicServiceSearch.tsx` | 7 | `jsx-a11y/prefer-tag-over-role` 3, `typescript/no-unsafe-type-assertion` 2, `import/no-unassigned-import` 1 |
| `src/components/AIAssistantModal.tsx` | 6 | `typescript/no-unnecessary-type-assertion` 2, `no-unused-vars` 1, `react/set-state-in-effect` 1 |
| `src/components/NowPlayingDeck.tsx` | 6 | `typescript/consistent-return` 2, `react/exhaustive-effect-dependencies` 1, `react/set-state-in-effect` 1 |
| `src/components/OnboardingOverlay.tsx` | 6 | `jsx-a11y/click-events-have-key-events` 2, `jsx-a11y/no-static-element-interactions` 2, `jsx-a11y/prefer-tag-over-role` 1 |
| `src/components/KeyMoodPanel.tsx` | 5 | `no-unused-vars` 2, `jsx-a11y/label-has-associated-control` 2, `import/no-unassigned-import` 1 |
| `src/components/HarmonicCompatibility.tsx` | 5 | `typescript/no-redundant-type-constituents` 4, `unicorn/no-array-sort` 1 |
| `src/components/TrackDetailsModal.tsx` | 5 | `react/exhaustive-effect-dependencies` 1, `unicorn/consistent-function-scoping` 1, `jsx-a11y/prefer-tag-over-role` 1 |
| `src/components/EditTrackModal.tsx` | 4 | `no-unused-vars` 1, `jsx-a11y/prefer-tag-over-role` 1, `typescript/no-unnecessary-type-assertion` 1 |
| `src/components/CommunityCluster.tsx` | 4 | `unicorn/no-array-sort` 2, `import/no-named-as-default` 1, `jsx-a11y/control-has-associated-label` 1 |
| `src/components/RadialMenu.tsx` | 3 | `jsx-a11y/no-static-element-interactions` 2, `jsx-a11y/click-events-have-key-events` 1 |
| `src/components/ServicePlaylistView.tsx` | 3 | `import/no-unassigned-import` 1, `jsx-a11y/prefer-tag-over-role` 1, `typescript/no-unnecessary-type-assertion` 1 |
| `src/components/PerformanceMonitor.tsx` | 3 | `import/no-named-as-default` 1, `no-shadow` 1, `unicorn/consistent-function-scoping` 1 |
| `src/components/EdgeDetailsModal.tsx` | 2 | `unicorn/consistent-function-scoping` 1, `import/no-unassigned-import` 1 |
| `src/components/EnergyMeter.tsx` | 1 | `jsx-a11y/prefer-tag-over-role` 1 |
| `src/components/TrackEditModal.tsx` | 1 | `react/set-state-in-effect` 1 |
| `src/components/OAuthCallback.tsx` | 1 | `typescript/no-floating-promises` 1 |
| `src/components/Attributions.tsx` | 1 | `typescript/no-floating-promises` 1 |
