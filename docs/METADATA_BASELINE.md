# Metadata baseline and source inventory

Checked 2026-10-24 (Australia/Sydney) in the cloud development Compose stack.
This inventory describes this instance, not the user's library or production.

| Available data | Count |
| --- | ---: |
| Bronze tracks / distinct track sources | 0 / 0 |
| Silver tracks / artists | 0 / 0 |
| Silver playlists / ordered set entries | 0 / 0 |
| Directed transitions | 0 |
| Persisted sample / requested size | 0 / 50 |

No real-library coverage baseline or complete real-set fixture is established.
All field percentages in the empty snapshots are `null`, rather than 0% or 100%.
Synthetic fixtures used by regression tests are removed and do not count as real
coverage. The two empty captures and their comparison are under the ignored
`.local-dev/coverage/` directory; they are local evidence of the tool run only.

## Reproduce snapshots and comparisons

Start the stack with `bash scripts/start-dev.sh`. From the repository root:

```bash
python scripts/metadata_coverage.py snapshot \
  --dataset my-catalog-baseline-1 \
  --sample .local-dev/coverage/my-catalog-baseline-1/sample.json \
  --output .local-dev/coverage/my-catalog-baseline-1/before.json
# After independently validated enrichment or transport changes:
python scripts/metadata_coverage.py snapshot \
  --dataset my-catalog-baseline-1 \
  --sample .local-dev/coverage/my-catalog-baseline-1/sample.json \
  --output .local-dev/coverage/my-catalog-baseline-1/after.json
python scripts/metadata_coverage.py compare \
  .local-dev/coverage/my-catalog-baseline-1/before.json \
  .local-dev/coverage/my-catalog-baseline-1/after.json \
  --output .local-dev/coverage/my-catalog-baseline-1/comparison.json
```

The CLI reads only the minimal development Compose database using `psql -X` in a
read-only repeatable-read transaction. It does not call providers, run enrichment,
change database records, or read/export credential values. It requires Docker
Compose and Python's standard library; no new package installation is needed.
There is deliberately no implicit connection to production. Large production
catalog capture will need a streamed export adapter; this baseline implementation
loads the development catalog into memory.

Use explicit dataset labels and separate output directories for real versus
synthetic runs. Labels record operator intent; they do not authenticate data
origin. Preserve the snapshot and sample together. Existing evidence files cannot
be overwritten. The default seed is `songnodes-metadata-v1`; sample selection sorts
stable IDs by SHA-256 of `seed:id` and keeps at most 50. Input ordering does not
change selection. A manifest is reused exactly: it never fills vacant slots,
replaces deleted tracks, or expands after capture. A seed/dataset/size mismatch
fails. **After importing the first real data into an empty catalog, start a new
baseline with a new sample path and dataset label.** Keep the empty-run evidence.

JSON reports include all-track coverage, the persisted sample, and comparison
cohorts. Current-catalog percentages can change merely because records were
added; fixed-baseline and fixed-sample denominators remain unchanged. Deleted
records count as missing in those cohorts, and are reported separately from field
losses among surviving records. Gains/losses count presence changes, not changes
in measurement values. Snapshots store stable IDs and boolean presence flags,
without titles, artists, raw measurements, or provider payloads.

The reported fields are BPM, musical key, Camelot key, energy, ISRC, TIDAL ID,
Deezer ID, genre, record label, mix name, duration, danceability and valence.
`record_label` is the requirement's record `label`, never graph display text.
The shared API extraction rules apply: core silver NULLs override stale JSONB;
optional stored fields can fall back to JSONB. `non_null` counts exposed non-null
values, rather than physical-column non-null counts. `populated` also excludes
blank strings and empty genre arrays. Numeric zero counts as present. Neither
metric proves validity, correct version matching, calibrated energy, or provider
improvement. Agreement is explicitly `not_assessed`: independent-method evidence
and a validated scoring contract are needed before computing agreement rates.

## Schema and source bindings

The running silver schema has core BPM/key/energy/duration/ISRC/Spotify fields,
`genre TEXT[]`, and JSONB enrichment metadata. Dedicated `camelot_key`, `tidal_id`,
`deezer_id`, `record_label`, `mix_name` and `energy_scale` columns are absent.
Versioned reversible migrations and independent-method evidence remain WP3/WP4
work; this tool does not migrate the schema or infer missing values.

The only running services are PostgreSQL, Redis, REST and graph APIs. Enrichment,
RabbitMQ and TIDAL integration are outside the minimal stack. No provider-named
environment variables are set in the current shell; `/run/secrets` and repository
`secrets/` are absent. The running database has no `api_keys` or enrichment-config
tables. These observations do not establish whether credentials exist in another
environment, a browser credential store, or an external deployment.

Source inspection identifies these bindings; none were validated live:

| Consumer | Binding or wiring |
| --- | --- |
| Enrichment API startup | Database service keys plus `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `DISCOGS_TOKEN`, `LASTFM_API_KEY`, `GETSONGBPM_API_KEY`, `MUSICBRAINZ_USER_AGENT` environment fallbacks |
| Enrichment TIDAL startup/client | `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`; startup retrieves `tidal_keys` but initializes the client from environment variables instead |
| Enrichment worker bootstrap | Separate provider initialization path; must be audited with the API path when shared clients are introduced |
| Common secrets helper | Docker files, repository secret files, then environment; includes TIDAL/Spotify/Last.fm bindings |
| REST API key helper | `api_keys` and `get_api_key` database function; absent from the minimal schema |
| Standalone TIDAL integration | `ENABLE_TIDAL_INTEGRATION`, `TIDAL_SESSION_FILE`, plus `DATABASE_*` names rather than the minimal stack's `DATABASE_URL` |

WP1 should resolve TIDAL credential/client duplication and keep user OAuth scopes
separate from application catalog access. WP2 introduces the shared Deezer client;
no new credential binding is assumed here. WP4 must reconcile the worker/API
configuration paths, database key helper and deployment names. Never infer
working provider contracts merely from a configured variable or stored token.

Next: audit remaining catalog writes against the shared metadata contract, then
continue provider/schema work in dependency order. Before any real backfill,
capture a populated baseline and fixed sample and retain independent run evidence.
