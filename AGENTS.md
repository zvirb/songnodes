# Contributor instructions

## Working rules for agents (small-batch; these override anything looser below)

Every work package (Jules session, Claude/Cursor run or scheduled task) follows
these rules. They exist because large "fix everything" PRs on this repo silently
deleted other packages' merged work (see plan/RESTRUCTURE.md, section 1).

1. **One job.** A package has one verb, one input, one output and one failure
   mode. If the task as written needs "and" to describe, do the first part only
   and list the rest under "Follow-ups" in the PR.
2. **Owned paths only.** Create, edit or delete only the files listed under
   "Owned paths" in your brief. Never delete, move or rewrite a file you do not
   own, even to make a check pass. Never resolve a merge conflict by taking one
   side wholesale for files you do not own.
3. **Diff budget.** Aim for at most about 400 changed lines of non-test code and
   10 files. Generated files (lockfiles, fixtures) are listed separately. If the
   job cannot fit, stop at a working point and say what remains.
4. **Verify, then commit.** After each step run the checks in your brief. Commit
   only a step whose checks pass, one commit per step, with a message that says
   what the step does.
5. **Two attempts, then stop.** If the same check still fails after two fix
   attempts, stop. Open the PR as a draft with the failing command and its output.
   Do not widen your scope to chase it.
6. **Out-of-scope failures are reported, not fixed.** If CI or a check fails
   because of a file you do not own, say so in the PR (file, error, suspected
   owner). A separate one-job package fixes it.
7. **No unrequested refactors, renames, formatting sweeps or dependency bumps.**
   No scratch scripts (`patch_*.py`, `fix_*.py`, `run_tests.sh`) committed
   anywhere.
8. **Honest states, never mock data.** A page or endpoint shows real data, an
   explicit empty state, or an explicit error that names the cause. No mock or
   placeholder records in non-test code.
9. **Rebase before the PR.** Update from `main` immediately before opening the PR
   and re-run your checks. If `main` changed a file you own in a way you cannot
   reconcile within your scope, stop and say so.
10. **PR format.** Title `<CODE>: <task>`. Branch name starts with the code in
    lower case. The description lists: the one job; files added, changed and
    **deleted** (deleted must be empty unless the brief owns them); checks run
    and not run; a behavioural check the reviewer can do in under 10 minutes
    (what to open or call, what they should see); follow-ups.
11. **STATUS.md:** edit only the lines inside your own slot
    (`<!-- SLOT:<CODE> BEGIN -->` to `<!-- SLOT:<CODE> END -->`). If it is
    missing, add it at the end of the file and say so.

## Task tracking

At the beginning of every task, update your own slot in the repository-root
`STATUS.md` (see rule 11) with the task being started, its scope, and the next
concrete step. This is a user
requirement so work can be resumed across sessions.

Before stopping or completing a task, record what changed, the checks actually
run and their outcomes, unresolved issues, and the exact next task. Preserve
relevant previous results rather than replacing them with an unsupported
readiness claim.

## Design system (single source of truth)

All formatting and design decisions come from the SongNodes design system in
[design-system/](design-system/README.md). Before any UI or copy change, read its
README and the sections and component cards you are touching. Use tokens and `sn-*`
classes only, with no hex, px font sizes or emoji. Format through `SN.format`
(`frontend/src/lib/songnodes.tsx`). Never edit `frontend/src/styles/design-system/`
(it is synced by `scripts/sync-design-system.sh`). Where code and the system
disagree, the system wins. A gap in the system is proposed as a change to the
system, not patched locally. The design-system gates for each lifecycle phase are
in [docs/sdlc/SDLC.md](docs/sdlc/SDLC.md). Quick references:
[docs/design-system/](docs/design-system/README.md), including the rendered
`reference.html` and the code-only `CODE_REFERENCE.md`.

## Development

Use [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) as the maintained
architecture plan. Wave routing belongs to milestone 6; keep its UI feature flag
off until the replacement route finder is validated.

Before editing enrichment/provider clients or graph metadata, consult the plan's
WP1–WP5 metadata program and docs/requirements/TRACK_METADATA_RETRIEVAL.md. Preserve
unknown metadata; do not substitute invented BPM/key/energy values. Record live
provider validation and actual coverage separately from synthetic test results.

Use [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the tested minimal stack.
The historical README contains full-platform commands that do not match the
current checkout. Keep synthetic smoke-test data distinct from production data.

Cloud development does not require saving project files to the user's laptop.
If local laptop files are needed, the user prefers `D:\` to conserve `C:\` space.
