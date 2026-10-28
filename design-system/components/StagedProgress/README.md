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
| `stalled` | ▲ | `status-warn` glyph on `status-warn-bg`, state text "▲ No progress for 60 s" in `status-warn` 600; the meter stays where it stopped; detail names where it stopped, what is kept and that Try again carries on from there; `__actions` holds **Try again** (resumes from this step) and Cancel. Added 1.4.0 |
The meter inside a running step uses `progress-fill` (completion is not health); only finished steps turn green.

## Stalls, not elapsed time (1.4.0, imported from BeanAlliance AsyncState v4.15)
- **Elapsed time alone never fails a job or a load.** A weekly build may take 20 minutes; that is not a fault. There is no total-time limit on a staged job.
- **A stall does.** If the current step reports no progress (no count, byte or row change, no step change) for **60 s**, it turns `stalled`: ▲, "No progress for 60 s", the step named in the words ("Stopped at 1,204 of 2,410 tracks: MusicBrainz has sent nothing for a minute"). Done steps stay as evidence of what was read.
- **Stalled is a warning (`status-warn`), not a failure (`status-bad`)**, until the person acts: the job may still be alive (a slow source, a long query), nothing is lost, and the person decides. **Try again** resumes from the stalled step, never from step 1; **Cancel** turns the remaining steps `cancelled` and says what is kept. If progress arrives before the person acts, the step goes back to `running` by itself and the announcement says so once ("Look up key and BPM is moving again").
- A step that really failed (the source answered with an error, the engine threw) is `failed` at once, with its own words and actions, as before. A stall never becomes `failed` by waiting longer.
- **Give the stall rule something to watch:** a step whose one unit of work can be long (a large file, a long query, a big MusicBrainz batch) reports progress inside the step (rows, bytes, tracks), so the meter keeps moving and a healthy slow step is never called stalled.
- **After a staged load finishes**, the step list goes and the data takes its place; the finished counts and timings ("Read the library · 2,410 tracks · 0:09") move to a "How this was read" `Disclosure` under the `FreshnessStamp`, so they stay available without taking the screen. A background job card (Pipeline monitoring, the weekly build) keeps its finished steps: there the list is the job's record.

## Content rules
- Step names verb first: "Fetch radio plays", "Look up key and BPM", "Send sets to TIDAL".
- Detail with real counts: "Matching 312 of 500 tracks", "1,912 plays from PBS Soul Time, 3RRR Superfreak and triple j Mix Up".
- Estimate only from measured rate, rounded up and stated loosely ("About 3 min left"); revise down freely, up once. No estimate → show only elapsed. Never let the meter go backwards.
- After cancel or failure, say what is kept.

## Accessibility
- Ordered list; current step has `aria-current="step"`; the meter is a `progressbar` with `aria-valuetext` ("312 of 500 tracks").
- A polite live region announces step changes, failures and completion only, not every count tick, and a stall once ("Look up key and BPM: no progress for 60 s. Try again carries on from track 1,205."). A stall is `polite`, not `alert`: it needs a decision, not an interruption.
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
