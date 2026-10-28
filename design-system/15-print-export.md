# Print and export

Paper and files leave the app and lose context, so they must carry it: what this is, where it came from, when, and how fresh the data was. Nothing downloads or prints unless the person asks.

## Print flow

- Artifacts (the music library, Claude-hosted pages) have no print buttons: `window.print()` is blocked in the sandbox and people use the browser's own print. The print stylesheet still applies.
- SongNodes may offer "Print set" (icon `printer`) in the `PageHeader` overflow of `SetBuilderPage` only. It opens `PrintSheet`, a print-ready route (`/sets/:id/print`) that calls `window.print()` after fonts load (`document.fonts.ready`).
- Other pages print with the generic rules below; no other "Print" buttons.

## Print rules (`@media print`)

| Rule | Implementation |
|---|---|
| Light theme forced | `@media print { :root { color-scheme: light; } }` plus the light token values re-declared under `@media print` (`tokens.css` does not emit this block yet: add it to `source/build_tokens.py`; until then `PrintSheet` sets `data-theme="light"` before printing). Booth and dark never print. |
| Shell hidden | `AppHeader`, `NavDrawer`, `.sn-skip`, `FilterRail`, toasts, tooltips, `CommandPalette`: `display: none`. |
| Controls hidden | Buttons, chips, inputs, `OverflowMenu`, `CopyButton`, row actions, `SetSlot` controls, `ShowMore` (expand content instead). Mark extra items with `data-print="hide"`; force with `data-print="show"`. |
| Page | `@page { size: A4 portrait; margin: 14mm 12mm 18mm; }`. Landscape only for `WeeklyGridPage` and `MatrixPage` (`@page wide { size: A4 landscape; }`, `page: wide`). |
| Type | Body 10pt Inter, titles Sora; `pt` units are allowed only in print CSS. Text `#1c1c1e` (light `fg`) on white. |
| Colour | `print-color-adjust: exact` only on `EnergyBar`, `KeyBadge` dot and `EnergyWave`; everything else may drop backgrounds. |
| Breaks | `break-inside: avoid` on `SetSlot`, `Card`, table rows, `FigureTile`; `break-after: avoid` on headings; repeat `thead` (`display: table-header-group`). |
| Links | Internal links print as text; external links append the domain in `fg-3`: `a.sn-link--ext::after { content: " (" attr(data-host) ")"; }`. |
| Charts | Print as SVG; canvas (PIXI graph) is replaced by "Graph view not printable. Open at <URL>." |

## Set list on paper (`PrintSheet`)

- One A4 page holds up to 24 tracks; 25–48 tracks use two pages with the header repeated. Row height 9mm.
- Header: thin–bold title "Set: Peak time Friday", shape, length "1 h 52 min", track count, BPM range "124–130 BPM".
- Columns: Slot, Time in (cumulative "0:00", "6:12"…), Track ("Artist – Title"), BPM, Key ("8A A minor"), Energy, Transition note ("energy +1 · +1 key · +2 BPM").
- Energy prints as the number plus the ten-segment bar. Lit segments also carry a pattern so greyscale stays readable: Low tier solid, Building tier diagonal hatch, High tier cross-hatch (SVG `<pattern>` or `repeating-linear-gradient`, the only gradient allowed).
- Compatibility prints as glyph + word ("● same key"), never colour alone.
- Locked slots print a `lock` icon; spare suggestions do not print.
- Optional blank "Notes" column (30mm) when the person ticks "Add a notes column" in `PrintSheet`.

## Traceability footer

Every printed page carries, in `body-s` `fg-3`, via a fixed footer element repeated per page:

```
Peak time Friday · Set builder · SongNodes   songnodes.local/sets/peak-time-friday
Printed 24 Oct 2026, 21:30 AEDT · Data from 24 Oct 2026, 06:00 AEDT · Page 1 of 2
```

- Page title as in the document title; full URL of the view (with query); printed stamp `SongNodes.format.stamp(new Date())`; data freshness from `FreshnessStamp`; page x of y via `@page { @bottom-right { content: "Page " counter(page) " of " counter(pages); } }` where supported, else "Page 1" only from a JS paginated `PrintSheet`.

## Exports and downloads

Downloads happen only after an explicit action naming the format ("Export set as CSV"). No auto-downloads on load, no background exports, no downloads from a toast without a click. In artifacts, deliver files through the host's download capability; if unavailable, show the content in a read-only `textarea` with `CopyButton`.

### File names

`songnodes-<what>-<yyyy-mm-dd>-<hhmm>.<ext>`, date and time in Melbourne time, lowercase, hyphens, the object slugged (`[a-z0-9]+` joined by hyphens, max 40 chars).

| Export | Example |
|---|---|
| Set as CSV | `songnodes-set-peak-time-friday-2026-10-24-2130.csv` |
| Set as JSON | `songnodes-set-peak-time-friday-2026-10-24-2130.json` |
| Set as M3U | `songnodes-set-peak-time-friday-2026-10-24-2130.m3u` |
| Tracklist text | `songnodes-tracklist-peak-time-friday-2026-10-24-2130.txt` |
| Target tracks | `songnodes-target-tracks-2026-10-24-2130.json` |
| Graph stats | `songnodes-graph-stats-2026-10-24-2130.csv` |
| Library view | `songnodes-library-2026-10-24-2130.csv` (the filters used are recorded in the JSON export only; CSV stays pure rows) |

The music library uses `music-library-<what>-…`. This replaces `songnodes-stats-${Date.now()}` in `StatsPanel.tsx`, `target_tracks_<ISO date>.json` in `TargetTracksManager.tsx` and `<name>_setlist.json` in `SetlistBuilder.tsx`.

### CSV

- UTF-8 with BOM (Excel opens en dashes and ♭ correctly), comma separated, CRLF line ends, RFC 4180 quoting, header row in sentence case.
- Set columns: `Slot,Artist,Title,BPM,Key,Key name,Energy,Duration,Time in,Transition,Locked,Spotify ID,TIDAL ID,ISRC`.
- Library columns follow the visible table order, plus IDs. Values raw, not decorated: BPM `124.5`, key `8A`, energy integer `7` (legacy converted values exported as converted integers with an `Energy source` column `legacy_0_1`), durations `m:ss`, times ISO 8601 with offset (`2026-10-24T21:30:00+11:00`), missing values empty (not "–").

### JSON

```json
{
  "schema": "songnodes.set",
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-10-24T21:30:00+11:00",
  "source": "https://songnodes.local/sets/peak-time-friday",
  "dataFrom": "2026-10-24T06:00:00+11:00",
  "set": { "id": "set_pt_fri", "name": "Peak time Friday", "shape": "peak_time", "lengthMin": 112,
    "tracks": [ { "slot": 1, "artist": "Josh Baker", "title": "Lost In Muzik", "bpm": 126, "key": "8A",
      "energy": 5, "energyScale": "dj_1_10", "durationSec": 372, "locked": false,
      "ids": { "spotify": "…", "tidal": "…", "isrc": "…" } } ] }
}
```

- Always include `schema` and `schemaVersion` (semver; major bump when a field is removed or renamed). Importers reject unknown majors with a clear `ErrorState`.
- Keys in camelCase; durations in seconds (`durationSec`), never ms; times ISO 8601 with Melbourne offset.

### Tracklist text

Plain text for pasting into Discord, Mixcloud or a show log:

```
Peak time Friday · 1 h 52 min · 24 tracks
01  0:00  Josh Baker – Lost In Muzik  [8A · 126]
02  6:12  Bicep – Glue  [8A · 128]
```

- Two-digit slot, cumulative time, "Artist – Title", key and BPM in brackets. No energy, no emoji. "Copy tracklist" copies exactly this text.

### M3U and TIDAL

- M3U: `#EXTM3U`, then per track `#EXTINF:<seconds>,<Artist> – <Title>` and the stream or file URL if known; tracks without a URL are listed as comments `# not found: Artist – Title` so the count is honest.
- TIDAL and Spotify: "Send to TIDAL" creates or updates a playlist named after the set; the music library queues it "on the weekly run" and shows the queued state with `StatusPill` (idle "Queued for Sun 25 Oct"). Report the result: "Sent 22 of 24 tracks to TIDAL. 2 not found: …".

### What each export includes

| Export | Includes | Excludes |
|---|---|---|
| Set CSV / JSON | Running order, locks, transitions, IDs, controls (JSON) | Spare suggestions, drafts of other sets |
| Tracklist text | Slot, time, artist, title, key, BPM | IDs, energy |
| M3U | Order, durations, URLs | Metadata beyond the title |
| Library CSV | The rows currently filtered, visible columns + IDs | Hidden columns; JSON adds the filter and sort used |
| Graph stats CSV / JSON | Metrics table shown, with generated time | Node positions |
| Target tracks JSON | All target tracks with priority and archive state | Search history |
