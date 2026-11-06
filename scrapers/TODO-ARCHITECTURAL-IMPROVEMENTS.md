# Architectural improvements: songnodes-scrapers

Written 7 Nov 2026 by the data-flow investigation. 2 tasks for this sub-project.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `e469b41763f1`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

Each task is one job package (AGENTS.md rules 1–3: one verb, owned paths only, about 400 changed lines). UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns, and no local overrides; a missing pattern is added to the design system first.

## SN-T05: Stop the unified scraper at bronze

- **Type:** data-integrity
- **Owned paths:** `scrapers/pipelines/persistence_pipeline.py`
- **Depends on:** –
- **Verification:** a scrape writes bronze rows only; ingest creates silver once
- **Gap `sn-be-gap-scraper-bronze-only` (high):** Scraper must stop at bronze
  - Fix: Remove the tracks/playlists/playlist_tracks/song_adjacency branches from PersistencePipeline._flush_batch (keep bronze_* only) and rely on the ingest_pending follow-up; add a unique index on silver_enriched_tracks (bronze_id) or (lower(artist_name), lower(track_title)) and convert upsert_track to ON CONFLICT.
  - Contract: Scraper output = bronze_scraped_playlists + bronze_scraped_tracks with positions 1..n; silver is written only by common/datalayer/ingest.py inside a transaction that appends an outbox event.
  - Evidence: songnodes/scrapers/pipelines/persistence_pipeline.py:910, songnodes/services/common/datalayer/ingest.py:104
- **Impact:** closes sn-be-gap-scraper-bronze-only

## SN-T07: Let target scrapes bypass the daily discovery quota

- **Type:** fix
- **Owned paths:** `scrapers/spiders/1001tracklists_spider.py`
- **Depends on:** –
- **Verification:** two target scrapes in an hour both run
- **Gap `sn-be-gap-target-scrape-quota` (high):** Target scrapes must bypass the daily discovery quota
  - Fix: Set self.force_run = True in OneThousandOneTracklistsSpider.__init__ when search_query is given (as MixesDB does at line 116), or have the handler pass force_run=1 via params; and only stamp last_searched / found_nothing when the spider did not close with daily_quota_reached (return a reason from /scrape).
  - Contract: POST /scrape response gains close_reason; handler treats daily_quota_reached as RetryableError.
  - Evidence: songnodes/scrapers/spiders/1001tracklists_spider.py:189, songnodes/services/common/datalayer/handlers.py:85
- **Impact:** closes sn-be-gap-target-scrape-quota

