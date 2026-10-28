AA2: Audio analysis: fill missing key and BPM from Deezer previews

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "AA2: Audio analysis: fill missing key and BPM from Deezer previews" on a branch starting with "aa2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:AA2 BEGIN/END). Depends on: AA1, SC2. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Run the AA1 analyser on Deezer 30-second previews for tracks that lack a key or BPM, and record the results as metadata evidence so the existing consensus fills the tracks the graph and the library show.

## Context (verified on main 2026-10-26)
Tracks are silver_enriched_tracks; library.tracks is an overlay keyed to the same ids (sql/migrations/101_library_schema_up.sql), so one fix covers the graph and the library. Measurements go through services/common/datalayer/evidence.py record(conn, track_id, field, value, source, method=..., method_version=..., confidence=...) into silver_track_metadata_evidence; consensus then sets bpm and key and flags conflicts for review (metadata_review). services/common/providers/deezer.py reads /track/{id}; its `preview` URL is in `raw` and is short-lived, so fetch a fresh one per analysis. Its docstring says 'availability is not permission to analyse audio' and docs/requirements/TRACK_METADATA_RETRIEVAL.md asks for Deezer's terms to be checked: the owner chose Deezer previews on 28 Oct 2026; check the terms and record the conclusion in docs/audio-analysis/deezer-previews.md. The worker (services/worker/celery_app.py) runs jobs from services/common/datalayer/handlers.py; heavy audio libraries belong in the audio-analysis image, not the worker image, the same way scraping goes through the unified-scraper container over HTTP.

## Owned paths
- services/audio-analysis/Dockerfile and services/audio-analysis/requirements.txt (Essentia only, see Do step 0)
- compose.dev.yaml (add the audio-analysis service only: build services/audio-analysis, 1 GB memory limit, no published port, healthcheck)
- services/audio-analysis/main.py (a POST /analyze-url endpoint and making startup work without RabbitMQ; do not remove existing endpoints)
- services/common/datalayer/audio.py (new)
- services/common/datalayer/handlers.py (register the 'audio_analysis' handler only)
- services/worker/celery_app.py (schedule_async: one more recurring kind)
- services/common/tests/test_audio_analysis_job.py (new)
- services/audio-analysis/tests/unit/test_analyze_url.py (new)
- docs/audio-analysis/deezer-previews.md (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/AA2/ if you need to record a decision.)

## Do
0. Essentia (used by AA1's analysis_modules/key_bpm.py) is not in requirements.txt yet, and it has no wheel for Python 3.15: the newest release, 2.1b6.dev1438, ships cp314 wheels only (2.1b6.dev1389 covers cp39 to cp313). Base the audio-analysis image on python:3.14-slim, pin essentia==2.1b6.dev1438 in requirements.txt, and check it with `pip install -r requirements.txt` in a Python 3.14 environment (plus `docker build services/audio-analysis` if Docker is available to you). AA1's tests (tests/unit/test_key_bpm.py) must pass with it; they passed on 28 Oct with 2.1b6.dev1389 on Python 3.13.
1. audio-analysis: POST /analyze-url {url} downloads the clip (max 5 MB, 20 s timeout, audio content types only), runs key_bpm.analyse_file on a temp file, deletes it, and returns the AA1 result. Nothing is stored on disk after the request.
2. Worker: a recurring 'audio_analysis' job every AUDIO_ANALYSIS_INTERVAL_SECONDS (default 600) when AUDIO_ANALYSIS_ENABLED is 'true' (default 'true' unless the terms check says otherwise; then default 'false' and say so). It picks up to AUDIO_ANALYSIS_PER_RUN (default 10) silver tracks with a deezer_id that have no bpm or no key, and no audio-analysis evidence newer than 30 days, library tracks first (EXISTS in library.tracks), then by created_at.
3. For each: Deezer /track/{id} through the existing provider for a fresh preview URL (skip and count when there is none), POST it to http://audio-analysis:8020/analyze-url, then evidence.record for 'bpm' and 'key' (Camelot) with source 'audio_analysis', method 'audio', method_version from the result, independent_group 'audio_analysis', and the result's confidence. Then run the same consensus step enrichment uses so the track columns update. Never write the track columns directly, never overwrite manual or Beatport values.
4. Respect Deezer's quota errors (code 4: back off, retryable) and a per-run limit; log one summary line per run {selected, analysed, no_preview, failed}.
5. Tests: fake Deezer and fake analyser: evidence recorded with the right source and method; a track without a preview is skipped; the disabled flag does nothing; library tracks are picked first.
6. docs/audio-analysis/deezer-previews.md: what the terms say about analysing previews, the decision, and how to switch it off (AUDIO_ANALYSIS_ENABLED=false).

## Done when (the reviewer's under-10-minute check; put it in the PR)
With the stack running and a library imported, after one interval GET /api/v1/jobs?kind=audio_analysis shows a succeeded job, and the Library page's 'Have key and BPM' figure rises above 0 %.

## Checks
`cd services && python -m pytest common/tests/test_audio_analysis_job.py -q`, `cd services/audio-analysis && python -m pytest tests/unit -q`, `docker compose -f compose.dev.yaml config`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
