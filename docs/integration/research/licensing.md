# Research brief: MetaBrainz licensing (agent-gathered 25 Oct 2026; not legal advice)
Re-read the live pages once before publishing anything. Unverified items are listed at the end.

**Verified (musicbrainz.org/doc/MusicBrainz_Database, /About/Data_License, /MusicBrainz_Database/Download; metabrainz.org/datasets)**
- CC0 core: artists, releases, recordings, labels, works (names, aliases, types, dates, MBIDs), genre entries, identifiers (ISRC, barcodes, ISNI, IPI), relationships, URLs, CD stubs.
- CC BY-NC-SA 3.0 supplementary: annotations, **tags (including genre associations)**, ratings, edit history, statistics, search indexes, non-personal editor data, live-feed replication packets.
- Dump files: `mbdump` and `mbdump-cdstubs` = CC0. `mbdump-derived`, `mbdump-edit`, `mbdump-editor`, `mbdump-stats`, `mbdump-cover-art-archive`, `mbdump-event-art-archive` = CC BY-NC-SA 3.0. `mbdump-documentation`/`wikidocs`: no licence stated.
- JSON dumps are listed as CC0 with no split (tag/rating content unchecked). Canonical data dump is CC0.
- Personal use is free; "Non-commercial includes personal use". No formal definition of commercial found.
- Web API: average 1 request/second per IP, otherwise HTTP 503; descriptive `User-Agent: App/1.0 ( contact )` required; do not poll or run at fixed times. Cover Art Archive: no licence terms for images stated; do not redistribute images.

**Unverified:** exact attribution wording; whether a local DB is a ShareAlike "derivative"; website bulk-download rules; live-feed token terms; cover-art image rights.

**Checklist for this project**
1. Prefer CC0 inputs (`mbdump`, canonical, JSON). Keep tag/genre-from-tag data in separate columns/tables with `licence='CC-BY-NC-SA-3.0'`.
2. Never commit dumps or derived DBs; commit code, schema, scripts and manifests only.
3. Credit "MusicBrainz (musicbrainz.org)" in README and UI; state that supplementary data is CC BY-NC-SA 3.0.
4. Stay non-commercial.
5. Any remaining web calls to MusicBrainz: ≤ 1/s, proper User-Agent, no fixed-time polling.
6. No cover-art redistribution until terms checked.
