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

`MB_LOCAL_DUMP_ID` is optional and is stored with each match. Leave it unset if the dump id is not known.

## Lookup order

When the flag is on, `musicbrainz_local` is registered ahead of the web `musicbrainz` provider:

1. **ISRC.** `isrc.isrc` is `char(12)`. The parameter is cast with `::bpchar` so Postgres can use the index. Hits are collapsed through `recording_gid_redirect` and `canonical_recording_redirect`. One canonical recording is accepted. If several remain, accept only when duration within ±5 seconds and artist similarity ≥ 0.85 leave exactly one. Otherwise the hit is review and the resolver does not try a weaker tier.
2. **Exact normalised artist and title.** The key is ListenBrainz `combined_lookup` (punctuation stripped, lowercased, transliterated). The SQL predicate is the expression assumed for the custom index `sn_cmd_lookup`.
3. **Canonical exact.** `canonical_musicbrainz_data.combined_lookup`, highest `score` first. The dump has no year column.
4. **Artist-first trigram fuzzy.** `pg_trgm` on `lower(unaccent(artist.name))` with `enable_seqscan` off for that statement, then recordings for that artist credit. Similarity ≥ 0.64 is still **review only**. Fuzzy is never auto-accepted.
5. **GID redirect.** A supplied recording MBID is followed through `recording_gid_redirect` and the canonical redirect. A gid that does not redirect is not treated as a match.

The stored id is the canonical recording MBID. Other candidate MBIDs are kept on the evidence raw payload (accepted matches) or on `enrichment_metadata.review_candidates` (review). Label, release date/year and genre are read from CC0 tables: `release_label`/`label`, `release_country` and `release_unknown_country`, and `l_genre_release_group` → `genre`. Tag votes, ratings, the derived first-release table and cover art are not queried.

## Assumptions (not re-measured in CI)

CI mocks the database. These names were not found as `CREATE INDEX` statements in the repository, so the queries assume the stock MusicBrainz schema plus the following:

- Lookup SQL is schema-qualified as `ref_mb`, so `MB_LOCAL_SCHEMA` needs to stay `ref_mb`.
- Index `sn_cmd_lookup` matches `lower(regexp_replace(public.unaccent(artist_credit.name || recording.name), '[^\w]+', '', 'g'))`.
- `canonical_recording_redirect` columns are `recording_mbid`, `canonical_recording_mbid` (uuid text). Higher `score` on `canonical_musicbrainz_data` is the preferred row.
- `recording_gid_redirect.new_id` is `recording.id`. `l_genre_release_group.entity0` is genre and `entity1` is the release group. If that link table was not loaded, genre is left empty.
- `unaccent` and `pg_trgm` are installed and visible from `public`.
- The worker image installs `unidecode` so the Python key matches `combined_lookup`. Without it, Latin accents still fold, but a few characters (for example ß) can differ.

What this change could not verify without the live mirror: that `sn_cmd_lookup` uses that exact expression, that the trigram indexes are the artist-first ones, index-only ISRC timing, and the measured precision figures.
