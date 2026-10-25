# Open questions and decisions needed

Each question has a recommendation. Evidence is in `mb_database_report.md`.

1. **Are non-commercial (CC BY-NC-SA) fields acceptable?**
   - Tags, genres-by-tag votes, ratings and `release_group_meta.first_release_date` come only from `mbdump-derived.tar.bz2` (NC).
   - If songnodes is or may become commercial: skip Set D and compute the earliest date from CC0 `release_country`/`release_unknown_country` (queries.sql F4c).
   - Recommendation: load the NC tables only into a separate schema (`ref_mb_nc`), or not at all, until this is decided.

2. **Which table set should be loaded?**
   - Set A (6.5 GB TSV) + canonical is enough for ISRC/exact/fuzzy matching and the preferred MBID.
   - Set B (+10.6 GB TSV, PG size not measured) adds earliest date, label, catno and barcode.
   - Recommendation: A + canonical now; B when enrichment needs it.

3. **Where should `ref_mb` live?**
   - (a) A separate container next to songnodes (isolated; easy to drop and reload).
   - (b) A separate database in the songnodes PG16 server.
   - (c) A schema inside the songnodes DB, which is not recommended (backup size, migration interference).
   - Recommendation: (a). It needs about 30 GB on the Docker disk; C: currently has 65.6 GB free.

4. **Use the canonical dump?** It is CC0, adds 2 ms exact `combined_lookup` matching and a "preferred recording" across duplicates. It costs about 11 GB. It is one week older than mbdump (17/10 vs 24/10). Recommendation: yes.

5. **How should songnodes store the MBID?**
   - `musicbrainz_id VARCHAR(100) UNIQUE` (scrapers migration 001) conflicts with legitimate many-tracks-to-one-recording mappings and with MusicBrainz merges.
   - Recommendation: store the canonical/preferred recording MBID, resolve redirects at lookup, and reconsider the UNIQUE constraint.
   - This needs a songnodes code change, which is out of scope here.

6. **How should ambiguous ISRCs be handled?** 145,495 ISRCs map to 2+ recordings. Proposal: accept an ISRC hit only if unique, or if duration ±5 s and artist similarity ≥ 0.4 single one out; otherwise fall through to exact/fuzzy.

7. **What refresh cadence?** Dumps are published about twice weekly. Options: monthly reload (about 30 min, swap schemas) vs live replication via musicbrainz-docker (heavy). Recommendation: monthly or on-demand reload.

8. **Download the missing files?**
   - JSON `release.tar.xz` is only needed if you want JSON recordings inside releases. Not needed if PG is used.
   - PG `cdstubs`, `edit`, `editor`, `stats`, `wikidocs`, `documentation` and `event-art-archive` are not needed for matching.
   - Recommendation: no.

9. **What to do with scratch and the container?**
   - `metabrainz_scratch` is 46.4 GB on E: (extract 35.6 GB, sqlite 6.9 GB, slice 3.9 GB).
   - The throwaway container `mbref-scratch-pg` and its volume use 32.0 GB on C:.
   - Nothing has been deleted.
   - Recommendation: keep until the load approach is approved. Then delete the container and volume, `extract`, and `sqlite`, and keep `slice`, `sql`, `schema_ref_mb`, `logs` and `inventory` (about 4 GB) for reproducibility. Commands are in report section J.

10. **Measure matching quality on real songnodes tracks?** Precision/recall was not measured, because no songnodes data was read. Next step if approved: export a sample of (artist, title, isrc, duration_ms) from songnodes read-only and run queries.sql F1-F3 against `ref_mb`.

11. **Should fuzzy matching be tuned?** The planner picks a seq scan on artist_credit for trigram queries (4.4-4.8 s vs 0.4-0.8 s with the GIN). queries.sql forces the index path with `SET LOCAL enable_seqscan=off`. An alternative is `random_page_cost=1.1` on SSD, which was not tested.
