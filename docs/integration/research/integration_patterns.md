# Research brief: ingest, outbox, graph projection, migrations, parallel worktrees (agent-gathered 25 Oct 2026)
"Convention" = the agent's recommendation, not a quoted source.

**Idempotent bulk ingest** (postgresql.org INSERT; stripe idempotent requests)
- `INSERT … ON CONFLICT DO UPDATE` is atomic; a conflict target is required; a single statement cannot affect the same row twice, so **dedupe each batch by key first**.
- Stripe model: client key (≤255 chars) → server stores first response and replays it; a different request with the same key is an error; keys may be pruned after ≥ 24 h.
- Convention: UNIQUE (source_system, source_id) with a separate surrogate canonical ID; `WHERE target.content_hash IS DISTINCT FROM EXCLUDED.content_hash` to skip no-op writes; one transaction per chunk with chunk status recorded so a re-run resumes; per-row results.

**Transactional outbox** (microservices.io; postgresql.org SELECT)
- Write business rows and outbox rows in one transaction; a relay publishes; duplicates are possible, so consumers must be idempotent. `FOR UPDATE SKIP LOCKED` avoids contention but gives no global ordering.
- Convention: `id bigserial, event_id uuid unique, aggregate_type, aggregate_id, event_type, payload jsonb, version, created_at, published_at null`; partial index on unpublished; single relay or per-aggregate ordering by version; projector idempotent (MERGE + SET); purge published rows.

**Memgraph** (memgraph.com/docs: merge clause, import best practices, migrate-from-rdbms)
- MERGE on key only (null property in MERGE fails), then SET. Batch with `UNWIND $rows` in chunks of ~10k–100k. Constraints do not create indexes: add a label-property index on the merge key. Nodes before relationships. IN_MEMORY_ANALYTICAL is ~6× faster for single-threaded full rebuild but drops ACID.
- Convention: unique constraint + index on `canonical_id` per label; incremental via outbox; keep a deterministic drop-and-reload rebuild. Postgres is the source of truth. Relationship MERGE performance: benchmark.

**Migrations** (alembic branches; postgresql ddl-alter)
- Two revisions with one parent give multiple heads. songnodes uses numbered SQL migrations (e.g. `sql/migrations/medallion/004_*_up.sql`), so this plan reserves number ranges per WP instead.
- Convention: additive (expand) first, backfill, switch code, drop later; down scripts for expand steps; `SET lock_timeout` on DDL; CI check that migration numbers are unique and ordered.

**Parallel agents in worktrees** (code.claude.com/docs/en/worktrees, sub-agents)
- `claude --worktree <name>` creates `.claude/worktrees/<name>/` on branch `worktree-<name>`; add `.claude/worktrees/` to .gitignore; each worktree needs its own dependency setup. Subagents work best on independent paths; many parallel subagents are costly. **Anthropic's docs give no guidance on ownership splits or merge order** — the rules below are convention:
- Contract-first commit; branch every worktree from it; contracts frozen except via the merge captain.
- Disjoint ownership (one module dir, one test dir, one migration range per agent); shared files (app wiring, requirements) belong to the merge captain.
- Merge order: schema → loaders → resolver → API → graph → UI; rebase after each merge. On a conflict in a non-owned file: stop and escalate.
- CI gates: unique migration numbers; contract tests against frozen schemas; up/down on a clean DB; lint/type; full suite after each merge.
