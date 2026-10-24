# SongNodes architecture implementation plan

This is the maintained implementation plan for the architecture blueprint and
the wave-routing addition. It supersedes the plan held only in chat. Update
`STATUS.md` at the start of every task and record results and the resume point
before stopping. This document describes intended work; STATUS.md records what
has actually been completed and verified.

The [track-metadata retrieval requirements](requirements/TRACK_METADATA_RETRIEVAL.md)
are also part of this plan. Their five work packages are scheduled below, with
the full original request retained for its provider contracts and acceptance cases.

## Direction and delivery rules

Replace components incrementally, preserving a working application and rollback
paths. Treat the blueprint's latency, memory, and throughput figures as hypotheses
to measure on representative data and agreed hardware, rather than guarantees.
Validate library examples against the installed versions before adopting them.

| Area | Starting choice | Decision gate |
| --- | --- | --- |
| Application | FastAPI modular monolith | Preserve existing public contracts while consolidating domains. |
| Background work | Celery + RabbitMQ | Consider Temporal only if durable long-running workflows justify it. |
| Catalog | PostgreSQL system of record | Evaluate PostgreSQL 16 and pgvector changes independently. |
| Graph | Rebuildable Memgraph projection | Demonstrate correctness and benefit against current SQL. |
| Search | Meilisearch candidate | Confirm relevance, facets, latency, and resource use with real catalog data. |
| Renderer | Sigma.js + Graphology + worker layout | Demonstrate interaction parity; retain Cosmos.gl as a benchmark alternative. |
| Audio | Isolated Essentia workers | Validate extraction quality, distribution/licensing, packaging, and resource use. |

Each milestone includes meaningful tests, migrations where needed, deployment
instructions, observability, and a rollback strategy. Use feature flags and shadow
comparisons for replacements. Retire services only after callers have migrated
and queued work has drained. Do not present synthetic test data as real music
evidence, or passing builds as passing runtime or type checks.

### Design system

All frontend and music-library presentation (colour, type, spacing, icons, copy,
formatting, component markup and page patterns) comes from the SongNodes design
system in [design-system/](../design-system/README.md), the single source of truth for
formatting and design. Frontend work in every milestone passes the design-system
gates in [docs/sdlc/SDLC.md](sdlc/SDLC.md). The frontend migration onto the system
runs as work packages WP0–WP7 (design-system section 19, phases 0–6) in parallel with
the backend milestones below, without changing their order.

## Milestone 1 — Reproducible development baseline

1. Establish supported startup for database/cache/queue prerequisites, APIs, and
   frontend; distinguish required services from optional external integrations.
2. Fix startup failures and active frontend type/contract errors. Align legacy
   graph and broader REST routes with the selected database schemas.
3. Capture representative catalog/transition fixtures and several complete real
   sets in their original order. Retain source identifiers, ordering, available
   timing, and provenance. Inventory existing data before obtaining more.
4. Keep synthetic smoke fixtures separate from these real sets. The ordered sets
   become held-out evaluation material for wave routing, plateau lengths, and
   observed drop sizes; do not manufacture fixtures to make a route pass.
5. Measure ingestion latency, graph/search response times, browser responsiveness,
   and memory with documented dataset sizes, concurrency, and hardware.
6. Complete the metadata transport/unknown-value audit and coverage-baseline
   preparation in the [metadata retrieval program](#track-metadata-retrieval-program--wp1wp5)
   before the next catalog-write changes.

**Exit:** a clean environment starts reliably, real database-backed graph/browser
workflows and representative REST operations pass, and the baseline and remaining
failures are documented. The startup and TypeScript increments have been completed;
broader workflow and real-set/performance coverage remain outstanding.

## Milestone 2 — Backend domain consolidation

Use the existing REST API as the compatibility entry point. Extract reusable logic
from data-transformer, data-validator, nlp-processor, metadata, and graph services
into explicit ingestion, catalog, entity-resolution, audio-feature, and graph-query
packages. Keep domain code independent of HTTP handlers and worker tasks.

Move CPU-heavy and slow external operations to Celery. Add job status,
idempotency keys, bounded retries, and dead-letter handling. Define transaction
boundaries explicitly; consolidation does not create atomic transactions across
external APIs, databases, and queues.
Consolidate TIDAL callers onto the shared official-v2 client as specified in WP1.

**Exit:** equivalent results for representative ingestion, compatibility endpoints
remain usable, and replaying/retrying jobs does not duplicate records or transitions.

## Milestone 3 — Canonical identities, energy contract, and projections

Define stable identities for artists, recordings, track versions, releases, and
setlists. Preserve raw source records and provenance. Keep observed transitions
distinct from inferred recommendations. Preserve setlist membership order and
available timing as evidence for learning plateau lengths and drop sizes.

Settle the canonical energy definition before building dependent indexes:

- Use a **1–10** canonical scale and **three energy bands**, including the Building
  tier. Ratify the remaining band names and exact inclusive boundaries here.
- Decide precision/rounding and how conflicting ratings are reconciled.
- Preserve original values/scales, source (manual rating, provider, or extractor),
  method/model version, calibration version, confidence where available, and when
  the score was measured or rated. Missing energy stays unknown.
- Define explicit conversions from legacy 0–1 values and extractor outputs.
  Preserve raw measurements; do not assume loudness alone represents DJ energy.
- Version the contract so recalibration can rebuild search and graph projections.
  Do not silently mix raw measurements, normalized scores, and manual ratings.

Add a PostgreSQL transactional outbox and replayable, idempotent projection
consumers. Handle lag, retries, deletions, and entity merges. Avoid independent
application dual writes to PostgreSQL and downstream stores.
Include the metadata program's reversible feature/platform-ID schema changes,
source-evidence model, shared Camelot specification/corrections, and consensus
contract here before enabling enrichment writeback or backfill.

**Exit:** canonical identities and ordered setlists survive merges/replays, energy
scale/bands/provenance are defined and tested, and projections can be rebuilt and
reconciled without lost or duplicated changes.

## Milestone 4 — Normalization and entity resolution

Implement deterministic parsing before probabilistic matching. Preserve Unicode,
original strings, featured artists, and remix/version distinctions. Correct the
blueprint's sample parsing: splitting on every `x` damages valid artist names,
and ASCII-only normalization discards identity information.

Evaluate Splink/DuckDB on labelled pairs in shadow mode. Use identifiers such as
MusicBrainz recording IDs and ISRCs as evidence, with explicit recording/version
semantics. Add automatic-match, review, and reject thresholds; retain reversible
merge history and checkpoint historical backfills.

Use Chromaprint/AcoustID only where suitable authorized audio is available:
fingerprinting still requires audio. Use metadata matching otherwise.
Integrate the metadata program's official provider clients, ISRC/version matching,
duration guard, per-field waterfall, and verified backfill in this milestone.

**Exit:** agreed precision on labelled examples, especially remixes and ambiguous
titles/artists; auditable and reversible merges; resumable backfill.

## Milestone 5 — Server-side catalog search

Introduce search through application endpoints, keeping administrative search
credentials off clients. Index canonical titles, artists, versions, BPM, Camelot
key, genre, and **energy on the milestone-3 1–10 scale**. Add the agreed **energy
band as a facet**, supporting queries such as Building-tier tracks.

Implement pagination, highlighting, deterministic ordering, facets, and index
rebuild/reconciliation commands. Refactor frontend API/search components to use
debounced requests, cancellation, and protection against stale responses. Keep
lightweight filtering where it operates on an already loaded small selection.

**Exit:** relevant results and correct facets, bounded browser memory, and measured
end-to-end search latency. Use p95 below 150 ms as a provisional development goal,
with workload/hardware documented and the final target agreed from measurements.

## Milestone 6 — Memgraph, transition scoring, and wave routing

Wave routing belongs here within graph projection; **it is not a separate
milestone and must not be bolted onto the current route finder**.
Preserve the metadata program's fields, provenance, and unknown-value semantics
when projecting the repaired PostgreSQL catalog into Memgraph.

### Graph and scoring contract

- Benchmark representative neighborhoods and paths against SQL before migrating
  production reads. Use canonical IDs and rebuildable PostgreSQL-backed graph data.
- Store transition direction, observation counts, source evidence, and scoring
  version. Model track, artist, and setlist relationships explicitly.
- Consolidate overlapping harmonic utilities into one tested scoring specification
  covering all 24 Camelot keys, circular boundaries, BPM half/double-time cases,
  energy, missing features, and confidence/provenance.
- Add deterministic **energy move** classification beside key and BPM:
  `hold`, `step_up`, `lift`, `reset_drop`, and `jarring`.
- Store the move label, source/target energy and delta, relevant version/provenance,
  direction, and counts on each edge. Compatibility strength and energy movement
  remain separate facts. Unknown energy must not be classified as a known move.
- Define move thresholds using the milestone-3 scale and observed sets. A move is
  fixed for its edge inputs and classification version; recalibration can produce
  a new version. Do not encode set-specific preference into the stored label.
- Keep compatibility scores separate from path costs. High compatibility must not
  accidentally become a more expensive path in a shortest-path algorithm.

### Contextual wave-shaped routing

The route finder decides whether a move is desirable **at the current point in
the set**. A reset drop can be appropriate after a peak and inappropriate during
a climb. Track route state such as current phase, progress/duration, recent energy
history, and plateau length; a single static edge weight is insufficient.

Specify the wave objective and constraints before implementation: climb, hold,
peak, reset, and subsequent build behavior; permitted drop sizes; plateau
durations; number of peaks; start/end/waypoint requirements; and behavior when
energy is missing or no feasible route exists. Learn/calibrate defaults from the
ordered real sets, keeping evaluation sets separate from calibration material.

Ship the replacement and wave routing in this milestone under a feature flag,
first in **shadow mode alongside the existing route finder**. Compare feasibility,
duration, waypoint coverage, key/BPM compatibility, energy trajectories, and
human assessments. Do not silently substitute another route and call it a wave.

Bound graph expansion and route search by depth, nodes, edges, time, and response
size. Use parameterized Cypher; correct the blueprint's variable-length
relationship filtering and do not rely on `LIMIT` alone to bound traversal work.

**Exit:** reconciled graph counts/direction, tested score-versus-cost semantics,
stable move classifications, bounded query behavior, successful rebuilds, and
wave routes passing synthetic boundary tests plus held-out real-set evaluation.
Enable wave routing only after shadow comparisons and rollback checks pass.

## Milestone 7 — Renderer and route presentation

Prototype Sigma.js/Graphology against selection, filtering, context menus,
pathfinding, and setlist interactions. Introduce a renderer interface and retain
the current renderer behind a rollout flag. Move layout to a worker, default to
bounded ego-network exploration, preserve coordinates during expansion, and cap
retained graph size.

Start with versioned JSON. Adopt binary transport or WebSocket updates only when
profiling justifies them; include backpressure/reconnection behavior. Prefer
transferable typed arrays initially; SharedArrayBuffer requires deliberate
cross-origin isolation.

Once milestone-6 scoring exists, **colour edges by energy move type** and show
the **wave chart on a built route**. Include a legend and text labels so colour
is not the only indicator. Keep chart time/order consistent with route data and
show missing-energy gaps. Display scores without recomputing routing policy in
the renderer.

Any renderer follows `design-system/components/GraphStyles` and `GraphControls`:
- Node and edge colours are read from tokens at runtime through `graphColours()`.
- Neutral nodes by default, with "Colour by" set to energy, key or genre.
- Lavender marks the selection, amber marks now playing.
- The wave chart is the design-system `EnergyWave`.

**Exit:** interaction parity, accurate edge labels/chart, bounded memory, and
responsive rendering on documented datasets/hardware. Treat 60 FPS as a measured
target, not a technology guarantee.

## Milestone 8 — Audio extraction and optional vector retrieval

Benchmark isolated Essentia workers against current extraction using identical
authorized audio. Validate BPM, key, energy, confidence, and processing version;
apply CPU/memory/duration/concurrency limits and safe retry behavior. Validate the
sample Essentia APIs rather than treating the blueprint pseudocode as executable.

For energy, compare **multiple methods**, rather than trusting one extractor,
against **tracks manually rated in the user's own library**. Define a labelled
reference set and held-out evaluation, calibrate outputs to the canonical 1–10
scale, and evaluate ordering, band agreement, and transition-move stability.
Preserve source/method provenance and distinguish preview-derived scores from
full-track analysis. Version/reproject improved scores through the outbox; wave
routing then benefits from improved energy estimates without changing its role
in milestone 6. Retain the previous extractor until quality/operational gates pass.

Add pgvector only after choosing a versioned embedding model and a specific
retrieval use case. Measure retrieval quality and HNSW recall before optimizing
latency.
WP3's audio methods, terms verification, independent-method consensus, and
rated-library energy calibration are part of this milestone; catalogue retrieval
and transport fixes are scheduled earlier rather than waiting for audio.

**Exit:** measured extraction quality and resource use, trustworthy calibrated
energy against library ratings, replayable feature updates, and validated vector
retrieval if included.

## Track-metadata retrieval program — WP1–WP5

This program repairs metadata acquisition and delivery to the graph. It is
required work, not an optional renderer enhancement. The detailed
[uploaded specification](requirements/TRACK_METADATA_RETRIEVAL.md) is retained
verbatim. Its provider observations are user-supplied evidence dated 24 Oct 2026;
they have not been independently live-verified in this cloud task.

### Placement and execution order

| Work | Primary home | Prerequisite and handoff |
| --- | --- | --- |
| Graph/catalog/frontend field transport and honest unknowns | Milestone 1, next task | Test delivery of existing values before attributing missing graph data to providers. |
| Coverage tooling and provider contract reconnaissance | Milestone 1 | Capture a real-data baseline and stable sample before enrichment changes. |
| Shared TIDAL client consolidation (WP1) | Milestone 2 | Verify official contracts, implement the client, then migrate its callers. |
| Metadata schema, provenance, Camelot correction migration, consensus contract | Milestone 3 | Reversible migrations and energy-scale contract precede production writeback/backfill. |
| TIDAL/Deezer/GetSongBPM retrieval, matching, per-field waterfall (WP1/WP2/WP4 and WP3 catalogue methods) | Milestones 3–4 | Provider clients and schema feed the configured field resolver; version matching must pass before backfill. |
| Graph exposure, resumable enrichment backfill, coverage proof (WP5) | Milestones 3–4, before milestone 6 | Populate and verify the current PostgreSQL graph first, then carry the same fields into Memgraph. |
| Audio methods, calibrated energy, and audio-dependent consensus (WP3) | Milestone 8 | Use authorized audio and rated-library calibration; missing calibrated energy stays unknown until supported. |

Do not defer provider repair, Camelot correctness, or existing-field transport
until the renderer replacement. Wave routing in milestone 6 depends on milestone-3
energy semantics and provenance, and later benefits from milestone-8 calibration.
Define how wave routing handles unknown energy rather than manufacturing scores.

Metadata transport checkpoint (2026-10-24 Australia/Sydney): shared backend and
frontend adapters now expose stored fields on graph/catalog/detail/setlist reads,
initial loads and API reloads, and desktop/mobile mappings. Explicit silver NULLs
and meaningful zeroes are preserved; durations keep their units; record labels
remain distinct from graph labels. Energy displays retain raw values/scales, and
legacy timed routing reports missing durations instead of inventing them.
Validation: 20 synthetic database/API tests, 38 frontend unit tests, type check,
production build and extended Chromium smoke passed. This is delivery of existing
values, not provider repair, calibration, backfill or proof of real-data coverage.
Actual-data/source inventory and coverage-baseline tooling (item 5) are now
documented in [METADATA_BASELINE.md](METADATA_BASELINE.md). The minimal stack is
empty; no real-library coverage or populated fixed sample is established. The
read-only CLI and six coverage regression checks are complete; provider consensus
remains unassessed. Capture a new populated baseline before real backfill.

### Immediate next task — metadata transport and baseline

The current code inspection found two concrete transport issues:
`frontend/src/services/api.ts` builds graph nodes without copying all available
metadata; `frontend/src/hooks/useDataLoader.ts` supplies invented BPM/key/energy
defaults. Audit all graph-to-track transformations, including DJInterface and
utility adapters, rather than fixing only one path.

1. Preserve BPM, musical/Camelot keys, energy and its scale, danceability, valence,
   duration units, ISRC, TIDAL/Deezer IDs, label, and mix/version metadata from the
   database through graph/catalog responses to frontend graph and track objects.
2. Keep display `label` distinct from the record label. Handle currently absent
   columns/JSONB fields explicitly until the versioned schema migration lands.
3. Preserve zero where meaningful and unknown where missing. Remove invented
   tempo, key, energy, and pseudo-random duration values from factual metadata.
   Keep any visual placeholder separate from data used for recommendations/routing.
4. Add regression cases for populated fields, nulls, zero values, unit conversion,
   and identical metadata through initial load, reload, detail, and neighborhood
   paths. Do not relabel legacy 0–1 energy as calibrated 1–10 energy.
5. Inventory actual data and source bindings. Add coverage tooling that can run
   before/after backfill; do not use synthetic fixtures as production coverage.

This task precedes the remaining legacy catalog writes because those writes and
later enrichment must preserve the same metadata contract.

### WP1 — one official TIDAL v2 client

- Consult the current official OpenAPI reference and verify live read contracts
  before implementation. Use `/v2` JSON:API and `application/vnd.api+json`.
- Implement ISRC lookup, searchResults relationship IDs, and hydration with
  artists; respect the requested 20-item batching limits. Treat opaque resource
  IDs separately from raw search text.
- Parse `data[].attributes`, ISO-8601 durations, title/version distinctions, ISRC,
  and TIDAL ID. Make `TIDAL_COUNTRY_CODE` configurable with default `AU`.
- Treat unexpected 404s on the known-good contract fixture as failures, not
  silent empty matches. Do not assume TIDAL supplies non-null BPM/key.
- Fix auth with secrets in supported headers/bodies rather than URL parameters;
  verify app-token, PKCE, refresh, and supported scopes against live contracts.
- Migrate enrichment, streaming integrations, connector, auth and playlist callers
  to the shared client. Implement documented v2 playlist item limits, duplicate
  policy, item IDs, and idempotency keys. Inventory exceptions where a feature is
  unavailable on the official API; do not silently keep private endpoints.
- Reconcile configured credential names without copying credentials into code,
  logs, fixtures, or PR text. Existing HTTPS proxy/secret bindings are checked first.

### WP2 — working Deezer retrieval

Implement ISRC-first lookup, plain-text search (including an extended-version
candidate query), track detail and album hydration. Preserve `deezer_id`, ISRC,
duration, title/version, gain, preview URL, album genres and label. Treat zero BPM
as unknown, not a real tempo. Add rate limiting, Redis caching, and quota-code-4
backoff with verified provider behavior. Preview availability does not itself
establish permission to analyze the audio.

### WP3 — independent BPM/key evidence and calibrated energy

- Repair GetSongBPM URL, `type=both`/lookup parameters and `tempo`/`key_of`/
  `camelot` parsing. Verify its terms and implement the required visible backlink
  before enabling it. Preserve non-zero Deezer BPM and existing Beatport values;
  use AcousticBrainz only where its historical data exists.
- Define one shared `to_camelot()` with golden tests for all 24 keys, enharmonic
  spellings, long/short key names, Open Key (`1m` = `8A`, `1d` = `8B`), and existing
  Camelot codes. Correct both enrichment conversion paths. Recompute affected
  stored minor values from original musical key/mode or trusted source evidence,
  not from an already incorrect Camelot code alone; retain originals for rollback
  and flag unrecoverable values for review.
- Store every source's BPM/key measurement and method/version provenance. Do not
  count the same upstream source twice as independent agreement. Fold half/double
  tempos only with justified genre ranges; test 64↔128 and 87↔174. Define behavior
  for unknown/multiple genres rather than forcing an arbitrary range.
- Distinguish exact key agreement from relative-major/minor or ±1-neighbor
  near-agreement. Select by agreement then configured source trust, preserve
  disagreements, set `metadata_review`, and expose `v_metadata_conflicts`.
- In milestone 8, verify Essentia KeyExtractor (`edma`) and RhythmExtractor2013,
  compare independent audio methods, and write versioned evidence/results back
  through the track resolver rather than only an analysis table. Use MinIO audio
  or provider previews only after checking and recording applicable terms.
- Calibrate energy from loudness/RMS, onset rate, spectral flux, danceability,
  and other tested methods against the user's rated library. Fit and validate the
  rule instead of inventing weights. Without tagged calibration data, leave
  canonical energy null. Do not write 1–10 values into legacy 0–1 fields before
  the milestone-3 schema/scale migration.
- Remove Spotify audio-features calls throughout the repository and from active
  waterfall configuration. Preserve unrelated supported Spotify integrations.

### WP4 — configured field resolution, matching, and schema

Replace blind `metadata.update` overwrites with configured per-field resolution
and provenance. Wire `ConfigDrivenEnricher` into the actual enrichment path.
Implement the requested defaults:

- BPM/key: consensus from independent methods.
- ISRC: TIDAL, then Deezer, then MusicBrainz's `isrcs` list.
- Duration/mix name: TIDAL, then Deezer.
- Genre/record label: Discogs, then Deezer album, then HTTPS Last.fm tags.

Match ISRC first, then version-aware fuzzy candidates. Include TIDAL/Deezer
candidates and the hard ±10-second duration guard to prevent radio-edit/extended
mix substitution; define explicit review behavior when duration is unknown.

Add reversible migrations for `camelot_key`, record label, `mix_name`, source
evidence/review state, and missing platform identifiers as confirmed by schema
inspection. Backfill available JSONB values without destroying source evidence.
Keep genres as `TEXT[]`. Correct MusicBrainz ISRC capture, Last.fm HTTPS, hard-coded
database-password defaults, and deployment credential-name mismatches.

### WP5 — graph projection, backfill, and proof

Expose the agreed fields through the current graph API and any retained
`graph_nodes` view, then preserve them in the milestone-6 Memgraph projection.
Audit view consumers rather than assuming all code still uses that view: the
current baseline graph API reads silver tables directly.

Build a rate-limited, resumable, idempotent backfill for tracks missing BPM, key,
ISRC, TIDAL ID or Deezer ID. Use checkpoints, bounded batches, retries and review
outcomes. Retain before-state evidence and avoid overwriting stronger known
values. Backfill must run only after schema, client contracts, matching and field
resolution are validated; never destructively change the production database.

### Acceptance, research, and handoff

- Report before/after non-null coverage for all tracks and a persisted, seeded
  sample of 50 stable track IDs: BPM, key, Camelot key, energy, ISRC, TIDAL ID,
  Deezer ID, genre, record label, and mix name. Report sample size honestly if
  fewer than 50 real tracks are available. Include independent-method BPM/key
  agreement, near-agreement and conflict rates. Separate transport improvements
  from newly acquired metadata, and explain fields whose coverage did not improve.
- Add credential-gated live contract tests for the requested TIDAL/Deezer ISRC
  `QM6MZ2651268`, 304-second extended version, and TIDAL search finding both the
  202- and 304-second versions. Recheck any drift against current live responses;
  report it rather than hard-coding the dated observation as a passing result.
- Add unit/contract cases for key mappings, ISO durations, tempo folding,
  independence of sources, version guards, null/zero semantics, field priority,
  quota/retry handling, and deprecated-URL/Spotify-audio-features absence.
- Research current official docs per work package and verify API behavior with
  real calls. Distinguish passed, failed, skipped-for-credentials and unrun checks.
  Missing credentials, calibration ratings, or real catalog data are recorded
  prerequisites; never invent values or claim live coverage from fixtures.
- Follow the uploaded request to use parallel agents with disjoint file ownership
  when implementing independent work packages. Assign migrations, shared types,
  and integration edits to a single owner and sequence dependent handoffs.
- Use a branch and open a PR with actual coverage, live-test/terms results,
  compatibility exceptions, and remaining gaps. Keep `.env` and secrets out of Git.
- The referenced laptop `musicLibrary` implementations are candidate reference
  material, not files available in this cloud checkout. Inspect connected/local
  access before requesting copies; keep any newly saved laptop files on `D:\`.
- Do not extend Beatport/1001tracklists scraping or bypass blocks; use existing
  collected values and supported APIs. Do not introduce undocumented/private
  TIDAL calls as a fallback.

## Feature availability and dependency order

The current `🌊 Wave` control does not implement wave routing. Gate it behind
`VITE_ENABLE_WAVE_ROUTING`, **off by default**. This flag controls visibility only;
it must remain off for users until milestone 6 supplies and validates the actual
replacement route finder. Do not add wave behavior to the current algorithm as
an interim solution or describe the flag itself as completed routing.

Dependency order:

**Baseline → domain consolidation → canonical identities/energy + outbox →
entity resolution and search → graph projection/scoring + wave routing → renderer
presentation → audio/vector improvements.**

Real-set fixtures begin in milestone 1. Energy definitions precede search facets
and graph move labels. Wave routing ships in milestone 6; milestone 7 displays
it, and milestone 8 improves the reliability of its input scores.

The next implementation task is the remaining legacy catalog-write audit.
Metadata transport and development coverage-baseline tooling are complete;
real-library coverage, ordered real sets and workload baselines remain pending. Provider/schema work follows the metadata program above. Do not skip
those foundations to implement wave routing ahead of its prerequisites.
