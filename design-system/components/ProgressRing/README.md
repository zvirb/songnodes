# ProgressRing

A compact completion ring for summaries on cards and in rows: how much of a goal is done (target tracks found 72%, library keyed 48%). Neutral like ProgressBar; health, if any, is a separate pill.

**Use** on hub and module cards, beside a list row, or in a stat tile where a bar would not fit. **Don't** use for a running job with stages or an estimate (ProgressBar), for energy or confidence (those are levels, not completion), or as a spinner.

## Anatomy
```html
<span class="sn-progress-ring sn-progress-ring--40" role="progressbar" aria-label="Library keyed"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="48" aria-valuetext="48%, 616 of 1,284 tracks">
  <span class="sn-progress-ring__box">
    <svg class="sn-progress-ring__svg" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle class="sn-progress-ring__track" cx="20" cy="20" r="18" stroke-width="4"/>
      <circle class="sn-progress-ring__fill" cx="20" cy="20" r="18" stroke-width="4" stroke-dasharray="113.1" stroke-dashoffset="58.81"/>
    </svg>
    <span class="sn-progress-ring__value" aria-hidden="true">48</span>
  </span>
  <span class="sn-progress-ring__text"><b>Library keyed</b><span>616 of 1,284 tracks</span></span>
</span>
```
r = (size − stroke) ÷ 2, circumference C = 2πr, `stroke-dashoffset` = C × (1 − value). The SVG is rotated −90° so the arc starts at 12 o'clock and runs clockwise. Round caps; at 0% omit the fill circle.

## Sizes
| Size | Stroke | Centre value | Use |
|---|---|---|---|
| 24 | 3 | none; percent goes in the text beside it ("72% · 36 of 50") | list rows, table cells, inline |
| 40 | 4 | number only, data font 11px ("48") | cards |
| 64 | 6 | number + % ("72%"), data font 14px | hub tiles, empty-state progress |

Track `progress-track`, fill `progress-fill`. In a tonal card the label inherits `--m-ink`.

## Held scale (1.14.0): a set against its length
In the set builder the ring shows minutes planned against the set length. The full circle is the set length and nothing else: it changes only when the person changes the length, never because a track joined or left the set, so the ring is not redrawn fuller when the plan shrinks. Size 64 only, class `sn-progress-ring--held`.

| Part | Drawn as | Words |
|---|---|---|
| Planned | `__fill` from 12 o'clock, square ends, capped at the full circle | "1 h 32 min of 2 h planned" |
| Still to fill | the open `__track` | "28 min still to fill · 5 slots empty" |
| Removed since the last save | a cut-out after the fill: `__removed` in the card's ground with two dashed `__removed-edge` arcs (`line-strong`, `dash` / `dash-gap`), never a status colour | "2 tracks removed since the last save (11 min)" |
| Over the set length | the full circle; the centre figure passes 100% ("107%") | "8 min over the set length" |

```html
<span class="sn-progress-ring sn-progress-ring--64 sn-progress-ring--held" role="progressbar" aria-label="Warm-up opener: set length filled"
      aria-valuemin="0" aria-valuemax="90" aria-valuenow="61"
      aria-valuetext="68%, 61 of 90 min planned, 29 min still to fill · 5 slots empty, 2 tracks removed since the last save (11 min)">
  <span class="sn-progress-ring__box">
    <svg class="sn-progress-ring__svg" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="sn-progress-ring__track" cx="32" cy="32" r="29" stroke-width="6"/>
      <circle class="sn-progress-ring__fill" cx="32" cy="32" r="29" stroke-width="6" stroke-dasharray="123.50 182.21"/>
      <circle class="sn-progress-ring__removed" cx="32" cy="32" r="29" stroke-width="6" stroke-dasharray="22.27 182.21" stroke-dashoffset="-123.50"/>
      <path class="sn-progress-ring__removed-edge" d="…outer edge of the cut-out…"/><path class="sn-progress-ring__removed-edge" d="…inner edge…"/>
    </svg>
    <span class="sn-progress-ring__value" aria-hidden="true">68%</span>
  </span>
  <span class="sn-progress-ring__text"><b>Warm-up opener</b><span>61 of 90 min planned</span><span>29 min still to fill · 5 slots empty</span><span>2 tracks removed since the last save (11 min)</span></span>
</span>
```
- The percentage and "x of y" stay on the set as it stands now. The removed amount is said in words (the text beside the ring, the `aria-valuetext` and the key) and is never folded into either figure.
- The cut-out is what the saved set holds and the edited set no longer does. A track added takes up the removed space first; saving the set clears it. It is worked out from the saved set and the set on screen, so no device keeps a number of its own.
- Only the arc is capped. The figure is planned ÷ length and may read 107%; `aria-valuenow` stops at `aria-valuemax` and the value text carries the real figure and the minutes over.
- "Set is full" needs every slot filled and the length met: a ring at or over 100% with an empty slot says how many slots are empty.
- A ring with a cut-out carries the key (`ul.sn-progress-ring__key` with `__swatch[data-part="filled|open|removed"]`); a page of rings has one key, not one per ring. Leave the "Removed" entry out when nothing is removed.
- Durations follow the figure-page rule: under 120 minutes in minutes, from 120 in hours and minutes; both sides of "x of y" take the form of the set length.
- Where a 64 ring does not fit (saved-set lists, phone rows) use the held ProgressBar; it follows the same rules.

## Content
Label names the goal ("Target tracks found", "Library keyed"); detail gives the count and what's left ("36 of 50 · 14 still missing"), or the next step ("run key analysis"). 100%: keep the ring full and say "Done for all 1,284".

## Accessibility
`role="progressbar"` with `aria-label` (the goal) and `aria-valuetext` (percent plus counts). The centre number is `aria-hidden` because the value text carries it. Not focusable unless the whole card is a link.

## Responsive
Fixed pixel sizes; booth keeps the 40 ring and enlarges the text beside it through the root font size. Don't scale a ring past 64; use a ProgressBar or figure instead.

## Do / don't
- Do pair every ring with words.
- Don't stack several rings to compare things; use a bar chart.
- Don't colour the arc by how good the number is.

## In SongNodes / the music library
The set builder's controls card (minutes planned against the set length, held scale). Target tracks manager header (found vs wanted), key coverage on Key & mood, audio-analysis coverage on Pipeline cards; in the library stats row it replaces the "Needs an energy check" percentage text.

## Differs from beanAlliance
- The held scale is the set length the person chose, not the larger of a capacity and the highest planned total of the day; it never needs a store of its own.
- Kept: the arc capped while the figure passes 100%, removed work as a dashed cut-out named in words, added work taking the removed space first, "done" only when every item is.
- Not adopted (no honest SongNodes use): the under-way arc, the expected-by-now outer ring and the plan dot (a set is not built against a clock), the spare-capacity line and the capacity mark (the set length is the only limit and is the scale), one segment per item not started (an empty slot has no length until a track fills it; the count is said in words), the "Removed today" row group and the ring card as a link to a detail page (the ring sits on the set's own page).
- Removed work is measured since the last save, not since the start of the day.
