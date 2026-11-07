# Architectural improvements: musicLibrary

Written 7 Nov 2026 by the data-flow investigation. 7 tasks for this repository.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `9239a01d7141`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

Each task is one job package (AGENTS.md rules 1–3: one verb, owned paths only, about 400 changed lines). UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns, and no local overrides; a missing pattern is added to the design system first.

## ML-T01: Correct the README songnodes contract

- **Type:** docs
- **Owned paths:** `README.md`
- **Depends on:** –
- **Verification:** every path in the README exists
- **Gap `ml-gap-sync-script-missing` (medium):** README contract names a songnodes script that no longer exists
  - Fix: Update README 'In SongNodes' section to name scripts/import-music-library.sh and the run_weekly db step; drop the .gitignore lines for music-library.json in songnodes.
  - Contract: library.json v1 (build_db.export_artifact_json) -> POST /api/v1/library/ingest, Idempotency-Key import-<md5>
  - Evidence: musicLibrary/README.md, songnodes/.gitignore:251-253, songnodes/scripts/import-music-library.sh
- **Impact:** closes ml-gap-sync-script-missing

## ML-T02: Build the set exchange (M1)

- **Type:** module
- **Owned paths:** `pipeline/djlib/set_exchange.py (new)`, `pipeline/run_weekly.py`
- **Depends on:** SN-T03
- **Verification:** a songnodes set reaches TIDAL through sync-sets
- **Gap `ml-gap-saved-set-shape` (critical):** Saved-set shape is no longer shared between the two Set Builders
  - Fix: Version the document: add schema 'naarm.saved-set.v2' {id, name, shape, minutes, mix, pool, seed, tidal, tracks[{ml_id, sn_id, tgt, move}]}; songnodes stores the extra fields in library.sets (jsonb) and maps uuid->source_id via library.track_xref on export; load_sets accepts {sets:[...]} and resolves ids via xref.
  - Contract: naarm.saved-set.v2
  - Evidence: musicLibrary/pipeline/build_db.py:93-106, musicLibrary/pipeline/run_weekly.py:529-547, songnodes/frontend/src/features/musicLibrary/data.ts:140-161, songnodes/services/library/model/library_db.py:50-62
- **Gap `sn-fe-gap-artifact-sets-tidal-flag` (critical):** artifact_sets.json lacks the tidal flag musicLibrary needs
  - Fix: Either add 'tidal: boolean' (set when Send to TIDAL is requested) to SavedSet and the export, or document that songnodes sets go to TIDAL through /api/v1/tidal/sets/send and drop the inbox path; better, have musicLibrary read GET /api/v1/library/sets/export (exists, unused by the frontend).
  - Contract: artifact_sets/v2: SavedSet[] + {tidal:boolean}
  - Evidence: songnodes/frontend/src/features/musicLibrary/SetBuilderPage.tsx:223-226, musicLibrary/pipeline/run_weekly.py:529, musicLibrary/pipeline/build_db.py:93-106
- **Impact:** closes ml-gap-saved-set-shape, sn-fe-gap-artifact-sets-tidal-flag

## ML-T03: Merge Deezer BPM and key onto the chosen version

- **Type:** data-integrity
- **Owned paths:** `pipeline/run_weekly.py`, `pipeline/djlib/deezer.py`
- **Depends on:** –
- **Verification:** more than 0 tracks have BPM and key after one run
- **Gap `ml-gap-deezer-bpm-not-merged` (critical):** Second-source BPM and key are discarded
  - Fix: In process, when v.bpm is null take the Deezer twin's bpm (fold to pillar range) and record bpm_source; add an optional ref_mb lookup by ISRC for key/label/release date.
  - Contract: ledger track bpm_source, key_source
  - Evidence: musicLibrary/pipeline/run_weekly.py:226-230, musicLibrary/decisions/2026-10-25-metabrainz-integration-baseline.md
- **Impact:** closes ml-gap-deezer-bpm-not-merged

## ML-T04: Build the play-history import (M2)

- **Type:** module
- **Owned paths:** `pipeline/djlib/play_history.py (new)`
- **Depends on:** –
- **Verification:** calibrate.py reports rotation timings from plays
- **Gap `ml-gap-rekordbox-feedback` (medium):** Rekordbox play history and overrides do not feed back automatically
  - Fix: Parse rekordbox_collection.xml in process: match by Location/Artist+Title to set local_path and last_played, add a play appearance (source 'Rekordbox') so rotation sees real play; keep calibrate as the suggestion step.
  - Contract: rekordbox DJ_PLAYLISTS TRACK{Location, Artist, Name, PlayCount, LastPlayed, DateAdded} -> ledger local_path, appearances
  - Evidence: musicLibrary/pipeline/calibrate.py:55-83, musicLibrary/pipeline/djlib/export.py:356-358
- **Impact:** closes ml-gap-rekordbox-feedback

## ML-T05: Move setlist files into exchange/ and import them

- **Type:** contract
- **Owned paths:** `exchange/setlists/ (new)`, `pipeline/run_weekly.py`
- **Depends on:** SN-T03
- **Verification:** JohnCourse and kiki appear as songnodes setlists
- **Gap `ml-gap-setlists-orphan` (critical):** JohnCourse.json and kiki.json are written but never consumed
  - Fix: Move them to inbox/setlists/; post one request per setlist as {name: event, dj_artist: dj, tracks:[{artist,title,position,...}]}; log failures to outputs/<date>/ALERT_songnodes.txt.
  - Contract: songnodes.setlists.v1 -> TracklistImportRequest
  - Evidence: musicLibrary/pipeline/run_weekly.py:599-616, songnodes/services/rest_api/main.py:96-100, musicLibrary/JohnCourse.json, musicLibrary/kiki.json
- **Impact:** closes ml-gap-setlists-orphan

## ML-T06: Warn on resolve yield drops and retry rejected pending

- **Type:** observability
- **Owned paths:** `pipeline/run_weekly.py`, `pipeline/djlib/export.py`
- **Depends on:** –
- **Verification:** a run with half the usual yield writes a warning
- **Gap `ml-gap-written-never-read` (critical):** Outputs with no reader
  - Fix: Either delete the step or give it a consumer: have process read the newest review_queue.csv override column into energy_overrides; move tests/reports to songnodes.
  - Contract: review_queue.csv energy_score_override -> overrides
  - Evidence: musicLibrary/pipeline/djlib/export.py:285-305, musicLibrary/pipeline/run_weekly.py:298-308
- **Impact:** closes ml-gap-written-never-read

## UX-T05: Retire the artifact Set Builder behind /sets (UX-05)

- **Type:** ux-page
- **Owned paths:** `artifact/index.html`, `artifact/build/index.html`, `README.md`
- **Depends on:** ML-T02
- **Verification:** see UX-05
- **Gap `ml-gap-saved-set-shape` (critical):** Saved-set shape is no longer shared between the two Set Builders
  - Fix: Version the document: add schema 'naarm.saved-set.v2' {id, name, shape, minutes, mix, pool, seed, tidal, tracks[{ml_id, sn_id, tgt, move}]}; songnodes stores the extra fields in library.sets (jsonb) and maps uuid->source_id via library.track_xref on export; load_sets accepts {sets:[...]} and resolves ids via xref.
  - Contract: naarm.saved-set.v2
  - Evidence: musicLibrary/pipeline/build_db.py:93-106, musicLibrary/pipeline/run_weekly.py:529-547, songnodes/frontend/src/features/musicLibrary/data.ts:140-161, songnodes/services/library/model/library_db.py:50-62
- **Impact:** closes ml-gap-saved-set-shape

## Standing-rule violations in this project (report only)

| Page | Rule | Detail | Evidence |
|---|---|---|---|
| ml-page-set-builder-legacy | R1 | nav.views button tabs (Library / Set builder) are the site navigation | musicLibrary/artifact/index.html:40-45 |
| ml-page-set-builder-legacy | R4 | design-system/linters/check.py: 43 findings (TYP-PX 22, COL-HEX 13, LAY-Z 4, WRT-DATE 2, COL-FN 1, LAY-IMP 1); M1 grep 48 hex, 181 px; own fonts Big Shoulders Display and Barlow | songnodes/design-system/linters/check.py |
| ml-page-set-builder-legacy | R5 | labels rendered uppercase via text-transform (PILLAR, ENERGY TIER); missing values use en dash (pass on that part) | musicLibrary/artifact/index.html |
