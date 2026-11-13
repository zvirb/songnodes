# SongNodes agent queue

Precedence: explicit user authorization/platform restrictions; AGENTS.md hard
boundaries; numbered queue rules; RUN-GUIDE.md; individual tasks and worker defaults.
QUEUE.md contains the portable catalog and readable task table. Current branch
execution state is authoritative only in ignored .runtime/ (Q011). Never edit these
records by hand. All tools take the same OS metadata mutex for metadata updates.

| Rule | Requirement and reason | Date and source |
| --- | --- | --- |
| Q001 | One task, owned paths, small batches; prevents lost merged work. | 2026-11-13, AGENTS.md 1–7 |
| Q002 | Read current AGENTS.md, standards, this governance, run guide, dependencies and recent status before claiming. Durable files outrank old chat instructions. | 2026-11-13, attached queue prompt §3 |
| Q003 | Claims are cooperative writer locks. No edits before full acquisition; OS mutex serializes claims and metadata. Special `_folder` conflicts with everything; folder locks conflict with descendants; files conflict at the same resolved path; `_shared` and `_apply` conflict with themselves and `_folder`. | 2026-11-13, attached prompt §4 |
| Q004 | Workers stage proposals only. No source promotion, deployment, pushes, merges, container/DB changes or destructive commands. This first package does not implement apply or Done transitions. | 2026-11-13, attached prompt smallest-working-queue instruction; AGENTS.md small-batch limit |
| Q005 | Stale age alone never proves abandonment. Operator must identify an abandoned run before recovery. Old tokens cannot heartbeat, release or stage afterward. | 2026-11-13, attached prompt §4 |
| Q006 | Preserve IDs, event history, unrelated tasks and references. Never silently reopen terminal tasks; add a linked follow-up. Derived views replay from QUEUE.md after a crash. | 2026-11-13, attached prompt §2, §6 |
| Q007 | The design system at design-system/ is authoritative; synced styles and reference folders are read-only. Unknown metadata stays unknown. | 2026-11-13, AGENTS.md |
| Q008 | Record actual tests, failures and exact remainder. No Done from worker assertions. Proposal staging is Waiting, never applied or deployed. | 2026-11-13, attached prompt §8–9 |
| Q009 | No schedules or automatic workers are enabled. Adding tasks does not authorize executing them. | 2026-11-13, user requested queue construction and backlog import |
| Q010 | Supersedes Q004's implementation limit: verification, guarded apply, rollback, completion recovery, planner transitions and deferred records are implemented. Source application remains disabled by the project configuration until explicitly authorized. This operator's requested Git commit/sync is authorized separately. | 2026-11-13, user: finish implementing the lock system first; then commit and sync |
| Q011 | QUEUE.md is the versioned task catalog and portable terminal evidence. Authoritative current ownership/task execution state is local `.runtime/<branch>/state.json`. Logs, leases, staged output and recovery journals are ignored by Git and never imported from another branch. Catalog states are portable baselines, not a live monitor. | 2026-11-13, user: locks must not enter commits or block new branches from main |
| Q012 | Verification runs configured commands in an isolated input snapshot with proposed outputs. Apply requires passed checks, unchanged baselines/shared sources, an independent integrator's criteria review and an enabled mode. Rollback retains prior terminal history and uses a linked follow-up claim. | 2026-11-13, attached prompt acceptance criteria |

Rule numbers are permanent. Supersede with a new rule and a DECISIONS.md entry;
never delete historical rationale. Project timezone is Australia/Sydney; timestamps
are stored as UTC offsets with this timezone named explicitly in events.
