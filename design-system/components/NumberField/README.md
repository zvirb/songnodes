# NumberField

A number input with its unit inside the box (BPM, min, %, bars), minus and plus steppers, a stated range and mono digits.

## When to use / not use
Use for exact numbers people type or nudge: target BPM, set length, genre share, tolerance. For a range between two values use RangeSlider; for rough values on a scale a single slider is fine, always with this field beside it. A number that only has a few named values is a `SegmentedControl` or `SelectField`. Never hand-build a stepper from a minus button, a plus button and a number input (`INP-STEPPER`): this is the stepper.

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
  <span class="sn-number-field__equiv" hidden>= 1 h 30 min</span>
  <span class="sn-field__error" hidden></span>
</div>
```
Set `--nf-ch` on the input to the longest value's digit count (min 3). The equivalent line `__equiv` is optional (below).

## States
Default, focus (ring on the whole box), at limit (that stepper `disabled`, still drawn), invalid (`data-invalid` on the box, `aria-invalid` on the input, error message), disabled (`data-disabled`, `disabled` on input and steppers).

## Behaviour
A text input with `inputmode`, not `type="number"` (no scroll-wheel surprises, no locale bugs; GOV.UK guidance). Arrow Up/Down step, Shift+arrow and Page Up/Down step by the big step (`data-big`, default 10 steps), Home/End jump to min/max (APG spinbutton). Steppers and keys clamp and snap to the step.

**Bounds and steps come from the page.** Minimum, maximum and step are the page's (the set-length limits, a BPM tolerance); the field never invents a bound. A bound the page leaves out is no bound, and steps count from the minimum, or from 0 when there is none.

**A typed value is never changed for you.** It is checked on change or blur. When it is off the step or outside the bounds the field keeps what was typed, shows the error and says how to fix it: "Enter a length in 5-minute steps, for example 90 or 95." (BeanAlliance snaps to the nearest step on blur; SongNodes does not.)

**Equivalents.** Where the value has another unit people think in (set length 90 min = 1 h 30 min), the page may show `__equiv` after the range line. It is worked out exactly by the page, left out when it cannot be, and never shown as 0. It is plain text tied to the input with `aria-describedby`.

## Content rules
Units after the number in mono: "128 BPM", "90 min" with a space; percent with no space: "100%", "65%" (also in the range line "0–100%" and in `aria-valuetext`). Inside the box the `%` unit sits tight against the digits (`data-unit="%"`). Range line "60–200 BPM" with an en dash. Errors: "Enter a tolerance from 0 to 8 BPM." Negative numbers use a true minus "−1".

## Accessibility
`role="spinbutton"` with `aria-valuenow/min/max/valuetext`; the unit is part of the name via `aria-labelledby`. Steppers are `tabindex="-1"` because the keyboard already steps; they are 36px wide (`touch-min` on touch). A committed change made with a stepper button is read once; a keyboard step is read by the spinbutton itself.

## Responsive
The box keeps its natural width; it never stretches across a phone screen.

## Do / don't
- Do show the unit; never make people guess whether 90 is minutes or BPM.
- Don't auto-correct an out-of-range or off-step typed value silently; show the error.
- Don't build your own minus and plus buttons beside a number input.

## In SongNodes / in the music library
Replaces the `type="number"` BPM min/max and confidence fields in `AdvancedSearch.tsx` and `TrackSearch.tsx`. In the Naarm Set Builder: Length (min), and the paired number box on each genre mix slider.

## In a row of fields
Fields that sit side by side are one `.sn-field-row` (a grid aligned to the top), never a page's own flex, grid or table: every label line is one height, every control starts at one height and is `control-md` tall, and an error, a range line or a readout hangs below its own field without moving its neighbours. A field that needs more room spans columns (`sn-field-row__span-2`, `sn-field-row__span-all`); a button beside the fields sits in `sn-field-row__action`. Rules and the rendered check (`linters/check_alignment.js`) are in `22-forms-and-load.md`, *Form alignment*.

In a row the stepper box is `control-md` tall like the inputs beside it, and the range line ("30–360 min") hangs below.
