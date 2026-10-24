# Cognitive load

SongNodes is used in two modes of attention: planning at a desk with time to explore, and playing in a booth with seconds between decisions. Every screen keeps the number of things to read, decide and remember as small as the job allows.

## Decisions per screen

- One primary action per view, visually dominant (`.sn-btn--primary`). If you cannot name it, the view is doing two jobs.
- At most 3 secondary actions visible next to it; the rest go in an `OverflowMenu`.
- Play mode (`GraphExplorerPage` with now playing): one decision at a time, "what next?". Show the now-playing track, up to 5 recommendations with their `CompatibilityBadge`, and nothing else by default. The current DJ Interface header (track count, connection count, Fix artist attribution, Import tracklist, Filters, Settings, Help, three scraper triggers) moves into the `NavDrawer`, `OverflowMenu` and Pipeline.
- Ask for one choice per step. The set builder asks for shape, length, genre mix and pool on one row, with defaults filled in, so the common case is a single click on "Build set".

## Progressive disclosure

| Page | Shown by default | On request |
|---|---|---|
| Library | Search, Pillar, Energy tier, Rotation, the table with default columns | Heard on, Tags, checkboxes, column chooser, Track detail `SideSheet` |
| Set builder | Name, shape, length, Build set, `EnergyWave`, running order, transitions | Genre mix weights, pool options, spare suggestions (3 per slot behind "Spares"), method `Disclosure` "How the set is built" |
| Graph | Canvas, search, now playing, recommendations | Graph filters (`FilterRail`/`SideSheet`), edge types legend, graph stats, layout controls |
| Track detail | Title, artist, BPM, key with name, energy, duration, sources | Audio analysis tab, external IDs (`KeyValueGrid`), other sources' values, edit |
| Pathfinder | Start, finish, Find route, the route | Waypoints, energy curve preset, constraints |
| Monitoring | 4 `FigureTile`s, health list with only non-healthy items expanded | Healthy sources, job history, technical details, links to Grafana / Swagger |
| Settings | Connections, theme, text size | API keys, density, shortcuts, reduce motion, advanced |

- Disclosed content keeps its place: opening it never moves the primary action.
- The state of each disclosure, filter and tab persists per person (see "User-controlled simplification").

## Consistent placement

Recurring regions are always in the same place, on every page:

| Region | Place |
|---|---|
| `AppHeader` (menu, wordmark, search, `ConnectionStatus`, help) | Top, sticky |
| `PageHeader` | `Breadcrumbs` → title (thin–bold) → `FreshnessStamp` / status pill → actions at the right (primary last, rightmost) |
| Filters | Left `FilterRail` on desktop; "Filters" button at the left of the toolbar on tablet and phone |
| Details of the selected item | Right `SideSheet` or docked panel |
| Page actions | Top right in `PageHeader` |
| Totals and summary figures | Above the table they summarise ("412 of 1,284 tracks · 6 h 40 min") |
| Row actions | Last column, right-aligned |
| Method and caveats | `Disclosure` directly under the chart or table |
| Dialog buttons | Bottom right: Cancel, then the action verb |

## Non-colour cues

Every colour meaning has a second cue (WCAG 1.4.1):
- Status: glyph + word (● Done, ▲ Stale, ✕ Failed).
- Compatibility: ● ◐ ○ ✕ + "+1 key".
- Energy: segment count + printed number + tier gaps after 4 and 7.
- Key: printed Camelot code next to the dot.
- Module: icon + name next to the hue.
- Flagged rows: ▲ marker + reason text, not just `flag-bg`.
- Now playing: 3px bar + "Now playing" label for screen readers.
- Graph edges: line style per edge type (adjacency solid, similarity dashed, key compatibility dotted) as well as colour.

## Grouping and labelling

- Group by the decision, not by the data source: in the set builder, "Shape" and "Length" sit together because they set the target wave.
- Label every group with a `label`-style heading (3 words or fewer) or a `SectionHeading`.
- No more than 7 filter groups in the `FilterRail`; collapse the rest under "More filters".
- Lists over 12 options use `SearchField` or `SelectField`, not chips.

## Length of critical paths

| Task | Max actions | Path |
|---|---|---|
| Build a set from the library | 3 | Filter the crate (optional) → "Build set from crate" → "Save set" |
| Find a track | 2 | Ctrl/Cmd K or / → type and pick |
| Swap a slot for a spare | 2 | "Spares" on the slot → pick |
| Send a set to TIDAL | 2 | "Send to TIDAL" → confirm playlist |
| See why two tracks connect | 1 | Click the edge |
| Check if the library is fresh | 0 | `FreshnessStamp` is visible on Library |

Count clicks, key presses that commit and page loads. Typing a query counts as one action.

## Orientation after interruption

- Pages remember where the person was (filters, scroll, open sheet, selected slot) per device.
- On return after new data, show one line under the `PageHeader`: "Changed since your last visit: +38 tracks, 4 energy checks cleared" with a "Show changes" `TextLink`. Dismiss it once viewed. Never more than one such line.
- The set builder shows an unsaved-changes `StatusPill` ("Unsaved changes") beside the title until saved.
- After a long job finishes while the person is elsewhere, the `Toast` names the job and links to its result.

## Severity budget per view

- At most 1 bad (✕) item visible as a `Banner` or headline and at most 3 warn (▲) items visible at once.
- Aggregate the rest: "3 sources degraded, 9 warnings" with a `ShowMore` that lists them.
- Do not mark "normal" things: healthy services and perfect transitions use quiet styling (outline pill or no pill); the eye goes to exceptions.
- In the running order, show transition badges for every row, but only possible ○ and clash ✕ are filled; perfect and compatible are outline (`.sn-pill--outline`).

## User-controlled simplification

- Saved views: name and save the current filters, sort and columns ("Friday peak, techno only"); pick them from the top of the `FilterRail`.
- Density: comfortable or compact in `PreferencesPanel`.
- Column chooser on every `DataTable` with more than 5 available columns, with "Reset to default".
- Text size, theme, reduce motion and single-key shortcuts in `PreferencesPanel`.
- All of these persist per person per device via `SongNodes.prefs` or the app's preference store.

## Default visible columns

| Table | Default (desktop) | Phone (max 4) | Optional |
|---|---|---|---|
| Music library crate | Energy, Track, BPM, Key, Pillar, Rotation, Heard (count), Add | Track, Energy, BPM, Key | Last heard, Heard on, Links, Tags, Duration, Label, Year |
| SongNodes library | Track, BPM, Key, Energy, Genre, Add | Track, BPM, Key, Energy | Duration, Year, Label, Sources, ISRC, Spotify ID |
| Running order | Slot, Energy, Track, BPM, Key, Actions | Slot, Track, Energy, Key | Duration, Genre, Spares |
| Saved sets | Name, Shape, Length, Tracks, Updated | Name, Length, Updated | Clashes, Sent to TIDAL |
| Target tracks | Track, Priority, Status, Last searched | Track, Status | Found on, Added, Notes |
| Jobs | Job, Source, Status, Started, Duration | Job, Status, Started | Items, Retries, Error |
| Data quality review | Track, Proposed match, Confidence, Source, Actions | Track, Confidence, Actions | Matched fields, Created |
| Validation | Severity, Track, Rule, Found | Severity, Track | Field, Value |

## Pre-release review checklist

Run this on every new or changed screen, in all three themes, at 400px and 1440px.

Writing
- [ ] All copy is sentence case, en-AU, no emoji, no exclamation marks.
- [ ] Buttons are verb + object; dialog buttons repeat the verb.
- [ ] Dates, times, durations and counts come from `SongNodes.format`; stamps show AEST/AEDT.
- [ ] Missing values show "–" in `.sn-none`.
- [ ] Errors say what happened and what to do; empty states have one action.

Structure
- [ ] The page has one job, one module and one primary button.
- [ ] It is in the page inventory with route, purpose and status.
- [ ] Module colour, icon and name appear together in the header and drawer.
- [ ] Regions follow the placement table; actions top right; totals above tables.
- [ ] Imported data shows `SourceBadge` and `FreshnessStamp`.

Colour
- [ ] No colour literals; only tokens (exceptions: `svc-*`, print, PIXI via computed style).
- [ ] Status colours used only for status, each with glyph and word.
- [ ] Categories are neutral tags; progress bars are neutral.
- [ ] Every pair used is in the contrast report; booth reaches 7:1.

Typography and layout
- [ ] Only named text styles; sizes in rem; works at Extra large text and 200% zoom.
- [ ] Numbers that align are tabular; BPM, key, time and IDs are mono.
- [ ] No horizontal page scroll at 320px; tables scroll in their own box.
- [ ] Only the header, table headers and desktop filter rail are sticky.
- [ ] Spacing uses tokens; cards in a row are equal height.

Interaction and accessibility
- [ ] Every control is reachable and operable by keyboard; focus order matches visual order.
- [ ] Focus ring visible on every element and never hidden under sticky UI.
- [ ] Targets ≥ 24px (44px on touch); small repeated actions spaced.
- [ ] Landmarks, one `h1`, headings in order; icon buttons named.
- [ ] Saves, rebuilds and filter counts are announced via `role="status"`; errors via `role="alert"`.
- [ ] No browser or OS shortcut overridden; single-key shortcuts ignore text fields and can be turned off.
- [ ] Every drag or gesture has a button or key alternative.

Feedback and motion
- [ ] Loading uses skeletons or the busy button; long work uses `StagedProgress`.
- [ ] Refresh keeps old data on screen; failures keep old data and mark it stale.
- [ ] At most one `Banner` and one visible `Toast`; no `alert`, `confirm` or `prompt`.
- [ ] Destructive actions follow the undo / armed / confirm rules.
- [ ] No entrance animation on data; durations within budget; reduced motion tested.
- [ ] Rows never move under the pointer on live updates; scroll is preserved across filters, sorts, tabs and Back.
- [ ] No programmatic scroll without an explicit user action.

Cognitive load
- [ ] Defaults cover the common case; advanced options are disclosed.
- [ ] Critical paths are within their action budget.
- [ ] No more than 1 bad and 3 warn items visible; the rest aggregated.
- [ ] Default columns match the table above; column chooser offered when more than 5.
