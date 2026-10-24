# GraphExplorerPage

The graph workspace: what to play next from the track that is on now, with the graph around it and one selected track open beside it.

## When to use / not use
`/graph` (`?mode=play|plan`, `?track=`). Also `/paths` with the Pathfinder panel. Not for library browsing (use `LibraryPage`).

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Shell | `AppHeader` with the Play/Plan `SegmentedControl` (`--sm`, sentence case "Play" / "Plan") and `ConnectionStatus` "Live"; `NavDrawer` | Mode in the header so it stays reachable in booth use |
| Compact header | One line: `h1` `title-s` "Graph: **Neighbourhood of Bicep – Glue**", mono counts, "Filters (1)" button, `OverflowMenu` | `.sn-page-graph__bar` |
| Up next (first) | Now-playing block (`TrackCell` with Now, `EnergyBar`, `KeyBadge` with name, `BpmReadout`, 3px amber `--now` bar), `SectionHeading`, ranked list: `TrackCell` + reason, `KeyBadge`, BPM, `EnergyBar`, `TransitionNote` from now (energy, key, BPM), "Play next" | `.sn-page-graph__recs` (320px, 360px on wall) |
| Canvas | `GraphControls` frame holding the graph drawn per `GraphStyles` (node fill set by the "Colour by" control: Neutral by default, or Energy, Key, Genre, with the legend matching the mode; amber now ring + "Now" tag, lavender selected ring, edge types and weights, labels with halo), count chip, compact legend, dock: zoom in/out, reset, centre on now playing | `.sn-page-graph__stage` |
| Track details | `SideSheet` (non-modal ≥768px, bottom sheet below): `KeyValueGrid` with ISRC `CopyButton`, connected tracks with `CompatibilityBadge`, links; foot "Path from here" (Pathfinder module button) and primary "Set as now playing" | `--sheet-w` 340px (420px on wall) |

## Data
`GraphExplorerPageProps`: mode, now playing, recommendations with reasons, nodes and edges, selected track, connection state.

## States
- First load: recommendations skeleton (6 two-line rows); canvas shows `LoadingState` inline "Laying out 48 tracks…".
- Refresh: live updates swap recommendations in place; the layout keeps positions (no re-shuffle).
- Empty: no now playing → `EmptyState` "Pick a track to start" with search; canvas shows the whole graph.
- Error: canvas region only: `ErrorState` "SongNodes couldn’t load the graph (503)" with Try again and reference; recommendations from cache stay.
- Offline: `ConnectionStatus` offline in the header, banner under it; graph frozen at the last data.

## Responsive
≥768px: recommendations | canvas | side sheet. <768px: recommendations list first, canvas behind "Show graph"; side sheet opens as a bottom sheet with scrim. Wall (≥1920): wider panels, canvas full-bleed (no `content-max`). Booth: Play mode, larger type, recommendations first; the canvas is secondary.

## Primary action
"Set as now playing" (one per view, in the sheet); "Play next" on the top suggestion is secondary.

## Replaces
DJInterface PLAY/PLAN (iOS-green/blue mode buttons, emoji header), the "Intelligent browser", `TrackDetailsModal` over the graph, `RadialMenu`, the old Perfect/Compatible/Default legend. No 2D/3D switch: the 3D graph and Camelot helix are retired.
