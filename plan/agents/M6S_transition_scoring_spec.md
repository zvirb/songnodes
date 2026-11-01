M6S: Transition scoring and energy move spec

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "M6S: Transition scoring and energy move spec" on a branch starting with "m6s-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:M6S BEGIN/END, added at the end of the file if missing). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Write the one tested-to-be harmonic scoring and energy move specification for milestone 6, and name the code packages that follow it. Docs only.

## Context (verified on main 2427bf9, 1 Nov 2026)
docs/IMPLEMENTATION_PLAN.md, Milestone 6 "Graph and scoring contract": one scoring spec over all 24 Camelot keys, circular boundaries, BPM half/double time, energy, missing features and confidence; deterministic energy moves `hold`, `step_up`, `lift`, `reset_drop`, `jarring` stored on edges with version and provenance; compatibility scores kept separate from path costs. None of the move labels exist in code. Overlapping utilities today (read-only): `SN.compat`, `SN.energyStep`, `SN.bpmStep` in frontend/src/lib/songnodes.tsx; `keyMove` in frontend/src/features/musicLibrary/setBuilder.ts; services/common/metadata/camelot.py; the edge build in services/common/datalayer/graph_projection.py; the design system's compatibility rules (design-system/, CompatPill card).

## Owned paths
- docs/TRANSITION_SCORING.md (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/M6S/ if you need to record a decision.)

## Do
1. Inventory each existing scoring utility (file, inputs, outputs, where they disagree), with line references.
2. The spec: key compatibility for all 24 keys with the wrap 12A to 1A; BPM including half and double time; energy delta and the five move labels with thresholds on the milestone-3 scale; unknown inputs giving no label (an en dash), never a guess; scoring version; score versus path cost.
3. A table of test cases the code packages must pass (at least every key pair class, the BPM edges, each move label and each unknown case).
4. The follow-up packages, each one job with owned paths and dependencies, in the shape of plan/RESTRUCTURE.md section 4 (for example: one shared scoring module with the test table; the move label on projected edges; the frontend reading the label). Do not write code or briefs for them.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The spec answers, for any two tracks with key, BPM and energy (or some missing), what score and move label they get, and the test table covers each rule.

## Checks
`git diff --check`; links and file references in the spec resolve. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
