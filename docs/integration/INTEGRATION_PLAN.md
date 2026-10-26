# Integration plan: MetaBrainz reference data + musicLibrary into songnodes

> **Superseded for Wave Execution (26 Oct 2026):** All unmerged work packages from this document have been decomposed into atomic, single-job packages in [`plan/RESTRUCTURE.md`](../../plan/RESTRUCTURE.md) (`C1`, `E1`–`E3`, `L1`–`L5`, `R3`, `P1`–`P3`, etc.) and are launched via `plan/launch_jules.py`. Retain this document as the domain and contract reference (`D1`–`D12`, §3–4); follow [`plan/RESTRUCTURE.md`](../../plan/RESTRUCTURE.md) for active wave ordering and PR rules.

*Written 25 Oct 2026. Plan only: no product code is changed by this document. Fan-out prompts are in `plan/agents/`.*
*Source of this file: `plan/build_prompts.py` generates the agent prompts; this plan is hand-written.*

## 0. Governing decisions

| # | Topic | Decision | Basis |
|---|---|---|---|
| D1 | Data scope | Download ~14 GB: MusicBrainz PostgreSQL core (`mbdump`), `mbdump-derived`, `mbdump-cover-art-archive`; JSON dumps for every entity except `release` (22 GB); the canonical-data dump (2 GB). **Not** downloaded: ListenBrainz listens/Spark/statistics (~490 GB), MLHD+ (~240 GB), `mbdump-edit` (16 GB), CritiqueBrainz. | Sizes read from data.metabrainz.org on 25 Oct 2026; E: has 202 GB free; none of the excluded sets help resolve a track to a label, date or genre. `release` JSON is rebuilt from the PG dump. |
| D2 | Store shape | **Partial import, not a mirror.** Stream-extract only the needed tables from `mbdump`/`mbdump-derived` into a read-only Postgres schema `ref_mb` in songnodes. A small SQLite `db/mb_lookup.sqlite` (ISRC + exact normalised lookup tiers only) serves the stdlib-only weekly pipeline. | Full mirror is ~100+ GB loaded and needs MusicBrainz Server; the library has 319 tracks (777 items seen including pending and rejected). |
| D3 | Two independent methods | PG-dump ETL is the primary source. JSON dumps are the cross-check (label, release date, tags agree on a sample). Disagreements are counted, not hidden. | Standing preference: more than one method. |
| D4 | Local first | Every enrichment lookup tries, in order: **ISRC exact → canonical `combined_lookup` exact → fuzzy (Postgres only)**, then and only then a web API. Each web call is counted by provider and field. | Goal: reduce reliance on web calls. |
| D5 | Identity | Track identity stays library-side `norm_key`/`track_id`; songnodes gets a canonical ID with an `xref` table (system, value → canonical ID, confidence, source). ISRC and MBID are attributes and match keys, never primary keys. | Existing `norm_key` is version-agnostic (primary artist + bare title) and ISRCs are per version; conform to songnodes' own canonical-ID design if STATUS.md defines one. |
| D6 | System of record | After cutover songnodes Postgres `library` schema is the record. `db/dj_library.sqlite` stays the pipeline's working store, rebuilt each run, and is pushed to songnodes through an idempotent ingest API. The pipeline must still work if songnodes is down. | `README.md` weekly flow; `sync-music-library.sh` copy is replaced. |
| D7 | What MusicBrainz will not fix | BPM, key, energy. Library baseline: BPM 0%, key 0%, label 2.2%, release year 2.2%, genre 73.7% (coarse), ISRC 100%. MusicBrainz is expected to lift label, release year, genre, aliases and MBID/relationship ids. BPM/key stay with `docs/songnodes-metadata-fix-prompt.md` (WP3 there). | Baseline query on `db/dj_library.sqlite` 25 Oct 2026. |
| D8 | Licences | CC0: `mbdump` core, canonical dump, JSON dumps (listed CC0, but tag fields unchecked: treat them as CC BY-NC-SA until verified). **CC BY-NC-SA 3.0:** `mbdump-derived`, `mbdump-cover-art-archive`, and anything tag-based (including genre associations). Tag/genre columns carry `licence='CC-BY-NC-SA-3.0'`. Dumps and derived DBs stay **out of git**; MusicBrainz is credited in README and UI; any remaining web call obeys 1 request/s with a proper User-Agent. No cover-art redistribution. | `plan/research/licensing.md` (agent-gathered from MusicBrainz docs; some items unverified). |
| D9 | Base branch and PR flow | **`main`.** `feature/design-system` is not on GitHub (checked 25 Oct 2026: origin has `main` and other branches only; the design-system work merged). songnodes `CLAUDE.md` requires every change to reach `main` through a pull request, E2E (`scripts/e2e-docker.sh`) before merge, and `scripts/sync-design-system.sh --check` on UI changes. Each package opens one PR against `main` and is **not merged** until the merge captain's turn, gates and E2E pass. | `git ls-remote` on origin; songnodes `CLAUDE.md` §3–4. |
| D10 | Design | The SongNodes design system is the only source for formatting/design. | Markus's 24 Oct 2026 decision. |
| D11 | Wave-energy theory | Not built here. WP5/WP8 leave a named plug point (`energy_model`) so it can be added to songnodes later. | Markus: planned for a future date. |
| D12 | Parallel safety | songnodes has a scheduled run that merges PRs and other sessions commit to it (a commit landed during this planning). Packages work only on `wp*` branches (worktrees locally, Jules sessions in the cloud) and open PRs against `main` labelled `mb-library`; nothing merges out of order. `AGENTS.md` also requires each task to update `STATUS.md`: every package adds its own dated section; the merge captain resolves the textual conflicts. | `areas/songnodes` notes; songnodes `AGENTS.md`. |

## 1. Lifecycle

```
 monthly/as needed                           weekly (Sun 7:37)
 ┌────────────┐   ┌──────────────┐   ┌─────────────────────────────────────────────┐
 │ P1 acquire │──▶│ P2 ref ETL   │──▶│ musicLibrary: scrape→ingest→resolve(local-first)│
 │ verify     │   │ ref_mb + lite│   │   →process→sync-tidal→db→ P6 sync-songnodes     │
 └────────────┘   └──────┬───────┘   └───────────────────────────┬─────────────────┘
        ▲                │ P3 resolver (ISRC→exact→fuzzy)         │ idempotent ingest
        │                ▼                                         ▼
   new dump drift   P4 songnodes enrichment waterfall  ◀── P5 library schema + canonical IDs
   (re-run P1–P3)        (local first, web last)                   │ outbox events
                                                                   ▼
                                              P7 graph projection (Memgraph) + P8 search/UI
                                                                   │
                                                  verifier WPV: coverage + web-call tables
```

## 2. Repository layout and ownership

New directories are preferred so branches rarely touch the same file.

**musicLibrary (`E:\musicLibrary`)**
- `data/metabrainz/` – downloads (git-ignored, never committed). `pipeline/fetch_metabrainz.sh` (WP1).
- `db/mb_lookup.sqlite` – lite lookup (WP7). `pipeline/djlib/local_ref.py`, `pipeline/djlib/songnodes_sync.py`, `pipeline/build_lookup_db.py` (WP7).
- `plan/`, `decisions/`, `index/` – this plan, decision records, version index.

**songnodes (`E:\songnodes`, discover real paths first; known ones below come from the 24 Oct survey)**
- `contracts/` (WP0) – ids, normalisation, OpenAPI, event schemas, fixtures.
- `sql/migrations/` – explicit number ranges (not globs) so branches never collide: WP0 0100–0199, WP2 0200–0249, WP3 0250–0299, WP4 0300–0349, WP5 0400–0499, WP6 0500–0549, WP8 0600–0649, WP9 0700–0749; `contracts/ownership.yaml` encodes them. Large-table indexes are built by loader commands after bulk load, not by migrations. Every migration has an up and a down script.
- `services/reference-data/mb_etl/` (WP2), `services/reference-data/resolver/` (WP3).
- `services/metadata-enrichment/local_reference_client.py` + one registration line (WP4).
- `services/library/` models + importer (WP5); `rest_api/routers/library_ingest.py` (WP6); `rest_api/routers/library_search.py` + `frontend/src/features/musicLibrary/` (WP9); `services/graph-projection/` (WP8).
- Frozen / not to be rewritten here: everything in `docs/songnodes-metadata-fix-prompt.md` scope (TIDAL v2, Deezer, BPM/key consensus). WP4 only adds the local source in front of them.

## 3. Contracts (WP0 produces; every other WP codes to them)

1. `contracts/normalisation.md` + `contracts/fixtures/normalise_vectors.json`: one text normaliser (accents, case, punctuation, feat./vs./&, mix/version, brackets) with golden vectors. Must reproduce the canonical dump's `combined_lookup` exactly (`unidecode(re.sub(r'[^\w]+','',artist_credit_name+recording_name).lower())`, 100% on ≥1,000 real rows; `unidecode` is not stdlib, so WP0 decides how the stdlib-only pipeline matches it for non-Latin scripts) and keep the existing `ledger.norm_key` as a separate version-agnostic key. Two implementations (songnodes Python, musicLibrary stdlib Python) pass the same vectors.
2. `ref_mb` DDL (artist, artist_alias, artist_credit, recording, isrc, track, release, release_label, label, release_group, url + relationship tables, tag/genre tables, canonical tables), each column tagged `licence: CC0|CC-BY-NC-SA`.
3. `library` DDL (tracks, appearances, rotation_history, chart_positions, pending, rejected, beatport_check, sources, sets, set_tracks, runs, xref).
4. `contracts/library_ingest.openapi.yaml`: `POST /api/library/ingest` with `Idempotency-Key`, batch upsert, per-row result.
5. Outbox event schemas: `library.track.upserted.v1`, `library.set.saved.v1`, `library.track.rotation_changed.v1`.
6. Fixtures: tiny synthetic MusicBrainz TSV files in dump format, a canonical-sample file, a 319-track library snapshot, and `make_fixtures.py`. Every WP can be tested before the real data lands.

## 4. Phases and gates

**P1 Acquire (WP1).** Gate: all D1 files present; every SHA256 verified; `data/metabrainz/MANIFEST.json` lists file, bytes, sha256, dump timestamp, source URL, licence class; script resumes after a killed run; ≥ 100 GB free after downloads (headroom for P2 extraction, which reports its own usage); zero 503 failures left unretried; the open questions in `plan/research/mb_import.md` answered with evidence.

**P2 Reference ETL (WP2).** Gate: for every table, rows counted in the source archive member while streaming = staging rows + rows excluded by the documented slim rule, and loaded rows = staging rows; re-running gives identical per-table checksums; against the JSON dumps (no `release` JSON), recordings agree 100% on title/artist credit, artists/labels ≥ 98% on name/aliases/area, release groups ≥ 98% on first release date, 20 releases spot-checked against the web API at ≤ 1 request/s; indexes built after load; runtime and disk reported.

**P3 Resolver (WP3).** Gate, measured on the 319 library tracks (ISRC is known for all, so ISRC→recording gives ground truth): (a) report ISRC hit rate; (b) run tiers 2–3 *without* the ISRC and report precision/recall for a threshold sweep; (c) fit the threshold on a deterministic half of the labelled data (fit from data, not set by hand) and require precision ≥ 0.98 on the held-out half, with ≥ 100 hand-labelled items whose ISRC is not in MusicBrainz reported separately (the ISRC-bearing slim makes the silver set optimistic); (d) p95 lookup latency < 50 ms on `ref_mb`; (e) mix/version and duration guards: a radio edit never matches an extended mix by fuzzy tier alone, shown on real named pairs from the 777 items.

**P4 Enrichment integration (WP4).** Gate: replay the 777 resolved items (`inbox/resolved_2026-10-24.json`): per-field coverage ≥ baseline for every field (no regression); MusicBrainz web-API calls = 0 for locally resolved items; label/release-year/genre web calls fall by at least the local hit rate; provenance recorded per field (`source`, `matched_by`, `confidence`).

**P5 Library schema + importer (WP5).** Gate: row counts match SQLite (tracks 319, appearances 325, rotation_history 319, chart_positions 10, pending 158, rejected 300, beatport_check 209, sources 21, runs 1, sets 0 at 24 Oct); second import changes 0 rows; every track has a canonical ID and xref rows; duplicates against `silver_enriched_tracks` listed, not auto-merged.

**P6 Ingest + weekly cutover (WP6 + WP7).** Gate: ingest of the same payload twice returns identical results with `Idempotency-Key`; killing the process mid-batch leaves no partially applied chunk and a retry with the same key resumes to exactly the state of an uninterrupted run; the weekly run completes with songnodes stopped (logs "sync deferred", exit 0) and with it running (rows land, outbox events emitted); `scripts/sync-music-library.sh` is retired after WP9 (API-backed pages) has merged.

**P7 Graph (WP8).** Gate: Memgraph node/edge counts reconcile with Postgres within 0; rebuild-from-scratch and incremental projection give the same counts; Camelot/BPM/energy transition edges verified on synthetic fixtures with key and BPM (the real library has none yet) and label edges verified on every real track that has a label (~7 at the 24 Oct baseline).

**P8 Search + UI (WP9).** Gate: `/library` and `/sets` read from the API, not the JSON copy; server search p95 < 150 ms on the library, artist alias search works ("Dom Dolla" finds aliases); MusicBrainz credit shown; design-system tokens only (no hard-coded colours).

## 5. Cross-cutting rules

- Determinism: the same normaliser code/vectors on both sides; builds are reproducible from `MANIFEST.json` + script.
- Data hygiene: dumps are immutable and checksummed; never edit them; never commit them; intermediate staging is disposable.
- At least two independent methods wherever a match, classification or estimate is made, with an agreement/disagreement flag (resolver tiers vs JSON cross-check; ISRC vs fuzzy).
- Infer rules from existing decisions where one is needed (e.g. threshold from the labelled set), and state the fit.
- No secrets in code, logs or PRs. `secrets/` is untouched.
- Windows: repos live on `E:` under Windows; scripts must run under Git Bash or PowerShell as stated in each prompt. Long jobs run in Claude Code on the laptop, not in the cloud shell (it kills background jobs and is ~0.5 MB/s).
- Never delete: move to `_to_delete/`.
- Rollback: every behaviour change is behind a flag (`MB_LOCAL_ENABLED`); migrations are additive with down scripts; new schemas (`ref_mb`, `library`) can be dropped without touching existing tables; take a `pg_dump` of any pre-existing table before a backfill.
- Environment: Postgres (+`pg_trgm`), Memgraph and Redis are set up per `docs/integration/prereqs.md` (WP0); dependencies per package are listed there.
- Beatport and 1001tracklists: no new scraping, no block-evasion.

## 6. Versioning

`index/musicLibrary_versions.csv` records plan, prompts, scripts and data manifests (`version,date,kind,unit,path,checksum,status,decision_link,notes`). One ACTIVE row per (kind, unit). Decisions go in `decisions/<date>-*.md`.

## 7. Work packages

| WP | Owner area | Depends on | Gate (see §4) | Verifier |
|---|---|---|---|---|
| WP0 | Contracts, DDL, fixtures, test harness | – | contracts + fixtures + CI skeleton merged | WPV0 |
| WP1 | Acquire & verify datasets | – | P1 | WPV1 |
| WP2 | Reference ETL → `ref_mb` | WP0 | P2 | WPV2 |
| WP3 | Resolver + evaluation harness | WP0 (fixtures); real data at end | P3 | WPV3 |
| WP4 | Local-first enrichment client + waterfall | WP3 | P4 | WPV4 |
| WP5 | `library` schema, importer, xref | WP0 | P5 | WPV5 |
| WP6 | Ingest API + outbox events | WP0, WP5 | P6 (API half) | WPV6 |
| WP7 | musicLibrary side: lookup DB, local-first resolve, songnodes sync | WP0 (fixtures, draft spec); wave C: WP2, WP3, WP6 | P6 (pipeline half) | WPV6 |
| WP8 | Memgraph projection | WP0 events, WP5 | P7 | WPV8 |
| WP9 | Search API + frontend pages on API | WP0 openapi, WP5 | P8 | WPV9 |
| WPV | Independent verifier (tests/report only) | each WP merged | all gates re-run from scratch | – |
| WPM | Merge captain | waves | integration branch green | – |

**Waves (cap 7 concurrent agents):** A = WP0 ∥ WP1 (WP1's long download blocks only the real-data gates, not WP0's merge) · B starts when WP0 merges = WP2 ∥ WP3 ∥ WP5 ∥ WP6 ∥ WP7 ∥ WP8 ∥ WP9, all coding to contracts + fixtures (gates that need real data wait for WP1) · C = WP4, plus WP7's real-data build and final gate (needs WP2, WP3, WP6 merged) · then WPV and WPM after each wave.
**Merge order:** WP0 → WP2 → WP3 → WP5 → WP6 → WP4 → WP7 → WP8 → WP9. Reason: schema before loaders, loaders before the resolver that reads them, library schema before the API and graph that read it, resolver before the waterfall that calls it, pipeline client after the API exists.

## 8. Open items only Markus can settle

1. Connect `E:\songnodes` to the session ("Add folder") so the agents' path assumptions can be checked; until then every prompt tells the agent to survey first.
2. Confirm the `main` base and the PR-not-merged flow (D9). If you prefer an `integration/mb-library` branch on GitHub, push it and tell the merge captain; Jules sessions can then start from it.
3. Run `pipeline/fetch_metabrainz.sh` (or let WP1 do it) on the laptop; partial files are already in `data/metabrainz/`.
4. Decide whether `release` JSON (22 GB) is wanted; default is no.

---

## ADDENDUM 2026-10-25: rescope after checking `origin/main` (this section overrides anything above it)
A review of `main` at `6338e89` found that songnodes already contains a data layer (`services/common/datalayer/`: ingest, durable jobs, transactional outbox, `projection_tracks` consumer, entity resolution, identity merge, evidence/consensus, enrichment waterfall), a provider registry (`services/common/providers/`, including a web-API MusicBrainz provider) and matching rules (`services/common/metadata/matching.py`). Consequences:
- **WP6 is retired.** Its ingest endpoint, idempotency and outbox work is covered by the existing job framework and outbox; the remaining pieces (a `library_ingest` job handler, `POST /api/v1/library/ingest`, saved-sets endpoints) are folded into **WP5**.
- **WP5** keeps tracks in `silver_enriched_tracks` (with evidence) and adds only a `library` overlay schema for rotation, crates, appearances, charts, review queues and saved sets.
- **WP3** reuses `matching.py`/`er.py`; **WP4** is a new `Provider` in the existing registry/waterfall (evidence via `evidence.record`); **WP8** is a new outbox consumer modelled on `projection.py`; **WP9** queries `projection_tracks` where it fits.
- **Migration numbers** are three digits continuing `sql/migrations/014_*`: WP0 100–119, WP2 120–139, WP3 140–159, WP4 160–179, WP5 180–219, WP8 220–239, WP9 240–259. Wherever this plan says `0100–0199` etc. or `/api/library/...`, read these ranges and `/api/v1/library/...`.
- **Merge order:** WP0 → WP2 → WP3 → WP5 → WP4 → WP7 → WP8 → WP9. **Waves:** A = WP0 ∥ WP1; B = WP2, WP3, WP5, WP8, WP9; C = WP4 (+ WP7 real-data gate).
- Frontend: Camelot (`/harmony`), pipeline (`/pipeline`), settings/API keys and the target-tracks manager already exist on `main`; the remaining frontend packages are FE1 (track bridge), FE3 (route finder on the existing PathfinderPanel), FE4 (set export and reorder), FE9 (library → target button), FE10 (AI setlist import) and FEW (route wiring). Security packages SEC1–SEC6 come from a scan of `main`.
