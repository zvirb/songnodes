# MusicBrainz in songnodes: recommendations

Written 25 Oct 2026 (Australia/Sydney, UTC+11). This is a read-only review of `E:\songnodes` at commit 5f17b50 (2026-10-25 16:55 +11:00). No songnodes files were modified, its database was not connected to, and none of its code or migrations were run. The track counts below come from files only. All line references are to files under `E:\songnodes` unless marked `musicLibrary:`.

## 1. What songnodes is (evidence)

| Question | Finding | Evidence |
|---|---|---|
| Purpose | A DJ music graph and analysis tool. It scrapes tracklists (1001tracklists, MixesDB, Setlist.fm and others) into bronze/silver layers. A personal DJ library sits on top, with crates and a buy list. | README.md:1; CLAUDE.md:15-16; sql/migrations/101_library_schema_up.sql:127-131 (`v_buy_list`) |
| Personal or commercial | Personal, non-commercial in practice. There are no pricing, billing or tenant hints anywhere. The README says MIT, but **there is no LICENSE file** in the repo. The musicLibrary plan says to "stay non-commercial". | README.md:404-406; repo root listing; musicLibrary:plan/research/licensing.md:9,18 |
| Deployed or hosted | Runs locally only, as plain Docker Compose on the Windows host. Kubernetes and Helm are present but unused. Every port binds to 127.0.0.1. | CLAUDE.md:81-84, 283, 358; compose.dev.yaml:41,62,134,149; STATUS.md:239-259 |
| Postgres | `postgres:16-alpine` with one named volume `dev-postgres`. No host port is exposed, auth is `trust`, and there are **no memory or CPU limits and no tuning** (default shared_buffers). The schema is built by initdb scripts that only run on an empty volume (medallion 001/002/006, 012, 013, 014). Migrations 100/101 are **not mounted**, so they are not applied yet. | compose.dev.yaml:4-23 |
| Other services | redis, graph-api, rest-api, rabbitmq, Celery worker, unified-scraper, frontend. The worker builds the enrichment providers. By default `ENRICHMENT_PROVIDERS=none`, which means no outbound calls. | compose.dev.yaml:25-157, 100; services/worker/celery_app.py:21,71 |
| Backups | `backup_volumes.sh` tars **whole named volumes**. A `ref_mb` stored inside `dev-postgres` would add about 20-30 GB to every backup. | backup_volumes.sh:36-47 |
| Stale artefacts | `songnodes.service` starts `docker-compose.yml` + `docker-compose.production.yml`, and neither file exists. Treat it as dead. | songnodes.service:12-14 |
| Size of the library | Tiny. There are 319 library tracks (777 items including pending/rejected), all 319 with ISRC. STATUS mentions 294, and `load_283_tracks.sql` is an older seed. Baseline coverage: label 2.2%, release year 2.2%, genre 73.7%, BPM/key 0%. | musicLibrary:plan/INTEGRATION_PLAN.md:11,16,77; STATUS.md:294 |
| Refresh hints | The musicLibrary pipeline runs weekly (Sunday 7:37). MusicBrainz acquire/ETL is planned as "monthly/as needed". The Celery beat only drains jobs and handles recurring scrapes; there is no MusicBrainz schedule. The GitHub cron jobs are security scans only. | INTEGRATION_PLAN.md:26-27; celery_app.py:47-50; .github/workflows/codeql.yml:20, trivy.yml:15 |

## 2. How songnodes uses MusicBrainz today

- **Live path:** `services/common/providers/musicbrainz.py`, a WS/2 client registered third in the provider order (after tidal and deezer) in registry.py:19,50-51.
  - Requests are limited to 1.1 s apart, and a User-Agent is built from `MUSICBRAINZ_CONTACT` (musicbrainz.py:37-39).
  - Lookup is ISRC search first, then `recording:"…" AND artist:"…"` (musicbrainz.py:64-70).
  - It stores **only three fields**: `musicbrainz_id`, `isrc` (the first one) and `duration_ms` (musicbrainz.py:47-51). It does not fetch tags, genres, ratings, release dates, labels or cover art.
- **Matching rules** (services/common/metadata/matching.py):
  - An ISRC that is equal on both sides gives a match at 1.0, but it goes to review if durations differ by more than 10 s (lines 13, 109-112).
  - Fuzzy matching requires title ≥ 0.92 and artist ≥ 0.85 using SequenceMatcher, plus a version-mismatch reject and a ±10 s duration guard. When a duration is unknown the result is review (lines 13-15, 117-129).
  - A unique-exact bypass applies at 0.97/0.92 (line 132).
- **Storage:**
  - `silver_enriched_tracks` has `isrc TEXT`, `release_date DATE`, `duration_ms INTEGER` and `genre TEXT[]` (sql/migrations/medallion/002_silver_layer_up.sql:25-32), with a partial index on isrc (line 67).
  - Migration 014 adds `musicbrainz_id TEXT` and `record_label TEXT` **without UNIQUE** (014_data_layer_up.sql:9,15).
  - Per-field provenance goes in `silver_track_metadata_evidence`, whose field CHECK includes isrc, duration_ms, genre, record_label and musicbrainz_id (014:75-90).
  - Raw API responses go in `bronze_api_enrichments` (medallion/001:134-142).
- **Legacy, not in the Compose stack:**
  - `services/metadata-enrichment/musicbrainz_client.py`, a "Label Hunter" that reads `label-info` and release dates (lines 100-217).
  - `scrapers/spiders/musicbrainz_spider.py`, with `inc=artist-credits+releases+isrcs`, release date and label (lines 209, 273, 311-329).
  - `common/api_gateway/musicbrainz_client.py`.
  - None of these services appears in compose.dev.yaml. They are a useful signal that **label and release date are the fields the project has always wanted from MusicBrainz**.
- **No pg_trgm in the live DB:** the medallion/014 init scripts do not create it. The silver search index uses `to_tsvector` (002:76-77). pg_trgm appears only in the legacy `scrapers/sql/migrations/001_add_mbid_and_camelot.sql:184`.
- **Plan in progress (not merged into running code):**
  - `sql/migrations/100_ref_mb_schema_up.sql` and `101_library_schema_up.sql` exist (added 25 Oct).
  - contracts/ids.md:13 makes ISRC/MBID attributes and match keys, never PKs.
  - INTEGRATION_PLAN D2 puts `ref_mb` as a schema inside the songnodes DB, plus a small SQLite lookup for the stdlib weekly pipeline.

## 3. Problems found in songnodes migration 100 (must be fixed before WP2 loads)

These were checked against the official `CreateTables.sql` at tag v-2026-09-21.0 (my `schema_inventory.csv`) and the real dump files. Each mismatch would make COPY of the real files fail or misalign:

| Table (migration 100 lines) | Problem |
|---|---|
| `artist_credit` (50-56) | Missing `edits_pending` and `gid`. The official table has 7 columns. |
| `isrc` (97-104) | Has an extra `source` column. The official columns are id, recording, isrc, edits_pending, created. |
| `medium` (121-130) | Missing `gid`. |
| `link_type` (209-227) | Has an extra `priority` column. |
| `canonical_musicbrainz_data` (370-382) | `id uuid` plus a `year` column, 11 columns in all. The real file is **CSV with a header**, has 10 columns, an integer `id`, and no `year`. |
| `genre` (361; header 319; comment 424) | Labelled CC-BY-NC-SA. The `genre` table ships in **CC0 `mbdump`**. Only the tag *votes* (`*_tag`, `tag`) are NC. |
| Missing tables | `release_country`, `release_unknown_country`, `country_area`, `iso_3166_1` and `area`, which are needed for a CC0 earliest-release date. `release_group_meta` is NC and should stay out of the CC0 schema. |

Fix: generate the `ref_mb` DDL from the official CreateTables.sql at the dump's schema tag (column order verbatim, no PKs or indexes in the migration), and keep indexes in loader commands, as INTEGRATION_PLAN.md:52 already says. `docs/mb/load_runbook.md` already does this.

**Erratum in my own report:** `mb_database_report.md` section D calls the canonical files TSV. They are CSV with a header row: `canonical/canonical_musicbrainz_data.csv` with 10 columns (id, artist_credit_id, artist_mbids, artist_credit_name, release_mbid, release_name, recording_mbid, recording_name, combined_lookup, score). Load them with `COPY … (FORMAT csv, HEADER true)`.

## 4. Recommendations, one per open question

1. **CC0 vs non-commercial: load CC0 only now.**
   - songnodes is personal and runs on localhost, so NC terms would currently be satisfied (licensing.md:9 says "Non-commercial includes personal use").
   - However, the repo claims MIT (README.md:404-406), is pushed to GitHub, and NC terms do not mix with MIT redistribution.
   - The live provider uses none of the NC fields (musicbrainz.py:47-51).
   - Genre coverage is already 73.7% from other providers (INTEGRATION_PLAN.md:16). The gaps are label and year, and both are CC0.
   - Decision: load `mbdump` + canonical only. If tag votes are wanted later, put them in a separate droppable `ref_mb_nc` schema, never written into silver without `licence` evidence.
   - Also add the LICENSE file the README promises, and the MusicBrainz credit (plan D8).

2. **Table set: core + canonical + release context (Set A + the label/date part of Set B).**
   - The stated goal is to lift label (2.2%) and release year (2.2%) (INTEGRATION_PLAN.md:16; decisions/2026-10-25 "Why"). Legacy code hunted for exactly these fields (metadata-enrichment/musicbrainz_client.py:192-217).
   - Core + canonical alone cannot provide them.
   - Load: recording, artist, artist_credit(+_name), artist_alias, recording_alias, isrc, track, medium, release, release_group, release_label, label, release_country, release_unknown_country, country_area, iso_3166_1, area, plus the *_gid_redirect tables and canonical.
   - Skip: url/l_* links, works, and all NC tables.

3. **Where ref_mb lives: a separate Postgres container, not a schema in `dev-postgres`.** This deliberately diverges from plan D2.
   - Size: about 24-30 GB loaded (measured bench DB 23.77 GB) against a songnodes DB that holds hundreds of library tracks.
   - Backups: `backup_volumes.sh` tars whole volumes (36-47), so every backup would grow by about 25 GB.
   - Rebuilds: the songnodes Postgres is built by initdb scripts on an empty volume (compose.dev.yaml:11-18). A "redeploy from main" that recreates `dev-postgres` would force a 30-minute reload.
   - Tuning: songnodes Postgres has no limits or tuning (compose.dev.yaml:4-23). `ref_mb` wants its own settings: 6 GB was enough, and it needs `pg_trgm`, `random_page_cost`, and an index build `maintenance_work_mem`. Changing these globally would affect the app.
   - Lifecycle: reload by schema swap or a container replace without touching app data. Dropping the volume is the clean rollback that plan line 94 asks for.
   - Wiring: add a `ref-mb` service under a Compose profile (e.g. `profiles: [mb]`), image `postgres:16-alpine`, its own volume, internal network only, `MB_REF_DSN` passed to the worker, and feature flag `MB_LOCAL_ENABLED`. The provider only does keyed lookups from Python, so it never needs cross-schema SQL joins with silver.
   - Fallback: if one Postgres is mandatory, use a separate **database** (`mbref`) in the same server and exclude it from backups. Do not use a schema in `songnodes`.

4. **Canonical dump: yes.** It is CC0, gives 1.9-2.5 ms exact `combined_lookup` matching, and picks the preferred recording among duplicates. Load it as CSV (see §3). The week of lag behind mbdump does not matter for this library.

5. **The `musicbrainz_id UNIQUE` problem: smaller than first reported. Close it formally.**
   - The UNIQUE constraint is only in the **legacy** `scrapers/sql/migrations/001_add_mbid_and_camelot.sql:16,24` on `artists`/`songs` tables. These are not part of the Compose init set.
   - The live column `silver_enriched_tracks.musicbrainz_id` is plain `TEXT` with no UNIQUE (014:15), which matches contracts/ids.md:13.
   - Recommendations:
     - Keep it non-unique.
     - Store the **canonical recording MBID** (after resolving `recording_gid_redirect` and `canonical_recording_redirect`), with every candidate MBID recorded as `silver_track_metadata_evidence` rows (014:75-90).
     - Use `library.track_xref` only for external-ID cross-walks.
     - Mark the legacy 001 file as superseded so nobody applies it.

6. **Ambiguous ISRC (145,495 ISRCs map to 2+ recordings): accept only a uniquely identified recording, then canonicalise.**
   - Unique ISRC → match at confidence 1.0.
   - Multiple recordings → first collapse them via canonical redirect (they are often the same song). If more than one still remains, accept the one whose duration is within ±5 s and whose artist similarity ≥ 0.85 (reuse ARTIST_THRESHOLD, matching.py:15) singles it out. Otherwise send it to review, not to the next tier.
   - This keeps matching.py's existing rule that ISRC-equal plus duration beyond the guard goes to review (matching.py:110-111).
   - Never write a second-tier ISRC guess over an existing silver ISRC.

7. **Refresh cadence: monthly, plus on demand. No replication.**
   - The weekly Sunday 7:37 musicLibrary run consumes the local lookup but does not reload it.
   - A reload takes about 30 minutes: COPY 397 s plus core indexes, skipping the title-trigram GIN.
   - Do it into a new schema `ref_mb_YYYYMMDD`, then an atomic `ALTER SCHEMA … RENAME` swap. Record the dump id in `dump_meta` (migration 100:396-402).
   - The library grows by tens of tracks a week (INTEGRATION_PLAN.md:77), so newer MusicBrainz data rarely changes outcomes. For a brand-new release missing from the dump, the live WS provider stays as a fallback.

8. **Missing downloads: none needed.** The JSON release dump, cdstubs, edit/editor/stats and event-art are not used. Cover-art (NC) is excluded by decision 1.

9. **Scratch and container cleanup: keep until phase 2 validates, then move.**
   - Keep `mbref-scratch-pg` running until the resolver evaluation (phase 2) is done. It is the only place where full-scale indexes exist.
   - Then remove the container and its 32 GB volume on C:.
   - For `extract` (35.6 GB) and `sqlite` (6.9 GB): the musicLibrary rule is "never delete, move to `_to_delete/`" (INTEGRATION_PLAN.md:93). Move them to `E:\musicLibrary\_to_delete\metabrainz_scratch_<date>\` and empty that folder once you have confirmed.
   - Keep `slice`, `sql`, `schema_ref_mb`, `logs`, `inventory` and `PROGRESS.md` (about 4 GB).

10. **Measuring match accuracy: use the plan's P3 gate, on real data, against the scratch container.**
    - Export (artist, title, isrc, duration_ms) for the 319 library tracks and the 777 replay items from **files** (`inbox/resolved_2026-10-24.json`, INTEGRATION_PLAN.md:75), not from the DB.
    - Hide the ISRC for a held-out half and resolve by canonical exact match, then fuzzy.
    - Pass criteria: precision ≥ 0.98, p95 < 50 ms, and no radio edit matched to an extended mix (INTEGRATION_PLAN.md:73).
    - Expected risk: ISRC and canonical-exact lookups meet the latency target (6.9 ms / 2 ms). Artist-first fuzzy (0.39-0.76 s) does **not**. Either exempt the fuzzy tier from p95 or limit fuzzy to the weekly batch.
    - Caveat: all 319 library tracks carry an ISRC, so ISRC-hidden ground truth flatters fuzzy recall a little. Report recall separately for the pending/rejected items.

11. **Fuzzy tuning:**
    - Keep the artist-first trigram path with `SET LOCAL enable_seqscan=off` (queries.sql F3).
    - Test `random_page_cost=1.1` in the dedicated container. This is safe there precisely because of decision 3.
    - Do not build the title-only trigram GIN: 418 s to build and 8-31 s per query.
