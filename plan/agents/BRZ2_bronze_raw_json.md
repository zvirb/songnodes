BRZ2: Bronze playlists store raw_json as a JSON object

Base: main at 62795a7. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Branch `brz2-bronze-raw-json`. Depends on: BRZ1 (#481, merged).

## Job
Serialise bronze playlist and track raw_json as a JSON object, so ingest can read fields such as `total_tracks`.

## Context (verified on main 62795a7, 1 Nov 2026)
Found in BRZ1: `_insert_bronze_playlists_batch` ran `json.dumps(item, default=str)` on a scrapy Item. An Item is not a dict, so json fell back to `str(item)` and raw_json held a JSON string of the Item repr; `services/common/datalayer/ingest.py` `raw_object` then read `{}`. `_insert_bronze_tracks_batch` used the same call (its MixesDB items are already dicts, but an Item with playlist context would hit it).

## Owned paths
- scrapers/pipelines/persistence_pipeline.py (bronze playlist and track raw_json serialisation only)
- scrapers/tests/test_bronze_raw_json_object.py (new)
- services/common/datalayer/ingest.py (reject playlists flagged `bronze_incomplete`, a few lines in `ingest_playlist`)
- services/common/tests/test_ingest_bronze_incomplete.py (new)
- plan/agents/BRZ2_bronze_raw_json.md (this brief)

## Do
1. Convert Items, nested Items and tuples to plain dicts/lists before `json.dumps` for bronze playlists and tracks.
2. Keep BRZ1's `bronze_incomplete` flag logic unchanged (non-object raw_json of old rows stays wrapped under `raw`).
3. Ingest rejects a playlist whose raw_json carries `bronze_incomplete` (reason `bronze_incomplete`) when no other completeness error applies.
4. Existing bronze rows are not rewritten; ingest reads them as `{}` (as before) unless BRZ1 wrapped them.

## Checks
`python -m pytest scrapers/tests -q`; `cd services && python -m pytest common/tests -q`; the scope guard.
