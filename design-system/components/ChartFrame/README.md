# ChartFrame

The shared anatomy every SongNodes chart is built from: thin–bold title, subtitle with unit and period, direct labels or a legend row, quiet axes, a tooltip on hover and keyboard focus, reference, now and preview marks, empty and loading states, and a "View as table" text alternative.

**Use** for any line, bar or column chart (plays per week, tracks by BPM, stats panel charts). **Don't** use for a single number (a figure tile with a Sparkline) or for progress (ProgressBar).

## Anatomy
```html
<figure class="sn-chart-frame" aria-labelledby="t">
  <div class="sn-chart-frame__head">
    <div class="sn-chart-frame__titles">
      <h3 class="sn-title title-s" id="t"><span class="sn-lead">Library:</span> Plays per week by pillar</h3>
      <p class="sn-chart-frame__sub">Radio plays · 12 weeks, 3 Aug – 24 Oct 2026</p>
    </div>
    <div class="sn-chart-frame__actions"><button class="sn-btn sn-btn--sm sn-btn--quiet">View as table</button></div>
  </div>
  <ul class="sn-chart-frame__legend">…only when more than 3 series…</ul>
  <div class="sn-chart-frame__plot"><svg tabindex="0" role="group" aria-roledescription="line chart">…</svg><div class="sn-chart-frame__tip"></div></div>
  <div class="sn-chart-frame__table" hidden><div class="sn-tablebox"><table class="sn-table">…</table></div></div>
  <p class="sn-sr" aria-live="polite"></p>
</figure>
```
Sits inside an `sn-card`; the frame itself has no border. `--chart-surface` (default `surface-1`) is the colour of mark rings and label backgrounds.

## Spec (recharts / d3 follow these numbers)
| Part | Spec |
|---|---|
| Title | `title-s` thin–bold; subtitle `body-s` `fg-3` naming unit, period and source ("12 weeks, 3 Aug – 24 Oct 2026") |
| Axes | tick text 11px (`0.6875rem`) `--font-data`, fill `chart-axis`; horizontal grid only, 1px solid `chart-grid`; zero line 1px `line-strong`; no chart border, no vertical grid; 3–5 clean y ticks (0 / 20 / 40) |
| Series colour | `chart-1` … `chart-8` in that fixed order, assigned to the entity, never to rank. Okabe-Ito based: dark #56b4e9 #e69f00 #3fc29a #cc79a7 #e8d95a #5aa0e0 #f08a4b #999999; light #0072b2 #b36b00 #007a5a #b0477f #8a7d00 #005a8c #b34700 #6b6b6b (booth uses dark). Pillars: House `chart-1` (sky blue), Techno `chart-2` (orange), UK garage `chart-3` (bluish green); "Other" is always `chart-8` grey |
| Lines | 2px, round join and cap; end marker r 4 with a 2px `--chart-surface` ring. Second cue per series: marker shape circle / square / diamond |
| Bars | ≤ 24px wide, 4px rounded data end, square at the baseline, gap ≥ 2px; value label only on the one bar the story is about |
| Labels | Direct labels at the line end in `fg-2` 12px; nudge apart with a 1px `fg-3` leader. More than 3 series: legend row above the plot (line key 14×2, rect key 10×10). Text never takes the series colour |
| Reference | 1px `chart-ref`, dash `5 4`, labelled in words ("Rotation target 40") in `fg-2` 11px |
| Now | 2px amber `--now` vertical line (its own token: #f7c04a dark, #9a6400 light, #ffd166 booth; never brand lavender), tag 1.2rem high filled `--now` with "Now" in `on-brand` 700. Selection and focus marks stay `brand` |
| Preview | 45° hatch, 1px `--sim` lines every 6px at 45% opacity, labelled "Preview"; projected lines dashed `4 4` |
| Tooltip | `surface-1`, 1px `line-strong`, `radius-control`, `shadow-2`; title `fg-2` 12px; rows = line key, value (data font 600 `fg`), name `fg-2`; sorted by value; one tooltip lists every series at that x |
| Crosshair | 1px `fg-3` on the hovered or focused x |

## States
Hover and focus show the same crosshair and tooltip. Empty: `sn-chart-frame__state` on `sunk` with what happened and what to do ("No plays in this period … Widen the date range or choose another show.") plus one button. Loading: `sn-skel` columns, `aria-busy="true"`, "Loading plays…". Refetch keeps the old chart at full size; no layout jump.

## Accessibility
- The plot is one tab stop (`tabindex="0"`, `role="group"`, `aria-roledescription`, `aria-labelledby` the title, `<desc>` with a one-sentence takeaway). Left/Right move between points or bars, Home/End jump, Escape hides the tooltip; each move is announced in the `aria-live` line ("Week of 5 Oct: House 55, Techno 39, UK garage 24.").
- "View as table" swaps the plot for a captioned `sn-table` with every value, preview rows tagged "Preview". Label changes to "View as chart".
- Colour is never alone: direct labels, marker shapes, dash for projection, hatch plus the word "Preview".
- Tooltip content is inserted with `textContent`, never `innerHTML`.

## Responsive
Charts redraw at the container width (1 SVG unit = 1 CSS px), never scale text. Phone: x ticks thin out (every 4th week, every 2nd bucket), the header actions wrap under the title. Wall: same layout, larger `html` font size scales margins.

## Do / don't
- Do say the unit and period in the subtitle; don't put units on every tick.
- Don't use two y axes. Two measures → two charts.
- Don't colour by status; status colours are for health only.

## In SongNodes / the music library
Replaces the hard-coded recharts styling in `SetlistBuilder/AnalyticsPanel.tsx` (dashed `#e5e7eb` grid, `#3b82f6`/`#f59e0b` lines, default `<Legend />`, hover-only values) and the d3 `renderBarChart` / `renderPieChart` in `StatsPanel.tsx` ("BPM Distribution" becomes "Library: Tracks by BPM"; the genre pie becomes a sorted bar chart). The music library's stats row and weekly-run report use the same frame.
