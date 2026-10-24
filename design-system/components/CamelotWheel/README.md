# CamelotWheel

The Camelot wheel as a selector and a map: 12 numbers around a clock face, outer ring B (major, lighter key colours), inner ring A (minor, darker), the playing key ringed in `--now`, its clean mixes outlined, selected keys ticked, and optional track counts per key.

**Use** on Key & mood, as the key filter in the library and graph filters, and next to the now-playing deck. **Don't** use where a key is just a value in a row; that is `sn-key` ("● 8A").

## Mapping (standard Camelot)
Number n sits at n o'clock (12 at the top, clockwise). 8A = A minor, 8B = C major, 9A = E minor, 9B = G major, 1A = A♭ minor, 1B = B major … names from `SongNodes.keyName()`. Colours: segment fill `var(--key-<n><a|b>)` via `[data-key]`.

## Anatomy
```html
<div class="sn-camelot-wheel">
  <svg class="sn-camelot-wheel__svg" viewBox="0 0 420 420" role="group" aria-label="Camelot wheel. Now playing 8A, A minor">
    <path class="sn-camelot-wheel__seg" data-key="8A" role="button" tabindex="0" aria-pressed="false" aria-label="8A, A minor, 96 tracks, now playing"/>
    … 24 segments, then codes, counts and rings (aria-hidden) …
    <g aria-hidden="true"><circle class="sn-camelot-wheel__hub"/> 8A · A minor · Now playing</g>
  </svg>
</div>
```

## Spec
| Part | Spec |
|---|---|
| Geometry (viewBox 420) | centre 210; inner ring A r 100–152; outer ring B r 154–206; hub r 94 `surface-2`; segment 30°, 2px gap in `--chart-surface` |
| Code | data font 13px 700 at mid-radius; colour `bg` or `fg`, whichever contrasts more with that segment's fill in the current theme (computed once per theme) |
| Count | data font 10px under the code, same ink rule; toggle "Show track counts" |
| Now | 4px `--now` outline just outside the segment; hub reads "Now playing" |
| Compatible | from the now key: ±1 same letter and the relative key (7A, 9A, 8B for 8A); 2px dashed (`4 3`) outline inset 3px, in the same ink as the code |
| Selected | 2.5px solid inset outline + "✓" near the outer edge; `aria-pressed="true"` |
| Focus | 3px `focus` ring around the focused segment; hub shows the focused key and its move from now ("◐ +1 key from 8A") |

## Interaction and keyboard
Click or Enter/Space toggles selection (multi-select filter). One tab stop (roving tabindex). Left/Right move anticlockwise/clockwise around the wheel (11 ↔ 12 ↔ 1 wraps), Up moves to the outer ring (B), Down to the inner ring (A). Selection summary is announced ("Filtering the library to ● 9A, ● 10A · 159 tracks"); "Clear selection" empties it.

## Accessibility
Every key has a code and name, not just a colour; selected = tick + outline; now = ring + word; compatible = dashed + words in the segment label. Keys are categories: never status colours.

## Responsive
SVG scales to its container up to 420px; below 280px hide counts and the hub meta line. Booth: same geometry, larger text via the root size.

## Do / don't
- Do keep 12 at the top and the clock order.
- Don't rotate the wheel to put the current key on top; position is memory.
- Don't fade unselected keys; it hides the map.

## In SongNodes / the music library
Replaces `CamelotWheel.tsx` (its private hex colours `#3b82f6`, `#374151`… and grey minor ring) and the 3D `CamelotHelix3D.tsx`, which is retired and deleted; feeds the Key filter in `GraphFilterPanel.tsx` and the library filter rail.
