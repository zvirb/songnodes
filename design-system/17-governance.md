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

**1.6.0 — 2 Nov 2026: explain once, every warning links to its source, go icons (imported from BeanAlliance v4.18 to v4.20.2, asked for by Markus 2 Nov 2026)**
- Added `InfoTip` (Feedback): an explanatory notice shrunk to one `info` button (24px, `fg-2`, no `title`) where the text was; the words move verbatim into a tooltip (40 words or fewer, the `Tooltip` look, opens on hover, keyboard focus and tap, a tap pins it) or a panel (the `Popover` look, 24rem, click, tap, Enter or Space only, never hover); one open per page; Escape closes; under 768px both sit at the bottom of the screen; never printed. Classes `.sn-infotip`, `__btn`, `__tip` (`--up`, `--end`, `--static`), `__panel` (`--static`), `__close`; helpers `SongNodes.infoTip`, `SongNodes.infoTips` (DR-038).
- Changed: every field's help is an `InfoTip` after its label, however short; a caveat on a figure, today's included, may be one; long method text is the panel form (DR-039). New `.sn-text-field__head` / `.sn-field__head` (label, InfoTip, count). 01-writing, 09-cognitive-load, 12-inputs, `TextField`, `SectionHeading`, `Tooltip` updated.
- Deprecated `.sn-field__help` for guidance (kept for a value a field reports back), removed in 2.0.0. Still to move to InfoTips (their help or notes still sit under the control in this release): `Checkbox` (`__hint`), `Switch` (`__desc`), `PreferencesPanel` (`__note`), `PeriodNav` (`__hint`), `ChartFrame` (`__note`), `PageHeader` (`__desc` when over one line), and the field help in `SettingsPage`; in the app, `SettingsPanel.tsx` and `APIKeyManager.tsx` move in phase 4 of the migration. Each needs its words checked against the never-list before it moves.
- Added: every warning links to its source. Warn and bad `Banner`s and `InlineMessage`s, a stale `FreshnessStamp` phrase, a flagged row's reason and a data-caused `ErrorState` end with one `a.sn-link.sn-link--src` naming the page and place where the cause is changed; another module opens in a new tab; a banner whose own button fixes it here needs none (DR-040). Helper `SongNodes.sourceLink`.
- Changed: every banner can be dismissed, `bad` included (was: not dismissable); a dismissed warn or bad banner, or boxed warn or bad `InlineMessage`, shrinks to its status icon in place (`.sn-dismissed`), until the next day in Melbourne or until its fact changes; a bad banner also returns when the blocked action is tried again; info and ok banners go entirely (DR-041). Helper `SongNodes.dismissal`; `BannerProps.factKey`, `BannerProps.source`, `InlineMessageProps.source`, `onDismiss`, `factKey`.
- Added go icons: the target module's icon at 84% with a half-size `external-link` badge, in the module colour, leading every source link to another page (`.sn-go`, `__glyph`, `__badge`; `SongNodes.goIcon`). No new icon file: built from the existing set (DR-042).
- Not adopted from BeanAlliance, with the reason: warn and crit toasts and their source links (SongNodes toasts are confirmations only, 07-feedback-status); `zebra` and `PrintLabel` (v4.17.4: thermal carton labels for Zebra printers; SongNodes prints no labels); the board-specific "next working day" (SongNodes has no plant calendar, so a dismissal lasts until the next calendar day, Q23).
- No token changed; every new class uses existing tokens. Contrast: module colours hold 4.5:1 as text on `bg`, `surface-1` and every `status-*-bg`, and 3:1 as icons on every ground; source links are kept off `surface-2`, where dark Pathfinder text is 4.02:1.

**1.5.0 — 30 Oct 2026: graph layout and link strength (chosen by Markus from the Graph Strength Options page, 30 Oct 2026)**
- Changed: the graph is laid out on rings around now playing, not by a force simulation. Distance only orders tracks: the strongest links take the closest seats, weaker ones move out when those are taken, and every seat keeps its node and label clear (GraphStyles → Layout; DR-034).
- Changed: link strength is drawn as four bands of width and opacity (1 / 2 / 3.5 / 6px, 0.35 / 0.55 / 0.8 / 1), replacing "width = 0.5 + 7.5 × weight" in GraphStyles and "1–4px" in Music domain. Weak links show only when one of a track's two strongest, touching now playing, or touching the hovered or selected track (DR-035).
- Added: band cut points fitted to the library each weekly run: quartiles, cross-checked by natural breaks (DR-036).
- Added tokens `graph-edge-w-1…4`, `graph-edge-op-1…4`, `graph-edge-dim`, `graph-ring-first`, `graph-ring-step`, `graph-ring-aspect`, `graph-seat-gap`, `graph-label-zoom` (new `graph` family); classes `.sn-graph-styles__edge--b1…b4`, `--dim`, `.sn-graph-styles__ring-guide`; helpers `SongNodes.edgeBand`, `fitEdgeCuts`, `edgeVisibility`, `seatBox`, `ringLayout`, `EDGE_BAND_LABEL`, `EDGE_CUTS_DEFAULT`.
- Deprecated `.sn-graph-styles__edge--strong` (now an alias of `--b4`), removed in 2.0.0. `opacity-edge` now applies only to link samples drawn without a band.
- Fixed: Data display's edge table (dash 4 3, dotted collaboration, compat-coloured key links) and Music domain's hovered/selected ring widths now match GraphStyles.
- Labels keep today's rule: shown on hover, selection, now playing and for all nodes at zoom > 1.5 (DR-037).
- GraphStyles, GraphControls and GraphExplorerPage previews redrawn with the ring layout and strength bands.

**1.4.0 — 28 Oct 2026: drag and drop, stalled loads, CSV guard, no printed paths (imported from BeanAlliance v4.15, v4.17 and v4.17.1, chosen by Markus 28 Oct 2026)**
- Added `DragDrop` (Inputs): one pattern for reordering the running order and dragging crate tracks into a set: `grip-vertical` handle, 4px threshold, name-only ghost, dashed `brand` target with the outcome in words, insertion line, locked slots refuse and say why, Space / arrows / Enter / Escape, Undo toast (`.sn-drag-handle`, `.sn-drag-origin`, `.sn-drag-ghost`, `__name`, `--static`, `[data-locked]`, `.sn-drop-target`, `.sn-drop-text`, `.sn-drop-line` in the new `source/css/35-drag-drop.css`).
- Added `SongNodes.csv` (`cell`, `row`, `file`, `BOM`, `EOL`): the formula guard prefixes typed or scraped text starting with `=`, `+`, `-`, `@`, tab or carriage return with an apostrophe, before quoting; numbers the export writes are untouched; the BOM, sentence-case header and timestamped name stay (DR-033). 15-print-export updated.
- Added the `stalled` StagedProgress step state (▲, `status-warn`): a load fails only after 60 s with no progress from the current step, never on elapsed time; Try again resumes from that step; a refresh with data on screen never shows a loading screen. LoadingState, ErrorState, FreshnessStamp and 07-feedback-status updated.
- Changed: a page never prints a file or folder location; places are named in words, and only an icon-only CopyButton in a file's row carries the path in its tooltip (01-writing "File paths and system locations"; CopyButton, FileDrop, LogPage, MonitoringPage, PrintSheet, SettingsPage, TextLink updated).
- Recorded DR-031 (calendar-day count), DR-032 (AppHeader 8px on phones), DR-033 (CSV conventions kept).

**1.3.0 — 28 Oct 2026: date ranges on a calendar, text inset (imported from BeanAlliance v4.17–v4.17.3)**
- Added `DateRange` (Inputs): the from–to calendar popover, ported from BeanAlliance DateRange and fitted to SongNodes (`.sn-date-range` and parts `__body`, `__months`, `__month`, `__head`, `__title`, `__spacer`, `__next`, `__grid`, `__dow`, `__day` with `[data-range=start|end|in|single]`, `[data-today]`, `[data-mark]`, `__n`, `__mark`, `__dot`, `__presets`, `__key`, `__code`, `__now-bar`, `__foot`, `__sum`; modifiers `--static`, `--stacked`, `--one`, `--sheet`) in the new `source/css/25-date-range.css`. Fitted, Markus to confirm (Q10–Q16): lavender selection, amber today, weekends not greyed, marks passed in by the page, calendar-day count, DateField's presets first with optional week presets, outcome as a default button.
- Added `SongNodes.calendar` (`today`, `iso`, `month`, `addDays`, `addMonths`, `compare`, `days`, `weekStart`, `preset`, `PRESET_LABELS`), `SongNodes.format.range` and `format.dayLong`, and `SongNodes.dateRange(el, opts)`, which renders and runs the popover. Types `DateRangeProps`, `DateRangeMark`, `DateRangePreset`, `DateRangePresetId`.
- Changed `DateField`: the range variant gains an icon-only calendar button (`.sn-date-field__pick`, `calendar` icon, "Pick the dates on the calendar") that opens DateRange with focus on the grid; typed and picked dates show in both (`.sn-date-field--calendar`; props `calendar`, `calendarProps`, `onPickOnCalendar`).
- Added `SongNodes.iconNames`; `SongNodes.icon()` now logs one console warning for a name outside the set instead of silently drawing `circle-help` (BeanAlliance found a step glyph that drew nothing).
- Added `.sn-overflow-menu__icon-gap`: a menu item with no icon keeps an empty icon column so labels line up; previews no longer use `circle-dot` as a placeholder. Menu and command-palette groups are separated by a rule.
- Changed (text inset, from a browser audit of every preview at 1440 and 390px in dark, light and booth: 315 cramped and 26 overflowing text boxes before, 0 after): a card holding only a table or a lone empty, loading or error state is flush and its cells carry the inset (`:where`, so a page's padding wins); table row headers and footer labels (`tbody th`, `tfoot th`) take the body cell's box instead of the column-header style; table cells get `space-1` block padding; key caps, tab badges, drawer counts, source-badge "+N" and error-state ref codes pad `space-2` and never wrap; KeyPicker keys, segmented controls, graph legend and recommendation reasons wrap instead of spilling. Rules written into 05-layout "Text inset" and 11-data-display Tables.
- No token changed; every new class uses existing tokens.

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

### DR-031 to DR-033 — answers of 28 Oct 2026 (after 1.3.0)
| # | Decision |
|---|---|
| DR-031 | DateRange counts a span in calendar days ("3 days"), on every page including gig spans (closes Q10). |
| DR-032 | The AppHeader keeps `space-2` (8px) side padding under a 560px container, so its actions fit; it is the one exception to the 16px phone gutter (closes Q17). |
| DR-033 | CSV exports keep the SongNodes convention (UTF-8 with BOM, sentence-case headers, timestamped file names); BeanAlliance's no-BOM, lowercase-header, period-named files are not adopted. Its formula-injection guard is adopted (1.4.0). |

### DR-034 to DR-037 — graph choices of 30 Oct 2026
Chosen from four layouts and three link styles compared on the same 40 tracks (Graph Strength Options page). Scores there for the rings layout, against today's force layout: 0 name clashes (was 47), spacing spread ±25% (was ±41%), rank correlation between strength and shortness +0.39 (was +0.94), so distance deliberately carries less.

| # | Decision |
|---|---|
| DR-034 | Layout: rings around the anchor track (now playing, else selected, else the most-linked track). Seats sit a regular distance apart; the strongest link takes the nearest free seat and weaker ones move outward when there is no room. Distance orders, never measures. |
| DR-035 | Link strength: four width bands with matching opacity (E3). Weak links are drawn only when one of either track's two strongest, touching now playing, or touching the hovered or selected track. |
| DR-036 | Band cut points: fitted to the library (quartiles of all link weights, refitted each weekly run; natural breaks as the cross-check, a mismatch over 0.10 flagged on Monitoring). Defaults 0.25 / 0.50 / 0.75 until 200 links exist. |
| DR-037 | Labels: unchanged (hover, selection, now playing; all at zoom > 1.5). Seats reserve each label at zoom 1.5, so they never overlap once shown. |

### DR-038 to DR-042 — imported from BeanAlliance v4.18 to v4.20.2 (2 Nov 2026)

Markus's BeanAlliance decisions of 1 Nov 2026, brought into SongNodes at his request ("collect, transform and integrate those more recent updates"). Each is his rule, fitted to SongNodes; where the fit needed a choice of its own, the choice is an open question below (Q23–Q27).

| DR | Decision |
|---|---|
| DR-038 | InfoTip: a notice that only explains becomes one `info` button with its words verbatim in a tooltip (40 words or fewer) or a panel. Banners, errors, toasts, legends, a one-line subtitle and anything that must not be missed are never InfoTips. |
| DR-039 | Every field's help is an InfoTip after its label, however short; a caveat on a figure, today's included, may be one. |
| DR-040 | Every warning ends with one source link to the page and place where its cause is changed; another page opens in a new tab; no page to change it is a gap on the open-questions list, never a dead link. |
| DR-041 | Every warning can be dismissed; a dismissed warning shrinks to its status icon in place (icon only, no word) and returns the next day or when its fact changes; a bad one also returns when the blocked action is tried again. Nothing is recorded. |
| DR-042 | Go icon: the target module's icon at 84% with a half-size new-tab badge, in the target module's colour, leading the words of every source link to another page. |

## How rules are derived

1. Markus's own decisions (DR-001…DR-016) and his past corrections win.
2. Then what the existing artifacts already do (the Naarm Set Builder: tiers, set shapes, transition rules, rotation, weekly run) — fit the rule that reproduces them, do not invent a new value.
3. Then the SongNodes code where it is correct (e.g. `utils/harmonic.ts` Camelot table, backend status enums).
4. Then platform standards (WCAG 2.2 AA, WAI-ARIA Authoring Practices, Lucide conventions).
5. Taste last, and recorded as an open question when it matters.

## Open questions

All questions raised at the 1.0.0 release were answered on 24 Oct 2026 (DR-018 revised, DR-021 to DR-030). Q9 remains open; Q11–Q16 and Q18 were fitted in 1.3.0 and Q23–Q27 in 1.6.0, and wait for Markus (Q10 and Q17 answered as DR-031 and DR-032):

| # | Question | Options | Default until answered |
|---|---|---|---|
| Q9 | Score bands for recommendations | 80/60/40 (current code) · fit to Markus's accepted picks | 80/60/40 until enough accepted picks exist to fit, then fitted from his own picks |
| Q11 | DateRange outcome button weight | Default button · primary when the picker is the whole view · always primary | Default button (one primary per view) |
| Q12 | When the DateRange popover closes | Stays open until the outcome button · closes on the second pick in DateField | Stays open |
| Q13 | Week presets in DateField's chip row | Popover only · mirrored in the field when enabled | Popover only |
| Q14 | More than one mark on a day | One code, extra marks in the name · two stacked codes · "+1" | One code |
| Q15 | DateRange on phones | Bottom sheet below 480px · full-screen Dialog sheet (DR-029) | Bottom sheet |
| Q16 | Limit future days in exports | None · `max` greys days after the last data with a reason | None |
| Q18 | "Tight" text inset (4–7px) | Warn only · fail the check | Warn only |
| Q23 | How long a dismissed warning stays down (DR-041) | Until the next calendar day in Melbourne · until the next weekly run · until the fact changes only | Next calendar day (BeanAlliance's "next working day" has no SongNodes calendar to follow) |
| Q24 | Source links in a single-page app (DR-040) | New tab, as BeanAlliance · same tab, since Back restores filters, tab and scroll (08-motion) | New tab, so the page with the warning keeps its place |
| Q25 | Info and ok banners when dismissed | Go entirely until their fact changes (SongNodes 1.0) · shrink to their icon like a warning | Go entirely |
| Q26 | InfoTip button size | 24px (WCAG 2.5.8 minimum, matches BeanAlliance's `control-h-sm`) · 32px `control-sm` like other small icon buttons | 24px, 44px hit area on touch |
| Q27 | InfoTip hover delay | Opens at once on hover (the info button is pointed at on purpose, as BeanAlliance) · 500 ms like `Tooltip` | At once |

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
