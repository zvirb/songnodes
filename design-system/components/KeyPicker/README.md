# KeyPicker

Choose one or more Camelot keys from a compact 12 × 2 grid (minor A row, major B row), each key shown as its wheel-colour dot plus the code in mono, with a one-click "Select keys that mix with 8A".

## When to use / not use
Use to filter or target by key: library filters, Pathfinder constraints, "next track" search. To show a key read-only use `sn-key` ("● 8A"); to explain harmonic relationships use the Camelot wheel in Key & mood.

## Anatomy & markup
```html
<div class="sn-key-picker">
  <div class="sn-key-picker__head"><span class="sn-key-picker__label" id="kl">Keys</span> quick-select and clear buttons</div>
  <div class="sn-key-picker__grid" role="group" aria-labelledby="kl">
    <span class="sn-key-picker__rowhead" data-span aria-hidden="true">Minor</span>
    <button class="sn-key-picker__key" data-key="8A" aria-pressed="true" tabindex="0" data-current>8A
      <span class="sn-sr">, A minor, current key</span><span class="sn-key-picker__tip" aria-hidden="true">A minor</span></button>
    …
  </div>
  <div class="sn-key-picker__foot">legend · <span role="status">2 keys: 8A, 9A</span></div>
</div>
```
`data-key` pulls the dot colour from `key-<n><a|b>`.

## Variants and states
Off: outline, dot, `fg-2` code. Selected (`aria-pressed="true"`): `fg` fill like a pressed chip, bold code, dot keeps its key colour with a ring. Current key (`data-current`): 3px `now` bar along the bottom, explained in the legend. Suggested (`data-suggest`): dashed `brand` border. Hover and focus show the key name in a tooltip.

## Behaviour
Click or Space toggles. Roving tabindex: one tab stop for the grid; Left/Right move along the row (wrapping round the wheel), Up/Down switch between A and B for the same number, Home/End go to the row ends. "Select keys that mix with 8A" selects same key, ±1 and the relative major/minor (`SongNodes.compat` perfect or compatible): 7A, 8A, 9A, 8B. "Clear keys" empties the selection ("Any key").

## Content rules
Codes "8A", names "A minor" (from `SongNodes.keyName`), row heads "Minor" and "Major". Summary "4 keys: 7A, 8A, 9A, 8B".

## Accessibility
Each key is a toggle button named "8A, A minor"; colour is never the only cue (code always shown). Buttons are 36px tall and at least 24px wide.

## Responsive
Container query: below 560px the grid becomes 6 × 4 (1–6 then 7–12 for each row). Booth keeps the same grid with larger type.

## Do / don't
- Do keep the wheel order 1–12; don't sort by popularity.
- Don't fill whole buttons with key colours; the dot carries the hue.

## In SongNodes / in the music library
Replaces the key checkboxes in `CamelotWheel.tsx` and `KeyMoodPanel.tsx` filters, and adds key targeting to `PathfinderPanel.tsx`. In the music library: a Key filter for the crate.
