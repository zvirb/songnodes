# SongNodes queue run guide

Run `python -X utf8 plan/agent-queue/tools/queue.py COMMAND` from the repo root.
Read AGENTS.md, GOVERNANCE.md, the task/dependencies and recent local status first.

## Git and restart safety

QUEUE.md is the portable catalog of tasks and terminal evidence; its baseline states
are not a live monitor. Current execution state is authoritative only in ignored
`.runtime/<branch-hash>/state.json`. Logs, leases, snapshots, pending verification,
markers and rollback journals replay from that state. New branches inherit task
records but no claims. Returning to the original branch restores its local run.
Separate worktrees have separate runtimes. Branch renames require explicit operator
reconciliation. Never switch a worker checkout mid-run; use isolated worktrees.

Commit documentation, configuration, tools, task catalog and immutable audit input.
Ignore rules exclude runtime state and raw proposals. Before committing run
`git-check`; it also detects force-added local artifacts and active catalog owners.
The root STATUS.md is a bootstrap index; live append-only history is local.
This is cooperative local-filesystem locking, not authentication or a sandbox.
Network shares and independent copies of the queue are unsupported.

## Commands

```text
status --json
resolve shell
claim --agent RUN --role frontend --tasks WQ00001
heartbeat --agent RUN --claim TOKEN
held --agent RUN
release --agent RUN --claim TOKEN --note "Exact remainder"
stage plan/agent-queue/reports/RUN/proposal --agent RUN --claim TOKEN
claim --agent REVIEWER --role integrator --tasks WQ00001
verify --agent REVIEWER --claim REVIEW_TOKEN --proposal STAGE_TOKEN
apply --agent REVIEWER --claim REVIEW_TOKEN --proposal STAGE_TOKEN --note "Independent criteria review and evidence"
recover-apply --agent REVIEWER --claim REVIEW_TOKEN
rollback --agent REVIEWER --claim FOLLOWUP_TOKEN --proposal APPLIED_TOKEN
transition --tasks WQ00001 --state Ready --note "Blocker resolved"
transition --tasks WQ00001 --state Split --children WQ00002 WQ00003 --note "Precise split"
transition --tasks WQ00001 --state Retired --note "Replacement and rationale"
defer --tasks WQ00001 --batch WQ00100 --note "Pending verification"
break-stale --agent OPERATOR --abandoned RUN
validate
repair
git-check
```

Apply/rollback refuse to run in the current proposal-only mode. Changing mode to
apply-verified requires explicit project authorization. The user's operator Git
commit/sync request is separate from worker permissions. No deployment, DB action,
provider edit, push, merge or automatic worker/schedule is enabled.

## Worker prompt

Read current governing files and applicable design-system cards. Select one Ready
task by priority, dependencies and role. Reproduce the observation before editing:
audit observations may be false positives or share a root cause. Resolve every
output/build unit and claim with a unique run ID. BUSY is prompt and retryable;
never edit after partial acquisition. Folder locks exclude descendants; independent
files can run concurrently. Claims snapshot baselines and shared-source versions.
Use an isolated worktree; preserve unrelated dirty files. Heartbeat every 10 minutes.
Write complete proposals under reports/RUN/proposal using repository-relative paths.
Stage copies immutable evidence and returns tasks to Waiting. Record actual tests,
git rollback reference and exact remainder. Two failed fix attempts stop the run.
Never describe a staged result as applied or deployed.

## Integrator prompt

Claim staged Waiting tasks as integrator. Verify uses an isolated Git snapshot of
configured inputs with the proposed outputs overlaid. Existing frontend dependencies
are linked for read access; checks must not change dependency installations. Checks
run outside the metadata mutex and ownership is rechecked afterwards. Setup/test
failures retain proposals and command results and return tasks to Waiting.

Apply, if authorized, requires passed checks, unchanged baselines/shared sources,
exact verified outputs, a reviewer different from the builder and explicit criteria
review. It checks the short _apply/_shared window, saves backups and a durable
journal before writing, then records Done with evidence. It never deploys. Recovered
tokens cannot apply. Interrupted finalization replays recover-apply idempotently.
Partial promotion must be rolled back under a current authorized claim; external
changes cause refusal. Rollback preserves prior Done history: create a linked
follow-up claim first. Completed evidence is portable; rollback bytes remain local.
Git commits provide the long-term rollback point after sync.

## Planner prompt

Validate task states, locks, markers and evidence. Show stale ownership separately
from task state. Age alone never proves abandonment: contact/check the worker and
attest that the exact named run is abandoned before break-stale. It retains history
and invalidates the old token. Repair regenerates interrupted derived views. Pending
integration journals require recovery or rollback under a current authorized claim.
Terminal tasks never reopen. Retirement protects resources; splitting requires
existing child IDs. Deferred checks need a verification-task owner, whose completion
resolves the pending record before the affected task can return Ready. Add linked
follow-ups with `add records.json`; origins deduplicate and IDs are immutable.

## Reproduction and checks

`tools/import_audit.py REPORT.json` preserves distinct route/rule/message/axe-target
observations and every display-matrix occurrence. reports/design-system-audit.json
is immutable evidence. Coverage gaps are separate verification tasks. The historical
dated tracker is untouched. BUILD-UNITS.csv documents the resolver configuration.

```sh
python -X utf8 -m pytest tests/test_agent_queue.py
python -X utf8 plan/agent-queue/tools/queue.py validate
python -X utf8 plan/agent-queue/tools/queue.py git-check
```

Before pushing follow AGENTS.md: fetch main, inspect deletions, update from main
and rerun checks. The queue supplies no exception to that protocol.
