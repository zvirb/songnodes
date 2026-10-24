# EnergyBar
The 10-segment energy meter (`sn-energy`): segments fill indigo to amber, with gaps after 4 and 7 marking the Low, Building and High tiers.

## When to use
- Any track energy 1–10: crate rows, running order, track detail, energy filters.
- Don't use for progress or confidence. It isn't a progress bar.

## Anatomy and markup
`SongNodes.html.energy(e)` gives the row form. Add `sn-energy-bar` for the extras below.
```html
<span class="sn-energy sn-energy-bar" title="Energy 7 · Building 5–7">
  <span class="sn-energy__bar" aria-hidden="true"><i class="on"></i>…<i class="target"></i>…</span>
  <span class="sn-energy__n">7</span><span class="sn-sr"> of 10, building tier, target 8</span>
  <span class="sn-energy-bar__target" aria-hidden="true">target 8</span>
</span>
```

## Variants
- Row (default): 5px segments, 14px tall, number on the right.
- Detail `sn-energy-bar--lg`: 16px segments, 24px tall, Sora number and the tier label ("Building 5–7").
- Target: add `target` to the target segment (outlined in `fg`) and the `__target` text. Used in SetSlot.
- Unknown `sn-energy-bar--unknown`: outlined empty segments and "–"; screen readers hear "Energy not set".
- Needs a check: `sn-energy-bar__flag` ("▲ Check" in `status-warn`) when energy is estimated.
- Legend `sn-energy-bar-legend`: 10 swatches (`__sw[data-e]`) with numbers and tier labels. Put it next to energy filters and in "How energy is scored".

## Content rules
Tiers: Low 1–4, Building 5–7, High 8–10 (`SongNodes.TIER_LABEL`). Write "energy 7", never "7/10" or "level 7".

## Accessibility
Segments are `aria-hidden`; the number is visible and sr-only text adds "of 10, building tier". Colour is never alone: the number and the count of lit segments carry the value; the target is an outline, not a colour.

## Responsive
Row size everywhere, phones included. Booth scales the number with the root font size; keep the row form in tables.

## Do / don't
- Do keep the gaps after 4 and 7; they are the tier cue.
- Don't recolour segments per module or by status.

## In SongNodes / the music library
Replaces `EnergyMeter.tsx` (and its ⚡/⚠ icons), the energy dots in `SetlistBuilder/TrackListItem.tsx` and the crate Energy column in the Naarm Set Builder.
