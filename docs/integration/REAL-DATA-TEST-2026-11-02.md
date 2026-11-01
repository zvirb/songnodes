# Real-data test: running stack, 2 Nov 2026

Read-only test of the SongNodes stack running on the laptop (TUF), against live data. No code, config, container or data was changed. Browser: Claude in Chrome, base URL `http://127.0.0.1:3006`. Screenshots are in [`REAL-DATA-TEST-2026-11-02/`](REAL-DATA-TEST-2026-11-02/).

Test window: 10:19–10:33 AEDT. **The data was changing during the test**: a scheduled scrape (Deadmau5 Strobe, mixesdb, 10:24) and its projection jobs (10:31) ran mid-test. The graph went from 364 tracks / 342 connections to 458 / 447, then 463 / 454. Numbers below give the count at the time of each measurement.

## 1. Baseline

| Item | Result |
|---|---|
| Commit the stack runs from | `62795a7d BRZ1: One bad row no longer loses or miscounts a bronze batch (#481)`, 2 Nov 2026 09:31 +11:00. Running containers are built from the worktree `E:/songnodes/.claude/worktrees/quizzical-kalam-9b255a` (branch `claude/songnodes-prod-test-main-93bea5`), which is at the tip of `origin/main` (0 commits behind). |
| Main checkout `E:\songnodes` | `f2bdc9b1 TGT1` on `main`, **19 commits behind `origin/main`**, `STATUS.md` modified. Not touched by this test (no pull). |
| `docker compose ps` | **Not run.** The test shell on the laptop is a sandboxed VM without Docker, so container state, health and created times could not be read. Service reachability was checked over HTTP instead (section 6): rest-api, graph-api and unified-scraper all report healthy. Stale-code check (container older than last commit) still needs `docker compose -f compose.dev.yaml ps --format '{{.Service}} {{.CreatedAt}}'` on the host. |
| Row counts (psql) | **Not run** (no Docker/psql in the test shell). Read-only stand-in from `GET :8084/api/graph/stats` at 10:31: 1,264 tracks, 692 artists, 56 playlists, 1,085 playlist tracks; graph 1,240 song nodes (all with artists), 454 edges, 681 occurrences (avg 1.5, max 3). Library page: 0 tracks (library not imported). Targets page: 415 target tracks. |

## 2. Graph view (/graph): main focus

### What the design system defines (design-system 1.5.0, GraphStyles DR-034…037, GraphControls)

| Spec | Defined value |
|---|---|
| Layout | **Ring layout** around an anchor (now playing → selected → most-linked track). Replaces the force layout. Runs once per anchor change, not every frame. |
| Ring radii | Ring 1 vertical radius 58 px, each next ring +40 px, horizontal × 1.7 |
| Seat spacing | A seat every 30 px of arc, min 8 per ring; a seat is free only if its label box doesn't overlap another → regular, predictable spacing (~30–60 px between neighbours) |
| Node radius | clamp(4, 4 + 20 × √(links ÷ most links), 24) px |
| Link strength | Line width bands 1 / 2 / 3.5 / 6 px (opacity 0.35 / 0.55 / 0.8 / 1); **distance never encodes weight** |
| Zoom | ×1.25 steps, 25 %–400 %; labels for all nodes above 150 % |
| Controls | Dock with zoom in/out, **Fit graph to screen**, **Reset view**, pause layout, layers, Colour by, minimap; keys `+` `−` `0` (fit) `Space` |

### What the running app does

The renderer (`frontend/src/components/GraphVisualization.tsx`) still runs the **d3-force simulation**, not the ring layout: link distance 150–900 px from weight (`900 − (w/10)² × 750`), charge −2,500 out to 2,500 px, collision radius r + 50, `forceCenter` strength 0.02, no forceX/forceY. Live edge weights are only 1–3 (305 × 1, 71 × 2, 78 × 3), so almost every link asks for **870–900 px**. The graph has **23 disconnected components** (largest 76, 44, 28 tracks), and nothing pulls them back together, so they drift apart.

### Measurements, desktop (window 1864 × 893, canvas 1319 × 810 Play / 1163 × 810 Plan)

| Measure | Play mode, nothing selected | Plan mode, nothing selected | Plan mode, "Kabuki" picked from Library | Design system |
|---|---|---|---|---|
| Nodes / edges (store) | 364 / 342 | 364 / 342 | 364 / 342 | – |
| Nodes drawn (PIXI `visible`) | **0** | **0** | **2** (+3 edges) | all in view after Fit |
| Nodes inside viewport | 0 | 0 | 1 | all after Fit |
| Nodes still at (0,0) in the store | 362–360 | 362 | 195 hidden at (0,0) | 0 |
| Spread of placed nodes (world px) | 3,593 × 3,530 (only 4 placed) | – | **150,125 × 122,128** (169 placed): ~130 × canvas width | a few hundred px |
| Nearest-neighbour distance, median | 0 (stacked) | – | **1,305 px** screen (2 drawn); **2,784 px** world across the 169 placed | ~30–60 px (seat gap) |
| Nearest-neighbour distance, P90 | 0 | – | 1,305 px screen | ~60 px |
| Node radius | 20 px (40 px circle) | – | 20 px | 4–24 px by links |
| Zoom / pan | 1.0 / (659, 405) | 1.0 / (581, 405) | 1.0 / **(−55,941, 45,655)** | 25–400 % |
| Layout still moving? | – | – | No: spread identical at +10 s and +20 s (frozen, not converging) | runs once |

Re-measured at 10:24 after the data grew (458 tracks): Plan mode, nothing selected, **0 drawn, 457 at (0,0)**.

**Fit / reset:** there is **no fit or reset control** on /graph: no zoom dock, no minimap, `find` returns nothing, and the overflow menu only has Import tracklist / Fix artist attribution / Clear scraping queue. The keyboard shortcuts panel lists ↑ ↓, Enter/Space, Ctrl+Click, Escape, Home/End, with no `0`/fit. Mouse-wheel zoom works (5 ticks: scale 1 → 0.5), but still draws nothing.

**Finding a known track:**
- Canvas: impossible. Nothing is drawn until a track is selected, so there is nothing to zoom or pan to.
- Global Search (Ctrl K) for "Runners High" navigates to **/library** (0 tracks), not to the graph.
- Library list in Plan mode: 1 click, 0 zoom/pan steps. The camera jumps to the node (pan −55,941, 45,655), but its nearest drawn neighbour is 1,305 px away, so its links run off-screen (screenshot 03).
- Keyboard ↓ ↓ Enter in Play mode selects a track and switches the page to Plan mode.

**Phone width (390 × 844, page loaded in a 390 × 844 frame because the browser window would not shrink):** there is no canvas at all (`__PIXI_APP__` absent). The middle panel is "Search to start exploring … 458 tracks loaded". "Kabuki" was found in 1 search with 0 zoom/pan steps and opens a track card. The **Track analysis panel underneath still says "No track selected"** after opening it (screenshot 07). The page stacks three fixed-height scroll panels; the Library panel shows only two rows, and the "Pathfinder" tab is cut off at the right.

**Console on /graph (verbatim, warnings only, no errors):**
```
Detected extreme viewport values, resetting to defaults: Object          (store/useStore.ts:1551, every page load)
Cannot navigate to node song_859a67d5-e8c1-4d75-beea-8230e9de00ea: node or zoom behavior not found   (×2)
Cannot navigate to node song_2e34b774-06cb-4c64-9b9f-2787b26af058: node or zoom behavior not found   (×2, later load)
```
The first is the persisted pan from earlier sessions (e.g. −56,522 / 45,250) being reset. The second is a stored "now playing" node the graph tries to centre before the PIXI zoom exists.

**API vs page:** `/api/graph/data` returns 1,240 nodes (later), but only the 463 with at least one edge are drawn; pipeline Stage 4 reports "132 / 1,264 (10%) tracks visible in the graph, 1,132 missing". No positions come from the API (all `position: {x: 0, y: 0}`), so layout is entirely client-side.

## 3. Recommendations panel (Intelligent Browser)

Opened with "Raise Your Weapon" (+ Deadmau5, 140.2 BPM, 3B, energy –, 8:23) as now playing, Play mode, "Best match" tab: 12 tracks (screenshot 08).

**Overlap: yes, on most rows.** The rows are virtualised: each is absolutely positioned at a fixed **64 px**, but its content is **78 px** whenever the reason text ("Mixed together in real DJ sets (sequential)", "Perfect harmonic match") wraps onto a second meta line. The extra 14 px spill into the next row (measured `overflowPx` +6 past the row box). The reason text then sits on top of the next title and is partly covered by it, which is why it reads "ct harmonic match" and "l together in real DJ sets". Only rows whose meta line fits on one line (Artbat, 54 px) are clean. The Play-mode canvas stays empty even with a track now playing.

| # | Track | BPM | Key | Energy | Reason | Score badge | Key badge |
|---|---|---|---|---|---|---|---|
| 1 | Architectural – Cubismo 8.3 | 123.1 | 7B | – | Mixed together in real DJ sets (sequential) | 80 strong | **key clash** |
| 2 | Enrico Sangiuliano – Symbiosis | 129 | 1A | – | Mixed together in real DJ sets (sequential) | 80 strong | **key clash** |
| 3 | Artbat – Planeta | 122 | 3B | – | Perfect harmonic match | **25 weak** | same key |
| 4 | Boards Of Canada – Satellite Anthem Icarus | 102.6 | 3B | – | Perfect harmonic match | **25 weak** | same key |
| 5 | Centrik – Beloved | 173.8 | 3A | – | Perfect harmonic match | 25 weak | relative B↔A |

The score and key badges contradict each other: "80 strong" sits next to "key clash", and "25 weak" next to "same key" with "Perfect harmonic match". The score appears to come only from transition evidence; harmonic match adds nothing. Tempo is not penalised either: a 102.6 BPM track is suggested after a 140.2 BPM track. Energy is "–" for every row (no energy data).

## 4. Every page, real data, light and dark, desktop (1440 wide) and phone (390 wide)

Measured with an in-page harness: each page loaded in a sized frame, theme set with `data-theme`, and the result recorded once network activity was idle for 2 s. "Data" is when the last `/api` response finished. **Zero console errors and zero failed requests (status ≥ 400) on all 32 runs.**

| Page | Desktop dark load / data (ms) | Desktop light | Phone dark | Phone light | Warnings | Bad text | Visual issues |
|---|---|---|---|---|---|---|---|
| / | 513 / 80 | 501 / 146 | 507 / 125 | 506 / 241 | 1 (extreme viewport) | – | Fine. "Library: 0 tracks" card |
| /library | 764 / 390 | 752 / 502 | 1003 / 650 | 1008 / 683 | 1 | – | **Empty: "The library has not been imported yet"**, 0 tracks, 0 % key and BPM. Search box still holds "Runners High" from an earlier quick search (query persists across visits). Phone: "Build set from crate" button cut off at the right edge |
| /sets | 759 / 365 | 756 / 357 | 767 / 410 | 1018 / 528 | 1 | – | Empty set (expected, 0 saved sets). "Build set" appears twice (header primary + empty-state) |
| /graph | 1014 / 532 | 1016 / 548 | 1017 / 679 | 1017 / 862 | 3 | – | **Empty canvas** (section 2). Light theme: right panel shows a large blank white box |
| /pipeline | 1014 / 602 | 1015 / 532 | 1026 / 544 | 1777 / 801 | 0–1 | – | Title "Pipeline telemetry" lacks the dimmed lead-in + bold title pattern used on every other page; no module banner. Stage cards use "—" (em dash) where the design system says en dash. Date fields: "Run scheduled scrapes between / From / Day Month Year / to / To" labels crowd together |
| /sources/targets | 1016 / 495 | 1264 / 541 | 1793 / 699 | 1812 / 809 | 1 | – | "Import a tracklist with AI" link clipped at the right edge (desktop). "Suggested for discovery" shows **duplicates** (A Moment Of Clarity ×2, Afreaka ×2) |
| /sources/import | 1006 / 582 | 756 / 584 | 768 / 639 | 767 / 685 | 1 | **null, Unknown** | Import history shows **56 × "@ null"** and "**Unknown DJ @ null (null)**" ×4. Title Case labels ("Copy Prompt", "Use API", "Setlist Parameters", "Paste Result") and upper-case field labels, against the sentence-case rule |
| /settings | 779 / 376 | 757 / 372 | 767 / 685 | 767 / 692 | 2 | – | Console: `SongNodes.icon: "key-round" is not in the icon set; drawing circle-help.` The Anthropic key status shows a "?" icon |

No emoji found on any page. No horizontal page scroll at either width.

## 5. Pipeline page (/pipeline): read-only

- **Scheduled scrape window:** card shows the "Every day" status pill and "Scheduled scrapes run every day." No window is set (`GET /api/v1/scrape/window` → `starts_on: null, ends_on: null`), so the date boxes are empty. Shown correctly for no window. Not saved.
- **Scrape runs:** "39 recent" listed. Latest: Deadmau5 Strobe / mixesdb / Done / 2 Nov 10:24 / 3:34 / 5 playlists / 213 tracks. Statuses on the page: Done 7, Found nothing 7, Failed 6, plus worker rows.
  - **Failed runs show durations of 87:24:44 and 87:29:00** (1001tracklists, started 29 Oct 18:00), i.e. measured to now because they never got a finish time.
  - One search reads "**atch22**, Kobayashi Maru Ddat" (first letter lost, probably "Catch22").
  - The status column shows a raw, HTML-escaped error as the status text: `RetryableError: unified scraper returned HTTP 504: {&quot;detail&quot;:&quot;Scrape request timeout after 900 seconds for source &#x27;1001tracklists&#x27;&quot;}` (×2).
  - No queued or running job at the time, so no stage card could be checked. Dead letters: 2.
- **Medallion flow:** Stage 1 bronze Done ("Last scrape saved 5 playlists, 213 tracks"). Stages 2 and 3 say "Up to date, **last run 5 d ago**", but `/api/v1/jobs` shows `projection_consume` and `graph_projection_consume` **succeeded at 10:31 today**, so that label is stale or reads the wrong source. Stage 4 serving index: **Warning, 132 / 1,264 (10 %)**, "1,132 missing, 132 out of date in the graph".
- Workers: 6. 1001tracklists worker **Error, 50 % success**; mixesdb worker Idle, 100 %.
- Nothing was queued and the window was not saved.

## 6. API spot checks (GET only)

| URL | Status | Time | Result |
|---|---|---|---|
| `:8082/health` | 200 | 7 ms | `healthy`, database_connected |
| `:8084/health` | 200 | 10 ms | `healthy` |
| `:8012/health` | 200 | – | `healthy`, unified_scraper, 11 sources. Blocked by CORS when fetched from the 3006 page; read directly |
| `:8082/api/v1/jobs?limit=5` | 200 | 6 ms | 5 jobs, all `succeeded` (ingest_pending, graph_projection_consume, projection_consume, 10:30–10:31) |
| `:8082/api/v1/scrape/window` | 200 | 6 ms | `{starts_on: null, ends_on: null, updated_at: null}` |
| `:8084/api/graph/data?limit=10000&offset=0` (what /graph calls, via `/api/graph/data` on 3006) | 200 | 283–330 ms | **1.23 MB**; 1,240 nodes, 454 edges at 10:31 (1,032 / 342 at 10:20). Sample x/y: (0,0), (0,0), (0,0): **all nodes at 0,0**, no positions sent. Edge weights 1 × 305, 2 × 71, 3 × 78. 463 nodes have an edge |
| `:8084/api/graph/stats` | 200 | – | 1,240 nodes (0 without artists), 454 edges, DB 1,264 tracks, 56 playlists |

## Five most serious problems

1. **/graph draws nothing until a track is picked, and the layout explodes when it does.** Evidence: section 2 (0 visible nodes in both modes; 169 placed nodes spread 150,125 × 122,128 px; nearest neighbour 1,305–2,784 px; 195–457 stuck hidden at 0,0; screenshots 02, 03, 33). Likely cause: the renderer still uses d3-force with link distances of 870–900 px for weights 1–3, charge −2,500, and no pull between 23 disconnected components. The ring layout in design system 1.5.0 (DR-034) has not been ported. Nodes left at (0,0) are culled, and the camera starts on an empty origin.
2. **No way to fit or reset the graph view.** Evidence: no dock, minimap or `0` shortcut; the menu has none. The spec (GraphControls) requires zoom ±, fit, reset, pause and minimap. Likely cause: GraphControls not yet implemented on the live page, and the old fit code path removed.
3. **Recommendation rows overlap.** Evidence: section 3, screenshot 08; 64 px virtual rows holding 78 px of content. Likely cause: fixed `estimateSize`/row height in the virtual list, not measured, while the reason line wraps.
4. **Recommendation scores contradict the key badges.** "80 strong / key clash" and "25 weak / same key / Perfect harmonic match", plus a 102.6 BPM pick after 140.2 BPM. Likely cause: the score is transition evidence only; harmonic and tempo compatibility are shown as badges but not used in the score or sort.
5. **Pipeline shows stale and raw data.** Failed runs with 87-hour durations, a raw HTML-escaped exception as a status, Stages 2–3 "last run 5 d ago" while jobs ran today, and 1,132 of 1,264 tracks missing from the graph. Likely cause: duration computed against now when `finished_at` is null; the error text is rendered unescaped and unformatted; the stage card reads a different timestamp than the jobs table. The 10 % serving figure matches the graph only drawing tracks with edges.

Also worth fixing: "Unknown DJ @ null (null)" and 56 "@ null" in /sources/import history (the design system says en dash for missing values); the missing `key-round` icon; the clipped "Import a tracklist with AI" link; duplicate discovery suggestions; the phone Track analysis panel not following the opened track.

## What looked fine

- All three services healthy; all API calls 200 in under 10 ms except graph data (~300 ms for 1.2 MB).
- **Zero console errors and zero failed requests** across 8 pages × 2 themes × 2 widths.
- Every page shows its data within 0.1–0.9 s of the request; full page settle 0.5–1.8 s.
- Light and dark themes both apply cleanly on every page; no horizontal scroll at 390 px; no emoji.
- Home, Set builder and Settings layouts are clean and follow the module banner and title pattern.
- Graph API data quality: every node has an artist (0 without), matching the artist-attribution rule.
- Scheduled scrape window card and pill render correctly for "no window set". Scraping and projection kept working during the test: the graph grew from 364 to 463 connected tracks without a reload of the stack.

## Screenshots

`02`–`04` graph Plan desktop · `05`–`07` graph phone · `08` recommendations panel · `20`–`23` phone pages (dark and light side by side) · `30`–`37` desktop dark pages · `40`–`47` desktop light pages. Order in each set: home, library, sets, graph, pipeline, targets, import, settings.
