# RangeSlider

A single- or dual-thumb slider with tick labels and editable number boxes beside it, for ranges such as BPM 120–130, release years or a minimum connection strength.

## When to use / not use
Use when the range matters more than exact typing and the scale is bounded: BPM, year, strength, energy. Always pair with number boxes so exact values can be typed. For one exact number with a unit use NumberField.

## Anatomy & markup
```html
<div class="sn-range-slider" role="group" aria-labelledby="bpm-l">
  <div class="sn-range-slider__head"><span class="sn-range-slider__label" id="bpm-l">BPM range</span><span class="sn-range-slider__readout" aria-hidden="true">120–130 BPM</span></div>
  <div class="sn-range-slider__main">
    <input class="sn-range-slider__num" aria-label="Minimum BPM" inputmode="numeric" value="120">
    <div class="sn-range-slider__rail">
      <div class="sn-range-slider__track"></div><div class="sn-range-slider__fill"></div>
      <div class="sn-range-slider__thumb" role="slider" tabindex="0" aria-label="Minimum BPM"
           aria-valuemin="100" aria-valuemax="130" aria-valuenow="120" aria-valuetext="120 BPM"></div>
      <div class="sn-range-slider__thumb" role="slider" tabindex="0" aria-label="Maximum BPM" …></div>
      <div class="sn-range-slider__ticks" aria-hidden="true"><span class="sn-range-slider__tick" style="left:0%">100</span>…</div>
    </div>
    <input class="sn-range-slider__num" aria-label="Maximum BPM" inputmode="numeric" value="130">
  </div>
</div>
```
Single-thumb: one thumb, fill from the start, one number box after the rail.

## Behaviour (WAI-ARIA APG slider and multi-thumb slider)
Arrow keys ±1 step, Page Up/Down ±a big step (10 BPM, 5 years), Home/End to the limits. Thumbs cannot cross: the lower thumb's `aria-valuemax` is the upper value and vice versa, updated live. Tab order stays min then max regardless of position. Dragging the track moves the nearest thumb. Number boxes commit on Enter or blur, snap to the step and clamp to the other thumb; out-of-scale values show an error and keep the slider unchanged.

## States
Thumb: `fg` disc with 3px `brand` ring, grows slightly on hover, 3px focus ring. Fill: `brand`. Track: `progress-track`. Error: 2px `status-bad` on the number box plus "Enter minimum BPM from 100 to 150."

## Content rules
`aria-valuetext` carries the unit ("124 BPM", "65%"). Readout uses an en dash: "120–130 BPM", "65% and stronger". Ticks at round values, both ends labelled.

## Accessibility
Thumb hit area is 44px (22px visible plus an invisible ring); WCAG 2.2 dragging alternative is met by keys and number boxes.

## Responsive
Below 480px the rail takes the full row and the number boxes sit under it.

## Do / don't
- Do keep the number boxes; dragging to an exact BPM is fiddly.
- Don't use a slider for unbounded values (play counts).

## In SongNodes / in the music library
Replaces `DualRangeSlider.tsx` (two stacked `type="range"` inputs) and the range inputs in `GraphFilterPanel.tsx`, `FilterPanel.tsx` and `PathBuilder.tsx`. In the Naarm Set Builder: BPM range in the pool settings.
