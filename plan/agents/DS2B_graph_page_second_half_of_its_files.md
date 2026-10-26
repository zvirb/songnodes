DS2B: Design system audit and fix: Graph page, second half of its files

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md (section 4, the design system, is mandatory). No access to the user's laptop, local data or secrets; work from the repo only. Open one PR against main; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:DS2B BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below.

## Scope
Page or area: Graph page, second half of its files. Route: /graph.
Review EVERY file listed under Owned paths for deviations from the SongNodes design system, and fix them. Read the page the way a user sees it: layout, every state (loading, empty, error, populated), every control, every piece of copy.

## Read first
1. design-system/README.md, then the sections that apply: 01-writing, 03-colour, 04-typography, 05-layout, 06-interaction-accessibility, 07-feedback-status, 08-motion, 10-navigation, 11-data-display, 12-inputs, 13-page-patterns, 14-identity-icons, 18-music-domain, 19-songnodes-migration.
2. design-system/tokens.css (the real token names; grep it, never copy a name from memory or from another file) and design-system/api/components/<Comp>.md plus design-system/components/<Comp>/README.md for every component you use or could use.
3. docs/design-system/EXCEPTIONS.md (registered exceptions EX-001, EX-002) and frontend/design-system-pending.txt.

## Check each file for
- Colour: hex, rgb()/hsl(), named colours, legacy `--color-*` variables, Tailwind colour classes. Use `var(--token)` or `sn-*` classes.
- Type: px or rem font sizes, wrong families (Sora titles with a dimmed lead-in plus bold title, Inter body, JetBrains Mono for BPM, keys, durations and IDs), raw font weights.
- Spacing, radius, shadow, z-index, motion duration/easing, breakpoints: ad-hoc numbers instead of tokens. Touch targets 44px, visible focus, reduced motion respected, valid at 360px width.
- Components: hand-built markup where a shipped component exists (DataTable, KeyBadge, EmptyState, Dialog, ConfirmDialog, Toast, CamelotWheel, EnergyBar, StatusPill and so on). New Tailwind classes. Inline `style` for values that belong to tokens.
- Interaction: `alert`, `confirm`, `prompt`; more than one primary button per view; site navigation other than the NavDrawer.
- Formatting: dates, durations, counts, BPM, keys, energy and statuses must go through `SN.format`, `SN.camelot`/`keyName`, `SN.compat`/`energyStep`/`bpmStep`, `SN.status`, `EnergyBar`, `KeyBadge`, `Bpm`, `StatusPill`. Statuses show a glyph plus a word; no colour-only meaning.
- Writing: en-AU spelling, sentence case (no Title Case labels), Australia/Melbourne 24-hour time, no emoji, Lucide icons plus a word, missing values as an en dash (`sn-none`), never "N/A" or "Unknown".
- Accessibility: WCAG AA contrast, names for icon-only controls, focus order, labels on inputs, roles for custom widgets.

## Fix what you can, report what you cannot
- Fix every deviation inside the owned paths with existing tokens, `sn-*` classes and shipped components. Behaviour must not change except where the design system requires it (for example replacing `confirm()` with `ConfirmDialog`).
- NEVER invent a token name and NEVER edit design-system/ or frontend/src/styles/design-system/ (the synced copy). If the system has no token, class or component for something the page needs (a missing colour step, size, radius, shadow, z-index layer, motion value, icon, component or pattern), do not hack around it: keep the file working, and record it as a MISSING TOKEN or MISSING COMPONENT finding (below). A conflict the system does not settle is a change to the system at its source, which the maintainers decide.
- Where a value is only close to an existing token, say so and use the token only if the visual difference is imperceptible; otherwise report it.
- frontend/design-system-pending.txt: you may only REMOVE lines for files you fully migrated or deleted. Never add a line.
- Do not edit files outside the owned paths. If a deviation lives in a file another package owns, list it under "Elsewhere" in your audit file.

## Audit file (required)
Create docs/design-system/audits/DS2B.md with these sections, in this order:
1. Summary: files reviewed (all of them, by path), deviations found, fixed, left open.
2. Findings table: file, line, rule (section of the design system), what was wrong, fixed (yes/no), how.
3. MISSING TOKENS: one row each: the value or need found, where it is used (file:line), what token name the design system would need (propose a name that follows the naming pattern in tokens.css; mark it a proposal), the nearest existing token and why it is not enough, and which design-system section would own it.
4. MISSING COMPONENTS AND PATTERNS: same layout.
5. Exceptions requested: anything that should be registered in docs/design-system/EXCEPTIONS.md, with a reason.
6. Elsewhere: deviations seen in files you do not own.
7. Could not check: states you could not reach statically, and checks you could not run.

## Owned paths
- frontend/src/components/IntelligentBrowser/utils.ts
- frontend/src/components/MobileTrackExplorer.css
- frontend/src/components/MobileTrackExplorer.tsx
- frontend/src/components/PathfinderPanel.css
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
- frontend/src/utils/serverPath.ts

(Files listed are the complete set. Test files may be updated only to keep them passing after your fixes.)

## Checks (run all you can; say which you could not)
- `cd frontend && npm ci && npx tsc --noEmit -p . && npx vitest run src && npx vite build`
- `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
- a grep of your changed files for hex colours, rgb(, px font sizes, z-index numbers and `var(--` names that are absent from design-system/tokens.css (report the result)
- Playwright visual/E2E tests cannot run in your sandbox; say so.

## Hand-back
What was fixed, what is open, the number of missing tokens/components reported, and anything the wiring or token-consolidation package (DS16) needs to know.
