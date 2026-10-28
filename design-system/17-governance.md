# Governance

One owner (Markus), two products, several agents writing code. These rules keep the system the single source of truth, make changes traceable, and stop drift.

## Versioning

The design system has one version number, [semver](https://semver.org) `MAJOR.MINOR.PATCH`, stored in `tokens.json` (`"version"`) and exposed as `SongNodes.version` in `bundle.js`. Both must match; the build fails if they differ. (`tokens.json` currently holds the integer `1`; set it to `"1.0.0"` in `source/build_tokens.py`.)

| Change | Bump | Examples |
|---|---|---|
| Rename or remove a token, class, component, prop or helper; change a token's meaning; change a status mapping so a raw enum lands on a different status | Major | `mod-harmony` renamed; `.sn-pill[data-status="warn"]` removed; `pending` → `warn` |
| Add a token, class, component, prop, icon, theme or helper; add a status mapping | Minor | `key-*` added; `RangeSlider` added; `shuffle` icon added |
| Change a value without changing meaning: contrast fix, spacing tweak, copy fix, bug fix | Patch | `fg-3` dark #9a9a9a → #9c9c9c |

- Deprecate before removing: keep the old name as an alias (`"{new-name}"` in `tokens.json`, a CSS selector list for classes) for at least one minor release, mark it `Deprecated in 1.4.0, removed in 2.0.0` in its usage note, and list it in the change log.
- Consumers pin an exact version. SongNodes records the version it synced in `frontend/src/styles/design-system/VERSION`.
- Export schemas (`schemaVersion` in JSON exports) are versioned separately with the same rules.

## Change log

Newest first. Each entry: version, date (Melbourne), one line per change, prefixed Added / Changed / Deprecated / Removed / Fixed, with the decision record if any.

**1.2.0 — 28 Oct 2026: completions, preview player, presets and keyboard rows**
- Added `AutocompleteSearchField` (Inputs): a SearchField whose input is a WAI-ARIA combobox with a grouped listbox of recent searches and suggestions (`.sn-autocomplete`, `__popup`, `__list`, `__group`, `__group-label`, `__option`, `__icon`, `__text`, `__meta`, `__foot`, `__clear`). Needed by UX4, UX5, UX6.
- Added `MiniAudioPreview` (Music): a 32px preview player with paused, loading, playing and unavailable states and one-at-a-time playback (`.sn-mini-preview`, `__btn`, `__track`, `__fill`, `__time`; `--sn-mini-preview-pct`). Needed by FL4 and the Space action of FL1.
- Added the FilterChip preset variant: a saved filter view as an apply chip joined to a delete button (`.sn-filter-chip-preset`, `__remove`), in a "Presets" group with "Save current filters". Needed by FL3.
- Added DataTable keyboard row navigation: `tr[data-active]` (2px `focus` outline, separate from selection) and the focusable box `.sn-data-table__box[data-keyboard]`, with J/K, arrows, Enter, Space, T and X. Needed by FL1. New optional DataTable props: `keyboard`, `activeRowId`, `onActiveRowChange`, `onRowOpen`, `rowShortcuts`.
- Fixed (closes EX-001): in dark the AppHeader wordmark uses `brand-strong` (#b4a2dc, as dark links do, DR-022) instead of `brand` (4.33:1 on `surface-1`). Light and booth keep `brand`. Decided by Markus, 28 Oct 2026.
- Changed (closes EX-002): LauncherCard is a `div.sn-card` whose title holds the link `.sn-launcher-card__link`, stretched over the card with `::after`; focus and hover show on the card via `:has()`. The link's name is its visible title (WCAG 2.5.3). Decided by Markus, 28 Oct 2026.
- No token changed; every new class uses existing tokens.

**1.1.4 — 28 Oct 2026: settings cards and sub-routes**
- Changed: SettingsPage is a card overview at `/settings` with a filter `SearchField`, plus one page per setting at `/settings/:settingId` (`streaming-services`, `api-keys`, `display-preferences`, `data-storage`, `about-system`), replacing the single page with anchors. 02, 10, 13 and the SettingsPage card updated.
- Added: accessibility guidance for card overviews with detail sub-routes (focus return, live result count, two ways back) to 06. No token, class or helper changed.

**1.1.3 — 27 Oct 2026: page container and the sn- namespace**
- Added the Page container rule to 13-page-patterns: every page root is `main.sn-page__main` (`sn-page-error`, `sn-page-auth` for those patterns; the graph canvas is the only full-bleed page).
- Added "The sn- namespace" below: only classes the bundle defines may carry the `sn-` prefix; spacing comes from tokens or defined classes, never from invented utilities such as `sn-mb-3` or `sn-p-5`.
- Added three conformance checks: page container and undefined `sn-*` classes (static, CI) and the rendered page gutter (Playwright). No token, class or helper changed.

**1.1.2 — 27 Oct 2026: filter chip contrast**
- Fixed: a FilterChip that is both selected (`aria-pressed="true"`) and empty (`data-empty`) kept the empty chip's `--fg-3` text on the selected `--fg` fill (2.4:1 dark, 2.8:1 light). The empty text colour now applies only to unselected chips; the dashed border still marks every empty chip. No token changed.

**1.1.1 — 25 Oct 2026: exceptions register**
- Added the approved exceptions EX-001 (AppHeader wordmark contrast in dark) and EX-002 (LauncherCard accessible name) to the register under Open questions. No token, class or helper changed.

**1.1.0 — 24 Oct 2026: open questions answered**
- Changed `now` to its own amber token; selected stays brand lavender (DR-024).
- Changed booth statuses to the traffic-light set used in dark and light (DR-018 revised).
- Changed `chart-1…8` to an Okabe-Ito based palette (DR-025).
- Added graph "Colour by" modes (Neutral default, Energy, Key, Genre) to `GraphControls` (DR-026).
- Changed finished `StagedProgress` steps to `status-ok` green; energy tier chips to a mini three-segment bar; filter rail visible from 1024px; library default columns without Last heard; tooltip shows at once on keyboard focus.
- Changed copy: "TIDAL" in capitals, "65%" without a space, weeks start Monday.
- Changed rotation to be calculated by the weekly run from play data (DR-027).
- Removed the 3D graph and Camelot helix (DR-028).

**1.0.0 — 24 Oct 2026: first release**
- Added tokens for three themes (dark, light, booth), eight module hues, status, compatibility, energy 1–10, Camelot keys 1A–12B, charts, spacing, radius, shadow, size, z-index, motion, breakpoints, opacity (DR-001…DR-020).
- Added `00-core.css` primitives and the `SongNodes` helper bundle (icons, Camelot, compat, energy and BPM steps, formatting, status map, preferences).
- Added the component catalogue (navigation, inputs, data and music, charts, feedback and surfaces, pages) and guideline sections 01–19.
- Added Lucide 1.53 icon subset (109 icons) and self-hosted Sora, Inter, JetBrains Mono.

## Decision records

Every choice that a reasonable person could make differently gets a decision record (DR). Format, after MADR, kept short:

```
### DR-NNN Title (status: accepted | proposed | superseded by DR-MMM | open)
Date · Decided by
Context: the problem and the forces, two or three sentences.
Options: the options considered.
Decision: the chosen option, as a rule.
Consequences: what this makes easy and hard; what to check.
```

Records are append-only. To change one, write a new DR that supersedes it and update the old status. DR-001…DR-016 were chosen by Markus on 24 Oct 2026 on the decisions page; DR-017…DR-020 were made while building and are open to him to overturn.

| DR | Topic | Decision | Status |
|---|---|---|---|
| DR-001 | Ground | Charcoal (Elektronauts): `bg` #222, `surface-1` #2d2d2d, `surface-2` #373737 | Accepted, Markus |
| DR-002 | Themes | Dark (default), light and high-contrast booth mode; system follows the OS; choice remembered per device | Accepted, Markus |
| DR-003 | Type | Sora titles and figures + Inter body (JetBrains Mono for data) | Accepted, Markus |
| DR-004 | Title style | Thin–bold: Regular 400 dimmed lead-in + colon → Bold 700 title | Accepted, Markus |
| DR-005 | Module colours | Studio palette: each module owns one hue for icon, links and tonal cards | Accepted, Markus |
| DR-006 | Card shape | 14 / 8 / 4: cards 14px, controls 8px, chips 4px (sheets 18px, pills full) | Accepted, Markus |
| DR-007 | Card colour | Tonal: module card fill, border, text, chips and secondary buttons in module shades; only status breaks out | Accepted, Markus |
| DR-008 | Navigation | Left drawer from a hidden hamburger; no visible nav bar or site tabs | Accepted, Markus |
| DR-009 | Links | Always underlined, in the destination module colour, weight 600 | Accepted, Markus |
| DR-010 | Energy | Ten-step heat, indigo → amber, tiers 1–4 / 5–7 / 8–10 | Accepted, Markus |
| DR-011 | Compatibility | Traffic light (perfect, compatible, possible, clash) with mandatory glyph and word | Accepted, Markus |
| DR-012 | Keys | Camelot wheel colours: dot + code, name in detail | Accepted, Markus |
| DR-013 | Density | Comfortable 40px rows + compact 32px option saved per person | Accepted, Markus |
| DR-014 | Brand | Lavender #9b85cb: wordmark, the one primary button, focus, selection | Accepted, Markus |
| DR-015 | Locale | en-AU, Australia/Melbourne, 24-hour | Accepted, Markus |
| DR-016 | Icons | Lucide, 2px stroke, no emoji | Accepted, Markus |
| DR-017 | Harmony and sources hues | Key & mood moved from lavender #9b85cb to teal #5fb8b0, and Sources nudged to #8fbf6b, so no module shares the brand hue and the two stay apart | Accepted, Markus (DR-021) |
| DR-018 | Colour-blind safety | Booth theme uses blue/orange statuses as the colour-blind-safe theme; dark and light keep the traffic light with mandatory glyphs and words | Superseded: booth uses traffic light (see below) |
| DR-019 | Dark link colour | Generic `link` uses `brand-strong` in dark because `brand` #9b85cb is 4.34:1 on `surface-1` (below 4.5:1) | Accepted (builder) |
| DR-020 | Camelot mapping | Standard Camelot mapping (1A = A♭ minor … 8A = A minor, 8B = C major); `utils/camelotData.ts` is wrong and is replaced | Accepted (builder) |

### DR-017 Harmony and sources hues (status: accepted, DR-021)
24 Oct 2026 · build agents
Context: The Studio palette gave Key & mood the same lavender as the brand, so links to Key & mood looked like generic links and the primary button looked like a Key & mood action.
Options: keep lavender; teal #5fb8b0; pink (taken by Pathfinder).
Decision: teal #5fb8b0 for Key & mood; Sources nudged to #8fbf6b to stay distinct from the new teal.
Consequences: brand lavender has one meaning. If Markus prefers lavender for Key & mood, the brand must move instead.


### DR-021 to DR-030 — answers of 24 Oct 2026 (second choices page and chat)
| # | Decision |
|---|---|
| DR-018 (revised) | Booth uses the same traffic-light status colours as dark and light; glyph and word are always shown. |
| DR-021 | Key & mood stays teal `#5fb8b0`; Sources `#8fbf6b`. |
| DR-022 | Dark-theme links use `brand-strong` `#b4a2dc`. |
| DR-023 | Wordmark is plain text; Home is the first drawer row. Home page has no module band. |
| DR-024 | "Now" is amber (`now`), never lavender; "selected" is brand lavender. |
| DR-025 | Chart series use the Okabe-Ito based palette. |
| DR-026 | Graph node colour is selectable (Neutral default, Energy, Key, Genre). |
| DR-027 | High rotation and Vault are calculated each weekly run from play data, never hard-coded. Fitted to the 24 Oct 2026 library (all 294 tracks reproduced): High = heard on 2+ different shows in the window, or on the ARIA Club Chart for 4 weeks or fewer. Vault threshold is learned once 8+ weeks of history exist: the larger of the 90th percentile of gaps between repeat plays and 3× the median show cadence. |
| DR-028 | 3D graph and Camelot helix retired. Modes stay "Play" / "Plan". |
| DR-029 | Phone tables become stacked cards; medium and large dialogs become full-screen sheets on phones; priority shows as neutral tags with only Critical in red; finished staged steps are green; tier chips use a mini three-segment bar. |
| DR-030 | Copy: "TIDAL"; "65%"; weeks start Monday; visited links unstyled; tooltips appear at once on keyboard focus (500 ms on hover); filter rail visible from 1024px; library default columns exclude Last heard; Settings is one page with anchors; the 50x page prints a request ID via nginx SSI; radio show times come from the library's source data; the conflicting shortcuts are removed; monitoring covers full pipeline health; favicon is "SN" in Sora 800 on a lavender tile. |

## How rules are derived

1. Markus's own decisions (DR-001…DR-016) and his past corrections win.
2. Then what the existing artifacts already do (the Naarm Set Builder: tiers, set shapes, transition rules, rotation, weekly run) — fit the rule that reproduces them, do not invent a new value.
3. Then the SongNodes code where it is correct (e.g. `utils/harmonic.ts` Camelot table, backend status enums).
4. Then platform standards (WCAG 2.2 AA, WAI-ARIA Authoring Practices, Lucide conventions).
5. Taste last, and recorded as an open question when it matters.

## Open questions

All questions raised at the 1.0.0 release were answered on 24 Oct 2026 (DR-018 revised, DR-021 to DR-030). One remains open:

| # | Question | Options | Default until answered |
|---|---|---|---|
| Q9 | Score bands for recommendations | 80/60/40 (current code) · fit to Markus's accepted picks | 80/60/40 until enough accepted picks exist to fit, then fitted from his own picks |

### Approved exceptions

| # | Rule | Why | Scope | Approved | Expires |
|---|---|---|---|---|---|
| EX-001 | WCAG 1.4.3 text contrast (axe `color-contrast`) | The AppHeader wordmark is the SongNodes logotype (section 14: the identity is the wordmark), and WCAG 1.4.3 exempts logotypes. Dark `brand` #9b85cb on `surface-1` #2d2d2d measures 4.33:1. | `.sn-app-header__wordmark`, all themes; SongNodes checks it in `frontend/tests/e2e/accessibility.spec.ts` | Markus, 25 Oct 2026 | Closed in 1.2.0 (fixed) |
| EX-002 | WCAG 2.5.3 label in name (axe `label-content-name-mismatch`) | `LauncherCard` names its link from the title only (`aria-labelledby="lc-t"`), so the visible module label is not part of the accessible name. Kept as specified until the markup is decided. | `.sn-launcher-card` links (HomePage); same test file | Markus, 25 Oct 2026 | Closed in 1.2.0 (fixed) |

## The sn- namespace

- The `sn-` prefix belongs to the design system. App code may use an `sn-*` class only if `components/bundle.css` (or a SongNodes stylesheet that implements a documented pattern) defines it.
- There are no spacing utility classes (`sn-mb-*`, `sn-mt-*`, `sn-p-*`, `sn-gap-*`, `sn-u-*`). Spacing comes from the component or page pattern, or from a `var(--space-*)` token in a feature stylesheet or inline style.
- Feature-local classes use the feature's own prefix (`ttm__`, `mte__`, `pf-`), never `sn-`.
- A class name that nothing defines fails silently: the element renders with no padding, gap or margin. This is why the checks below fail on it rather than warn.

## Distribution and staying in sync

- This design-system artifact is the source. Nothing is edited downstream.
- Regenerate: `python3 source/build_tokens.py` (writes `tokens.json`, `tokens.css`, prints the contrast report) and `python3 source/build_bundle.py` (inlines icons, concatenates `source/css/*.css` into `components/bundle.css`, writes `components/bundle.js`).
- SongNodes consumes `tokens.css`, `components/bundle.css`, `components/bundle.js`, `fonts/` and `source/types/*.d.ts` copied into `frontend/src/styles/design-system/` by `scripts/sync-design-system.sh` (copies, writes `VERSION`, fails if the version went backwards). Import order in `main.tsx`: `tokens.css`, then `bundle.css`, then app CSS modules. React components mirror the markup and classes; they import helpers from a typed wrapper around `bundle.js`.
- The music library (Naarm Set Builder) and other artifacts load the same three files and fonts from the artifact's own files, never from a CDN.
- A sync is a normal pull request: version bump in the title, change log excerpt in the body.

## Conformance checking

Automated (CI on SongNodes, script on the design system):

| Check | Tool | Fails when |
|---|---|---|
| No raw colours | stylelint `color-no-hex` + `declaration-property-value-disallowed-list` outside `styles/design-system/`; ESLint rule banning hex strings in `.tsx` | Any hex, `rgb()` or named colour in app code (allow list: third-party brand assets) |
| No emoji | `grep -P` over `src/` for emoji ranges (U+1F300–1FAFF, U+2600–27BF) | Any match outside comments |
| No `alert`/`confirm` | ESLint `no-alert` | Any call |
| Accessibility | axe-core in Playwright on every route and theme | Any serious or critical violation |
| Contrast | `build_tokens.py` contrast report | Any listed pair below 4.5:1 (3:1 for large text and UI edges) |
| Visual | Playwright snapshots of every `preview.html` in dark, light, booth; and key routes | Diff above threshold without an approved update |
| Version sync | build script | `tokens.json` and `SongNodes.version` differ |
| Page container | `scripts/check_design_system.py` | A `<main>` without `sn-page__main`, `sn-page-error` or `sn-page-auth` (exception comment allowed only for the graph canvas) |
| Undefined classes | `scripts/check_design_system.py` | An `sn-*` class in app code that no stylesheet defines; existing debt is listed in `frontend/design-system-layout-baseline.txt`, which may only shrink |
| Page gutter (rendered) | Playwright `design-rules.spec.ts` on every shell route except the graph | The page has no side gutter, or visible text starts within the gutter of the window edge |

Manual: run the pre-release checklist in Accessibility and quality (section 09) before each minor or major release.

## Exceptions

- Request an exception in the open questions register with: what rule, why, scope (file, component, page), and an expiry date or release.
- Markus approves or declines; approved exceptions get an `EX-NNN` row in the register and a code comment `/* design-system exception EX-NNN */` at the site.
- Exceptions expire; at expiry the code conforms or a new DR changes the rule.
- Third-party widgets in Platform are standing exceptions and need no request.
