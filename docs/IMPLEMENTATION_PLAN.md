# SongNodes architecture implementation plan

This is the maintained implementation plan for the architecture blueprint and
the wave-routing addition. It supersedes the plan held only in chat. Update
`STATUS.md` at the start of every task and record results and the resume point
before stopping. This document describes intended work; STATUS.md records what
has actually been completed and verified.

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

**Exit:** measured extraction quality and resource use, trustworthy calibrated
energy against library ratings, replayable feature updates, and validated vector
retrieval if included.

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

The next implementation task remains milestone-1 REST/legacy graph validation.
Do not skip that foundation to implement wave routing ahead of its prerequisites.
