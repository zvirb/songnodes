# SegmentedControl

Pick one of 2–4 mutually exclusive modes for the same content, such as Play/Plan, Wheel/Flow/Both or Day/Week/Month.

## When to use
- The choice changes how the current view looks or behaves, instantly, with no extra step.
- Not for more than 4 options (use a select), not for switching between different objects (Tabs), not for on/off (a checkbox).

## Anatomy and markup
Built on core `.sn-seg`; add `.sn-segmented-control` for hover, the selected outline, disabled options and sizes.
```html
<span class="sn-segmented-control__group">
  <span class="sn-segmented-control__label" id="lbl-scale">Time scale</span>
  <div class="sn-seg sn-segmented-control" role="radiogroup" aria-labelledby="lbl-scale">
    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="day">Day</button>
    <button type="button" role="radio" aria-checked="true" tabindex="0" data-value="week">Week</button>
    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="month">Month</button>
  </div></span>
```
Without a visible label, put `aria-label` on the radiogroup ("Mode").

## Variants
- Mode switch: Play/Plan is shown in sentence case ("Play", "Plan"), like every other label; there is no uppercase variant.
- `--sm`: 26px segments for the header and toolbars.
- `--block`: full width, equal segments, for panels and phones.
- With icons: Lucide icon before the label (Wheel `disc-3`, Flow `chart-line`, Both `layout-grid`). Icon-only needs `aria-label` per option.

## States
Selected: `surface-1` segment, `shadow-1` and a `line-strong` outline (not colour alone). Hover: `hover-bg`. Disabled option: `aria-disabled="true"`, `opacity-disabled`, skipped by arrow keys; give the reason next to the control and link it with `aria-describedby`.

## Content rules
One or two words, sentence case, nouns: "Comfortable", "Compact", "Peak time". Same option order everywhere: Day, Week, Month; Wheel, Flow, Both.

## Accessibility (WAI-ARIA radio group)
- Tab enters on the selected option. ←/→ (and ↑/↓) move and select, wrapping; Home/End to first/last; Space selects.
- Changing mode is announced by the radio state; announce bigger consequences with a status message ("Plan mode").

## Responsive
Phone: use `--block` inside panels; in the header use `--sm` (also for Play/Plan). Touch: segments grow to 38px. Wall: no change.

## Do / don't
- Do apply the choice immediately; no "Apply" button.
- Don't mix a segmented control with tabs for the same choice.
- Don't use module or status colours on the selected segment.

## In SongNodes
Replaces `DJModeSelector.tsx` (PLAY/PLAN), the 2D/3D toggle in `GraphModeToggle.tsx` (deleted with the retired 3D graph, and its Ctrl+Shift+3 shortcut with it), the graph's "Colour by" choice (Neutral / Energy / Key / Genre), the Key & mood wheel/flow switch and the stats period picker.

## In the music library
Set shape (Journey, Peak time, Warm-up, Closing) on narrow screens, the density preference and the Day/Week/Month scale in PeriodNav.
