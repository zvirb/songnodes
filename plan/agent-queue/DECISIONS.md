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
- D008 - 2026-11-13, user correction: a worker staged an unchecked proposal and declared the
  task complete. Added `precheck` (runs the verification gates on the exact proposal bytes) and
  made `stage` refuse proposals without a current passing precheck (Q013). Verification
  sandboxes moved to the system temp folder because Windows MAX_PATH broke copies of nested
  Playwright snapshot folders inside .runtime. Reverse only by replacing the gate with an
  equal or stronger one; never by letting unchecked proposals be staged.
- D009 - 2026-11-14, user: "always go ahead and apply". config.json mode changed from
  proposal-only to apply-verified (rule Q014). Verified proposals are applied by an independent
  integrator; moved baselines are rebuilt and re-verified, not forced. Backup of the previous
  config: plan/agent-queue/_archive/config.pre-apply-verified-20261114-2045.json. Reverse by
  restoring that file (mode proposal-only) and adding a Q-rule that supersedes Q014.
- D010 - 2026-11-15, user asked for design checks, checks of implemented features, invented
  features and full container rebuild tasks for e2e. Added role `e2e` to config.json (rule Q015) so
  rebuild tasks are never picked by the scheduled frontend runs, which cannot reach Docker. Wave
  import source: plan/agent-queue/imports/2026-11-15-wave/build_records.py. Backend items outside
  the writable boundary (SN-T02, SN-T05, MDB1, musicLibrary ML-T01..T06, UX-T05) were not queued.
  Reverse by restoring _archive/config.pre-e2e-role-20261115-1045.json and adding a rule that
  supersedes Q015; retire (never delete) any unclaimed e2e tasks.
- D011 - 2026-11-15, user chose "Widen queue" for the backend items. Added role `backend` and four
  writable paths (rule Q016); removed `services` from forbidden, leaving only the named router writable.
  Queued SN-T02, SN-T05 and SN-T06; MDB1 is superseded by SN-T05 and not queued. The musicLibrary
  ML-T01..T06 and UX-T05 tasks live in E:/musicLibrary, outside this queue's project root, so they
  cannot join it. Source: imports/2026-11-15-wave/build_backend_records.py. Reverse by restoring
  _archive/config.pre-backend-role-20261115-1110.json and a rule superseding Q016.
- D012 - 2026-11-15, planner-20261115-2141 (nightly planner, user authorization of 15 Nov 2026): proposed
  rule Q017. Evidence: of 105 tasks Done on 14-15 Nov, 86 were closed with outputs identical to their
  baseline (no change); integrator-batch6b closed 73 header-scroll tasks citing only the strict design-system
  check and tsc, and integrator-batch6a cites a 264-case Playwright audit whose output was not retained in the
  repo. Those tasks stay Done (terminal, Q006); their live check is already queued as WQ00157 (spec) and
  WQ00170 (e2e baseline), so no new task was added. Fitted to Q013 and D008 (Markus requires checks to
  actually run and unrun checks to be called "not run"). Reverse by restoring
  _archive/20261115-2141-planner/GOVERNANCE.md and adding a rule that supersedes Q017.
- D013 - 2026-11-15, planner-20261115-2141: no tasks added because 67 tasks are Ready (limit 30 for planner
  additions). No undefined steps were found in either STATUS.md or reports/. Reverse: not applicable.
- D014 - 2026-11-16, planner-20261116-2141: no tasks added, retired, split or returned to Ready. 66 tasks are
  Ready (58 frontend, 5 e2e, 3 backend), over the 30-task limit for planner additions; no duplicates or obsolete
  tasks found among them (the /sources/targets and /pipeline design checks WQ00124 and WQ00126 overlap the area
  of the newly Done WQ00111 but audit the whole page, so they stay). No new rule proposed: the only repeated
  issue (builder and integrator from one scheduled session) is already reported to Markus and is within Q012/Q014;
  changing it is his call. No undefined steps found. Fitted to D013 (same limit and outcome last night).
  Reverse: not applicable (nothing changed).
- D015 - 2026-11-17, Markus (B3 brief): SongNodes work that needs him (design questions, account steps, sign-offs) goes on a human lane. Added role `human` with no permissions to config.json (rule Q018) so the existing resolver cannot hand such a task to a worker; the tool already refuses stage for a role without `stage`. Seeded two human tasks from evidence in reports/20261116-planner.md (uncommitted working-tree changes on main; Docker not reachable from the device shell for the e2e tasks). Considered a separate file for human items: rejected, because the Queue Monitor and the planner read one catalog and the lane must show on the monitor. Known limit: `queue.py claim --role human` is not refused by the tool (it would then fail at stage); Q018 forbids it and the planner reports it as prompt drift. Reverse: restore _archive/config.pre-human-lane-20261117-1745.json, add a rule that supersedes Q018, and Retire the human tasks with a note.
- D016 - 2026-11-17, Markus in chat: no standing tasks in any queue ("we should never have a task that wastes tokens like this... it will get picked up over and over again when nothing needs to be run"). Added rule Q019 to GOVERNANCE.md and the rules table in QUEUE.md (same rule as Bean Alliance 57 and Personal Dashboard R25). Sweep of the 180 tasks found no standing task here. Fitted to Q018 (human lane). Reverse: restore _archive/20261117-1850-chat/GOVERNANCE.md and QUEUE.md rules table (task table unchanged).
