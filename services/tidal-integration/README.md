# TIDAL Integration Service

This FastAPI microservice wires SongNodes to a TIDAL account using the community `tidalapi` library.
It allows you to:

- List the user’s TIDAL playlists so you can choose which ones to import.
- Import a selected playlist into Postgres (`tidal_imported_tracks`).
- Build a new TIDAL playlist from a visualization path (list of node IDs).

## Enabling the service

Add the following environment variables (the service stays disabled when `ENABLE_TIDAL_INTEGRATION` is false or missing):

```
ENABLE_TIDAL_INTEGRATION=1
DATABASE_HOST=musicdb-postgres
DATABASE_PORT=5433
DATABASE_NAME=musicdb
DATABASE_USER=musicdb_user
DATABASE_PASSWORD=musicdb_secure_pass
TIDAL_SESSION_FILE=/data/tidal-session.json
```

On first run you will be prompted (in the service logs) to complete the TIDAL OAuth device flow. The session is then cached in `TIDAL_SESSION_FILE` for future runs.

## Robots.txt & Quotas

The service fetches each provider’s `robots.txt` and respects the published `crawl-delay`. It also stores a `last_run` timestamp in Redis (shared with the scrapers) so accidental reruns within the same day can be skipped unless you set `SCRAPER_FORCE_RUN=1`.

## Endpoints

- `GET /health` – returns `disabled` when TIDAL integration is off.
- `GET /playlists` – list TIDAL playlists (for user selection).
- `POST /playlists/import` – body `{ "playlist_id": "1234" }`; imports tracks to Postgres.
- `POST /playlists/create-from-path` – body `{ "node_ids": ["uuid1", "uuid2"], "name": "optional" }`.
  If `name` is omitted a default such as `path2025SEP19-132233` is used.

## Running locally

```
cd services/tidal-integration
pip install -r requirements.txt
uvicorn main:app --reload --port 8095
```

Use a REST client (or curl) to hit the endpoints. For example:

```
curl http://localhost:8095/playlists
```

When generating playlists from node paths, make sure the IDs map to rows in `musicdb.nodes`. Unknown nodes are skipped.
