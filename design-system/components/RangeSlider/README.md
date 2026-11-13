# RangeSlider

A single- or dual-thumb slider with tick labels and editable number boxes beside it, for values on a bounded scale such as BPM 120–130, release years, energy 5–8 or a minimum connection strength. One thumb is the same component with one thumb.

## When to use / not use
Use when the place in a range matters more than exact typing and the scale is bounded: BPM, year, strength, energy. Always pair with number boxes so exact values can be typed (DR-063). For one exact number with a unit use `NumberField`; for a choice among a few named values use `SegmentedControl`; for several related weights use `SliderGroup`. Don't use a slider for unbounded values (play counts).

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
Single thumb: one `__thumb`, the fill runs from the start of the rail, one number box after it. The page places thumbs and fill with inline `left` and `width` percentages. Set `--rs-ch` on a number box to its longest value's digit count (min 3). Optional `__help` and `__error` lines go under the control (the error leads with ✕, `status-bad`). A native `input[type=range]` is never used (`INP-RANGE`): the system draws its own so it looks the same in every browser and all three themes.

## Behaviour (WAI-ARIA APG slider and multi-thumb slider)
Left and Down step one down, Right and Up step one up, Page Up and Page Down step a big step (10 BPM, 5 years; `data-big`), Home and End go to the limits. Thumbs cannot cross: the lower thumb's `aria-valuemax` is the upper value and vice versa, updated live. Tab order stays min then max regardless of position. A press on the rail moves the nearest thumb there; dragging snaps to the step. Number boxes commit on Enter or blur, snap to the step and clamp to the other thumb; out-of-scale values show an error and keep the slider unchanged.

The slider and its number box have the same minimum, maximum and step, and follow each other: moving one sets the other at once. A slider whose page gives it no `aria-valuemin` or `aria-valuemax` is not mounted and says so in the console; it is never given a range of its own.

## States
Thumb: `fg` disc (`slider-thumb`) with a `slider-thumb-ring` `brand` ring, grows slightly on hover, system focus ring on `:focus-visible` (3px in Booth). Fill: `brand`. Track: `slider-track-h` high, `progress-track` with a 1px `line-strong` edge so the unfilled part holds 3:1 against the page in every theme: dark 4.31, light 3.33, Booth 8.83 (the edge alone was 1.44 and 1.29 in dark and light, below 3). Disabled: `aria-disabled="true"` at `opacity-disabled`, thumbs do not move, the reason in a `Tooltip` or `InfoTip`. Error: 2px `status-bad` on the number box plus "Enter minimum BPM from 100 to 150."

## Content rules
`aria-valuetext` carries the unit ("124 BPM", "65%"). Readout uses an en dash: "120–130 BPM", "65% and stronger". Ticks at round values, both ends labelled.

## Accessibility
Thumb hit area is `touch-min` (44px) with the visible thumb at `slider-thumb`; the WCAG 2.2 dragging alternative (2.5.7) is met by keys and the paired number boxes. A keyboard step is read by the slider itself and not announced a second time; a committed number-box change is. Tick labels hold 4.5:1 (`fg-2`), 7:1 in Booth.

## Responsive
Below 480px the rail takes the full row and the number boxes sit under it.

## Do / don't
- Do keep the number boxes; dragging to an exact BPM is fiddly.
- Do keep the track edge in every theme.
- Don't use a slider for unbounded values (play counts) or for a choice among named values.
- Don't style a native range input.

## In SongNodes / in the music library
Replaces `DualRangeSlider.tsx` (two stacked `type="range"` inputs) and the range inputs in `GraphFilterPanel.tsx`, `FilterPanel.tsx` and `PathBuilder.tsx`. In the Naarm Set Builder: BPM range in the pool settings; each genre mix weight is a single-thumb slider inside one `SliderGroup`.
