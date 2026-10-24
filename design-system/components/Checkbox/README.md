# Checkbox

Native checkboxes and radio buttons with large hit areas, grouped in a fieldset with a legend, plus select-all with an indeterminate state for tables and a disabled state that says why.

## When to use / not use
Checkbox: independent yes/no choices ("Has key and BPM"), or selecting rows. Radio: exactly one of 2–5 visible options. Don't use a checkbox for a setting that applies immediately (use Switch), or for filters that read better as chips.

## Anatomy & markup
```html
<fieldset class="sn-checkbox-group">
  <legend class="sn-checkbox-group__legend">Track checks</legend>
  <label class="sn-checkbox"><input type="checkbox">
    <span class="sn-checkbox__text"><span>Needs an energy check<span class="sn-checkbox__count">37</span></span>
    <span class="sn-checkbox__hint">Energy came from one source only.</span></span></label>
</fieldset>
```
Radios use the same `sn-checkbox` label with `type="radio"` and a shared `name`. `sn-checkbox-group--inline` lays options in a row. `sn-checkbox--bare` is a label-less box for table cells (give the input an `aria-label`).

## States
Checked and radio dot use `brand` (`accent-color`); unchecked boxes follow the theme through `color-scheme`. Indeterminate: set `input.indeterminate = true` on the select-all box when some rows are selected. Disabled: `data-disabled` on the label, `disabled` on the input, and a hint linked by `aria-describedby` saying why ("Needs audio analysis, which is off in Pipeline."). Booth: 22px boxes.

## Content rules
Labels are positive statements in sentence case ("Played on 2+ shows"), not questions or negatives. Counts in mono after the label. Select-all is named "Select all 4 tracks"; rows "Select Bicep – Glue".

## Accessibility
Native inputs: Space toggles; arrow keys move within a radio group. The whole label is the hit area (at least 28px tall, above the 24px WCAG 2.2 minimum). Groups use fieldset/legend so the question is read with each option. Announce the selection count in a `role="status"` line ("2 of 4 tracks selected").

## Responsive
Stacked on phones; inline groups wrap. Table select boxes stay in the first column.

## Do / don't
- Do mark the selected row with `tr[aria-selected="true"]` as well as the tick.
- Don't pre-tick options people would not expect.

## In SongNodes / in the music library
Replaces the bare checkboxes in `FilterPanel.tsx`, `MultiSelect.tsx`, `KeyMoodPanel.tsx`, `CamelotWheel.tsx` and bulk selection in `TargetTracksManager.tsx`. In the Naarm Set Builder: "Has key and BPM", "Needs an energy check", "Played on 2+ shows".
