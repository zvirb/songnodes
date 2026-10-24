# WeeklyGridPage

Shows × days for one week: plays and new tracks per cell, today's column marked in amber `--now`, totals per day and per show, and one list per day on phones.

## When to use
- Use this page to compare a week at a glance: radio plays (Week of 19 Oct 2026), or sets per week.
- Not for one day's detail (DailyViewPage) or for long periods (MatrixPage heatmap calendar).

## Anatomy
| Region | Component |
|---|---|
| Shell | `AppHeader`, `NavDrawer`, `.sn-skip` |
| Header | `PageHeader` "Radio plays: Week of 19 Oct 2026", stamp, "View only" pill |
| Week | `PeriodNav` (week, no scale; weeks start Monday; next disabled on the current week) |
| Totals | `FigureTile` × 4 |
| Grid | `.sn-tablebox` + `table.sn-table.sn-page-weekly__grid` with `role="grid"`: row headers = shows with slot; columns Mon–Sun, each header a `TextLink` to that day's DailyViewPage; Week column; `tfoot` "All shows" row |
| Cells | `.sn-page-weekly__cell`: plays (mono) over "3 new"; "–" no episode; "Not yet" for future days |
| Today | `th[data-today]` with a 3px amber `--now` underline and the word "Today"; its cells carry a 3px `--now` line. Amber is the now token, not brand |
| Detail | `Tooltip` on hover and focus: "Sat 24 Oct · PBS Electric Sunset 13:00–15:00: 8 plays, 3 new to library" (same text is the cell's `aria-label`) |
| Phone | `.sn-page-weekly__days`: `Card --list` per day, today marked |

## Keyboard
One tab stop in the grid (roving `tabindex`). Arrows move by cell, Home/End to row ends, Enter opens that day. [ and ] change week.

## Data
`rows` of `{show, slot, days: WeekCell[7]}`, `weekOf` (always a Monday: "Week of 19 Oct 2026"), `today`. Show days and air times are never fixed slots in the UI: they are read from each source's schedule in the library's source data (source ids such as `PBS_Elektrosophy`, `RRR_FeelTheFloor`, `triplej_Doof`, `ARIA_Club`, `Balance_Selections`), shown with the name the source uses ("PBS Elektrosophy", "PBS Electric Sunset", "3RRR Feel The Floor", "triple j Doof", "Balance Selections"). The times in the preview are examples. Rows are the sources that aired that week, in schedule order.

## States
Loading: grid skeleton with headers kept. Refresh: values swap in place. Empty week: `EmptyState` "No plays in the week of 12 Oct. The radio scrapers were off." Error: `ErrorState` in place of the grid. Offline: stale stamp.

## Responsive
Below 768px the grid becomes one card per day (Mon–Sun), each listing the shows that aired with "plays · new". Desktop/wide: grid. Wall: the grid suits a wall display; cells keep their size, space grows.

## Primary action
None (read-only). Links to each day.

## Replaces
New. The planned "Weekly run report" view in the music library.
