# EnergyWave

The set's energy wave: one bar per running-order slot coloured by its energy (1–10), the chosen shape's target wave dashed over it, the Building tier shaded, the now slot marked and every rule-breaking transition flagged above its bar.

**Use** in Set builder above the running order, in Pathfinder for energy-curve presets, and in a saved-set summary (compact). **Don't** use for energy of a single track over time; that is the energy curve in WaveformStrip.

## Anatomy
Built on ChartFrame (`sn-chart-frame sn-energy-wave` inside an `sn-card`), with a legend row because it carries five encodings.
```html
<figure class="sn-chart-frame sn-energy-wave" aria-labelledby="t">
  <div class="sn-chart-frame__head">…title "Set builder: Peak time Friday", subtitle "Energy per slot, 1–10 · 14 tracks · 92 min"…</div>
  <ul class="sn-chart-frame__legend">Energy per slot · Target wave · Building 5–7 · ✕ Too steep · ○ Drop 2–3 at once instead</ul>
  <div class="sn-chart-frame__plot"><svg tabindex="0" role="group" aria-roledescription="energy wave chart">…</svg></div>
  <div class="sn-energy-wave__summary">sn-pill[data-compat] per problem</div>
</figure>
```

## Spec
| Part | Spec |
|---|---|
| y | 0–10, ticks 0 2 4 6 8 10 in `chart-axis` data font 11px; tier words "Low", "Building", "High" in the right margin (`fg-3` 11px) |
| Building band | rect from 4.5 to 7.5, fill `chart-grid` (`sn-energy-wave__band`); no other gridlines |
| Bars | `var(--energy-N)` fill, width ≤ 28px, 22% band gap, 4px rounded top, square base. No number on the bar |
| x | slot number centred under each bar (data font 11px); the now slot's number in `fg` 700 with a 3px amber `--now` underline |
| Target wave | polyline through slot centres, 1.5px `chart-ref`, dash `5 4` |
| Now | 2px amber `--now` line from the plot top to just above the bar, "Now" tag (ChartFrame now tag). Amber is the now token only; a selected slot uses `brand`, and an energy-10 bar is told apart from now by the line and tag |
| Problems | glyph 13px 700 centred 6px above the arriving bar: `✕` in `compat-clash` (energy +2 or more), `○` in `compat-possible` (second −1 in a row); from `SongNodes.energyStep()` |
| Preview | rebuild proposal: region from the first re-planned slot hatched (`--sim`, 45°, 40%), bars at 55% fill opacity with hatch over them, "Preview" label top right; primary "Use this order" + quiet "Discard" in the header |

## States
Hover or focus a bar: `fg` 1.5px outline and tooltip "Slot 5 · Overmono – So U Kno" with energy (rect key, tier), target (dashed key) and the transition verdict. Empty set: ChartFrame empty state "No tracks in this set yet · Build set or add tracks from the library." Loading during Build set: ChartFrame skeleton.

## Content
Energy as a bare number ("8"), tier words from `TIER_LABEL`. Verdict text from `energyStep()` labels ("energy +2: too steep, step up one at a time"). Shape names as in the set builder ("Peak time, three waves").

## Accessibility
One tab stop; Left/Right move slot by slot, Home/End jump; each move is announced ("Slot 5 · Overmono – So U Kno. Energy 8, target 7. energy +2: too steep…"). `<desc>` summarises the shape and names the problem slots. "View as table" lists slot, track, `sn-energy` meter, target and transition pill; the now row gets `tr[data-now]`. Problems carry a glyph and words, not colour alone.

## Responsive
Redraws at container width. At 400px 14 slots still fit (≈20px per slot); above 24 slots on a phone, label every 2nd slot and keep bars ≥ 6px. Header actions wrap below the title. Compact variant (`h ≈ 9rem`) for saved-set cards.

## Do / don't
- Do keep tier gaps meaningful: band = Building only.
- Don't colour the target line or flags by energy; they must read on any bar.
- Don't animate bars on load; a rebuild swaps instantly.

## In SongNodes / the music library
Replaces the Naarm Set Builder's energy chart (bars + dashed target wave) and the energy curve presets drawing in `PathBuilder.tsx`; adds the problem flags the transition strip already computes.
