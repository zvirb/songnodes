# Configuration Settings for `ref_mb`

The `ref_mb` database integration is configured via environment variables. This prevents credentials from being hardcoded or accidentally logged.

## Variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `MB_LOCAL_ENABLED` | `false` | Set to `true`, `1`, or `yes` to enable connecting to the local MusicBrainz reference database. |
| `MB_LOCAL_HOST` | `host.docker.internal` | The host of the Postgres server hosting the `ref_mb` database. |
| `MB_LOCAL_PORT` | `55433` | The port for the Postgres server. |
| `MB_LOCAL_DATABASE` | `ref_mb` | The database name. |
| `MB_LOCAL_SCHEMA` | `ref_mb` | The schema name. |
| `MB_LOCAL_USER` | `ref_mb_reader` | The database user, which must only have read privileges. |
| `MB_LOCAL_STATEMENT_TIMEOUT_MS` | `2000` | The statement timeout applied to connections (in milliseconds). |
| `MB_LOCAL_PASSWORD_FILE` | (none) | Path to a file containing the password. (Recommended) |
| `MB_LOCAL_PASSWORD` | (none) | Password to use. |

## Important Security Rules
- Passwords **must never be committed** to the repository.
- Use `MB_LOCAL_PASSWORD_FILE` (mapped as a Docker secret or mounted file) on the host machine to provide the database password.
- Do not log the instantiated `RefMBSettings` object or include the password in debugging output.

## How to enable it

The flag defaults to off. With it off, enrichment uses the MusicBrainz web provider exactly as before (still subject to `ENRICHMENT_PROVIDERS`).

1. Run the read-only mirror as its own Postgres 16 database. From the host it is `127.0.0.1:55433`. From a Compose container it is `host.docker.internal:55433` (the Compose default for `MB_LOCAL_HOST`).
2. Put the `ref_mb_reader` password in the environment or in a file. Do not commit either.
3. Set `MB_LOCAL_ENABLED=true`.
4. The dev stack sets `ENRICHMENT_PROVIDERS=none`, which builds no providers. To use the mirror, set `ENRICHMENT_PROVIDERS` to a list that includes `musicbrainz_local` (and `musicbrainz` if the web fallback should stay), or unset it so every configured provider runs.
5. Restart the worker so it reads the new environment. No songnodes migration loads the mirror.

Example (password from a file, web fallback kept):

```bash
export MB_LOCAL_ENABLED=true
export MB_LOCAL_HOST=127.0.0.1          # use host.docker.internal inside Compose
export MB_LOCAL_PASSWORD_FILE=/path/to/ref_mb_reader_password.txt
export ENRICHMENT_PROVIDERS=musicbrainz_local,musicbrainz
```

`MB_LOCAL_DUMP_ID` is optional. When a match is stored, the dump id is read from `ref_mb.load_manifest` if that table exists (`dump_id`, otherwise `schema_sequence`, otherwise `id`), then from `MB_LOCAL_DUMP_ID`. There is no `dump_meta` table. If neither source is set, the stored dump id is empty.

## Lookup order

When the flag is on, `musicbrainz_local` is registered ahead of the web `musicbrainz` provider:

1. **ISRC.** `isrc.isrc` is `char(12)`. The parameter is cast with `::bpchar` so Postgres can use the index. Hits are collapsed through `recording_gid_redirect` and `canonical_recording_redirect`. Those redirects compare uuid columns to `ANY($1::uuid[])` (`recording_gid_redirect_pkey`, `sn_crr_recording`). Casting the columns to text seq-scans and exceeds the 2 second statement timeout. One canonical recording is accepted. If several remain, accept only when duration within ±5 seconds and artist similarity ≥ 0.85 leave exactly one. Otherwise the hit is review and the resolver does not try a weaker tier.
2. **Canonical exact.** Python builds the ListenBrainz `combined_lookup` key (`unidecode` after stripping non-word characters, which is what maps CJK to Pinyin) and compares it to `canonical_musicbrainz_data.combined_lookup`. That column is indexed by `sn_cmd_lookup`. Highest `score` first. The dump has no year column. There is no second exact tier over `recording` / `artist_credit`: that expression is not what `sn_cmd_lookup` indexes, it seq-scans the recording table, and it disagrees with `combined_lookup` on a noticeable share of rows.
3. **Artist-credit trigram fuzzy.** `sn_ac_trgm` is on `artist_credit (lower(ref_mb.musicbrainz_unaccent(name)))`. The query uses that expression and `SET LOCAL pg_trgm.similarity_threshold = 0.64` inside the transaction. Recordings are then read for that artist credit. Similarity ≥ 0.64 is still **review only**. Fuzzy is never auto-accepted. The `artist` table and `public.unaccent` are not used; that path seq-scans.
4. **GID redirect.** A supplied recording MBID is followed through `recording_gid_redirect` and the canonical redirect, again as uuid arrays. A gid that does not redirect is not treated as a match.

The stored id is the canonical recording MBID. Other candidate MBIDs are kept on the evidence raw payload (accepted matches) or on `enrichment_metadata.review_candidates` (review). Label and release date/year are read from CC0 tables: `release_label`/`label`, `release_country` and `release_unknown_country`. Genre is read by `GENRE_SQL` from `l_genre_release_group` → `genre`. Those two tables exist on the mirror and are empty, so genre comes back empty. Loading them is described in `docs/integration/ref_mb/GENRE_LOAD_PLAN.md`. Tag votes, ratings, the derived first-release table and cover art are not queried.

## Indexes the queries use

Checked against the live mirror (Postgres 16, schema `ref_mb`). CI still mocks the database and does not time these.

| Index | Relation | Used by |
| ----- | -------- | ------- |
| `sn_cmd_lookup` | `canonical_musicbrainz_data (combined_lookup)` | canonical exact |
| `sn_crr_recording` | `canonical_recording_redirect (recording_mbid)` | canonical redirect, uuid comparison |
| `recording_gid_redirect_pkey` | `recording_gid_redirect (gid)` | gid redirect, uuid comparison |
| `sn_ac_trgm` | `artist_credit (lower(ref_mb.musicbrainz_unaccent(name)))` | fuzzy artist, with `similarity_threshold` 0.64 |

## Assumptions

- Lookup SQL is schema-qualified as `ref_mb`, so `MB_LOCAL_SCHEMA` needs to stay `ref_mb`.
- `recording_gid_redirect.new_id` is `recording.id`. `l_genre_release_group.entity0` is genre and `entity1` is the release group.
- `ref_mb.musicbrainz_unaccent` and `pg_trgm` are installed in the mirror. Fuzzy does not call `public.unaccent`.
- The worker image installs `unidecode` so the Python key matches `combined_lookup`. Without it, Latin accents still fold, but a few characters (for example ß) and non-Latin scripts can differ.
- `load_manifest` may be absent. Health and matches then use `MB_LOCAL_DUMP_ID`, or no dump id.
