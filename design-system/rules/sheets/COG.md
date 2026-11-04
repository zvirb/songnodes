# COG rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| COG-001 | Each view shall have one primary action, visually dominant (`.sn-btn--primary`). | dom | Each view contains exactly one `.sn-btn--primary` that is the most prominent button. |
| COG-002 | At most 3 secondary actions shall be visible next to the primary action; the rest shall go in an `OverflowMenu`. | dom | Count of visible non-primary actions in the action group <=3; extras are inside OverflowMenu. |
| COG-003 | Play mode (`GraphExplorerPage` with now playing) shall show by default only the now-playing track and up to 5 recommendations with their `CompatibilityBadge`. | dom | Play mode default view has one now-playing item and <=5 recommendation items each with a CompatibilityBadge, and nothing else. |
| COG-004 | Each step shall ask for one choice. | judgement | Reviewer confirms each step requests a single decision. |
| COG-005 | The set builder shall ask for shape, length, genre mix and pool on one row with defaults filled in, so the common case is a single click on "Build set". | dom | Set builder shows the four controls in one row with default values; Build set is enabled on load. |
| COG-006 | The Library page shall show by default only: Search, Pillar, Energy tier, Rotation and the table with default columns. | dom | Library initial DOM contains exactly those elements; others are hidden or collapsed. |
| COG-007 | The Library page shall reveal on request only: Heard on, Tags, checkboxes, column chooser and the Track detail `SideSheet`. | dom | Library items listed are absent or collapsed until the person opens them. |
| COG-008 | The Set builder page shall show by default only: Name, shape, length, Build set, `EnergyWave`, running order and transitions. | dom | Set builder initial DOM contains exactly those elements; others are hidden or collapsed. |
| COG-009 | The Set builder page shall reveal on request only: Genre mix weights, pool options, spare suggestions (3 per slot behind "Spares") and the method `Disclosure` "How the set is built". | dom | Set builder items listed are absent or collapsed until the person opens them. |
| COG-010 | The Graph page shall show by default only: Canvas, search, now playing and recommendations. | dom | Graph initial DOM contains exactly those elements; others are hidden or collapsed. |
| COG-011 | The Graph page shall reveal on request only: Graph filters (`FilterRail`/`SideSheet`), edge types legend, graph stats and layout controls. | dom | Graph items listed are absent or collapsed until the person opens them. |
| COG-012 | The Track detail page shall show by default only: Title, artist, BPM, key with name, energy, duration and sources. | dom | Track detail initial DOM contains exactly those elements; others are hidden or collapsed. |
| COG-013 | The Track detail page shall reveal on request only: Audio analysis tab, external IDs (`KeyValueGrid`), other sources' values and edit. | dom | Track detail items listed are absent or collapsed until the person opens them. |
| COG-014 | The Pathfinder page shall show by default only: Start, finish, Find route and the route. | dom | Pathfinder initial DOM contains exactly those elements; others are hidden or collapsed. |
| COG-015 | The Pathfinder page shall reveal on request only: Waypoints, energy curve preset and constraints. | dom | Pathfinder items listed are absent or collapsed until the person opens them. |
| COG-016 | The Monitoring page shall show by default only: 4 `FigureTile`s and the health list with only non-healthy items expanded. | dom | Monitoring initial DOM contains exactly those elements; others are hidden or collapsed. |
| COG-017 | The Monitoring page shall reveal on request only: Healthy sources, job history, technical details and links to Grafana / Swagger. | dom | Monitoring items listed are absent or collapsed until the person opens them. |
| COG-018 | The Settings page shall show by default only: Connections, theme and text size. | dom | Settings initial DOM contains exactly those elements; others are hidden or collapsed. |
| COG-019 | The Settings page shall reveal on request only: API keys, density, shortcuts, reduce motion and advanced. | dom | Settings items listed are absent or collapsed until the person opens them. |
| COG-020 | Opening disclosed content shall not move the primary action. | dom | Primary action offsetTop is unchanged after expanding a Disclosure. |
| COG-021 | The state of each disclosure, filter and tab shall persist per person. | dom | Reload the page; disclosure, filter and tab states are restored. |
| COG-022 | `AppHeader` (menu, wordmark, search, `ConnectionStatus`, help) shall be placed at the top, sticky, on every page. | dom | On every page, `AppHeader` (menu, wordmark, search, `ConnectionStatus`, help) is located as stated (DOM region and position). |
| COG-023 | `PageHeader` shall be placed as `Breadcrumbs` -> title (thin-bold) -> `FreshnessStamp` / status pill -> actions at the right, with the primary action last (rightmost), on every page. | dom | On every page, `PageHeader` is located as stated (DOM region and position). |
| COG-024 | Filters shall be placed in a left `FilterRail` on desktop and behind a "Filters" button at the left of the toolbar on tablet and phone, on every page. | dom | On every page, Filters is located as stated (DOM region and position). |
| COG-025 | Details of the selected item shall be placed in a right `SideSheet` or docked panel, on every page. | dom | On every page, Details of the selected item is located as stated (DOM region and position). |
| COG-026 | Page actions shall be placed at the top right in `PageHeader`, on every page. | dom | On every page, Page actions is located as stated (DOM region and position). |
| COG-027 | Totals and summary figures shall be placed above the table they summarise (e.g. "412 of 1,284 tracks · 6 h 40 min"), on every page. | dom | On every page, Totals and summary figures is located as stated (DOM region and position). |
| COG-028 | Row actions shall be placed in the last column, right-aligned, on every page. | dom | On every page, Row actions is located as stated (DOM region and position). |
| COG-029 | Method and caveats shall be placed in a `Disclosure` directly under the chart or table, on every page. | dom | On every page, Method and caveats is located as stated (DOM region and position). |
| COG-030 | Dialog buttons shall be placed at the bottom right: Cancel, then the action verb, on every page. | dom | On every page, Dialog buttons is located as stated (DOM region and position). |
| COG-031 | Status shall carry a second, non-colour cue: a glyph plus a word (● Done, ▲ Stale, ✕ Failed). | dom | Status elements include the stated non-colour cue. |
| COG-032 | Compatibility shall carry a second, non-colour cue: the glyph ● ◐ ○ ✕ plus text such as "+1 key". | dom | Compatibility elements include the stated non-colour cue. |
| COG-033 | Energy shall carry a second, non-colour cue: segment count, printed number, and tier gaps after 4 and 7. | dom | Energy elements include the stated non-colour cue. |
| COG-034 | Key shall carry a second, non-colour cue: the printed Camelot code next to the dot. | dom | Key elements include the stated non-colour cue. |
| COG-035 | Module colour shall carry a second, non-colour cue: an icon and name next to the hue. | dom | Module colour elements include the stated non-colour cue. |
| COG-036 | Flagged rows shall carry a second, non-colour cue: a ▲ marker plus reason text, not just `flag-bg`. | dom | Flagged rows elements include the stated non-colour cue. |
| COG-037 | Now playing shall carry a second, non-colour cue: a 3px bar plus a "Now playing" label for screen readers. | dom | Now playing elements include the stated non-colour cue. |
| COG-038 | Graph edges shall carry a second, non-colour cue: a line style per edge type (adjacency solid, similarity dashed, key compatibility dotted) as well as colour. | dom | Graph edges elements include the stated non-colour cue. |
| COG-039 | Groups shall be formed by the decision, not by the data source. | judgement | Reviewer confirms controls are grouped by the decision they influence. |
| COG-040 | Every group shall be labelled with a `label`-style heading of 3 words or fewer, or a `SectionHeading`. | dom | Each control group has a heading of <=3 words or is a SectionHeading. |
| COG-041 | `FilterRail` shall have no more than 7 filter groups, collapsing the rest under "More filters". | dom | FilterRail has <=7 visible filter groups; extras are inside "More filters". |
| COG-042 | Lists of more than 12 options shall use `SearchField` or `SelectField`, not chips. | dom | Chip groups have <=12 chips. |
| COG-043 | Building a set from the library shall take at most 3 actions (filter the crate (optional) -> "Build set from crate" -> "Save set"). | judgement | Count clicks, committing key presses and page loads along the path; total <= the stated maximum. |
| COG-044 | Finding a track shall take at most 2 actions (Ctrl/Cmd K or / -> type and pick). | judgement | Count clicks, committing key presses and page loads along the path; total <= the stated maximum. |
| COG-045 | Swapping a slot for a spare shall take at most 2 actions ("Spares" on the slot -> pick). | judgement | Count clicks, committing key presses and page loads along the path; total <= the stated maximum. |
| COG-046 | Sending a set to TIDAL shall take at most 2 actions ("Send to TIDAL" -> confirm playlist). | judgement | Count clicks, committing key presses and page loads along the path; total <= the stated maximum. |
| COG-047 | Seeing why two tracks connect shall take at most 1 action (click the edge). | judgement | Count clicks, committing key presses and page loads along the path; total <= the stated maximum. |
| COG-048 | Checking whether the library is fresh shall take 0 actions (`FreshnessStamp` visible on Library). | judgement | Count clicks, committing key presses and page loads along the path; total <= the stated maximum. |
| COG-049 | Critical-path action counts shall count clicks, committing key presses and page loads, with typing a query counting as one action. | judgement | Counting method applied as stated. |
| COG-050 | Pages shall remember the person's place (filters, scroll, open sheet, selected slot) per device. | dom | Leave and return; filters, scroll, open sheet and selected slot are restored. |
| COG-051 | On return after new data, one line under the `PageHeader` shall read like "Changed since your last visit: +38 tracks, 4 energy checks cleared" with a "Show changes" `TextLink`. | dom | Changed-since line present after return with new data, with a Show changes link. |
| COG-052 | The "Changed since your last visit" line shall be dismissed once viewed, and there shall never be more than one such line. | dom | Line is removed after viewing; at most one exists. |
| COG-053 | The set builder shall show an "Unsaved changes" `StatusPill` beside the title until saved. | dom | Unsaved state shows the pill beside the title; saved state removes it. |
| COG-054 | After a long job finishes while the person is elsewhere, the `Toast` shall name the job and link to its result. | dom | Toast text contains the job name and a link to the result. |
| COG-055 | No more than 1 bad (✕) item shall be visible as a `Banner` or headline. | dom | Count of visible bad Banner/headline items <=1. |
| COG-056 | No more than 3 warn (▲) items shall be visible at once. | dom | Count of visible warn items <=3. |
| COG-057 | Items beyond the severity budget shall be aggregated (e.g. "3 sources degraded, 9 warnings") with a `ShowMore` that lists them. | dom | Excess items collapse into an aggregate line with a ShowMore control. |
| COG-058 | Normal things (healthy services, perfect transitions) shall use quiet styling (outline pill or no pill). | visual | Healthy/perfect items use `.sn-pill--outline` or no pill. |
| COG-059 | In the running order, transition badges shall be shown for every row, with only possible ○ and clash ✕ filled and perfect and compatible as outline (`.sn-pill--outline`). | dom | Perfect/compatible badges have `.sn-pill--outline`; possible/clash badges are filled. |
| COG-060 | Saved views shall let the person name and save current filters, sort and columns, and pick them from the top of the `FilterRail`. | dom | FilterRail top has a saved-views picker; saving stores filters, sort and columns. |
| COG-061 | `PreferencesPanel` shall offer density (comfortable or compact). | dom | PreferencesPanel has a density control with two options. |
| COG-062 | Every `DataTable` with more than 5 available columns shall have a column chooser with "Reset to default". | dom | Tables with >5 columns contain a column chooser with a "Reset to default" button. |
| COG-063 | `PreferencesPanel` shall offer text size, theme, reduce motion and single-key shortcuts. | dom | PreferencesPanel contains those four controls. |
| COG-064 | Saved views, density, column choices, text size, theme, reduce motion and single-key shortcuts shall persist per person per device via `SongNodes.prefs` or the app's preference store. | dom | Reload; preferences are restored from SongNodes.prefs. |
| COG-065 | The Music library crate table shall show by default on desktop the columns: Energy, Track, BPM, Key, Pillar, Rotation, Heard (count), Add. | dom | Music library crate desktop default header cells equal [Energy, Track, BPM, Key, Pillar, Rotation, Heard (count), Add] in order. |
| COG-066 | The Music library crate table shall show on phone at most the columns: Track, Energy, BPM, Key. | dom | Music library crate header cells at <768px equal [Track, Energy, BPM, Key] (max 4). |
| COG-067 | The Music library crate table shall offer as optional columns: Last heard, Heard on, Links, Tags, Duration, Label, Year. | dom | Music library crate column chooser lists [Last heard, Heard on, Links, Tags, Duration, Label, Year]. |
| COG-068 | The SongNodes library table shall show by default on desktop the columns: Track, BPM, Key, Energy, Genre, Add. | dom | SongNodes library desktop default header cells equal [Track, BPM, Key, Energy, Genre, Add] in order. |
| COG-069 | The SongNodes library table shall show on phone at most the columns: Track, BPM, Key, Energy. | dom | SongNodes library header cells at <768px equal [Track, BPM, Key, Energy] (max 4). |
| COG-070 | The SongNodes library table shall offer as optional columns: Duration, Year, Label, Sources, ISRC, Spotify ID. | dom | SongNodes library column chooser lists [Duration, Year, Label, Sources, ISRC, Spotify ID]. |
| COG-071 | The Running order table shall show by default on desktop the columns: Slot, Energy, Track, BPM, Key, Actions. | dom | Running order desktop default header cells equal [Slot, Energy, Track, BPM, Key, Actions] in order. |
| COG-072 | The Running order table shall show on phone at most the columns: Slot, Track, Energy, Key. | dom | Running order header cells at <768px equal [Slot, Track, Energy, Key] (max 4). |
| COG-073 | The Running order table shall offer as optional columns: Duration, Genre, Spares. | dom | Running order column chooser lists [Duration, Genre, Spares]. |
| COG-074 | The Saved sets table shall show by default on desktop the columns: Name, Shape, Length, Tracks, Updated. | dom | Saved sets desktop default header cells equal [Name, Shape, Length, Tracks, Updated] in order. |
| COG-075 | The Saved sets table shall show on phone at most the columns: Name, Length, Updated. | dom | Saved sets header cells at <768px equal [Name, Length, Updated] (max 4). |
| COG-076 | The Saved sets table shall offer as optional columns: Clashes, Sent to TIDAL. | dom | Saved sets column chooser lists [Clashes, Sent to TIDAL]. |
| COG-077 | The Target tracks table shall show by default on desktop the columns: Track, Priority, Status, Last searched. | dom | Target tracks desktop default header cells equal [Track, Priority, Status, Last searched] in order. |
| COG-078 | The Target tracks table shall show on phone at most the columns: Track, Status. | dom | Target tracks header cells at <768px equal [Track, Status] (max 4). |
| COG-079 | The Target tracks table shall offer as optional columns: Found on, Added, Notes. | dom | Target tracks column chooser lists [Found on, Added, Notes]. |
| COG-080 | The Jobs table shall show by default on desktop the columns: Job, Source, Status, Started, Duration. | dom | Jobs desktop default header cells equal [Job, Source, Status, Started, Duration] in order. |
| COG-081 | The Jobs table shall show on phone at most the columns: Job, Status, Started. | dom | Jobs header cells at <768px equal [Job, Status, Started] (max 4). |
| COG-082 | The Jobs table shall offer as optional columns: Items, Retries, Error. | dom | Jobs column chooser lists [Items, Retries, Error]. |
| COG-083 | The Data quality review table shall show by default on desktop the columns: Track, Proposed match, Confidence, Source, Actions. | dom | Data quality review desktop default header cells equal [Track, Proposed match, Confidence, Source, Actions] in order. |
| COG-084 | The Data quality review table shall show on phone at most the columns: Track, Confidence, Actions. | dom | Data quality review header cells at <768px equal [Track, Confidence, Actions] (max 4). |
| COG-085 | The Data quality review table shall offer as optional columns: Matched fields, Created. | dom | Data quality review column chooser lists [Matched fields, Created]. |
| COG-086 | The Validation table shall show by default on desktop the columns: Severity, Track, Rule, Found. | dom | Validation desktop default header cells equal [Severity, Track, Rule, Found] in order. |
| COG-087 | The Validation table shall show on phone at most the columns: Severity, Track. | dom | Validation header cells at <768px equal [Severity, Track] (max 4). |
| COG-088 | The Validation table shall offer as optional columns: Field, Value. | dom | Validation column chooser lists [Field, Value]. |
| COG-089 | The pre-release review checklist shall be run on every new or changed screen, in all three themes, at 400px and 1440px. | judgement | Review record shows checklist run per screen across three themes at 400px and 1440px. |
