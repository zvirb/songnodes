# Plan: load CC0 genre tables into the ref_mb mirror

Plan only. Songnodes does not load this data. There is no loader in this change. `GENRE_SQL` stays as it is.

The live mirror already has `ref_mb.genre` and `ref_mb.l_genre_release_group`, and both are empty, so genre on a match is empty. Filling them is a one-off load on the owner's laptop, against the separate ref-mb Postgres 16 container. It must not connect to the songnodes database.

## What this load will and will not do

`l_genre_release_group` is the advanced-relationship table (genre linked to a release group through `link` / `link_type`). It is not the table of genres people have tagged onto releases. MetaBrainz describes it that way: the link is for relationships such as "genre is named after release group", and the tags people apply live in `release_group_tag` ([forum thread](https://community.metabrainz.org/t/confused-about-tags-vs-genres-in-the-database/813680)).

The public relationship statistics, read 16 Nov 2026, list 25 genre–release group relationships, all of type "is named after release group" ([MusicBrainz relationship statistics](https://musicbrainz.org/statistics/relationships)). The same day's overview lists 2,222 genres ([MusicBrainz statistics](https://musicbrainz.org/statistics), last updated 2026-11-16). After a CC0 load, `GENRE_SQL` can return a name only for those few relationships. It will not reproduce the genre tags in the derived dump.

Those tag tables (`tag`, `release_group_tag`, `recording_tag`) are supplementary data. The download documentation says the derived dump is what you need if you want genre data, because that association is done via user tags ([MusicBrainz Database / Download](https://musicbrainz.org/doc/MusicBrainz_Database/Download)). Supplementary data is CC BY-NC-SA 3.0, not CC0 ([About / Data License](https://musicbrainz.org/doc/About/Data_License)). This plan does not load `mbdump-derived`, cover art, ratings, or tags. The mirror stays CC0-only.

## Why these files are CC0 core

The core database dump `mbdump.tar.bz2` is distributed under CC0 ([Download](https://musicbrainz.org/doc/MusicBrainz_Database/Download), Public Domain section). Genres are listed as core data under that same CC0 dedication ([MusicBrainz Database](https://musicbrainz.org/doc/MusicBrainz_Database)).

The replication table list puts all of the following in `mbdump.tar.bz2`, not in the derived archive ([Replication](https://musicbrainz.org/doc/Replication), schema sequence 30 as of 2 December 2025 UTC):

- `genre`
- `genre_alias`
- `genre_alias_type`
- `l_genre_release_group`
- `link`
- `link_type`

`genre_alias` is in that core list, so it is CC0 and is in scope. `genre_alias_type` is the small lookup `genre_alias.type` points at, and it is in the same core archive.

The dump already inventoried for this project agrees. `docs/integration/ref_mb/schema_inventory.csv` records these members of `postgres/20261024-102842/mbdump.tar.bz2`:

| File inside the archive | Bytes | Rows | Columns |
| ----------------------- | ----: | ---: | ------- |
| `mbdump/genre` | 191,655 | 2,216 | `id gid name comment edits_pending last_updated` |
| `mbdump/genre_alias` | 88,963 | 962 | `id genre name locale edits_pending last_updated type sort_name begin_date_year begin_date_month begin_date_day end_date_year end_date_month end_date_day primary_for_locale ended` |
| `mbdump/genre_alias_type` | 117 | 2 | `id name parent child_order description gid` |
| `mbdump/l_genre_release_group` | 645 | 11 | `id link entity0 entity1 edits_pending last_updated link_order entity0_credit entity1_credit` |
| `mbdump/link_type` | 209,013 | 697 | `id parent child_order gid entity_type0 entity_type1 name description link_phrase reverse_link_phrase long_link_phrase last_updated is_deprecated has_dates entity0_cardinality entity1_cardinality` |
| `mbdump/link` | 74,980,330 | 1,156,622 | `id link_type begin_date_year begin_date_month begin_date_day end_date_year end_date_month end_date_day attribute_count created ended` |

Those byte and row counts are the 24 Oct 2026 dump, not a forecast. A newer `mbdump.tar.bz2` will differ by a small amount for genre and by a lot for the full `link` file. The public genre count on 16 Nov 2026 was 2,222.

Do not load the whole `link` file for this task. `GENRE_SQL` does not join `link`. The only reason to touch `link` is a foreign key from `l_genre_release_group.link`. That is 11 rows in the inventoried dump, not 1.16 million. `link_type` is 209 KB. Load the whole `link_type` file only when the mirror does not already have those rows.

## Where the load runs

- Data stays on the laptop under `E:\`. Use the existing `mbdump.tar.bz2` tree or a newer core dump stored there. Do not copy the dump into this repository, and do not put it on the songnodes Postgres volume.
- Connect to the ref-mb container only: host `127.0.0.1`, port `55433`, database `ref_mb`, schema `ref_mb`. Use a role that can write. Leave `ref_mb_reader` read-only.
- Do not use the songnodes Compose database, its password, or `sql/migrations`. Migration 100 is a no-op on purpose.
- The tables already exist and are empty. Copy into them. Do not recreate them from `services/common/refmb/ddl/create_tables.sql` (that file is a test stand-in and uses text columns). If a column type does not match the dump, stop.

## Load order

Foreign keys, when present, require this order. Skip a step when the target table is already populated.

1. `genre_alias_type` from `mbdump/genre_alias_type`.
2. `genre` from `mbdump/genre`.
3. `genre_alias` from `mbdump/genre_alias`.
4. `link_type` from `mbdump/link_type`, only for ids that are missing.
5. `link` rows whose `id` appears in `mbdump/l_genre_release_group` (the `link` column). Do not `COPY` the full `mbdump/link` file.
6. `l_genre_release_group` from `mbdump/l_genre_release_group`.

`release_group` is already loaded. `entity1` points at it. Do not reload releases or recordings.

The dump members are PostgreSQL `COPY` text (tab-separated, `\N` for null). Load each small file with an explicit column list in the order in the table above, connected to database `ref_mb`.

For the filtered `link` rows, read the `link` column out of `mbdump/l_genre_release_group` first (second column) and copy only matching lines from `mbdump/link`. If `l_genre_release_group.link` has no foreign key on this mirror, skip steps 4 and 5. `GENRE_SQL` does not read them.

## Indexes `GENRE_SQL` needs

`GENRE_SQL` joins `track.recording` to the release, then `l_genre_release_group.entity1` to `release.release_group`, then `genre.id` to `entity0`.

After the load, the mirror should have:

- the primary key on `ref_mb.genre (id)`
- an index on `ref_mb.l_genre_release_group (entity1)`, the stock name `l_genre_release_group_idx_entity1`

`track.recording` is already indexed by the core load. Create an index only if `\d ref_mb.l_genre_release_group` shows none on `entity1`. Do not add an expression index, and do not create any of these in the songnodes database.

## Verification

Run this on database `ref_mb` only:

```sql
SELECT
  (SELECT COUNT(*) FROM ref_mb.genre) AS genres,
  (SELECT COUNT(*) FROM ref_mb.genre_alias) AS genre_aliases,
  (SELECT COUNT(*) FROM ref_mb.l_genre_release_group) AS genre_release_group_links;
```

For the 24 Oct 2026 dump those counts are 2216, 962 and 11. A newer core dump should be close to the public genre count (2,222 on 16 Nov 2026) and to a few dozen genre–release group links, not to millions of rows.

```sql
SELECT lt.name, COUNT(*)
FROM ref_mb.l_genre_release_group lg
JOIN ref_mb.link l ON l.id = lg.link
JOIN ref_mb.link_type lt ON lt.id = l.link_type
GROUP BY lt.name
ORDER BY COUNT(*) DESC;
```

The names should be relationship phrases such as "is named after release group". A result that looks like a catalogue of musical genres means the wrong file was loaded. Stop and roll back.

`GENRE_SQL` itself stays sparse on purpose. A recording that is not on one of those few release groups still returns no genre.

## Rollback

On database `ref_mb` only, remove the rows this load added:

```sql
TRUNCATE TABLE
  ref_mb.l_genre_release_group,
  ref_mb.genre_alias,
  ref_mb.genre,
  ref_mb.genre_alias_type;
```

If step 5 inserted specific `link` rows into a table that already held data, delete those ids rather than truncating `ref_mb.link` or `ref_mb.link_type`. Do not drop the schema. Do not run this against the songnodes database. The dump files on `E:\` stay where they are.
