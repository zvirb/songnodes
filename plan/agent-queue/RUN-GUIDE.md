# SongNodes queue run guide

Run `python -X utf8 plan/agent-queue/tools/queue.py COMMAND` from the repo root.
Read AGENTS.md, GOVERNANCE.md, the task/dependencies and recent local status first.

## Store: the queue database (Q026, since 2026-11-21)

1. Source of truth on main: `plan/agent-queue/qdb/queue.db`, while `qdb/queue-db.json` says `"mode": "authoritative"` and `"branch": "main"`. Only tools/queue.py writes it (inside the .mutex, on a private temp copy renamed over the shared file).
2. QUEUE.md and `.runtime/<branch-hash>/state.json` are generated views, rewritten by the tool after every change. Never edit them, queue.db or queue-db.json by hand.
3. Read tasks with qdb.py from the Queue Monitor folder (D:\beanAllianceOne\build\queue-monitor\docker\standalone\qdb.py; device VM: `$HOME/mnt/beanAllianceOne/build/queue-monitor/docker/standalone/qdb.py`), never by reading the 1 MB QUEUE.md table: `qdb.py ready plan/agent-queue --band`, `qdb.py show plan/agent-queue ID`, `qdb.py info plan/agent-queue`. Device VM: `export QDB_TMP=/tmp` first. Change state only with queue.py commands.
4. Other branches and worktrees keep the older store described below (QUEUE.md catalog plus branch-local state.json).
5. If the tool refuses with "state.json changed outside the queue database", stop and report it. The operator adopts the file with `qdb-import` or returns to the older store with `qdb-import --state shadow` (nothing is lost: state.json is a full mirror). Return to the database with `qdb-import --state authoritative`, which flips only when the regenerated views are byte-identical.

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
precheck plan/agent-queue/reports/RUN/proposal --agent RUN --claim TOKEN
stage plan/agent-queue/reports/RUN/proposal --agent RUN --claim TOKEN
claim --agent REVIEWER --role integrator --tasks WQ00001
verify --agent REVIEWER --claim REVIEW_TOKEN --proposal STAGE_TOKEN
apply --agent REVIEWER --claim REVIEW_TOKEN --proposal STAGE_TOKEN --note "Independent criteria review and evidence"
recover-apply --agent REVIEWER --claim REVIEW_TOKEN
rollback --agent REVIEWER --claim FOLLOWUP_TOKEN --proposal APPLIED_TOKEN
transition --tasks WQ00001 --state Ready --note "Blocker resolved"
transition --tasks WQ00001 --state Split --children WQ00002 WQ00003 --note "Precise split"
transition --tasks WQ00001 --state Retired --note "Replacement and rationale"
amend --tasks WQ00001 --note "Reason" [--dependencies ... --criteria ... --description ... --priority N --resources ... --set-role ROLE]
defer --tasks WQ00001 --batch WQ00100 --note "Pending verification"
break-stale --agent OPERATOR --abandoned RUN
validate
repair
git-check
qdb-import [--state authoritative|shadow]
```

Mode is apply-verified since 2026-11-14 (Q014, D009; user: "always go ahead and apply").
A task is finished when an integrator (a run id different from the builder) has verified
and applied its staged proposal, recording Done. A moved baseline is rebuilt on the current
file and re-verified, never forced.

Device shell (Linux VM on tuf-boi): export TMPDIR=$HOME/mnt/songnodes/plan/agent-queue/.runtime/sandboxes
before verify/precheck (the VM temp disk is too small). TypeScript 7 needs its Linux binary
frontend/node_modules/@typescript/typescript-linux-x64 (installed 2026-11-14, same version).
Each verify takes about 40 s; run one per shell call (calls stop at 180 s). The user's operator Git
commit/sync request is separate from worker permissions. No deployment, DB action,
provider edit, push, merge or automatic worker/schedule is enabled.

## Worker prompt

Write every note, STATUS slot, report and summary of work done by Q021 (i-have-adhd write-up style): outcome and next action for Markus first, what now works in concrete terms, numbered items, state of each, no preamble or recap.

Read current governing files and applicable design-system cards. Select one Ready
task by priority, dependencies and role. Reproduce the observation before editing:
audit observations may be false positives or share a root cause. Resolve every
output/build unit and claim with a unique run ID. BUSY is prompt and retryable;
never edit after partial acquisition. Folder locks exclude descendants; independent
files can run concurrently. Claims snapshot baselines and shared-source versions.
Use an isolated worktree; preserve unrelated dirty files. Heartbeat every 10 minutes.
Write complete proposals under reports/RUN/proposal using repository-relative paths.
Run `precheck` on the proposal until it passes (exit 0); `stage` refuses proposals that
were not prechecked, failed, or changed afterwards. Do not stop after writing a proposal.
Test only in isolated copies (precheck, a temp worktree), never by editing the live tree.
Stage copies immutable evidence and returns tasks to Waiting. Record actual tests,
git rollback reference and exact remainder. Two failed fix attempts stop the run.
Never describe a staged result as applied or deployed.

## Integrator prompt

Write every note, STATUS slot, report and summary of work done by Q021 (i-have-adhd write-up style): outcome and next action for Markus first, what now works in concrete terms, numbered items, state of each, no preamble or recap.

Claim staged Waiting tasks as integrator, with a run id different from the one that staged them: `verify` refuses the stager's own agent name (Q026). Verify uses an isolated Git snapshot of
(Q022, Q024: when Codex has credits, also run a read-only Codex CLI review of the proposal's worktree against the task criteria and record it in the apply note; never wait for it. Codex never stages or applies.)
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

Write every note, STATUS slot, report and summary of work done by Q021 (i-have-adhd write-up style): outcome and next action for Markus first, what now works in concrete terms, numbered items, state of each, no preamble or recap.

Validate task states, locks, markers and evidence. Show stale ownership separately
(Q023: when adding or reshaping tasks, group same-rule findings into one root-cause task, note which check tasks to claim together, plan one container rebuild per wave, split anything over the ~400-line budget and use `amend` for open tasks. Roles `e2e` and `backend` go to any run with a tuf-boi shell that reaches Docker and pytest (Q024).)
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

Device VM: `python3 -m pytest -o addopts= --noconftest tests/test_agent_queue.py` (the repo conftest imports docker; pytest via `pip3 install --user pytest`).

```sh
python -X utf8 -m pytest tests/test_agent_queue.py
python -X utf8 plan/agent-queue/tools/queue.py validate
python -X utf8 plan/agent-queue/tools/queue.py git-check
```

Before pushing follow AGENTS.md: fetch main, inspect deletions, update from main
and rerun checks. The queue supplies no exception to that protocol.

## Queue Monitor refresh (every run, last step)

The Queue Monitor is the Dashboard artifact https://claude.ai/artifact/3bm8Kqg3SPBuMD9WHiH24L (slug 150cc260-fb70-426a-9d83-3cbd4fd65f35). It is the current queue page. The older "SongNodes Work Queue" page (https://claude.ai/artifact/3LMop46JU62EFnuf1ZBmQB, from plan/work-queue-2026-10-30) is retired: do not refresh it and do not add tasks to that older system.

It reads four CSV files that nothing updates by itself. After your queue work is finished (and before you stop), refresh it:

1. From the repo root: `python3 -X utf8 plan/agent-queue/tools/monitor_refresh.py`. It reads the ignored runtime state read-only and writes queue_tasks.csv, events.csv, runs.csv and locks.csv to plan/agent-queue/monitor/ (ignored; derived data). It counts complete tasks two ways (task states and completed events) and exits 3 if they disagree: report that in your run note and still publish.
2. Stage the four files with the device stage tool, then `upload_asset` them to the monitor slug.
3. `db_write` op `update` on `datasets/tasks`, `datasets/events`, `datasets/runs` and `datasets/locks`: set `source.url` to the new `/_blob/...` url, pass `ifVersion` from `db_get`, and set `updated` (at, by) and `edit` (via claude, at). The tasks file is `queue_tasks.csv`.
4. Check by `db_get` of each dataset that `source.url` is the new blob, and compare the monitor's complete and open counts with the script's printed counts.
5. If a write is refused ("needs an editor"), do not retry. Note it in your run report under For Markus.

The refresh publishes nothing but those four datasets. Never write a design system version number into any queue row or task text; say "the current design system".

## Human lane (Q018)

Role `human` has no permissions. Never claim, stage or verify with `--role human`. Tasks with role `human` are questions or steps for Markus; list the open ones in your report under For Markus, do not answer or close them, and let anything that depends on them wait. Design questions for Markus go to him as a rendered options page; that page is human housekeeping, not a doc (docs/CATEGORIES.md, category H).
