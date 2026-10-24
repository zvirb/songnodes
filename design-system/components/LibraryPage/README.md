# LibraryPage

The crate: filter, search and sort every track in the Melbourne club library, then build a set from what is left.

## When to use / not use
`/library` in SongNodes (Plan mode left column) and `#/library` in the music library. Also the pattern for any filterable list (target tracks, attribution queue). Not for a single track (use `TrackDetailPage` or the `SideSheet`).

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Shell | `AppHeader` (Library: Melbourne club library, data stamp), `NavDrawer`, toast region | |
| Header | `PageHeader` library band; primary "Build set from filters", secondary "Export CSV", `OverflowMenu` (Import tracklist…, Copy filtered tracklist, Print crate) | |
| Stats | `FigureTile` × 4: 1,284 tracks, 212 heard this week, 38 need an energy check (`StatusPill` warn + Review link), 94% have key and BPM | |
| Coverage note | `Banner` info, dismissible: "77 tracks have no key or BPM yet…" + "Show tracks without a key" | Keyed so a dismissal sticks until the count changes |
| Rail | `FilterRail` (no `data-layout`: rail ≥1024px, sheet below): `SearchField`, `FilterChip` groups Pillar, Energy tier (mini 3-segment tier bars), Rotation (with the "How rotation is worked out" `Disclosure`), Tags, `SelectField` Heard on, `Checkbox` track checks | Sticky under the header (`.sn-page-library__body > .sn-filter-rail`) |
| Crate | `DataTable --stack`: Energy (`EnergyBar`), Track (`TrackCell` with TIDAL/Deezer/Beatport `TextLink --ext` in its meta), BPM (`BpmReadout`), Key (`KeyBadge`), Pillar and Rotation (`CategoryTag`), Heard (`SourceBadge` count, sources in the tooltip and screen-reader text), add-to-set `Button --sm --icon` | Default columns: Energy, Track, BPM, Key, Pillar, Rotation, Heard. "Last heard", Links and IDs are optional (column chooser). Default sort Energy, descending; header buttons sort with `aria-sort`; flagged rows `data-flag` |
| More | `ShowMore` "Showing 12 of 846 tracks · Show 150 more · Show all 846" | |

## Data
`LibraryPageProps`: filters and sort (in the URL: `?pillar=house,uk-garage&checks=key&sort=-energy`), loaded rows, totals, coverage note, region state.

## States
- First load: `LoadingState` table skeleton with the real header row and "Loading 1,284 tracks…" after 1 s; tiles show `sn-skel`.
- Refresh: rows stay; loading bar on the table frame; stamp updates when done.
- Empty: `DataTable` empty row "No tracks match these filters" naming the filters, with "Clear filters".
- Error: `DataTable` error row (what failed, filters kept, Try again); tiles and rail stay usable.
- Offline: header `ConnectionStatus` offline; table shows cached rows with their stamp; add-to-set queues locally.

## Responsive
≥1024px: rail 248px + table. 768–1023px: "Filters (3)" button with active-filter chips above the table, rail opens as a right sheet. <600px: table rows become stacked cards (`data-label` captions); primary goes full width; secondary actions fold into More actions. Wall: content capped at 1400px. Booth: larger type; the track column truncates, full name in `title`.

## Rotation
Rotation is calculated, never hard-coded: High rotation and Vault are worked out by the weekly run from the library's own play data. Current rule (fitted to the library, reproduces all 294 tracks of the 24 Oct 2026 run): High = heard on 2 or more different shows in the run window, or on the ARIA Club Chart for 4 weeks or fewer; everything else heard is Standard. Vault is empty until 8+ weeks of history exist (see Music domain → Rotation).

## Primary action
"Build set from filters" → Set builder with the pool set to the filtered crate.

## Replaces
DJInterface Plan-mode left column and `MobileTrackExplorer`; the emoji "🔧 Filters" button and `GraphFilterPanel` modal for library filtering. Music library: the Naarm Set Builder library view (stats row, filter rail, crate table).
