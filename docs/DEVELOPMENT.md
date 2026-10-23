# Development baseline

This is the first increment of the architecture migration: a small, real database
and API workflow for frontend development. It does not deploy the full platform.
See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete migration plan.

The inactive Wave option is hidden by default. `VITE_ENABLE_WAVE_ROUTING=true`
reveals it for development only; this does not implement wave routing. Keep the
flag unset for users until milestone 6 is validated. Vite reads this variable at
startup/build time, so changes require restarting or rebuilding the frontend.

## Prerequisites

- Docker Engine and Docker Compose v2 (supporting `up --wait`)
- Node.js 22.12+ (validated with 24.19) and npm
- Bash, curl, and, in the Codex proxy environment, Python 3 and getent

Use the existing checkout. In Codex cloud, files remain in the cloud; no laptop
drive space is required. For a Windows checkout, use `D:\` as requested and run
these commands through WSL with Docker integration.

## Start

From the repository root:

```bash
bash scripts/start-dev.sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

The startup script builds API images and starts PostgreSQL 16, Redis 7, REST on
loopback port 8082, and the graph API on loopback port 8084. Vite uses port 3006
and proxies API requests to those backends. The script supports the cloud's
existing proxy and CA certificate without disabling verification.

The development database is private to this Compose network and has no published
port. It uses trust authentication for development only. Never use this Compose
file on a shared or production network. Redis also has no published port.

The dedicated `songnodes-dev_dev-postgres` volume is initialized from the existing
bronze, silver, and transition migrations. It starts empty; no production data or
external provider credentials are required. Initialization scripts run only when
the volume is first created. Existing volumes are preserved by the startup script.
Schema changes to an existing volume require explicit migrations, not a reset.
The startup script also applies `sql/migrations/012_target_tracks_up.sql` to
existing volumes. This idempotent migration creates the target-track work queue
and preserves existing records. Apply that migration explicitly when deploying
the updated REST service outside this development script. Rolling back API code
does not require dropping the queue table; keep its data.

## Verify

With Vite running:

```bash
curl --fail http://127.0.0.1:8082/health
curl --fail http://127.0.0.1:8084/api/graph/data
cd frontend
npm run build
npm run type-check
npm run test:unit
node scripts/smoke-dev.mjs
```

From the repository root, run the real database/API regression suite:

```bash
python -m unittest discover -s tests/integration -p 'test_dev_*.py' -v
```

These 19 tests require the development Compose stack, use unique synthetic
records, and clean up only their own data. They cover graph aliases, directed
induced edges, pagination, bounded neighborhoods, literal substring search,
metadata corrections, target CRUD/validation, repeated queue migration, catalog
read contracts/provenance, and ordered setlist membership.

The smoke test requires Playwright Chromium (`npx playwright install chromium`).
Where a system Chromium is already installed, use:

```bash
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/smoke-dev.mjs
```

The smoke test inserts two explicitly synthetic tracks and one directed transition
into the development database, checks their IDs and transition weight through the
Vite proxy, and verifies that React renders a graph canvas without browser
exceptions. It checks track details through the browser's catalog client, creates
a target through the browser API client, opens the
Targets management UI to verify it is displayed, and checks update/delete calls
through the Vite proxy. It removes its records in a cleanup block and does not mock API data.
If the process is forcibly killed, test records may remain; their artist is
`Smoke Test Artist`.

The graph data, nodes, edges, statistics, search, and neighborhood routes now share
silver-catalog read models. Graph IDs use `song_<uuid>`; raw database UUIDs remain
available as `track_id`. Node visibility requires known artist attribution, and
subgraph edges require both endpoints to be loaded. Neighborhood exploration is
bounded to 150 nodes and at most two hops. The combined graph response is capped
at 15,000 nodes and 30,000 edges. These are PostgreSQL baseline queries; substring
search is not the milestone-5 typo-tolerant search engine. Neighborhood expansion
explores both directions but preserves the original directed edges in responses.

Target creation and updates accept JSON, matching the UI. Deletion returns 204
with no body. Manual metadata corrections write to silver; genre strings are
stored as arrays. The canonical energy-scale changes remain deferred to milestone 3.

### Catalog read contracts

Track/artist/setlist reads use dedicated catalog response models rather than
scraper-submission validators. Existing list/search field names are retained;
UUID identities and valid silver values are returned without silently skipping
rows. Track details also expose `id`, `name`, and `artist` for the frontend client.

- `/api/v1/tracks`, `/api/search/tracks?query=...`, and both
  `/api/tracks/{id}` and `/api/v1/tracks/{id}` read silver tracks. Detail IDs may
  be UUIDs or `song_<uuid>` graph IDs. `track_id`/`song_id` are database UUIDs;
  `source_track_id` preserves a provider's separate identifier.
- `/api/v1/artists`, `/api/v1/artists/search?query=...`, and
  `/api/v1/artists/{uuid}` read silver artists. Search supports literal name and
  alias substrings. `match_score` is a compatibility ranking heuristic, not a
  learned probability. Track counts and the track-list `artist_id` filter use
  exact canonical-name matching because silver track rows currently store artist
  text, not an artist foreign key. Canonical relationship design remains milestone 3.
- `/api/v1/setlists` and `/api/v1/playlists` support `dj_id`, `source`, `limit`,
  and `offset`. Both detail aliases return ordered entries, also available at
  `/api/v1/setlists/{uuid}/tracks`. Repeated tracks, original position gaps, and
  unknown cue times are preserved. `total_tracks` counts loaded entries;
  `declared_track_count` retains the source's separate count.

`data_layer: silver` describes storage separately from `data_source`/`data_sources`.
Provider names come from bronze lineage, including additional track sources;
unknown provenance remains null/empty. An artist with multiple sources has no
invented primary provider. Durations expose explicit milliseconds and derived
seconds/minutes; release dates remain full dates. No energy calibration or new
canonical identity policy is introduced by these read adapters.

Ordered setlist contract tests are synthetic fixtures. They do not satisfy the
milestone-1 requirement to inventory and capture complete real sets for wave evaluation.

This baseline does not validate legacy catalog writes (artist/track creation,
artist rename/merge/assignment), external target-search dispatch, OAuth, external music services,
scraping, or the complete medallion pipeline. Some REST catalog and graph debug
write/diagnostic endpoints still require older operational tables and are not ready on this
minimal stack. Structured graph filters are also outside this validated scope.
Type checking and the 33 frontend unit tests pass after the
milestone-1 cleanup. The archived renderer is type checked but its runtime behavior
has not been validated. Do not treat a passing build as a passing type check.

## Stop and inspect

```bash
docker compose -f compose.dev.yaml ps
docker compose -f compose.dev.yaml logs --tail 100 graph-api rest-api
docker compose -f compose.dev.yaml stop
```

Stop Vite with Ctrl+C. Stopping services retains database contents. Avoid
`down -v` unless intentionally deleting this development database.

### Stored metadata checks

The smoke test checks stored duration/energy/Camelot/provider fields and unknowns
through initial graph loading, the API reload client and desktop/mobile adapters.
Graph and REST catalog reads share the stored-field contract; optional legacy
JSONB fields remain readable until the versioned column migrations are introduced.
Core silver NULLs override stale JSONB measurements. Record labels are exposed as
`record_label`, separate from graph display `label`. Energy is transported with
its recorded scale, without calibration or conversion. Legacy timed routing
requires measured durations and reports an error when they are missing.

These checks use synthetic fixtures. They do not demonstrate live provider
contracts, real-library coverage, calibrated energy, or backfill completion.

### Coverage baseline

See [METADATA_BASELINE.md](METADATA_BASELINE.md) for read-only snapshot/compare
commands, the persisted seeded sample, empty-data semantics and source inventory.
Run all development API and coverage checks with:

```bash
python -m unittest discover -s tests/integration -p 'test_dev_*.py' -v
```

Coverage evidence defaults to explicitly selected ignored `.local-dev/` paths.
It is separate from committed synthetic regression fixtures and live provider
validation. A populated real-data baseline has not yet been captured here.
