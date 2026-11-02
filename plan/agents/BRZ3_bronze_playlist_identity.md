BRZ3: A re-scraped MixesDB playlist updates its one bronze row

Base: main at 9096637. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Branch `brz3-bronze-playlist-identity`. Depends on: BRZ2 (#499, merged).

## Job
Give every bronze playlist row a non-null upsert key `(source, source_url, source_playlist_id)` so a re-scrape of the same playlist updates its row instead of adding a copy.

## Context (verified on main 9096637, 2 Nov 2026)
Found in the local test of 2 Nov (`docs/integration/LOCAL-TEST-2026-11-02.md`, PR #518): all 47 MixesDB rows in `bronze_scraped_playlists` have `source_url = 'unknown'` and `source_playlist_id` NULL; they hold 23 distinct playlists. The MixesDB spider yields its EnhancedSetlistItem (URL only in `external_urls`) before the PlaylistItem, the setlist wins the per-run name check, and `_insert_bronze_playlists_batch` defaulted the URL to `'unknown'`. Postgres treats NULLs in a UNIQUE key as distinct, so the upsert never matched.

The other two findings are already fixed on main and only remain in old rows: raw_json as a string repr (BRZ2, #499, merged 2 Nov 10:39 Melbourne; the newest of the 47 rows is from 10:26) and the `MixesDB:Explorer/Mixes` page saved as a playlist (SC7, #461, 31 Oct; both such rows are from 28 Oct). BRZ3 adds tests for both through the real spider but does not change that code.

## Owned paths
- scrapers/pipelines/persistence_pipeline.py (bronze playlist upsert key only)
- scrapers/tests/test_bronze_playlist_identity.py (new)
- plan/agents/BRZ3_bronze_playlist_identity.md (this brief)
- STATUS.md (BRZ3 slot)

## Do
1. Take the playlist URL from `source_url`, else the first URL in `external_urls` (JSON text or dict).
2. Without an explicit source id, use that URL as `source_playlist_id`, so the key is never NULL when the URL is known.
3. Do not delete or rewrite existing bronze rows. Cleanup of the old duplicates is a separate step for the owner.

## Checks
`python -m pytest scrapers/tests -q`; `python -m pytest tests/unit/scrapers -q`; the scope guard.
