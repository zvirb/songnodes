# FigureTile
A headline number with its label: the stats row at the top of a page, in Sora with tabular figures, neutral by default.

## When to use
- Use for 3–6 numbers that summarise the page below ("1,284 tracks", "47 need an energy check").
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

## Variants
- Neutral (`surface-1`, `line`): everywhere except module hubs.
- Tonal `sn-figure-tile--tonal` inside an `sn-m-<module>` scope: module hub pages only; label, delta and unit take `--m-muted`.
- Loading `sn-figure-tile--skeleton` with an `sn-skel` in place of the figure and `aria-busy="true"`.

## Content rules
Figures formatted with `SongNodes.format.count` ("1,284"), signed deltas with true signs ("+38", "−3"). The label says what is counted, in sentence case ("High rotation"). The delta names the period ("+38 added last run", "+412 in the last 24 h"). Link text is a verb ("Show these", "Review") and goes to the list filtered to exactly that number.

## Accessibility
The row is a list, so screen readers announce the item count. Figure and label read in order ("47 Need an energy check"). The status pill always carries a word. Don't animate figures counting up.

## Responsive
Auto-fit grid: 5 across on desktop, 2–3 on tablet, 2 on phone (min 160px). On wall displays keep the figure size; add space, not scale.

## Do / don't
- Do keep one figure per tile; put context in the delta.
- Don't colour the figure by status. Status goes in the pill.
- Don't make the whole tile a link; one link in the footer.

## In the music library / SongNodes
Replaces the Naarm Set Builder stats row (1,284 tracks · 212 high rotation · +38 added last run · 611 with key + BPM · 47 need energy check) and the top numbers in `StatsPanel.tsx`. The Pipeline hub uses the tonal form for scrapers running, tracklists scraped and the enrichment queue.
