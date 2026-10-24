# DailyViewPage

A read-only view of one day: radio plays per show for "Radio plays: Sat 24 Oct", with 24-hour times, which plays were new to the library, and a now line in the show that is still on air.

## When to use
- Use this page to see what happened on one day: radio plays (`#/plays/2026-10-24`) or a day of pipeline runs.
- Not for editing anything; it has no edit controls, only links to detail.

## Anatomy
| Region | Component |
|---|---|
| Shell | `AppHeader`, `NavDrawer`, `.sn-skip` |
| Header | `PageHeader` (Sources › Radio plays, title "Radio plays: Sat 24 Oct", stamp "Radio plays as of …", `StatusPill` info "View only"); no actions |
| Day | `PeriodNav` (day, no scale): ‹ › with [ and ], Today (disabled on today), "Saturday 24 Oct 2026"; next is disabled on today |
| Totals | `FigureTile` × 4: plays, new to library, already in crate, shows on air |
| Timeline | `SectionHeading` "Plays: by show" + link to the week; `DataTable --stack` with `.sn-group` rows per show (name, slot, plays · new, "On air" pill); rows: time `.sn-page-daily__time`, `TrackCell`, Library (`TextLink` "In crate" in Library colour, or `CategoryTag` "New to library"), Also heard on (`SourceBadge` +N) |
| Now | `.sn-page-daily__now`: a 2px amber `--now` line labelled "Now 21:30" after the last play of the show on air, then a one-line note on when later plays arrive |

## Data
`ShowDay[]` for the date, `dataFrom`, `now` (see `61-pages-b.d.ts`). Show days and air times are never fixed slots in the UI: they are read from each source's schedule in the library's source data (source ids such as `PBS_Elektrosophy`, `RRR_FeelTheFloor`, `triplej_Doof`, `ARIA_Club`, `Balance_Selections`), shown with the name the source uses ("PBS Elektrosophy", "PBS Electric Sunset", "3RRR Feel The Floor", "triple j Doof", "Balance Selections"). The times in the preview are examples. A show with no schedule entry is grouped by its play times only.

## States
- First load / another day: skeleton rows in the table, tiles keep their place.
- Refresh: rows stay; stamp shows "Updating…"; new plays append under their show, never reorder.
- Empty: "No plays on Sun 25 Oct yet. The first show airs at 13:00." (the time from the source schedule) (`EmptyState --compact`).
- Error: `ErrorState` in place of the table ("Radio plays didn't load"), PeriodNav still works.
- Offline: stamp turns ▲ with the last fetch time; data stays.

## Responsive
Phone: tiles 2 across; rows become cards with time on top; the now line spans the list. Tablet/desktop: table. Wall/booth: works as a wall display of today; keep it on today and let live plays append.

## Primary action
None (read-only). Links: track → Library, week → WeeklyGridPage.

## Replaces
New. Planned "Radio plays by day" in the music library; replaces scrolling the raw play log in the weekly run output.
