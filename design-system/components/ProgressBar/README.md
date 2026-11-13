# ProgressBar

Shows how much of a job is done: a neutral bar with a label and a count or percent, an indeterminate bar while there is no estimate, and a segmented bar for jobs that run in stages. Health (is it going well?) is never the bar's colour; it is a separate `sn-pill` beside it.

**Use** for imports, scrape jobs, enrichment, audio analysis, TIDAL/Spotify sync and the weekly library run. **Don't** use for scores or levels (energy, confidence) or for a ring-sized summary on a card (ProgressRing).

## Anatomy
```html
<div class="sn-progress-bar">
  <div class="sn-progress-bar__head">
    <span class="sn-progress-bar__label" id="l">Import tracklists from 1001tracklists</span>
    <span class="sn-progress-bar__value">312 of 500 · 62%</span>
  </div>
  <div class="sn-progress-bar__track" role="progressbar" aria-labelledby="l" aria-valuemin="0" aria-valuemax="500"
       aria-valuenow="312" aria-valuetext="312 of 500 tracklists, 62%" style="--p: 62.4%"><div class="sn-progress-bar__fill"></div></div>
  <div class="sn-progress-bar__foot"><span>Started 21:04 · about 6 min left</span><span class="sn-pill" data-status="ok">Healthy</span></div>
</div>
```

## Variants
| Variant | Markup | Use |
|---|---|---|
| Determinate | `--p` on the track | Count known. Value "312 of 500 · 62%"; percent alone when items aren't meaningful |
| Indeterminate | `sn-progress-bar--indeterminate`, no `aria-valuenow`, `aria-valuetext` says what it waits for | Rate limits, queued, waiting for a source. Value shows "–" |
| Sizes | `--sm` 4px (table rows), default 8px, `--lg` 12px (booth, hero) | |
| Held scale | `sn-progress-bar--held`; `--p` planned and `--removed` removed, both as a share of the set length; `__removed` after `__fill`; `__caption` under the track | A set against its length where a ring does not fit. Default or `--lg` height only |
| Segmented | `sn-progress-bar__segs` > `sn-progress-bar__seg[data-state]` with `--p`, plus `ol.sn-progress-bar__stages` | Staged jobs: Fetch plays → Match tracks → Enrich → Validate → Publish. States `done`, `current`, `queued`, `failed` |

Fill is `progress-fill` on `progress-track`; a failed stage stops at its percent in `fg-3`, and the reason goes in a `bad` pill ("Failed: analyser timed out").

## Held scale (1.14.0): a set against its length
The linear form of the held ProgressRing, for saved-set lists and phone rows. The full bar is the set length; it is never the current planned total, so a bar is not redrawn fuller because a track left the set.
```html
<div class="sn-progress-bar sn-progress-bar--held">
  <div class="sn-progress-bar__head"><span class="sn-progress-bar__label" id="s2">Warm-up opener</span><span class="sn-progress-bar__value">61 of 90 min · 68%</span></div>
  <div class="sn-progress-bar__track" role="progressbar" aria-labelledby="s2" aria-valuemin="0" aria-valuemax="90" aria-valuenow="61"
       aria-valuetext="61 of 90 min planned, 68%, 29 min still to fill, 2 tracks removed since the last save (11 min)" style="--p: 67.8%; --removed: 12.2%">
    <div class="sn-progress-bar__fill"></div><div class="sn-progress-bar__removed"></div>
  </div>
  <div class="sn-progress-bar__caption">29 min still to fill · 2 tracks removed since the last save (11 min)</div>
</div>
```
- Reads left to right in one order: planned, removed, still to fill (open track).
- The removed part is the card's ground with a dashed `line-strong` start edge and a diagonal `line-strong` hatch. The hatch is never dropped: without it the part is almost the track's colour. It never takes a status colour, because removing a track is an edit, not a fault. A bar with nothing removed has no `__removed`.
- The value stays on the set as it stands ("61 of 90 min · 68%"); the removed amount is in the caption and the `aria-valuetext`, never folded into either figure.
- Over the set length the fill is the full bar, the value reads past 100% ("2 h 8 min of 2 h · 107%") and the caption says "8 min over the set length".
- One key under the list, not one per row: `ul.sn-progress-bar__key` with `__swatch[data-part="filled|open|removed"]`: Planned, Still to fill, Removed since the last save. The last entry appears only when a row has a removed part.
- Not at `--sm` (4px): the hatch cannot be read there.
- On paper the removed part and its swatch print with `print-color-adjust: exact`, so a mono print reads the hatch and the caption.

## States and motion
Fill width eases over `duration-base`; never animate from 0 on page load if the job was already running. Indeterminate slides a 32% segment; under reduced motion it becomes a full, pulsing 35% fill.

## Content
Label = the job in sentence case with its object ("Scrape job: MixesDB, October archive"). Foot = when it started and the honest estimate ("about 6 min left"), or what slowed it ("slowed by retries"). Done: "Finished 21:15". Counts with thousands separators.

## Accessibility
`role="progressbar"` on the track, labelled by the visible label, `aria-valuetext` in words (segmented: "Stage 3 of 5, Enrich, 40%"). Stage list is `aria-hidden` because the value text already says it. Don't announce every tick; announce only stage changes and completion in the page's live region.

## Responsive
Head wraps the value under the label on narrow widths; segments keep equal width; stage labels truncate to the stage word.

## Do / don't
- Do put health in a pill next to the bar.
- Don't turn the fill green, amber or red.
- Don't show a spinner and a bar for the same job.

## In SongNodes
The held form is for saved sets against their length (SetBuilderPage's saved-set column, the sets hub). Replaces the text-only "Progress:" `progress-indicator` in `DataQualityReview.tsx` (review queue: "42 of 180 reviewed"), and is the bar for the backend jobs that have no UI yet: scraper jobs, enrichment, audio analysis and the planned monitoring dashboard's "pipeline progress". Job enums map through `SongNodes.status()` into the pill. In the music library it shows the weekly run and "Send to TIDAL on the weekly run".

## Differs from beanAlliance
- beanAlliance's `Meter` on a held scale becomes a ProgressBar variant; the scale is the set length, not the row's highest planned total of the day.
- Order is planned, removed, open track (beanAlliance puts the removed part at the end of the bar); here the removed part sits where the tracks were taken from, straight after the fill, as on the ring.
- No under-way fill and no expected-by-now mark: a set is not built against a clock.
- Removed work is measured since the last save, and the key entry reads "Removed since the last save".
