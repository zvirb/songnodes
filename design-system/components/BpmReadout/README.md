# BpmReadout
BPM in mono with tabular figures: whole numbers as "124", fractional as "123.5", with a half- or double-time reading in brackets ("87 (174)").

## When to use
- Every tempo: crate BPM column, track detail, ranges in filters and set summaries, deltas between set slots.

## Anatomy and markup
Core `sn-bpm` with the value in `<b>`. Extras: `sn-bpm-readout__alt` (bracketed reading, `fg-3`), `__unit` ("BPM" in the body font), `sn-bpm-readout--lg` (detail), `__delta` (a transition delta with a TransitionNote verdict).
```html
<span class="sn-bpm"><b>87</b> <span class="sn-bpm-readout__alt">(174)</span><span class="sn-sr"> BPM, double time 174</span></span>
<span class="sn-bpm"><b>122–128</b><span class="sn-bpm-readout__unit">BPM</span></span>
<span class="sn-transition-note__item sn-bpm-readout__delta" data-level="perfect">+2 BPM</span>
```

## Content rules
`SongNodes.format.bpm(b)`: one decimal only when fractional. Ranges use an en dash ("122–128 BPM"). Deltas use true signs ("+2 BPM", "−4 BPM") from `SongNodes.bpmStep`, which also gives the verdict (within 2 perfect, 4 compatible, 8 possible, more is a clash). Missing: "–" in `sn-none`. Column headers say "BPM"; cells leave the unit out.

## Accessibility
Right-align in tables (`td.num`). Put the half/double reading in sr text and `title` so it isn't read as two unrelated numbers. Deltas carry a glyph and words, never colour alone.

## Do / don't
- Don't round 123.5 to 124 in detail views; do round in compact charts.
- Don't show the alternative reading unless analysis flagged it.

## In SongNodes / the music library
Crate BPM column, `TrackDetailsModal.tsx`, the BPM range labels in `FilterPanel.tsx` (DualRangeSlider), and the "+2 BPM" in the Naarm set builder transition strip.
