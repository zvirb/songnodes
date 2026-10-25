# Research brief: partial MusicBrainz import (agent-gathered 25 Oct 2026)
Items under "Not verified" must be checked by the agent doing the work (`tar tjf` etc.).

**Verified**
- Dumps ship `SHA256SUMS` + `.asc`; tarballs include `SCHEMA_SEQUENCE`, `TIMESTAMP`, `REPLICATION_SEQUENCE`. The official `MBImport.pl` aborts on a schema-sequence mismatch and loads Postgres COPY text format (tab-delimited, `\N` = NULL, backslash escapes `\t \n \r \\ \b \f \v`, optional `\.` end line; column order = `admin/sql/CreateTables.sql`).
- Table → archive (musicbrainz-server `lib/MusicBrainz/Server/Constants.pm`): **core `mbdump`**: artist, artist_alias, artist_credit, artist_credit_name, recording, recording_alias, isrc, track, medium, release, release_label, release_country, label, label_alias, release_group, url, link, link_type, link_attribute*, every `l_*_url`, genre, `*_gid_redirect`. **`mbdump-derived`**: tag, artist_tag, recording_tag, release_tag, release_group_tag, label_tag, tag_relation, `*_meta`, annotations. Tags live only in derived → genres-from-tags need both archives.
- Example column orders: `isrc(id, recording, isrc CHAR(12), edits_pending, created)`; `artist_credit_name(artist_credit, position, artist, name, join_phrase)`; `l_artist_url(id, link, entity0, entity1, edits_pending, last_updated, link_order, entity0_credit, entity1_credit)`.
- Scale (musicbrainz.org/statistics, 25 Oct 2026): artists 3.02M, recordings 40.7M, tracks 58.6M, releases 5.88M, release groups 4.60M, labels 354k, URLs 22.6M, ISRCs 6.54M.
- Canonical files (CC0): `canonical_musicbrainz_data.csv`, `canonical_recording_redirect.csv`, `canonical_release_redirect.csv` (release_mbid, canonical_release_mbid, release_group_mbid); reference code github.com/metabrainz/canonical-data-example (~23M rows, Typesense). Canonical MBIDs change after merges; keep `gid_redirect`. The current download is a single ~2 GB `.tar.zst`.
- `mbslave` and `mbdata` exist but document no table filtering. **Nothing verified for a partial-import tool** (an earlier mention of "musicbrainz-light keep_only" could not be confirmed — treat it as unproven).

**Recommended ETL (agent's design)**
- Stream each archive once with `tarfile.open(path, "r|bz2")`, whitelist members, and COPY straight into bare constraint-free tables (`copy_expert`). bz2 is single-threaded and sequential: expect tens of minutes for 7 GB; consider `lbzip2 -dc | python`.
- Load first, index after: gid, recording(artist_credit), isrc(isrc), track(recording), url link columns, trigram/lower(name).
- Filter `track`/`recording` (the biggest) by joining against ISRC and canonical rows.
- Look up URL `link_type` ids in the table (Beatport, Discogs, Wikidata, Spotify); never hard-code them.
- Store SCHEMA_SEQUENCE + TIMESTAMP with the data and refuse to load on a schema-sequence change.

**Not verified:** in-archive paths (`mbdump/<table>`?) and whether files have a header; full column lists for track, medium, release, release_label, link, url, recording and tag tables; the current SCHEMA_SEQUENCE; per-table row counts and sizes; canonical archive's internal file names and format; trigram/FTS performance numbers.
