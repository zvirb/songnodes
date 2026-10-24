# NumberField

A number input with its unit inside the box (BPM, min, %, bars), minus and plus steppers, a stated range and mono digits.

## When to use / not use
Use for exact numbers people type or nudge: target BPM, set length, genre share, tolerance. For a range between two values use RangeSlider; for rough values on a scale a single slider is fine.

## Anatomy & markup
```html
<div class="sn-field sn-number-field">
  <label for="bpm" id="bpm-l">Target BPM</label>
  <div class="sn-number-field__box">
    <button class="sn-number-field__step" type="button" tabindex="-1" aria-label="Decrease target BPM">−</button>
    <input class="sn-number-field__input" id="bpm" role="spinbutton" inputmode="numeric"
      aria-valuenow="128" aria-valuemin="60" aria-valuemax="200" aria-valuetext="128 BPM" aria-labelledby="bpm-l bpm-u">
    <span class="sn-number-field__unit" id="bpm-u">BPM</span>
    <button class="sn-number-field__step" type="button" tabindex="-1" aria-label="Increase target BPM">+</button>
  </div>
  <span class="sn-number-field__range">60–200 BPM</span>
  <span class="sn-field__error" hidden></span>
</div>
```
Set `--nf-ch` on the input to the longest value's digit count (min 3).

## States
Default, focus (ring on the whole box), at limit (that stepper `disabled`), invalid (`data-invalid` on the box, `aria-invalid` on the input, error message), disabled (`data-disabled`, `disabled` on input and steppers).

## Behaviour
A text input with `inputmode`, not `type="number"` (no scroll-wheel surprises, no locale bugs; GOV.UK guidance). Arrow Up/Down step, Page Up/Down step by 10, Home/End jump to min/max (APG spinbutton). Steppers and keys clamp and snap to the step; typed values are checked on change and keep what was typed when invalid.

## Content rules
Units after the number in mono: "128 BPM", "90 min" with a space; percent with no space: "100%", "65%" (also in the range line "0–100%" and in `aria-valuetext`). Inside the box the `%` unit sits tight against the digits (`data-unit="%"`). Range line "60–200 BPM" with an en dash. Errors: "Enter a tolerance from 0 to 8 BPM." Negative numbers use a true minus "−1".

## Accessibility
`role="spinbutton"` with `aria-valuenow/min/max/valuetext`; the unit is part of the name via `aria-labelledby`. Steppers are `tabindex="-1"` because the keyboard already steps; they are 36px wide (44px on touch).

## Responsive
The box keeps its natural width; it never stretches across a phone screen.

## Do / don't
- Do show the unit; never make people guess whether 90 is minutes or BPM.
- Don't auto-correct an out-of-range typed value silently; show the error.

## In SongNodes / in the music library
Replaces the `type="number"` BPM min/max and confidence fields in `AdvancedSearch.tsx` and `TrackSearch.tsx`. In the Naarm Set Builder: Length (min) and the House/Techno/UKG genre-mix weights.
