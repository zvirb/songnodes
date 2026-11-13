# Decisions

- D001 — 2026-11-13, attached prompt and repository context: use a local filesystem
  queue with OS advisory mutex, atomic QUEUE.md replacement, and replayable views.
  Existing dated tracker remains untouched. Reverse by exporting records before
  adopting another store; retain immutable IDs and history.
- D002 — 2026-11-13, AGENTS.md small-batch requirement: deliver the safe core first.
  Workers stage proposals only. Final verification/promotion, rollback restoration,
  idempotent Done finalization, retired-resource enforcement and planner transitions
  are unimplemented and must be a separate owned-path package. Never use this core
  as an automatic integration service. Reverse only after those acceptance tests pass.
- D003 — 2026-11-13, audit evidence: import distinct (route, rule, message, axe targets)
  observations individually; retain all repeated display-matrix occurrences. This
  preserves all 669 findings without 669 duplicate fixes. Coverage gaps are separate
  verification tasks, not alleged design defects. Reversal: retain tasks and retire
  superseded duplicates once terminal-state tooling is implemented.
- D004 — Configuration uses E:/songnodes through a portable relative root,
  Australia/Sydney, current design-system references and frontend proposal workers.
  No provider edits, DB operations, remote execution, deployment or schedules. The
  project still uses Australia/Melbourne for formatted product data per its standards.
- D005 — Supersedes D002's deferral: user requested finishing the lock system
  before committing. Verification, apply, rollback, terminal recovery, retirement,
  splitting and deferred batches are now implemented. Apply remains disabled by
  configuration until explicitly authorized; no workers or schedules were started.
- D006 — User requires locks never to enter Git or follow branches from main.
  Branch-specific `.runtime/` holds current state, leases, journals and proposals.
  QUEUE.md transports task definitions and terminal evidence with no active claims.
  New branches seed from the catalog; `git-check` rejects staged runtime artifacts.
  Reverse only by explicit state migration, never by committing lease files.
- D007 — Preserve existing imported IDs. New IDs combine the mutex-allocated local
  sequence with a random UUID suffix, preventing collisions when independent branches
  later merge new task definitions. There is no distributed lease across worktrees;
  source promotion is confined to the claimed checkout, never a central deployment.
