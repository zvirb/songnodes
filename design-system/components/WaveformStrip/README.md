# WaveformStrip

The audio-analysis view of one track: a neutral waveform envelope with intro and outro regions, breakdowns, vocal segments, cue points, the energy curve and the playhead, on an m:ss time axis, with a beat grid once you zoom in.

**Use** in the track details modal (Track analysis tab), the now-playing deck and the audio-analysis job result. **Don't** use for set-level energy (EnergyWave) or as a tiny inline preview (use a plain envelope with the playhead only).

## Anatomy
```html
<figure class="sn-chart-frame sn-waveform-strip" aria-labelledby="t">
  …head "Audio analysis: Bicep – Glue" / "4:29 · 130 BPM · ● 8A A minor · analysed 24 Oct 2026, 06:00 AEDT", zoom out / 1× / zoom in…
  <ul class="sn-chart-frame__legend">Intro, outro · Breakdown · Vocal · Energy · Cue · Playhead</ul>
  <div class="sn-waveform-strip__scroll">
    <svg tabindex="0" role="slider" aria-label="Playhead position" aria-valuemin="0" aria-valuemax="269" aria-valuenow="102"
         aria-valuetext="1:42, bar 56, Breakdown, energy 4">…</svg>
  </div>
  <p class="sn-waveform-strip__readout">1:42 · bar 56 · Breakdown · energy 4</p>
</figure>
```

## Spec (top to bottom)
| Layer | Spec |
|---|---|
| Cue lane (1.5rem) | flag 12 × 13 in `fg` with letter A–D in `bg` data font 10px 700; 1px dashed (`2 2`) `fg` line through the wave at 70% |
| Intro / outro | full-height band `surface-3`, label 11px 600 `fg-2` top-left |
| Breakdown | band `chart-grid` with 1px dashed `line-strong` outline + label (pattern differs from intro/outro so it's not colour alone) |
| Waveform (110px) | mirrored envelope columns, `fg-3` ahead of the playhead, `fg-2` behind it; ~540 columns at 1×. Never coloured by frequency |
| Beat grid | when a bar is ≥ 10px wide: bar lines 1px `line-strong`; beats 1px `line` when a beat is ≥ 6px |
| Energy curve | 2px `chart-2` polyline, 0–10 mapped to the wave height; named in the legend and readout |
| Vocal lane (18px) | rounded rect `surface-2`, 1px `line-strong`, dot pattern (r 1 every 5px, `fg-3`) + "Vocal" label on a `--chart-surface` chip |
| Time axis | m:ss (`format.duration`), data font 11px `chart-axis`; every 0:30 at 1×, 0:15 at 2×, 0:10 at 4×+ |
| Playhead | 2px `--now` line + time tag (ChartFrame now tag) |

## Interaction
Zoom 1×, 2×, 4×, 8× (buttons, and Ctrl + wheel in the app); content scrolls horizontally and keeps the playhead in view. Click sets the playhead. Keyboard on the strip: Left/Right one bar, Page up/Page down eight bars, Home/End start and end.

## Accessibility
`role="slider"` with `aria-valuetext` in words (time, bar, section, vocal, energy), updated on every move; the visible readout repeats it. Sections and vocals are named in text, not shape alone. Focus ring on the scroll container.

## Responsive
Fills its container at 1×; on phones keep 1× with 0:30 ticks and hide the beat grid; the legend wraps. Booth: same layers, larger text and tags.

## Do / don't
- Do keep the waveform neutral so section bands and the energy line read.
- Don't use status colours for sections or the energy line.
- Don't auto-scroll while the user drags the scroll bar.

## In SongNodes
Replaces the canvas waveform in `NowPlayingDeck.tsx` (filled progress overlay, no axis) and gives the backend's audio analysis (intro/outro, breakdowns, vocal segments, energy curve, beat grid) its first UI.
