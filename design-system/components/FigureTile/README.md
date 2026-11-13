# FigureTile
A headline number with its label: the stats row at the top of a page, in Sora with tabular figures, neutral by default.

## When to use
- Use for 3–6 numbers that summarise the page below ("1,284 tracks", "47 need an energy check").
- On a figure page (`21-figure-pages.md`) use the summary band: at most four link tiles and one reading sentence, each tile the headline of one section.
- Don't use for a single status (use StatusPill) or for numbers you compare across rows (use DataTable).

## Anatomy and markup
`sn-figure-tile-row` (auto-fit grid, min 160px) holds `sn-figure-tile` items: `__figure` (Sora 2rem, tabular), optional `__unit` ("of 7"), `__label` (`fg-2`), optional `__delta` (mono, `fg-3`), optional `__foot` with a StatusPill and/or a `sn-link` to the filtered view.
```html
<div class="sn-figure-tile-row" role="list" aria-label="Library at a glance">
  <div class="sn-figure-tile" role="listitem">
    <span class="sn-figure-tile__figure">47</span>
    <span class="sn-figure-tile__label">Need an energy check</span>
    <div class="sn-figure-tile__foot"><span class="sn-pill sn-status-pill" data-status="warn">To check</span>
      <a class="sn-link sn-m-library" href="/library?check=energy">Review</a></div>
  </div>
</div>
```

## Link form (1.14.0)
On a summary band, or where a figure has its own detail page, the whole tile is the link: `a.sn-figure-tile.sn-figure-tile--link`, with the destination named in `__go` (words and a `chevron-right`), so the link is not carried by the edge alone. Nothing inside a link tile is a link or a button: no `__foot` link, no InfoTip. A StatusPill is allowed because it is not interactive.
```html
<section class="sn-figure-band" aria-label="Library this week">
  <div class="sn-figure-tile-row" role="list">
    <div class="sn-figure-band__item" role="listitem">
      <a class="sn-figure-tile sn-figure-tile--link" href="#missing">
        <span class="sn-figure-tile__figure">673</span>
        <span class="sn-figure-tile__label">Missing key or BPM</span>
        <span class="sn-figure-tile__delta">52% of the library</span>
        <span class="sn-figure-tile__go">Missing data <svg class="sn-icon">…chevron-right…</svg></span>
      </a>
    </div>
    …
  </div>
  <p class="sn-figure-band__read">The library grew by 38 tracks to 1,284 on the last run. Just over half still have no key or BPM: …</p>
  <p class="sn-figure-band__rest">Not connected: TIDAL plays. Awaiting the weekly run: Vault.</p>
</section>
```
| Tile does | Element | Notes |
|---|---|---|
| Jumps to its section, or opens the figure's detail page | `a.sn-figure-tile--link` | Same tab; the detail page repeats the figure once, as its first figure, from the same calculation |
| Leads to the list filtered to that number | `div` with one `sn-link` in `__foot` ("Show these") | The existing form; unchanged |
| Neither | `div` | No hover, no pointer |

`sn-figure-band__item` is the list item around a link tile (an `a` cannot be the list item itself); it stretches the tile to the row height.

## State tiles (1.14.0)
A tile with no trustworthy figure says so in words. `__state` (an icon and fixed words) takes the place of `__figure`; the label and one note stay. A state tile never shows 0, an en dash or an estimate, and never carries a StatusPill or a status ground: a missing service is not a result.

| State | Markup | Icon | Words (fixed) | Note says |
|---|---|---|---|---|
| A service that is not connected | `data-state="not-connected"`, `surface-2` ground | `plug` | "Not connected" | What connecting adds ("Connect Spotify to count plays"). May be a link tile to Services |
| Worked out by the weekly run, which has not run since the data changed | `data-state="awaiting"` | `clock` | "Awaiting the weekly run" | The next run ("Next run Sat 14 Nov, 06:00 AEDT") |
| Outside its plausible range | `data-state="implausible"` | `triangle-alert` in `status-warn` | "Implausible" | The figure and the reason ("Reads 248 BPM: 31 of 38 tempos are doubled"), and that it is left out of totals |

```html
<div class="sn-figure-tile" role="listitem" data-state="awaiting">
  <span class="sn-figure-tile__state"><svg class="sn-icon">…clock…</svg>Awaiting the weekly run</span>
  <span class="sn-figure-tile__label">High rotation</span>
  <span class="sn-figure-tile__delta">Next run Sat 14 Nov, 06:00 AEDT</span>
</div>
```
- In a table the implausible figure is the warn StatusPill "Implausible" in place of the number, with the figure and the reason in the row's note or an InfoTip after the column header.
- An implausible figure is left out of every total, median and mean it would feed, and the note of that total says so ("31 implausible tempos left out").
- The plausible range is fitted per figure from the library's own history and arrives with the data; the component never hard-codes one.
- State tiles never outnumber figure tiles in a row. When they would, the row keeps its figure tiles and `sn-figure-band__rest` lists the rest in one line.
- Loading is still the skeleton variant; "Awaiting the weekly run" is not a loading state.

## Estimate tag (1.14.0)
A figure worked out from a model and not measured (a set's length after trims from average track lengths, a projected run time) carries the flat tag "Estimate" inside its label: `<span class="sn-tag sn-figure-tile__tag">Estimate</span>`. An estimate never shares a total with measured figures unless the total is tagged too.

## Variants
- Neutral (`surface-1`, `line`): everywhere except module hubs.
- Tonal `sn-figure-tile--tonal` inside an `sn-m-<module>` scope: module hub pages only; label, delta and unit take `--m-muted`.
- Loading `sn-figure-tile--skeleton` with an `sn-skel` in place of the figure and `aria-busy="true"`.

## Content rules
Figures formatted with `SongNodes.format.count` ("1,284"), signed deltas with true signs ("+38", "−3"). The label says what is counted, in sentence case ("High rotation"). The delta names the period ("+38 added last run", "+412 in the last 24 h"). Link text is a verb ("Show these", "Review") and goes to the list filtered to exactly that number.

## Accessibility
The row is a list, so screen readers announce the item count. Figure and label read in order ("47 Need an energy check"). The status pill always carries a word. Don't animate figures counting up. A link tile is one tab stop and reads as one link ("673 Missing key or BPM, 52% of the library, Missing data"); its focus ring is the page's `focus` outline on the tile. State icons are decorative (`aria-hidden`): the fixed words carry the state, so it never rests on colour or shape alone.

## Responsive
Auto-fit grid: 5 across on desktop, 2–3 on tablet, 2 on phone (min 160px). On wall displays keep the figure size; add space, not scale.

## Do / don't
- Do keep one figure per tile; put context in the delta.
- Don't colour the figure by status. Status goes in the pill.
- A tile is a link as a whole (link form) or carries one link in its footer, never both: no link inside a link.
- Don't show 0 for a service that is not connected, or 100% for something that was not measured.
- A tile does nothing on press, so it is never a `button` or a link and has no hover edge, pressed state, pointer cursor or focus stop (RAC-061, RAC-062). The one link in its footer is its only control.

## In the music library / SongNodes
Replaces the Naarm Set Builder stats row (1,284 tracks · 212 high rotation · +38 added last run · 611 with key + BPM · 47 need energy check) and the top numbers in `StatsPanel.tsx`. The Pipeline hub uses the tonal form for scrapers running, tracklists scraped and the enrichment queue.

On HomePage the "Since your last visit" row may use link tiles into the modules; MonitoringPage uses the summary band for jobs, scraper success, the review queue and proxies; the stats views (plays, rotation, key and BPM spread) open with one. Streaming figures from a service that is not connected (Spotify, TIDAL) are "Not connected" tiles; rotation and link strength before the first weekly run are "Awaiting the weekly run".

## Differs from beanAlliance
- beanAlliance `KpiTile` states `.kpi.off` "Not monitored" and `.kpi.await` "Awaiting feed" become `data-state="not-connected"` "Not connected" and `data-state="awaiting"` "Awaiting the weekly run"; `.kpi.suspect` becomes `data-state="implausible"`.
- Icons are Lucide: `plug` for `plugs`, `clock` for `hourglass-medium` (nearest in the subset), `triangle-alert` for `warning`.
- The link tile names its destination (`__go`) as well as taking a stronger edge, and opens in the same tab.
- The figure and reason of an implausible value are visible text (the note), never a `title`.
- No filter tile (`button.kpi`), no gates or approved targets, no CrossCheck chip, no tile for people: SongNodes filters with FilterChip and a footer link, and has one user.
