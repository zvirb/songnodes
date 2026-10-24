# StagedProgress

Shows a long or multi-step job as ordered steps with honest state, the current step's detail, elapsed time, an estimate only when known, and Cancel where the job allows it.

## When to use
- Jobs over ~10 s or with distinct phases: weekly library build, full graph load, tracklist import, audio analysis, enrichment runs, scraper jobs.
- Not for sub-10 s loads (LoadingState) or a single button action (busy button).

## Anatomy
```html
<div class="sn-staged-progress">
  <div class="sn-staged-progress__head">
    <h2 class="sn-title title-s"><span class="sn-lead">Weekly build:</span> Sat 24 Oct</h2>
    <div class="sn-staged-progress__time"><span>Elapsed <b>4:18</b></span><span>About 3 min left</span></div>
  </div>
  <ol class="sn-staged-progress__steps">
    <li class="sn-staged-progress__step" data-state="running" aria-current="step">
      <span class="sn-staged-progress__glyph" aria-hidden="true"></span>
      <span class="sn-staged-progress__name">Match plays to tracks</span>
      <span class="sn-staged-progress__state">Running</span>
      <p class="sn-staged-progress__detail">Matching 312 of 500 tracks</p>
      <div class="sn-staged-progress__meter" role="progressbar" aria-valuenow="312" aria-valuemax="500"><i style="--p:62.4%"></i></div>
    </li>…
  </ol>
  <p class="sn-staged-progress__notice">…You can leave this page…</p>
  <div class="sn-staged-progress__foot"><button class="sn-btn">Cancel build</button></div>
</div>
```
Usually inside an `sn-card` scoped to the owning module (`sn-m-pipeline`, `sn-m-sources`).

## States (per step, `data-state`)
| State | Glyph | Look |
|---|---|---|
| `done` | ● | Green: `status-ok` glyph on `status-ok-bg`, state text "● Done · 0:42" in `status-ok` 600, and the connector below it in `status-ok`. A finished step is a verdict, so it uses the status colour; the word "Done" always goes with it |
| `running` | ↻ | amber `--now` ring (current step); detail + neutral meter when the total is known |
| `waiting` | – | dim name, "Waiting" |
| `failed` | ✕ | `status-bad`; detail says why and what is kept; step actions ("Retry this step", "Skip MixesDB") in `__actions` |
| `cancelled` | – | dim; job head shows "Cancelled" |
The meter inside a running step uses `progress-fill` (completion is not health); only finished steps turn green.

## Content rules
- Step names verb first: "Fetch radio plays", "Look up key and BPM", "Send sets to TIDAL".
- Detail with real counts: "Matching 312 of 500 tracks", "1,912 plays from PBS Soul Time, 3RRR Superfreak and triple j Mix Up".
- Estimate only from measured rate, rounded up and stated loosely ("About 3 min left"); revise down freely, up once. No estimate → show only elapsed. Never let the meter go backwards.
- After cancel or failure, say what is kept.

## Accessibility
- Ordered list; current step has `aria-current="step"`; the meter is a `progressbar` with `aria-valuetext` ("312 of 500 tracks").
- A polite live region announces step changes, failures and completion only, not every count tick.
- Cancel is a real button; if cancelling is not possible, leave it out rather than disabling it.

## Responsive
Single column at all widths; head wraps the time under the title on phones. On wall displays (monitoring) use one card per job in a grid.

## Do / don't
- Do keep the job running server-side when the person navigates away and say so in `__notice`; surface completion with a Toast ("Weekly build finished: 48 new tracks").
- Don't show a percentage you can't back up, or a spinner for a 3-minute job.

## In SongNodes
For the planned monitoring dashboard's pipeline progress, scraper jobs (pending/running/completed/failed/cancelled/timeout mapped to waiting/running/done/failed/cancelled), enrichment and audio analysis runs, TracklistImporter, and the initial graph load in LiveDataLoader.

## In the music library
The weekly build (fetch plays → match → key/BPM → crate → TIDAL send) and "Send to TIDAL on the weekly run".
