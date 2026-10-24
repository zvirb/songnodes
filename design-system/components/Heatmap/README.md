# Heatmap

A grid of cells shaded by count on one sequential ramp, from `surface-2` (none) to brand lavender (most): key × energy coverage of the library, and a plays-by-day calendar per show. Counts appear on hover and focus; a ramp legend gives the min and max.

**Use** when two categorical axes cross and the question is "where are the gaps and clusters?". **Don't** use for exact comparison of a few values (bar chart) or for anything with a meaningful midpoint (no diverging ramps here).

## Anatomy
```html
<figure class="sn-chart-frame sn-heatmap" aria-labelledby="t">
  …ChartFrame head: "Key & mood: Library coverage" / "Tracks per Camelot key and energy · 1,284 tracks"…
  <span class="sn-heatmap__ramp">0 <span class="sn-heatmap__ramp-steps"><i></i>×7</span> 43 <span class="sn-heatmap__ramp-none">No episode</span></span>
  <div class="sn-chart-frame__plot"><svg role="grid">
    <g role="row"><text role="columnheader">Key</text><text role="columnheader" aria-label="Energy 1">1</text>…</g>
    <g role="row"><g role="rowheader" aria-label="8A A minor">● 8A</g>
      <rect class="sn-heatmap__cell" data-step="4" role="gridcell" tabindex="-1" aria-label="8A A minor, energy 7: 31 tracks"/>…</g>
  </svg></div>
  <p class="sn-heatmap__readout" aria-live="polite">● 8A A minor · energy 7: 31 tracks</p>
</figure>
```

## Spec
| Part | Spec |
|---|---|
| Ramp | 7 classed steps, `data-step="0…6"`: 0 = `surface-2`, 1–5 = `color-mix(in oklab, var(--brand) 18/34/50/66/83%, var(--surface-2))`, 6 = `brand`. Classed bins (0, 1–3, 4–7, 8–12, 13–18, 19–25, 26+) read better than a continuous scale; set bins per chart and say them in the table view |
| Cells | key × energy 30 × 17px, calendar 22 × 22px; 2px gap in `--chart-surface`; radius 2 |
| No data vs zero | zero = step 0 fill; no data (no episode that day) = transparent with 1px dashed `line`; future days blank |
| Labels | row headers in data font 11px `fg-2`; key rows carry the key dot (`key-*`) then the code; energy columns 1–10 with 4px gaps after 4 and 7 and tier words above; calendar month above the first week, day numbers every 2nd week, rows Mon–Sun |
| Hover / focus | 2px ring (`fg` for hover, `focus` for keyboard) and the count inside the cell (data font 10px, `on-brand` on steps 5–6, `fg` below) |

## States
Empty library: ChartFrame empty state. Loading: skeleton grid of `sn-skel` cells. A selected filter (show chips) redraws the grid and recomputes the ramp max.

## Accessibility
ARIA grid: one cell has `tabindex="0"` (roving). Arrow keys move by cell, Home/End to row ends. Each cell's `aria-label` reads row, column and count in words; the readout line repeats it visibly for sighted keyboard users. In the app the ChartFrame "View as table" toggle gives the full matrix as an `sn-table`. The ramp has an `aria-label` with min, max and the no-data meaning. More always means stronger lavender, further from the card colour, in every theme: lighter on dark and booth, darker on light.

## Responsive
Fixed cell size, SVG width = cells; on a phone the SVG scales down to the card (`max-width: 100%`). For Camelot rows below 360px wide, show A rows only with a "Show major keys" chip.

## Do / don't
- Do keep one hue; never rainbow or energy colours on a count.
- Don't print numbers in every cell; show them on focus and in the table view.
- Don't use status colours for "low coverage".

## In SongNodes / the music library
New for Key & mood ("where are my 8A energy-7 tracks?") and Sources (which shows feed the library). Replaces the key bar chart in `StatsPanel.tsx` (`keyDistribution`) and the per-key list in `KeyMoodPanel.tsx`.
