# Colour

Colour in SongNodes has four jobs and only four: layer the surfaces, rank the text, say which module you are in, and say whether something is OK. Every colour is a token from `tokens.css`; a colour literal in component code is a bug unless it appears in the exceptions at the end of this page.

## Surface layers

| Token | Dark | Light | Booth | Use |
|---|---|---|---|---|
| `bg` | #222222 | #f4f4f1 | #000000 | Page background |
| `surface-1` | #2d2d2d | #ffffff | #0f0f0f | Cards, panels, table body, drawer, dialog |
| `surface-2` | #373737 | #ecece8 | #1c1c1c | Raised parts inside a panel: table header, hovered row, `.sn-seg` track |
| `surface-3` | #414141 | #e1e1dc | #2a2a2a | Pressed or selected neutral fills, progress track, skeleton base |
| `sunk` | #1b1b1b | #e9e9e5 | #000000 | Inputs, code wells, the transition strip between set rows |
| `overlay` | 55% black | 40% ink | 80% black | Scrim behind `NavDrawer`, `SideSheet` on phones, `Dialog` |

- Step up one layer at a time: `bg` → `surface-1` → `surface-2` → `surface-3`. Never put `surface-1` on `surface-2`.
- `line` is decorative (dividers between rows and sections). Any edge that defines a control (input, chip, secondary button, checkbox) uses `line-strong`, which holds 3:1 (WCAG 1.4.11).

## Text emphasis

| Token | Use | Contrast held |
|---|---|---|
| `fg` | Titles, primary text, icons | 4.5:1 on `bg`, `surface-1/2/3`, `brand-soft` (7:1 booth) |
| `fg-2` | Metadata lines, supporting table cells, quiet buttons | 4.5:1 on `bg`, `surface-1/2` (7:1 booth) |
| `fg-3` | Lead-in of thin–bold titles, captions, column headers | 4.5:1 on `bg`, `surface-1` only |
| `fg-disabled` | Disabled labels only | exempt (WCAG 1.4.3 inactive components) |

- Do not put `fg-3` on `surface-2` or `surface-3`; use `fg-2` there.
- Three levels is the limit. Do not invent a fourth by lowering opacity.

## Brand

`brand` (lavender, #9b85cb dark / #6a52a6 light / #c9b9f0 booth) is SongNodes itself.

Use it for:
- the wordmark in `AppHeader`;
- the single `.sn-btn--primary` per view;
- the focus ring (`focus`), selection outline and `::selection` (`brand-soft`);
- selected rows and chips (`brand-soft` fill), the current drawer item;
- selected graph nodes (lavender ring). The "now" marker is not brand: it has its own amber token, `now` (see below);
- generic links with no module destination (`link`).

Never use it for: "now", status, a chart series, a module identity, decorative headers, large fills or backgrounds behind text other than `brand-soft`.

## Module colours

Each module owns one hue for identity: its drawer icon, links that lead to it, its tonal cards (`.sn-card--tonal` inside `.sn-m-<key>`) and the `PageHeader` band. Values are `mod-<key>` / `mod-<key>-bg`.

| Module | Scope class | Dark | Light | Booth |
|---|---|---|---|---|
| Graph | `sn-m-graph` | `#6fa8dc` / `#22313e` | `#2b679a` / `#e5f2fe` | `#acd6fe` / `#081725` |
| Library | `sn-m-library` | `#c9a85c` / `#362e1b` | `#7d5e01` / `#f9efda` | `#e9ce92` / `#1d1502` |
| Set builder | `sn-m-sets` | `#e08a5f` / `#3f291e` | `#9b4816` / `#ffece3` | `#fec1a4` / `#250f05` |
| Pathfinder | `sn-m-paths` | `#d27aa8` / `#3e2732` | `#964070` / `#ffe9f3` | `#feb9db` / `#240d19` |
| Key & mood | `sn-m-harmony` | `#5fb8b0` / `#1e3432` | `#00736c` / `#def6f3` | `#9ce0d9` / `#031a18` |
| Sources | `sn-m-sources` | `#8fbf6b` / `#27331e` | `#447214` / `#e8f5e0` | `#b8df9c` / `#0e1a05` |
| Pipeline | `sn-m-pipeline` | `#7fa1b3` / `#283135` | `#46687a` / `#e7f2f8` | `#bad6e5` / `#0f171c` |
| Services | `sn-m-services` | `#a5a07b` / `#312f26` | `#6a6440` / `#f2f1e5` | `#d6d2b4` / `#18160d` |

Limits:
- Identity only. A module hue never means good, bad, new or selected.
- One module hue dominates a page: its own. Other modules appear only as links (text colour) and small `LauncherCard` icons.
- Inside a tonal card, every part is a shade of that hue (`--m-bg`, `--m-raised`, `--m-line`, `--m-ink`, `--m-muted`); only status pills break out.
- Solid module buttons (`.sn-btn--mod`) mean "go to or act in that module" and use `--m-on` text.
- Module hues are not chart series. If a chart compares modules (pages per module), the module hue may mark it; otherwise use `chart-*`.

## Status vocabulary

One vocabulary for every backend enum, mapped by `SongNodes.status(raw)`. Status colour is always paired with a glyph and a word (WCAG 1.4.1).

| Status | Token | Glyph | Words used |
|---|---|---|---|
| ok | `status-ok` | ● | Done, Healthy, OK, Saved, Normal, High confidence |
| fair | `status-fair` | ◐ | Medium confidence, compatible |
| warn | `status-warn` | ▲ | Degraded, Partly done, Cooling down, Testing, Low confidence, Stale |
| bad | `status-bad` | ✕ | Failed, Error, Timed out, Down, Critical, Paused after errors |
| info | `status-info` (grey) | i | Neutral notes; deliberately not blue (blue is Graph) |
| running | `fg` on `surface-3` | ↻ | Running, Processing, In progress, Saving… |
| idle | `fg-3`, outlined | – | Queued, Idle, Off, Skipped, Cancelled, Not tested, Not set up |

Booth uses the same traffic-light hues as dark (green ok, amber warn, red bad), lifted to 7:1 on black. No theme is a colour-blind-safe palette, so the glyph and the word are mandatory on every status in every theme: they, not the hue, carry the difference.

## Domain statuses

| Domain | Values → status | Component |
|---|---|---|
| Transition compatibility | perfect ●, compatible ◐, possible ○, clash ✕ (`compat-*`) | `CompatibilityBadge`, `TransitionNote` |
| Energy check | step +1 or hold = perfect; −1 = compatible; second −1 in a row = possible; +2 or more = clash (`SongNodes.energyStep`) | `TransitionNote` |
| Needs an energy check (library flag) | row `data-flag` (`flag-bg`) + ▲ marker | `DataTable` |
| Rotation | category, not status: neutral `CategoryTag`; High may use `brand-soft` emphasis | `CategoryTag` |
| Data confidence | high ok, medium fair, low warn | `StatusPill` |
| Scraper circuit | closed ok "Normal", half_open warn "Testing", open bad "Paused after errors" | `ServiceStatus` |
| Proxy health | healthy ok, degraded warn, failed bad, untested idle | `ServiceStatus` |
| Validation severity | error bad, warning warn, info info | `StatusPill` |

## Completion is not health

Progress (`ProgressBar`, `ProgressRing`, `StagedProgress`) is always `progress-fill` on `progress-track`, both neutral. A job 40% done is not "warn". A health judgement goes in a `StatusPill` beside the bar: "↻ Running · 412 of 1,030".

## Categories versus statuses

Genres, Pillars, sources, shows, tags, rotation and edge types are categories. Show them as neutral `CategoryTag` (`.sn-tag`) and, in charts, as `chart-*` series. Never colour a category with a status or module token. Edge types in the graph (adjacency, similarity, collaboration, genre, key_compatibility) use `chart-1…5` in that order.

## Flag tint

`flag-bg` is the only tint for "look at this row": needs an energy check, duplicate, stale. Use it on `tr[data-flag]` or a cell, always with a `status-warn` ▲ marker and a text reason in the row or its Tooltip. Never flag with `status-*-bg`.

## Chart palettes

- Categorical: `chart-1` … `chart-8` in order, based on the Okabe-Ito colour-blind-safe palette (sky blue, orange, bluish green, reddish purple, yellow, blue, vermilion, grey). More than 8 categories: show the top 7 and group the tail as "Other" in `chart-8` (grey).

| Token | Dark | Light |
|---|---|---|
| `chart-1` | #56b4e9 | #0072b2 |
| `chart-2` | #e69f00 | #b36b00 |
| `chart-3` | #3fc29a | #007a5a |
| `chart-4` | #cc79a7 | #b0477f |
| `chart-5` | #e8d95a | #8a7d00 |
| `chart-6` | #5aa0e0 | #005a8c |
| `chart-7` | #f08a4b | #b34700 |
| `chart-8` | #999999 | #6b6b6b |

  Light values are darkened Okabe-Ito hues so lines and labels hold 3:1 on white; booth uses the dark values. Order is fixed: assign a colour to an entity, never to a rank. Series are still labelled directly, so colour is never the only cue.
- Ordered classes (energy, tiers): use `energy-1…10`. Other ordered data: a single-hue ramp built from one `chart-*` at stepped opacity, never a rainbow.
- Keys: `key-1a…key-12b`, always with the code printed.
- Reference lines (target wave, average, threshold): `chart-ref`, 1.5px dashed `5 4`, labelled at the end of the line.
- Grid `chart-grid`, axis text `chart-axis`. No chart background other than the surface it sits on.

## The now marker

`now` is its own amber token (#f7c04a dark / #9a6400 light / #ffd166 booth), not brand lavender. It marks "now playing", the current slot and the current time: a 3px inset bar on the row (`tr[data-now]`), a vertical line on timelines (the ChartFrame now line, today's column on the weekly grid), an amber ring plus a "Now" tag on the graph node. It has one meaning everywhere and is never used for selection: selection stays brand lavender (`brand` ring on graph nodes, `brand-soft` fill on rows and chips), so now and selected differ by hue and by the "Now" word, not by ring count. Amber `now` is not a status: it never appears without the word "Now" or a time label beside it.

## Simulated data

Anything proposed but not real (a rebuild preview, a path not yet saved, a "Try another take") is hatched in `sim` and labelled "Preview" in the chart or slot. Remove the hatch the moment it is saved.

## Token naming

`<role>[-<variant>]` for neutrals (`surface-2`, `fg-3`); `mod-<module>[-bg|-raised|-line|-ink|-muted]` and `on-mod-<module>`; `status-<state>[-bg]`, `on-status-bad`; `compat-<level>`; `energy-<1–10>`; `key-<n><a|b>`; `chart-<n>`, `chart-grid|axis|ref`; `svc-<service>`, `on-svc-<service>`. `on-*` is always text on that fill.

## Contrast requirements and how they are checked

| Pair | Minimum | Booth |
|---|---|---|
| Body text (`fg`, `fg-2`, `fg-3`, `link`, `mod-*`, `status-*`) on its listed grounds | 4.5:1 (1.4.3) | 7:1 for `fg`, `fg-2`, `fg-3`, `mod-*`, `mod-*-ink` (1.4.6) |
| `on-brand` on `brand`, `on-mod-*` on `mod-*`, `on-status-bad` on `status-bad` | 4.5:1 | 4.5:1 |
| Control edges `line-strong`, focus ring `brand`, key dots on `surface-1` | 3:1 (1.4.11) | 3:1 |
| `mod-*-line` on `mod-*-bg` | 1.4:1 (decorative edge) | 1.4:1 |

- The generator `source/build_tokens.py` prints the contrast report for every pair above in all three themes ("Contrast: all pairs pass."). Run it after any colour change; a fail blocks the change.
- Only use a pair that is in the token usage notes (`tokens.json`). A new pair needs a line in the generator first.

## Hard-coded values: allowed exceptions

- Third-party brand colours: `svc-spotify`, `svc-tidal` and their `on-*` only on "Connect Spotify"/"Connect TIDAL" buttons and their `SourceBadge`, per the services' brand rules.
- PIXI graph rendering: read tokens at runtime with `getComputedStyle(document.documentElement).getPropertyValue('--mod-graph')` and convert to a hex number; re-read on theme change. No hex in `GraphVisualization.tsx`.
- Print (`PrintSheet`): black on white via `@media print` with `--fg: #000; --bg: #fff` overrides in one place.
- Image placeholders may use a gradient. Nothing else does.
