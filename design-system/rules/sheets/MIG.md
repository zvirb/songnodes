# MIG rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| MIG-001 | The frontend shall not use Tailwind: tailwind.config.js, src/index.css, tailwindcss, @tailwindcss/postcss, tailwind-merge and class-variance-authority shall be removed. | lint | Files and dependencies are absent. |
| MIG-002 | Utility classes shall be replaced with sn-* classes or a component CSS module that uses tokens only. | lint | No Tailwind utility classes in className. |
| MIG-003 | The one token source shall be src/styles/design-system/tokens.css plus bundle.css, synced and never edited. | lint | Those files match the design-system source byte for byte. |
| MIG-004 | The legacy style files src/styles/tokens.css, globals.css, global.css, src/styles/README.md and src/lib/tokens.ts shall be deleted. | lint | Files do not exist. |
| MIG-005 | The 2D PIXI graph shall be the only graph: Graph3D, CamelotHelix3D, GraphModeToggle, GraphVisualizationWrapper and GraphVisualization.disabled shall be deleted, react-force-graph-3d and three dropped, and the Ctrl+Shift+3 shortcut removed. | lint | Files, deps and shortcut are absent. |
| MIG-006 | No 2D/3D toggle shall exist anywhere; GraphControls shall carry a "Colour by" control instead. | dom | No 2D/3D control; Colour by control present. |
| MIG-007 | The two graph modes shall be "Play" and "Plan" in sentence case, selected with ?mode=play\|plan. | dom | Mode control labels are Play/Plan and URL param works. |
| MIG-008 | Graph colours shall be read from CSS variables once per theme change and node fill shall follow the "Colour by" choice. | lint | graphColours() reads tokens; recomputed on data-theme change. |
| MIG-009 | Alias tokens used for graph marks shall be resolved to hex through getComputedStyle, and rgba() values shall not be used for graph marks. | lint | No rgba() in graph mark colours. |
| MIG-010 | The "now" token shall be its own amber token and not an alias of brand. | lint | --now does not reference --brand. |
| MIG-011 | Legacy iOS/Matrix palette hex values shall be replaced with the tokens given in the palette mapping table. | lint | Legacy hex values (#4A90E2, #7ED321, #F5A623, #F56565, #8E8E93, #00FF41…) are absent. |
| MIG-012 | Numeric z-index values shall be replaced by z-* tokens (z-sticky, z-header, z-drawer, z-dialog, z-overlay, z-popover, z-tooltip, z-toast). | lint | grep -rE "zIndex: *[0-9]{3,}" src is empty. |
| MIG-013 | From Phase 0 no new hex literals, emoji or alert calls shall be introduced, enforced in CI on changed files. | lint | CI fails on new hex, emoji or alert in changed files. |
| MIG-014 | Each migration phase shall remove what it replaces in the same pull request. | judgement | PR deletes the legacy code it replaces. |
| MIG-015 | Phase 4 pages may live at their new routes while the old DJInterface stays at / until Phase 4 ends, and no other flags shall be used. | judgement | No feature flags apart from this routing arrangement. |
| MIG-016 | ESLint no-alert shall pass, one dialog at a time shall be enforced (test), and no zIndex of three or more digits shall remain. | lint | eslint no-alert passes; dialog test passes; zIndex grep empty. |
| MIG-017 | There shall be one primary button per view (lint test on rendered DOM). | dom | Each rendered view has exactly one primary button. |
| MIG-018 | Pages shall be snapshot-tested in dark, light and booth themes and shall show no horizontal scroll at phone width 375. | visual | Snapshots pass in three themes; no horizontal scroll at 375px. |
| MIG-019 | Switching theme shall recolour the graph canvas without reload and GraphVisualization.tsx shall contain no hex literals. | lint | Theme switch recolours canvas; grep hex in file empty. |
| MIG-020 | Stylelint shall forbid hex outside the design-system, the emoji grep shall be empty and the bundle size shall not be larger than before Phase 0. | lint | Stylelint, emoji grep and bundle-size checks pass. |
| MIG-021 | Phase 0 shall show no theme flash on reload (Playwright first-paint screenshot) and no external font or CDN requests (Lighthouse). | visual | First-paint screenshot has correct theme; Lighthouse shows no external font/CDN requests. |
| MIG-022 | Domain code shall be tested so that the 24 keys round-trip camelot(keyName(c)) === c, legacy_0_1 0.73 converts to 7, and no reference remains to camelotData, getEnergyColor or COMPATIBILITY_PROPS. | lint | Unit tests pass; grep in src empty. |
| MIG-023 | Shell routing shall make every route reachable from the drawer, Back/Forward shall restore filters, tab and mode, and axe shall report zero serious violations. | dom | Route reachability test, history test and axe pass. |
