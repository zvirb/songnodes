# Data layer

How a scrape becomes trustworthy, enriched, queryable catalog data. Audio analysis is out of scope.

```
scrape job ──► unified-scraper ──► bronze (playlists + tracks with positions)
                                        │  ingest_pending  (complete playlists only)
                                        ▼
                     silver artists / tracks / ordered sets / directed transitions
                                        │  outbox events (same transaction as the change)
                  ┌─────────────────────┼───────────────────────────┐
                  ▼                     ▼                           ▼
        enrichment_backfill     projection_consume           er_shadow (review queue)
   (TIDAL → Deezer → MusicBrainz →   (projection_tracks:        (shadow decisions; merges
    Discogs → Last.fm; evidence,      denormalised, rebuildable)  are human-approved, reversible)
    consensus, field resolution)
```

Everything runs as **jobs** in Postgres (`ingestion_jobs`), executed by the Celery worker. Jobs are idempotent by key,
retried with exponential backoff up to `max_attempts`, then dead-lettered (`status = dead`, revivable). A worker that dies
mid-job loses nothing: its lease expires and another worker reclaims it. Any number of workers is safe.

## Rules the code enforces

| Rule | Where |
| --- | --- |
| Valid artist on **both** ends of every transition; placeholders (`Unknown Artist`, `VA`, `ID`, …) never become nodes | `common/metadata/names.py`, `ingest.py` |
| Complete playlists only: positions `1..N` with no gap, declared size honoured; otherwise recorded as `failed` with the reason and nothing else is created | `ingest.completeness_errors` |
| An invalid entry breaks the chain; transitions never bridge a gap | `ingest.ingest_playlist` |
| Bronze keeps every submitted row at its original position | `catalog_writes.import_tracklist` |
| Replaying an ingest changes nothing; the same transition from another set increments `occurrence_count` | `ingest`, tests |
| Unknown stays unknown: no invented BPM, key, energy or duration; BPM `0` is unknown | `consensus`, `providers/*` |
| A radio edit is never substituted for an extended mix (version match + ±10 s duration guard; ISRC first) | `common/metadata/matching.py` |
| A person's correction is final; provider disagreement is kept as evidence but raises no review | `consensus.manual` |
| Providers that publish the same upstream value count once (`PROVIDER_GROUPS`) | `consensus`, `registry` |
| Nothing is overwritten without a trace: prior values are kept as `legacy` evidence | `evidence.snapshot_legacy` |
| Merges are reversible and old ids keep resolving | `identity`, `entity_redirects` |
| Spotify audio features are not used anywhere | guard test `test_no_spotify_audio_features.py` |
| No committed password/secret defaults | guard test `test_no_hardcoded_secrets.py` |

## Job kinds

Submit with `POST /api/v1/jobs` (header `Idempotency-Key` for safe retries) or, for scraping, `POST /api/v1/scrape/trigger`.

| kind | payload | what it does |
| --- | --- | --- |
| `scrape` | `source`, `search_query` (artist **and** title), `limit` | POSTs to the unified scraper, then queues `ingest_pending` |
| `ingest_pending` | `limit` | Ingests bronze playlists/tracks not yet ingested; queues projection and enrichment |
| `enrichment_backfill` | `batch_size`, `restart` | Enriches tracks missing BPM/key/ISRC/TIDAL/Deezer id; resumable; 7-day cooldown |
| `enrich_track` | `track_id` | Enrich one track now |
| `camelot_repair` | `limit` | Recomputes stored Camelot codes from the original key (the old minor-key table was wrong); reversible |
| `projection_consume` / `_rebuild` / `_reconcile` | `repair` | Keep `projection_tracks` current / rebuild it / compare with silver |
| `er_shadow` | `max_artists`, `restart` | Scores same-artist track pairs and records them for review; merges nothing |

Recurring jobs (`ingest_pending` every 60 s, `projection_consume` every 15 s) are enqueued by the worker's scheduler.

## Operating it

* **Job state:** `GET /api/v1/jobs?status=dead`, `GET /api/v1/jobs/{id}`, revive with `POST /api/v1/jobs/{id}/retry`.
* **Review queue:** `GET /api/v1/metadata/review` (reasons such as `key_near`, `bpm_conflict`, `isrc_conflict`,
  `match_review_<provider>`, `camelot_unverified`) shows competing evidence; `GET /api/v1/resolution/review` lists pairs
  awaiting a verdict, `POST /api/v1/resolution/{id}/review {"outcome":"same"|"different"}` decides.
* **Merges:** `POST /api/v1/tracks/{id}/merge`, `GET /api/v1/merges`, `POST /api/v1/merges/{id}/revert`,
  `GET /api/v1/tracks/{id}/canonical` (resolves a merged-away id).
* **Pipeline health:** `GET /api/v1/outbox/status` (consumer lag, dead letters, projection reconciliation).
* **Schema check:** `python migrate.py --check` in the worker image lists any missing data-layer object.

## Configuration

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` (or `POSTGRES_*`) | Postgres; `postgresql+asyncpg://` is accepted |
| `RABBITMQ_HOST/PORT/USER/PASS` or `CELERY_BROKER_URL` | Celery broker |
| `ENRICHMENT_PROVIDERS` | Allow-list, e.g. `tidal,deezer,musicbrainz,discogs,lastfm`; `none` disables all outbound calls |
| `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`, `TIDAL_COUNTRY_CODE` (default `AU`) | TIDAL v2 |
| `DISCOGS_API_TOKEN` (or `DISCOGS_TOKEN`), `LASTFM_API_KEY`, `MUSICBRAINZ_CONTACT` | Other providers |
| `GETSONGBPM_API_KEY` + `GETSONGBPM_ENABLED=true` | **Off until its terms are verified**; the required backlink is served at `/api/v1/attributions` and rendered by the frontend |
| `PROVIDER_GROUPS` | `a=b` marks provider `a` as republishing `b`'s data |
| `UNIFIED_SCRAPER_URL` | Default `http://unified-scraper:8012` |

Credentials equal to a `CHANGE_ME…` placeholder count as **not configured**.

## Energy contract (provisional)

`energy-1`: canonical scale 1–10, one decimal, bands **Warm 1.0–3.9**, **Building 4.0–6.9**, **Peak 7.0–10.0**.
These names and boundaries are proposals awaiting your ratification; changing them means a new contract version and a
projection rebuild. Legacy 0–1 `energy` is converted for display but flagged uncalibrated and never receives a band.
Only manual ratings and calibrated extractors do. Calibration from audio is not implemented.

## Not verified (read this before trusting provider data)

The official documentation could not be read for **Deezer, GetSongBPM, MusicBrainz and Discogs** (login wall, 403,
anti-bot page), and the Last.fm HTTPS base and JSON field names are inferred. The TIDAL v2 OpenAPI **was** read, but live
responses were not seen: whether BPM/key are populated, the array-filter encoding (`comma` is the default,
`array_style='repeat'` is available), and the auth header form are unconfirmed. None of the provider clients has been run
with credentials. The mocked contract tests prove the code matches *this* reading of the contracts, not the live APIs.

Run the credential-gated checks before relying on any provider:

```
RUN_LIVE_PROVIDER_TESTS=1 TIDAL_CLIENT_ID=… TIDAL_CLIENT_SECRET=… LASTFM_API_KEY=… \
  python -m unittest discover -s tests/live -v
```

They assert response *shape* and print `LIVE-REPORT …` lines (observed durations, whether BPM/key are populated, which
array style TIDAL accepts). A provider that turns out not to supply the data we need should be removed from the code and
the allow-list.

## Known gaps

* The legacy `data-transformer` bronze→silver ETL and the scraper pipeline's direct silver writes still exist. Ingestion
  adopts silver playlists the pipeline already wrote and does not double-count transitions, but only one ETL should be
  scheduled. Retire `data-transformer/bronze_to_silver_etl.py` once this path is confirmed on real data.
* Entity-resolution thresholds were calibrated on synthetic pairs only; automatic merging stays off until labelled real
  pairs meet the precision gate (`er.meets_precision`). Splink is not wired in; a second model can run beside `rules/v1`.
* No real catalog data has been loaded or measured: coverage baselines, performance and relevance are all unmeasured.
* Out of scope by instruction: audio extraction and calibration (Milestone 8), search, graph projection and wave routing,
  and the Sigma renderer (Milestones 5–7).
