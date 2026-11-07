# Design system inventory (Phase 0)

The data-flow report, its diagrams and its PDF are built only from the **SongNodes design system**, the single source of truth for SongNodes and the music library (`CLAUDE.md` §4, `songnodes/design-system/README.md`, published design-system artifact `7f37707d…`).

| Item | Value | Evidence |
|---|---|---|
| Source | `songnodes/design-system/` (mirrors the published design-system artifact) | `CLAUDE.md` §4 |
| Version used | **1.10.0** (raised from 1.9.1 by this investigation, see "Changes made") | `design-system/tokens.json:3`, `components/bundle.js` `SongNodes.version` |
| Load order | `tokens.css` → `components/bundle.css` → `components/bundle.js` (`window.SongNodes`) | `design-system/README.md` "Use it" |
| Standalone pattern | inline the three files, fonts embedded as base64 `@font-face` | `docs/design-system/build_standalone.py:1-60` |
| Frontend copy | `frontend/src/styles/design-system/` via `scripts/sync-design-system.sh` (`--check` is a CI gate) | `.github/workflows/design-system.yml:36` |
| Reference pages | `design-system/components/HomePage/preview.html` (shell: AppHeader, NavDrawer, PageHeader, FigureTile row, cards), `LibraryPage/preview.html` (DataTable, FilterChip), `docs/design-system/reference.html` | files |

## Tokens (dark theme counts; light and booth carry the same names)

| Group | Tokens | Examples (dark) |
|---|---|---|
| Ground and surfaces | `bg`, `surface-1..3`, `sunk`, `line`, `line-strong`, `overlay`, `hover-bg`, `flag-bg` | `bg` #222222, `surface-1` #2d2d2d |
| Text | `fg`, `fg-2`, `fg-3`, `fg-disabled` | `fg` #f9f9f9 |
| Brand and focus | `brand`, `brand-strong`, `brand-soft`, `on-brand`, `link`, `focus` | `brand` #9b85cb (lavender) |
| Modules (8 × 6 + `on-mod-*`) | `mod-<key>`, `-bg`, `-raised`, `-line`, `-ink`, `-muted` for graph, library, sets, paths, harmony, sources, pipeline, services | `mod-graph` #6fa8dc |
| Status | `status-ok|fair|warn|bad|info` and `-bg` | `status-bad` #ff7469 |
| Music | `energy-1..10`, `key-1a..12b`, `compat-*`, `now`, `sim` | — |
| Charts | `chart-1..8` (Okabe–Ito based, colour-blind safe), `chart-grid`, `chart-axis`, `chart-ref` | `build_tokens.py:97` |
| Graph | `graph-edge-w-1..4`, `graph-edge-op-1..4`, `graph-edge-dim`, ring/hood layout tokens | — |
| Type | `font-display` (Sora), `font-body` (Inter), `font-data` (JetBrains Mono); sizes are classes: `title-l` 1.75rem, `title-m` 1.375rem, `title-s` 1.125rem, `body`, `body-s`, `label` | `bundle.css:55-57` |
| Space | `space-0..16` (4px scale) | — |
| Radius | `radius-chip` 4, `radius-control` 8, `radius-card` 14, `radius-sheet` 18, `radius-pill` | README "Shape" |
| Shadow / elevation | `shadow-1` cards, `shadow-2` menus, `shadow-3` drawers and dialogs; `z-base … z-tooltip` | README "Depth" |
| Size and layout | `header-h`, `drawer-w`, `rail-w`, `content-max`, `prose-max`, `row-comfortable|compact|two-line`, `control-sm|md|lg`, `touch-min`, `bp-phone … bp-wall` | — |
| Motion and opacity | `duration-instant|fast|base|slow`, `ease-standard|exit`, `opacity-*` | — |

## Layout shell and components used by the report

- **Shell:** `.sn-page` → `.sn-skip` link → `AppHeader` (`.sn-app-header`, 56px sticky, hamburger, wordmark "SongNodes", thin–bold page title) → `NavDrawer` (`.sn-nav-drawer`, the only site navigation; groups Make, Explore, Collect, System) → `main.sn-page__main` → `PageHeader` (`.sn-page-header`, thin–bold title-l, description, freshness stamp) → `.sn-page__section` blocks with `SectionHeading`.
- **Titles:** `<h2 class="sn-title title-m"><span class="sn-lead">Lead:</span> Title</h2>` everywhere.
- **Tables:** `DataTable` (`.sn-data-table`, sticky header, sortable `aria-sort` headers, numeric columns right-aligned mono), filters with `FilterChip` and `SearchField`.
- **Cards and figures:** `Card` (`.sn-card`, 14px, `shadow-1`, hairline border), `FigureTile` row for headline metrics.
- **Badges:** `StatusPill` (glyph + word, `data-status`), `CategoryTag` (neutral kind tags). Status colour only means state.
- **Disclosure and tabs:** `Disclosure` (native `details`/`summary`) for evidence; `Tabs` (`.sn-tabs`) for personas.
- **Links:** `TextLink` (`.sn-link`, underlined, module colour via `sn-m-<key>`).
- **Images:** `MediaViewer` for click-to-enlarge diagrams.

## Light and dark

Dark is the default; Light and Booth via `data-theme`; System follows the OS through `@media (prefers-color-scheme: light)` on `:root:not([data-theme])`. `SongNodes.prefs.init()` runs inline in `<head>` before first paint and applies the saved theme, text size, density and motion. The report supports all four through the design system's own `PreferencesPanel` choices.

## Print

- Light token values re-declared under `@media print` (generated into `02-theme-media.css` by `build_tokens.py`).
- `PrintSheet` (`.sn-page-print`): A4 portrait `@page { margin: 14mm 12mm 18mm }`, repeated `thead`, no split rows, traceability footer.
- **Gap found:** the generic print rules for every other page (*Print and export*, "Print rules") and the named landscape page `@page wide` were documented but not built; they applied only inside `.sn-page-print`.

## Changes made to the design system (single source, separate commit)

**1.10.0** — `design-system/source/css/62-print-document.css`, rebuilt with `build_tokens.py` and `build_bundle.py`, re-synced to the frontend (`sync-design-system.sh --check` passes, contrast report passes):
- generic print rules for every page (shell hidden, closed `details` and hidden tab panels print open, headings kept with what follows, cards/figures/rows unsplit, repeated header rows, external link hosts);
- `@page wide` (A4 landscape) and the class `sn-print-wide`;
- fixed the stale note in `15-print-export.md`; change log in `17-governance.md`.

The published design-system artifact must take the same change to stay mirrored (listed in the handover).

## Values that cannot read CSS variables

`@page` margins and the PDF running header and footer cannot use `var()`. The build reads those values from the design system at build time (`tokens.json` and the design system's own `@page` rules), so they still come from the single source.
