# DataTable
The table for every list of records: sortable headers, sticky header, right-aligned numbers, selection, row actions, grouping, flagged and now rows, density, a column chooser, and stacked cards on phones.

## When to use
- Crate/library, target tracks, scraper jobs, proxies, the data-quality queue, import results: anything people scan, sort and compare.
- Don't use for label/value pairs (KeyValueGrid) or running orders (SetSlot).

## Anatomy and markup
`sn-data-table sn-data-table--stack` → `__bar` (count, bulk action, group `sn-seg`, density `sn-seg`, `__chooser`) → `sn-tablebox sn-data-table__box` (scroll box, max-height 480px, `position: relative`) → `table.sn-table` with a `caption`. Cells: `th/td.num` (right-aligned mono), `__sel` (checkbox), `__track` (TrackCell, takes the spare width and truncates), `__actions` (row end). Every other `td` carries `data-label` for the phone layout.

## Behaviour
- Sorting (WAI-ARIA APG sortable table): each sortable header holds a `<button>`; only the sorted `th` has `aria-sort`. One sort at a time; activating the sorted column flips direction; a new column starts ascending. Ties break by artist, then title. Unsorted sortable headers show a faint ↕ (shape, not just colour); arrows are hidden from the accessible name. The caption says headers are sortable, and a polite live region announces "Sorted by BPM, ascending, then by artist".
- Selection: a checkbox per row, labelled with the track. The header checkbox selects all and goes `indeterminate` when some are selected. Selected rows get `data-selected` (`brand-soft`). The bar shows "11 selected" and the bulk action ("Add 11 to set").
- Row actions: at most 2 quiet `sn-btn--sm sn-btn--icon` buttons, then an OverflowMenu trigger (`aria-haspopup="menu"`), at row end.
- Grouping: `tr.sn-group` rows (sticky under the header) by energy tier (High, Building, Low, not set) or pillar, each with a count.
- Flagged rows `data-flag` (`flag-bg`) always pair with a TrackCell flag word. The now row `data-now` gets the 3px amber `--now` bar (now is its own amber token; selection stays `brand-soft`).
- Density: comfortable 40px or compact 32px via `data-density`, saved per person with `SongNodes.prefs.setDensity`.
- Column chooser: a disclosure button with `aria-expanded`. "Shown by default" (crate: Energy, Track, BPM, Key, Pillar, Rotation, Heard) and "Optional" (Last heard, Links, Label, Duration, Year, Sources). Track can't be hidden. "Reset to default"; Escape closes and returns focus. Save choices per person.
- States: loading (5 skeleton rows, `aria-busy`), empty (why nothing matched and how to widen it), error (what failed and what to do, Try again, `role="alert"`). The header stays visible in all three; select-all is disabled.

## Alignment
Numbers right-aligned in mono tabular figures, with the header aligned the same way. Text left. Dates "24 Oct 2026" with the full stamp in `title`. Missing values "–".

## Responsive (decision)
Below 600px rows become stacked cards (`--stack`): checkbox, TrackCell and actions on top, then labelled values. Chosen over horizontal scroll with a frozen column because crate browsing on a phone is one track at a time, the Track column alone is wider than a phone, and cards keep 44px touch targets. Leave out `--stack` (plain scrolling box) only for wide numeric tables, such as pipeline metrics, where columns must be compared.

## Do / don't
- Don't animate rows in, or sort on hover.
- Don't tint whole rows by status; `flag-bg` and selection are the only row fills.

## In SongNodes / the music library
Replaces the Naarm crate table, the `TargetTracksManager.tsx` table, the `DataQualityReview.tsx` queue, rows in `VirtualizedTrackList.tsx`, and is the table for the planned scraper jobs and proxy health views.
