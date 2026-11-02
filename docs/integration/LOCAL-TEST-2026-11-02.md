# Local production-like test of `main`, 2 Nov 2026

Tested `main` at `62795a7d` (BRZ1 #481) on the Windows laptop, Docker Compose project `songnodes-dev`, from a
clean worktree of `origin/main` with the usual untracked `.env`. Times are UTC unless marked Melbourne (AEDT,
UTC+11). Nothing was fixed on `main`; this branch adds only this report, its screenshots and the E2E2 slot in
`STATUS.md`. The Postgres volumes were not reset or removed.

## Summary

| Step | Result |
|------|--------|
| 1. Update and rebuild | Passed. All 9 services healthy. |
| 2. Health and API smoke checks | Passed, 6 of 6 as expected. |
| 3. Full E2E suite | Passed, 373 of 373 (chromium 143, firefox 115, webkit 115). |
| 4. Load library targets | Passed. 264 added, 0 skipped for no artist. |
| 5. Real scrape, end to end | Job succeeded, but bronze, projection and target bookkeeping have serious problems (below). |
| 6. Scrape window card | Passed. The 00:00 UTC tick returned `outside_window: true` and queued nothing; cleared afterwards. `SCRAPE_TARGETS_INTERVAL_SECONDS` in `.env` has no effect. |
| 7. App look-over | Library page and Home Library card show 0 tracks; escaped HTML entities on /pipeline; phone-width clipping. |

### The three most important problems

1. **The library and most of the graph are invisible.** `projection_tracks` holds 132 rows and has not grown
   since at least 28 Oct; none of the 339 library tracks are in it. `/library` says "The library has not been
   imported yet", Home says "Library: 0 tracks", and /pipeline reports 1,017 tracks missing from the graph.
   The projection consumers process 0 events every tick, and `projection_reconcile` reports the gap
   (`missing: 718` on 28 Oct) without closing it. The scrape in step 5 added 115 linked silver tracks and none
   reached the projection ("The ingest after this scrape changed nothing, so no projection was queued").
2. **Bronze MixesDB rows lose their identity and duplicate on every re-scrape.** All 47 MixesDB playlists in
   bronze have `source_url = 'unknown'` and `source_playlist_id` NULL, so the upsert key
   `(source, source_url, source_playlist_id)` never matches: 47 rows hold only 23 distinct playlists (the
   2019 Testpilot Essential Mix is stored 5 times). Their `raw_json` is a JSON *string* containing a Python
   repr (`datetime.datetime(...)`), not an object, so replay is impossible and the step-5 check
   `raw_json ? 'bronze_incomplete'` can never match. A category page ("Explorer/Mixes") is stored as a
   playlist. Cause: `scrapers/pipelines/persistence_pipeline.py:1172` defaults `source_url` to `'unknown'`
   (the URL is in the item's `external_urls`), and line 1177 runs `json.dumps(item, default=str)` on a Scrapy
   `Item`, which is not a dict, so `default=str` stores its repr. Duplicate playlists will inflate transition
   `occurrence_count` once those transitions are created.
3. **The frontend HTML-escapes every API string, in both directions.** `frontend/src/services/api.ts:145`
   passes every response through `sanitizeObject`, and lines 210 and 219 do the same to POST and PUT bodies
   (`sanitizeInput` in `frontend/src/lib/utils.ts:309`, added in 2e2b30bd on 25 Oct). React already escapes
   text, so users see `Itch-E &amp; Scratch-E`, `Lab&#x27;s Cloud`, `Soul &amp; Funk` and
   `{&quot;detail&quot;: ...}` on /pipeline. Writes through `apiClient.post`/`put` (for example adding a
   target in `TargetTracksManager`) would store `&amp;` in the database. None are stored yet (0 target rows
   contain an entity), so this is still a display bug plus a latent data bug.

---

## 1. Update and rebuild

```bash
git fetch origin                       # origin/main = 62795a7d BRZ1 (#481)
# The main checkout (E:/songnodes) is 19 commits behind with an uncommitted STATUS.md edit, so it was left
# alone; the stack was built from this worktree, which is exactly origin/main. .env was copied in (untracked).
git log --oneline -1                   # 62795a7d BRZ1: One bad row no longer loses or miscounts a bronze batch (#481)
PYTHONUTF8=1 bash scripts/start-dev.sh # exit 0; migrations applied incl. 260_scrape_window
docker compose -f compose.dev.yaml ps
```

| Service | Status |
|---------|--------|
| audio-analysis, frontend, graph-api, postgres, rabbitmq, redis, rest-api, unified-scraper, worker | Up, healthy |

No service was unhealthy, so no log tails were needed. The stack had been stopped since 29 Oct.

## 2. Health and API smoke checks

| Call | HTTP | Result |
|------|------|--------|
| `GET :8082/health` | 200 | healthy, database connected, pool 0.33, memory 24.6 % |
| `GET :8084/health` | 200 | healthy, database and redis ok |
| `GET :8012/health` | 200 | healthy, 11 sources listed |
| `GET /api/v1/scrape/window` | 200 | `{"starts_on":null,"ends_on":null,"updated_at":null}` as expected |
| `GET /api/v1/jobs?created_from=2026-11-01&created_to=2026-11-02&limit=5` | 200 | `[]` (correct: no jobs since the stack stopped on 29 Oct; the newest job was 29 Oct 07:40) |
| `GET /api/v1/jobs?created_from=2026-11-03&created_to=2026-11-01` | 422 | `created_from must not be after created_to` as expected |

## 3. Full browser test suite (E2E2)

```bash
bash scripts/e2e-docker.sh --reporter=list,html
```

| Browser | Passed | Failed | Skipped |
|---------|--------|--------|---------|
| chromium | 143 | 0 | 0 |
| firefox | 115 | 0 | 0 |
| webkit | 115 | 0 | 0 |
| **Total** | **373** | **0** | **0** (17.5 min, one worker, no flaky) |

HTML report: `frontend/playwright-report/index.html` in the test worktree (git-ignored, not committed).

The suite passes although `/library` shows no tracks against the real data (section 7): the library specs use
`frontend/tests/e2e/data/library.fixture.json` through `libraryApi.ts`, so they do not notice an empty real
library.

## 4. Load scrape targets from the library (TGT1)

```bash
bash scripts/load-library-targets.sh --dry-run
bash scripts/load-library-targets.sh
```

| library_tracks | same_track_twice | skipped_no_artist | already_targets | added |
|----------------|------------------|-------------------|-----------------|-------|
| 339 | 0 | 0 | 75 | 264 |

Both runs gave the same row; the real run committed. `target_tracks` now has 415 active rows. It ran after
E2E so new targets could not change data mid-suite.

## 5. One real scrape, watched end to end (DATA1 start)

```bash
curl -X POST "http://127.0.0.1:8082/api/v1/scrape/trigger?source=mixesdb&search_query=Deadmau5%20Strobe" \
  -H "Idempotency-Key: laptop-$(date +%s)"
# 202 {"status":"queued","job_id":"09543085-33a0-4ae8-87a1-9d2fd53cec6c","source":"mixesdb","created":true,
#      "message":"Job recorded and waiting for a worker; no worker runs in the minimal development stack."}
```

The 202 message is wrong for this stack: the worker is running and picked the job up 2 s later.

**/pipeline card.** Queued, then "Done · 0:02"; "Scraping and saving raw data" with counts rising
(0 pages → 1 page → 4 pages, 1 playlist, 36 tracks → 9 pages, 5 playlists, 155 tracks); Ingest and Graph
projection then showed Done. No step showed "No progress for N s". Screenshot: `05-scrape-card-running.jpg`.

Problems on the card after it finished (`06-window-paused-and-scrape-card-0-00.jpg`):

- "Scraping and saving raw data · Done · **0:00**" for a 3 min 34 s scrape, and the page/playlist/track counts
  disappear (`progress: null` in the final stages response). The Scrape runs table shows 3:34 correctly.
- The job row itself is wrong: `started_at 23:24:38.875`, `finished_at 23:24:38.910`. Likely cause:
  `services/common/datalayer/jobs.py` sets `finished_at = NOW()`, which is the transaction start time, so if
  the runner claims and completes a job in one transaction the finish time equals the claim time
  (`clock_timestamp()` would record the real time). Not confirmed in the runner code.
- Ingest says "Already ingested by a recurring ingest run" and projection says "changed nothing, so no
  projection was queued", while 115 new linked silver tracks appeared; see problem 1.

Polled `GET /api/v1/jobs/<id>/stages` every 20 s (11 polls running, then succeeded). Last response:

```json
{"job_id":"09543085-33a0-4ae8-87a1-9d2fd53cec6c","kind":"scrape","stages":[
 {"key":"queued","label":"Queued","state":"done","started_at":"2026-11-01T23:24:36.942479Z","finished_at":"2026-11-01T23:24:38.875628Z","detail":null},
 {"key":"scrape","label":"Scraping and saving raw data","state":"done","started_at":"2026-11-01T23:24:38.875628Z","finished_at":"2026-11-01T23:24:38.910422Z","detail":null,"progress":null},
 {"key":"ingest","label":"Ingest to silver","state":"done","started_at":"2026-11-01T23:28:13.413769Z","finished_at":"2026-11-01T23:28:13.416830Z","detail":"Already ingested by a recurring ingest run"},
 {"key":"projection","label":"Graph projection","state":"done","started_at":null,"finished_at":null,"detail":"The ingest after this scrape changed nothing, so no projection was queued for it; the recurring projection is up to date"}],
 "last_progress_at":"2026-11-01T23:28:13.416830Z"}
```

Job result: `items_scraped 1117, bronze_playlists_persisted 5, bronze_tracks_persisted 213, data_loss_count 0,
duration_seconds 214.43`.

**Database counts**

| | bronze_playlists | bronze_tracks | silver_linked | transitions |
|--|--|--|--|--|
| Before the scrape | 51 | 610 | 810 | 447 |
| After the scrape | 56 | 699 | 925 | 454 |

- The 5 new MixesDB playlists have 18 + 19 + 18 + 34 + 29 = 118 track rows, positions 1..N with no gaps.
  The scraper reported 213 tracks persisted; the gap is not explained. The +89 net bronze tracks also include
  5 `user_import` playlists created at 23:23:15 (see below).
- Only 7 new transitions from 5 new playlists of 118 sequential tracks.
- `SELECT count(*) FROM bronze_scraped_playlists WHERE raw_json ? 'bronze_incomplete'` → **0**, but this check
  is meaningless for MixesDB: all 47 MixesDB rows have `jsonb_typeof(raw_json) = 'string'` (problem 2).
- `target_tracks` query (`playlists_found IS NOT NULL ORDER BY last_searched DESC LIMIT 5`):

  | artist | title | playlists_found | last_searched |
  |--------|-------|-----------------|---------------|
  | Anders Hellberg | New Territory | 0 | (null) |
  | Adrian V | Out Of Touch | 0 | (null) |
  | atch22, Kobayashi Maru | Ddat | 0 | (null) |
  | Blazej Malinowski | Deconstruct | 0 | (null) |
  | Blazej Malinowski | Deconstruct | 0 | (null) |

  Correction (later on 2 Nov): this query misleads, and target bookkeeping does work. `ORDER BY last_searched
  DESC` puts NULLs first, and every row above is the never-searched copy of a duplicated target. The searched
  copy of Anders Hellberg (`97e6599e`) has `last_searched` 1 Nov 23:06 UTC and `playlists_found` 4. The real
  problem is duplicates: 415 unarchived targets but only 340 distinct artist/title pairs (75 pairs), created by
  the frontend posting the same track twice; see TGT2 (#541). The truncated artist "atch22" is in the library
  source data, not introduced by the code.

**Scraper log** (`logs --tail=200 unified-scraper | grep -iE "missing bronze_id|not saved|incomplete in bronze|error"`):
34 matching lines, none for "missing bronze_id", "not saved" or "incomplete in bronze". All are validation
errors of one kind (20 tracks in this run, 92 such lines in the whole log):

```
[pipelines.validation_pipeline] INFO:   Sample validation errors (showing first 10 of 20):
  1. track validation failed: Strobe - Deadmau5 - 1 validation error for TrackCreate
  Value error, remix_type must be specified when is_remix=True [type=value_error, ...]
  3. track validation failed: Don't Look Down - Scared Of Heights - ...
  4. track validation failed: Hurricane - Alex Niggemann - ...
  ... Phoenix Rose - Skober, Channel Deq - Sasha, Discopolis 2.0 - Lifelike, Big Love - Pete Heller,
  Shivers - Armin van Buuren, The Veldt - Deadmau5
```

The target track itself (Strobe) fails validation whenever it is a remix with no remix type. Bronze still
holds the rows (3 bronze rows titled Strobe), so this hits the validation/silver path, not bronze.

**Test and other data in the real database.** `bronze_scraped_playlists` holds 4 `fixture` playlists
(`https://example.invalid/...`, created 25 and 28 Oct, from the integration tests) and 5 `user_import`
playlists created at 23:23:15–16 today through `POST /api/v1/tracks/import-tracklist` (AI-setlist style names
such as "Boiler Room, Glitch Festival"). I did not make those imports; they came through the frontend proxy
during the last minute of the E2E run. The AI setlists page only imports on a click, so they are probably
someone using the app at the same time (a TIDAL OAuth sign-in also happened at 23:33). Not confirmed.

## 6. Scrape window card

On /pipeline, set From 1 12 2026, To 31 12 2026 (typed in the day, month and year fields), Save window
(saved 2 Nov 2026, 10:31 Melbourne):

- Pill "Paused" and text "Scheduled scrapes run from Tue 1 – Thu 31 Dec 2026. Paused until 1 Dec 2026." as
  expected (`06-window-paused-and-scrape-card-0-00.jpg`). It survives a reload, in light and dark, at phone width.
- `GET /api/v1/scrape/window` → `{"starts_on":"2026-12-01","ends_on":"2026-12-31","updated_at":"2026-11-01T23:31:23.477434Z"}`.

**Interval shortcut does not work.** `services/worker/celery_app.py:29` reads `SCRAPE_TARGETS_INTERVAL_SECONDS`,
but the `worker` service in `compose.dev.yaml` does not pass it (nor `SCRAPE_TARGETS_ENABLED`,
`SCRAPE_TARGETS_PER_RUN`, `SCRAPE_TARGET_SOURCES`), so setting it in `.env` changes nothing. The tick key is
`tick:scrape_targets:<now // 3600>`, so it fires at the top of each UTC hour. I waited for the 00:00 UTC
(11:00 Melbourne) tick instead.

Passed. `GET /api/v1/jobs?kind=scrape_targets`:

| created_at | key | result |
|------------|-----|--------|
| 2026-11-02 00:00:13 | `tick:scrape_targets:498216` | `{"selected": 0, "enqueued": 0, "skipped_existing": 0, "outside_window": true, "starts_on": "2026-12-01", "ends_on": "2026-12-31"}` |
| 2026-11-01 23:06:13 (before the window was set) | `tick:scrape_targets:498215` | `{"selected": 2, "enqueued": 4, "skipped_existing": 0}` |

Worker log: `scrape_targets skipped: today 2026-11-02 (Australia/Melbourne) is outside the window 2026-12-01 to
2026-12-31`. No scrape job was created between 23:35 and 00:01.

Then Clear dates and Save window: pill "Every day", text "Scheduled scrapes run every day.", "Saved 2 Nov 2026,
11:01." `GET /api/v1/scrape/window` → `{"starts_on":null,"ends_on":null,"updated_at":"2026-11-02T00:01:20.324260Z"}`.
Left cleared. Screenshot: `06-window-cleared.jpg`.

## 7. App look-over

Checked /, /library, /sets, /graph, /pipeline and /settings in the in-app browser at desktop width (dark and
light) and phone width (375 px, light and dark), with a script on each page for "Unknown", "N/A", "undefined",
"null", "NaN", emoji, escaped entities and horizontal overflow.

**Passed**

- Home Sets card: "Set builder: 0 saved sets. Shape a set from the crate, check every transition and save it."
  It no longer says "send to TIDAL". (/sets still has a "Send to TIDAL" button, which is expected.)
- No "Unknown", "N/A", "undefined", "null" or "NaN" text and no emoji in the interface on any of the six pages.
- No console errors on any page. No page-level horizontal scroll at 375 px.
- Light and dark both render and follow the system scheme (checked by eye on screenshots, not measured).

**Problems**

| Page | Problem | Evidence |
|------|---------|----------|
| /library | "0 tracks", "The library has not been imported yet" with 339 imported tracks (problem 1). `GET /api/v1/library/search?limit=5000` returns `[]` because it joins `projection_tracks` to `library.tracks` and the two do not overlap. | `07-library-empty.jpg` |
| / | "Library: 0 tracks"; "Library data from …" and /library "Built …" show the page load time (10:26, 10:31, 10:33 on successive loads), not when the data was built. | `07-home-library-0-tracks.jpg` |
| /pipeline | Escaped entities: `Itch-E &amp; Scratch-E`, `Lab&#x27;s Cloud`, `Steve O&#x27;Sullivan`, `Can&#x27;t Deny It`, genre `Soul &amp; Funk`, and dead-letter errors `{&quot;detail&quot;:&quot;Scrape request timeout ...` (problem 3). | page text |
| /pipeline | Two failed 1001Tracklists runs from 29 Oct show durations of 87:24:44 and 87:29:00. They were in flight when the stack stopped and were marked dead at restart (`finished_at` 1 Nov 23:05). | `07-pipeline-runs-87h-durations.jpg` |
| /pipeline | Missing values in the medallion stage rows and worker success rate are an em dash (—), not the design system's en dash (`sn-none`). Stages 2 and 3 say "Up to date, last run 5 d ago" while the consumers run every 15 s. | page text |
| /pipeline | Scrape runs lists exact duplicates (Prospa Free Your Mind, mixesdb, Done, 29 Oct 00:00, twice; Adam Ten twice). | page text |
| /pipeline | 1001Tracklists does not work: every recent run is Failed (900 s timeout, HTTP 504) or Found nothing; 2 dead jobs. | page text |
| /pipeline | Heading is plain "Pipeline telemetry"; every other page uses the dimmed lead-in plus bold title ("Library: Melbourne crate"). | screenshot |
| /graph | Toolbar shows 463 tracks and 454 connections, but the canvas looked empty in the in-app browser after 10 s. A canvas read-back is inconclusive because WebGL does not keep its buffer; the E2E graph specs pass. Not confirmed either way. | `07-graph-canvas-empty-in-pane.jpg` |
| /graph | The production build logs about 50 `[GraphVisualization]` debug lines per load (one with an emoji, "🔄 Automatic token refresh enabled"). Console only, not interface text. | console |
| /graph (phone) | The ⋯ overflow menu sits past the right edge; "Pick a track in the graph to see what to play next" is cut off by the empty box below it. | `07-graph-phone-menu-clipped.jpg` |
| /library (phone) | "Build set from crate" runs off the right edge (clipped, no page scroll). | `07-library-phone-button-clipped.jpg` |
| /pipeline (phone) | Target-card ID lines ("ID: 01524c56-…") are wider than their cards. | script |

**Security note (minor).** The rest-api access log records the TIDAL OAuth callback URL with its `code`
query parameter. The code is single-use with PKCE, but it should not be logged.

## Not done or not verified

- The 1001Tracklists source was not tried by hand; its recent automatic runs all failed or found nothing.
- The graph canvas could not be confirmed visually in the in-app browser.
- Root causes are named from reading code and data, not from fixes; nothing was changed in code.
