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
Target tracks manager header (found vs wanted), key coverage on Key & mood, audio-analysis coverage on Pipeline cards; in the library stats row it replaces the "Needs an energy check" percentage text.
