# LogPage

A page of records that accumulate (target tracks, the import log, run history, attribution fixes): filter chips, a selectable table with bulk actions, an entry dialog, and an append-only run log underneath.

## When to use
- Use this page to keep a growing list of records and act on several at once. First instance: **Sources: Target tracks** (`/sources/targets`).
- Not for browsing the crate (LibraryPage) or for a one-day timeline (DailyViewPage).

## Anatomy
| Region | Component |
|---|---|
| Shell | `AppHeader` ("Sources: Target tracks", "Searched 3 h ago"), `NavDrawer`, `.sn-skip`, toast region |
| Header | `PageHeader` (Sources › Target tracks; secondary "Import JSON"; More actions: Export as JSON, Search all active now, Show archived; primary **Add target track**) |
| Toolbar `.sn-page-log__toolbar` | `FilterChip` groups Priority (labels from `SongNodes.status(p, "priority")`) and State; `ProgressRing` 40 "Fully found 3 of 11" |
| Records | `DataTable --stack`: select, `TrackCell` (genres · search terms, flag "Not found yet"), priority as a neutral `CategoryTag` ("High", "Medium", "Low"); only Critical is a red `StatusPill` bad ✕ "Critical" (decided: priority is a category, Critical is the one value that needs action), state pill (Searching / Paused / Archived), `ProgressRing` 24 "3 of 4" checks, In tracklists, last searched `FreshnessStamp` (▲ after 8 days, absolute stamp in `Tooltip`), row `OverflowMenu` |
| Bulk bar `.sn-page-log__bulk` | In the `DataTable` bar when rows are selected: Activate, Pause, Archive, Delete…, Clear selection |
| Entry | `Dialog --m`: `TextField` Title and Artist, `ChipInput` Genres and Search terms, `SelectField` Priority |
| Confirm | `ConfirmDialog` for Delete ("Delete 2 target tracks?"), Cancel focused |
| Run log | `SectionHeading` + `DataTable`: run (mono stamp), added, updated, errors, duration, result `StatusPill`, "Job log" `TextLink` (Pipeline colour) |

## Data
`TargetTrack[]` and `RunLogEntry[]` (see `61-pages-b.d.ts`); next run time.

## States
- First load: 5 skeleton rows in the table (`LoadingState`), chips disabled with counts "–".
- Refresh: rows stay; `FreshnessStamp` shows "Updating…".
- Empty: `EmptyState` first-use "No target tracks yet. Add a track SongNodes should hunt for." → Add target track. Filtered to nothing: compact state row with "Clear filters".
- Error: `ErrorState` replaces the table only; the run log keeps working.
- Offline: header `ConnectionStatus` "Offline"; Add and bulk actions queue on the device and say so in the toast.

## Behaviour
- Activate and Pause apply at once (no message). Archive applies at once with an **Undo** toast. Delete always confirms, naming the count. Search now and Add confirm with a toast.
- Archived rows are hidden until State › Archived or "Show archived" is on.
- Sort by any header; selection survives sorting and filtering; select-all covers the rows shown.
- The run log is append-only: no edit controls, newest first, failures explained in one line.

## Responsive
Phone (<600px): rows become stacked cards; secondary actions fold into More actions; the primary fills the row. Tablet: toolbar wraps. Desktop/wide: as shown. Wall/booth: not a booth page; booth theme only enlarges type.

## Primary action
Add target track.

## Replaces
`TargetTracksManager.tsx` (its table, `window.confirm` deletes, emoji buttons and `target_tracks_<ISO>.json` export) and the "Targets" tab of the DJ Interface right panel.

## Locations (1.4.0)
A log line or job detail names a file by its file name and a place in words ("Wrote songnodes-target-tracks-2026-10-24-2130.json to the Pipeline output folder"); a path never appears in the log text. A row that lists a file may carry the icon-only path copy (CopyButton, 1.4.0).
