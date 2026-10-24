# Sparkline

A word-sized trend: plays per week over the last 12 weeks, drawn as a thin neutral line with the latest point emphasised, and the low and high points revealed on hover or focus.

**Use** in table rows (crate table "Plays, 12 weeks"), figure tiles (library stats row) and source cards. **Don't** use when the reader needs values or axes (ChartFrame), or to compare magnitudes across rows: each sparkline is scaled to its own min and max, so it shows shape, not size.

## Anatomy
```html
<span class="sn-sparkline" role="img" aria-label="Plays per week, last 12 weeks: latest 12, low 2 in the week of 3 Aug, high 12 in the week of 19 Oct">
  <svg width="96" height="22" aria-hidden="true">
    <polyline class="sn-sparkline__line" points="…"/>
    <circle class="sn-sparkline__ext" r="2.5"/><circle class="sn-sparkline__ext" r="2.5"/>  <!-- low, high -->
    <circle class="sn-sparkline__end" r="3"/>
  </svg>
  <span class="sn-sparkline__val" aria-hidden="true">12</span>
  <span class="sn-sparkline__tip" aria-hidden="true">low <b>2</b> 3 Aug · high <b>12</b> 19 Oct</span>
</span>
```

## Spec
| Part | Spec |
|---|---|
| Size | table 96 × 22, tile 132 × 32; 3px inner padding |
| Line | 1.5px `fg-3`, round join and cap; no fill, no axis, no grid |
| Endpoint | r 3 `fg` with 1.5px `--chart-surface` ring; latest value beside it in data font 13px 600 (omit when the tile's figure already shows it) |
| Low / high | r 2.5 hollow (`--chart-surface` fill, 1.5px `fg-2`), opacity 0 until hover/focus, with a small tip "low 2 3 Aug · high 12 19 Oct" |
| Scale | x = week index, y = own min..max; flat series draws mid-height |
| Now | when the series runs into the current week or time, a 1px amber `--now` tick at that x (the ChartFrame now line, without the tag); never `brand` |
recharts: `<LineChart>` with no axes, `dot={false}`, `strokeWidth={1.5}`, `isAnimationActive={false}`, plus a custom end dot.

## States
No data: `<span class="sn-none">–</span>`. Fewer than 3 weeks: show the number only. Loading: `sn-skel` 96 × 14.

## Content
Always name the period near it (column header "Plays, 12 weeks", tile caption "12 weeks to 24 Oct"). Week labels are week-start dates "3 Aug".

## Accessibility
`role="img"` with a sentence giving latest, low and high with their weeks; the visible tip is decorative. In table rows the sparkline is not focusable (the row is); in figure tiles it has `tabindex="0"` so keyboard users get the same low/high reveal.

## Responsive
Fixed size; on phones the crate table hides the column and the track detail shows a full ChartFrame instead.

## Do / don't
- Do keep it neutral; trend direction is not good or bad.
- Don't colour the line green or red, add area fill, or animate it.
- Don't compare rows by line height.

## In SongNodes / the music library
New "Plays, 12 weeks" column in the crate table and trend line in the library stats row tiles; also the trend in the planned monitoring dashboard's "Recently scraped data" tiles and in the stats panel's graph metrics.
