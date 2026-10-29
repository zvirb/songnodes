# Page patterns

Fifteen page patterns cover both products. Build a new page by picking the closest pattern and composing its listed components; do not invent a layout. Every pattern except `ErrorPage`, `AuthCallbackPage` and `PrintSheet` sits inside the shell: `AppHeader` + `NavDrawer` + `CommandPalette` + toast region, with a skip link (`.sn-skip`) to `<main>`.

Common rules:
- Content width `content-max` (1400px), centred; side gutter `space-4` on phones, `space-6` from `bp-tablet`, `space-8` from `bp-desktop`.
- **Page container (required).** Every page's root is `<main class="sn-page__main" id="main" tabindex="-1">`. That class is what gives the gutter, the `content-max` width and the `space-8` rhythm between sections; a page without it renders edge to edge with no padding. `ErrorPage` uses `sn-page-error`, `AuthCallbackPage` uses `sn-page-auth`, and `GraphPage` uses `sn-page-graph` as the full-bleed page container (05-layout). Do not wrap a page in any other class, and never invent one: a class the bundle does not define renders nothing (17-governance, The sn- namespace).
- Vertical rhythm between sections `space-8`; inside a section `space-4`.
- One `h1` (the thin–bold title). Section headings `SectionHeading` (`h2`).
- Loading uses `LoadingState` (skeletons shaped like the content), errors `ErrorState` in place of the failed region only, empty regions `EmptyState`.

## HomePage (launcher)

| Region | Components |
|---|---|
| Greeting band | `.sn-title.display-xl` "SongNodes", one line `body-l` `fg-2`, `FreshnessStamp` |
| Launcher grid | `LauncherCard` × 8 (one per module, drawer order), 4 columns ≥ `bp-desktop`, 2 on tablet, 1 on phone |
| Recent | `SectionHeading` "Recently opened" + list of `TextLink`s (last 5 sets, tracks) |
| Health strip | `ServiceStatus` for API, scrapers, Spotify, TIDAL; only problems expanded |

```
| AppHeader ............................................. |
| SongNodes            Data from 24 Oct 2026, 06:00 AEDT  |
| [Graph] [Library] [Set builder] [Pathfinder]           |
| [Key & mood] [Sources] [Pipeline] [Services]           |
| Recently opened: Peak time Friday · Bicep – Glue        |
| ● API healthy  ▲ 1001tracklists cooling down            |
```

## LibraryPage (rail + table)

| Region | Components |
|---|---|
| Header | `PageHeader` (Library: Crate), primary action none or "Build set from filters" |
| Stats row | `FigureTile` × 4 ("1,284 tracks", "212 heard this week", "38 need an energy check", "94% have key and BPM") |
| Rail | `FilterRail` (`rail-w`, sticky `z-sticky`): `SearchField`, `FilterChip` groups, `Checkbox` conditions, "Clear filters" |
| Table | `DataTable`: Energy (`EnergyBar`), Track (`TrackCell`), BPM, Key (`KeyBadge`), Pillar, Rotation (`CategoryTag`), Heard (`SourceBadge` count), add-to-set (`Button --sm --icon plus`) |
| Detail | `SideSheet` with track detail (`?track=`) |

```
| PageHeader: Library: Crate                         [⋯]  |
| [1,284 tracks] [212 this week] [38 check] [94% keyed]   |
| Rail 248px     | Table ..................................|
| Search         | Energy  Track          BPM  Key  ...  + |
| Pillar  chips  | ▮▮▮▮▮▮▮ 7  Bicep – Glue  130  ● 8A    + |
| Energy tier    | ...                                     |
```

Below `bp-tablet` the rail becomes a "Filters" button with a `SideSheet`; below `bp-phone` rows render as two-line list items (`row-two-line`): track on line 1, energy, key, BPM on line 2.

## SetBuilderPage

| Region | Components |
|---|---|
| Header | `PageHeader` (Set builder: Peak time Friday), primary "Build set", secondary "Save set", overflow: Copy tracklist, Export, Print set, Send to TIDAL on the weekly run, Delete |
| Controls | `Card`: `TextField` set name, `SelectField` shape, `NumberField` length (min), `RangeSlider` × 3 genre mix weights, pool `SelectField` |
| Wave | `ChartFrame` + `EnergyWave` (bars per slot, dashed target) |
| Running order | `SetSlot` list with `TransitionNote` strips; `ShowMore` spares per slot |
| Saved sets | `SetCard` grid |

Desktop ≥ `bp-wide`: controls left (360px), wave + running order right. Tablet and phone: one column, controls collapse into a `Disclosure` once a set exists.

## GraphExplorerPage (canvas + side panel)

| Region | Components |
|---|---|
| Compact header | One-line `PageHeader`: title, `SegmentedControl` Play / Plan (`?mode=`), `GraphControls` button, overflow |
| Canvas | PIXI canvas filling the remaining height, `GraphStyles` from tokens, zoom `zoom-in`/`zoom-out`, reset `crosshair`, locate `locate-fixed`, legend |
| Side panel | Play: "Up next" recommendations (`TrackCell` + `CompatibilityBadge` + score band). Plan: `Tabs` Track analysis, Key & mood, Pathfinder, TIDAL, Spotify, Target tracks (`?tab=`) |
| Overlays | `ContextMenu` (node, edge, empty canvas), `Popover` node summary, `SideSheet` track detail |

```
| Graph: Neighbourhood of Bicep – Glue  [Play|Plan] [=] [⋯]|
| Canvas ................................. | Side panel 380|
|   ● ─── ●                                 | Tabs ......   |
|      ╲ ●  (now)                           | ...           |
```

Play is the booth view: fewer controls, `control-lg`, recommendations first, canvas secondary. Plan exposes everything. Phones get the list view (`MobileTrackExplorer` replacement) with the canvas behind a "Show graph" button.

## TrackDetailPage

`PageHeader` (Track: Bicep – Glue) · identity row (`KeyBadge` with name, `BpmReadout`, `EnergyBar`, duration) · `KeyValueGrid` (label, year, ISRC, Spotify ID, Beatport ID with `CopyButton`s) · `WaveformStrip` (intro/outro, breakdowns, vocal segments) · `SectionHeading` "Heard on" + `SourceBadge`s · "Plays well with" list (`TrackCell` + `CompatibilityBadge`) · `Disclosure` "Raw data". Same content serves the `SideSheet`.

## LogPage (log or entry page)

For records that accumulate: target tracks, the import log, run history, attribution fixes.

| Region | Components |
|---|---|
| Header | `PageHeader`, primary "Add target track" / "Import tracklist" |
| Entry | Inline `Card` form or `TracklistPaste` / `FileDrop` |
| Log | `DataTable` newest first: time (mono, Melbourne), what, who/source, result `StatusPill`, row overflow |
| Bulk | Selection bar appears when rows are selected: "3 selected · Archive · Export · Clear" |

## DailyViewPage (read-only daily view)

Today's radio plays or today's pipeline runs. `PageHeader` + `PeriodNav` (day) · `FigureTile` row · timeline list grouped by show or scraper (`.sn-group` rows), each item time + `TrackCell` + `SourceBadge` · an amber `--now` line at the current time on today. Show air times come from each source's schedule in the library data, never fixed slots. Read-only: no edit controls, only links to detail.

## WeeklyGridPage (weekly grid)

Shows × days (radio plays) or sets per week. `PeriodNav` (week) · grid: rows = the sources that aired ("PBS Elektrosophy", "3RRR Feel The Floor", "triple j Doof", with days and times read from each source's schedule in the library data), columns Mon–Sun, cells hold counts or `SetCard` minis · today's column header marked in amber `--now` · a week total column. Below `bp-tablet` the grid becomes one list per day.

## MatrixPage (matrix views)

Tracks × sources, artists × attributes, keys × energy. `PageHeader` · `SegmentedControl` for the matrix type · `Heatmap` or a `DataTable` with sticky first column and header · selection of a cell filters a `DataTable` below ("38 tracks in 8A at energy 7"). Always offer "Show as table".

## MonitoringPage

Pipeline health and recently scraped data.

| Region | Components |
|---|---|
| Header | `PageHeader` (Pipeline: Health), `FreshnessStamp`, `ConnectionStatus` (live updates) |
| Problems first | `Banner` per active incident ("1001tracklists paused after errors. Retries at 21:45 AEDT.") |
| Health | `ServiceStatus` grid: scrapers, proxies, enrichment, validation, API, database |
| Runs | `StagedProgress` for running jobs; `DataTable` of recent jobs with `StatusPill` |
| Recently scraped | `DataTable` newest first, `TrackCell`, `SourceBadge`, time |
| Trends | `ChartFrame` + `Sparkline`s (jobs per hour, failures per hour) |

Grafana stays the deep tool, linked with `TextLink --ext`; this page answers "is anything broken right now".

## SettingsPage

Two tiers, a card overview and one sub-route per setting:
1. **Settings overview (`/settings`)**: `PageHeader` (Services: Settings) · `SearchField` (filter settings cards by title, description, keywords) · responsive grid of neutral `Card` components (`grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`) · each card displays eyebrow lead, setting title, brief description, interactive control snippet, and card foot link (`Open setting page →` to `/settings/:settingId`) · empty filter panel with clear search action.
2. **Individual setting detail page (`/settings/:settingId`)**: `PageHeader` with quiet back action ("All settings") · focused `Card` container (max-width 720px) holding full section controls · card foot return link (`← Back to all settings`) · supports deep-linking directly to `/settings/streaming-services`, `/settings/api-keys`, `/settings/display-preferences`, `/settings/data-storage`, or `/settings/about-system`.

## RetiredPageNotice (moved or retired page)

A centred `Card` in the shell: title "This page has moved" or "This page is retired", one sentence saying where things went, a `TextLink` to the new place in its module colour, the date it changed. Auto-redirect only after one release. Used for old routes and old artifact links.

## ErrorPage

404 and 50x served by nginx (`error_page 404 /404.html; error_page 500 502 503 504 /50x.html;` in `nginx/nginx.conf`, root `/usr/share/nginx/html`). These files do not exist in the repo yet; create them.

- Static HTML, no JS, inline CSS only (copy the needed tokens as literals at build time), system font stack fallback after Inter, both themes via `prefers-color-scheme`.
- Content: wordmark text, `title-l` "Page not found" / "SongNodes is not responding", one sentence of what to do ("Check the address or go to Home." / "Try again in a minute. If it keeps happening, check Pipeline health."), a plain link to `/`, the request ID (`$request_id`, nginx `X-Request-ID`) in mono if available.
- The in-app 404 (`ErrorPage code={404}` route) uses the same words inside the shell.

## AuthCallbackPage (OAuth)

Spotify and TIDAL return to `/callback/spotify` and `/oauth/callback`. No shell. A centred `Card`: `StagedProgress` "Checking with Spotify → Saving connection → Done", then "Spotify connected" with a `TextLink` back to Settings (auto-return after 2 s). On failure `ErrorState`: what happened ("TIDAL did not accept the sign-in. The link may have expired.") and "Try again" to restart the flow. Never show raw codes or tokens; replaces the inline-styled "Loading..." fallback in `App.tsx`.

## PrintSheet

A print-only layout of a set or a list; see Print and export. Light theme, no shell, A4 portrait, traceability footer.
