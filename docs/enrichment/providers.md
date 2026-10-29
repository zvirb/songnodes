# Metadata Enrichment Providers

This document specifies the execution order and configuration for metadata enrichment providers in SongNodes.

## Provider Execution Order

Metadata enrichment calls providers in priority order. The local MusicBrainz provider (`musicbrainz_local`) is registered ahead of the web MusicBrainz provider (`musicbrainz`) to prioritize fast, offline database lookups before making outbound web API requests.

1. `tidal`
2. `deezer`
3. `musicbrainz_local`
4. `musicbrainz`
5. `discogs`
6. `lastfm`
7. `getsongbpm`

## Local MusicBrainz Provider (`musicbrainz_local`)

The local MusicBrainz provider queries a local mirrored reference database (`ref_mb`) using the MusicBrainz resolver.

### Required Environment Variable

To enable and configure the local MusicBrainz provider:

- `REFMB_DATABASE_URL`: PostgreSQL connection URL for the `ref_mb` database (e.g. `postgresql://ref_mb_reader:password@localhost:55433/ref_mb`).
- Alternatively, set `MB_LOCAL_ENABLED=true` alongside standard local database environment variables (`MB_LOCAL_HOST`, `MB_LOCAL_PORT`, `MB_LOCAL_DATABASE`, `MB_LOCAL_USER`, `MB_LOCAL_PASSWORD`).

### Graceful Skip Behavior

When `REFMB_DATABASE_URL` is unset or the database is unreachable, `musicbrainz_local` gracefully skips by returning `None` immediately. No exceptions are raised and no outbound network calls are attempted.
