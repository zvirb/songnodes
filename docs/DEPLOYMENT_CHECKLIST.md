# Run and first-scrape checklist (Docker Compose)

SongNodes runs as plain Docker containers from `compose.dev.yaml` (project `songnodes-dev`). The data layer is
code-complete and tested with synthetic data; nothing has run against real credentials or real playlists.

## 1. Before you start

- [ ] **Rotate the exposed credential.** A database password (`7D82_xqNs55tGyk`) was committed in two scraper files. It is
      removed from the tree but remains in git history: if it was ever a real password, change it.
- [ ] Decide the **energy bands** (`docs/DATA_LAYER.md`): ratify or change Warm/Building/Peak.
- [ ] Put provider credentials in your shell environment or an untracked `.env` next to `compose.dev.yaml`:
      `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`, `LASTFM_API_KEY`, `DISCOGS_API_TOKEN`
      (`SPOTIFY_*` only if you use them). Values starting `CHANGE_ME` count as "not configured".
- [ ] Set `ENRICHMENT_PROVIDERS` (comma list, e.g. `tidal,lastfm,discogs`). The default is `none`, so nothing calls out until you opt in.
- [ ] Run the **live provider checks** (command in `docs/DATA_LAYER.md`) and paste the `LIVE-REPORT` lines back. Remove any
      provider that does not supply what we need.
- [ ] Leave `GETSONGBPM_ENABLED=false` unless you have read its terms and accept the backlink.
- [ ] Optional: `git rm -r --cached data/rabbitmq` (a committed RabbitMQ runtime directory).

## 2. Build and start

```
bash scripts/start-dev.sh
```

This applies migrations 012–014 (and the base schema on an empty volume), builds the images (rest-api, graph-api, worker,
unified-scraper, frontend) and runs `docker compose up --wait`. Re-run it after any code change.

| Service | URL on your machine |
| --- | --- |
| Frontend | http://127.0.0.1:3006 |
| REST API | http://127.0.0.1:8082 |
| Graph API | http://127.0.0.1:8084 |
| Unified scraper | http://127.0.0.1:8012 (container port 8000) |

## 3. Verify before scraping

```
docker compose -f compose.dev.yaml ps                                           # all healthy
docker compose -f compose.dev.yaml exec worker python migrate.py --check        # exit 0
curl -s http://127.0.0.1:8082/api/v1/outbox/status                              # consumers listed, dead_letters 0
curl -s "http://127.0.0.1:8082/api/v1/jobs?limit=5"                             # recurring ticks succeeding
```

If `--check` reports missing objects, apply `sql/migrations/012`, `013`, `014` (`*_up.sql`); they are safe to repeat.
Roll back the data layer with `014_data_layer_down.sql`.

## 4. First scrape (one target, then look)

```
curl -X POST "http://127.0.0.1:8082/api/v1/scrape/trigger?source=mixesdb&search_query=Deadmau5%20Strobe" \
     -H "Idempotency-Key: first-scrape-1"
```

Use a combined **artist + title** query. Follow the returned `job_id` with `GET /api/v1/jobs/{job_id}`. Expected sequence:
`scrape` → `ingest_pending` → `projection_consume` → `enrichment_backfill`. Scrape logs: `docker compose -f compose.dev.yaml logs -f unified-scraper worker`.

Then check, in order:

1. `GET /api/v1/jobs?status=dead` is empty. A `scrape` job rejected by the scraper (unknown source, bad body) is dead-lettered
   immediately with the scraper's message; timeouts and 5xx are retried.
2. Bronze got a **complete** playlist: positions `1..N`, no gaps. A playlist with gaps is recorded as `failed` in
   `silver_enriched_playlists.enrichment_metadata` (`position_gap` / `declared_count_exceeds_loaded`) and creates nothing else — intended.
3. `silver_track_transitions` has rows and every endpoint has a real artist (no `Unknown Artist`).
4. `GET /api/v1/metadata/review` shows what needs a human.
5. The frontend graph shows the nodes.

Known and harmless: the scraper pipeline logs `relation "artists" does not exist` (and `song_adjacency`) because those legacy
tables are not part of this schema. Checked with a synthetic playlist: bronze (with `playlist_id` and positions) and silver
writes still succeed. Still unverified: real spiders against live sites, and the scraper's own silver writes against a
real playlist (ingestion adopts them; compare transition counts for one known playlist).

## 5. Only after the first scrape looks right

- Raise `limit` and scrape more targets (`load_283_tracks.sql` / `target_tracks_master.json` hold the 283-track target list).
- Run `er_shadow`, review pairs, and keep automatic merging off until labelled pairs meet the precision gate.
- Capture the coverage baseline with `scripts/metadata_coverage.py` (`docs/METADATA_BASELINE.md`).

## What can go wrong

| Symptom | Likely cause |
| --- | --- |
| Scraper inserts fail on `playlist_id`/`position` | Migration 014 did not run (`migrate.py --check`) |
| Worker exits with a RabbitMQ credentials error | `RABBITMQ_USER`/`RABBITMQ_PASS` (or `CELERY_BROKER_URL`) unset; the compose file sets them |
| `scrape` jobs retry with `unified scraper unreachable` | Scraper container down, or `UNIFIED_SCRAPER_URL` not `http://unified-scraper:8000` |
| Frontend loads but graph is empty / 502 | `graph-api` unhealthy; frontend proxies to the `graph-visualization` alias |
| Enrichment finds nothing | Credentials unset/placeholder, or `ENRICHMENT_PROVIDERS` excludes them |
| Everything is `match_review_*` | Tracks lack ISRC and duration and several candidates look alike (by design) |

## Kubernetes (not used now)

The Helm chart and Flux config under `deploy/` are retained for a possible later production move but are not part of this workflow.
