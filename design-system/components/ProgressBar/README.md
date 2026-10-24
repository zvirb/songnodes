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
| Segmented | `sn-progress-bar__segs` > `sn-progress-bar__seg[data-state]` with `--p`, plus `ol.sn-progress-bar__stages` | Staged jobs: Fetch plays → Match tracks → Enrich → Validate → Publish. States `done`, `current`, `queued`, `failed` |

Fill is `progress-fill` on `progress-track`; a failed stage stops at its percent in `fg-3`, and the reason goes in a `bad` pill ("Failed: analyser timed out").

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
Replaces the text-only "Progress:" `progress-indicator` in `DataQualityReview.tsx` (review queue: "42 of 180 reviewed"), and is the bar for the backend jobs that have no UI yet: scraper jobs, enrichment, audio analysis and the planned monitoring dashboard's "pipeline progress". Job enums map through `SongNodes.status()` into the pill. In the music library it shows the weekly run and "Send to TIDAL on the weekly run".
