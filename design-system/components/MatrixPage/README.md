# MatrixPage

Two crossed lists on one page: tracks × sources (which shows and sites played which track, ● with counts) and a keys × energy coverage heatmap whose cells filter a track list.

## When to use
- Use this page to spot overlap, gaps and clusters across two dimensions: "Sources: Who played what", "Key & mood: Library coverage".
- Not for reading one record (TrackDetailPage) or a single time series (ChartFrame).

## Anatomy
| Region | Component |
|---|---|
| Shell | `AppHeader`, `NavDrawer` |
| Header | `PageHeader` "Sources: Who played what", period in the description, More actions: Export as CSV |
| Switch | `Tabs` (module-coloured line): Tracks × sources (12), Keys × energy (1,284); `?tab=` |
| Filters | `FilterChip` group Sources (Radio, Charts, Tracklists hide their columns), `Checkbox` "Played on 2+ sources", live count |
| Matrix | `.sn-tablebox.sn-page-matrix__box` (scrolls both ways, focusable region) + `table.sn-page-matrix__grid`: sticky header row and sticky first column (`TrackCell`), cells `.sn-page-matrix__mark` "● 3" or "–", Total "27 · 5 sources"; every header sorts, Total descending by default |
| Coverage | `Card` + `ChartFrame` + `Heatmap` (24 keys × energy 1–10, tier gaps), "View as table" toggle |
| Selection | `.sn-page-matrix__picked`: `SectionHeading` "Library: 31 tracks in 8A at energy 7" + `TextLink` "Show all 31 in Library" (Library colour) + compact table (`KeyBadge`, `EnergyBar`); zero cells say "A gap worth filling" |

## Data
`sources`, `rows` with counts per source, `coverage[24][10]`, period.

## States
Loading: skeleton rows / skeleton grid. Empty: `EmptyState` "No plays from these sources in the last 4 weeks." with "Show all sources". Error: `ErrorState` in place of the active tab only. Offline: stale stamp; data stays.

## Responsive and phones
- Desktop/wide: full matrix; the box caps at 560px tall and scrolls with header and track column pinned.
- Tablet: same, scrolling sideways with the track column pinned.
- Phone (<600px): the matrix becomes one card per track listing only the sources that played it ("PBS Soul Time ● 3 · 1001tracklists ● 14", "Total 27 across 5 sources"), because a 7-column grid with a pinned track column leaves no room for values. The heatmap scales to the card width and keeps cell focus; "View as table" gives exact numbers.
- Wall: not a wall page.

## Primary action
None; the cell → Library link is the way on.

## Replaces
New for Sources. On Key & mood it replaces the key bar chart in `StatsPanel.tsx` and the per-key list in `KeyMoodPanel.tsx`.
