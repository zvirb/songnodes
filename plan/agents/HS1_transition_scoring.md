HS1: One transition scoring classifier with golden tests

Base: main at 62795a7. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "HS1: One transition scoring classifier with golden tests" on a branch starting with "hs1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:HS1 BEGIN/END, added at the end of the file if missing). Depends on: M6S spec `docs/specs/HARMONIC_SCORING.md` (merged) and the owner's answers to its §5 questions (2 Nov 2026). Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so.

## Job
Implement spec package M6-F1: one pure Python classifier for a directed transition (key verdict, BPM verdict with half/double time, energy move label, compatibility score, path cost), tested against every §3 worked example as golden data.

## Context (verified on main 62795a7, 1 Nov 2026)
`docs/specs/HARMONIC_SCORING.md` (`harmonic-1`) defines the rules in §2 and 24 worked examples in §3. Owner answers (2 Nov 2026): Q-E1 add `step_down` for −1; Q-E2 drops 2–4 `reset_drop`, drops 5+ and rises 4+ `jarring`; Q-B1 half/double time judged like a direct gap but capped at compatible, worded "half time"/"double time"; every other question takes the proposed default. Parsing reuses `common.metadata.camelot.to_camelot`, `tempo.known_bpm` and the `energy-1` contract.

## Owned paths
- docs/specs/HARMONIC_SCORING.md
- services/common/metadata/transition_scoring.py (new)
- services/common/tests/test_transition_scoring.py (new)
- tests/fixtures/harmonic_scoring/examples.json (new)
- plan/agents/HS1_transition_scoring.md (this brief)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/HS1/ if you need to record a decision.)

## Do
1. Record the owner's answers in spec §5 (an "Answer (2 Nov 2026)" column), update §2 and the §3 rows they touch, and mark `harmonic-1` accepted.
2. Write `transition_scoring.py` as pure functions with no I/O; unknown inputs stay unknown (never a clash, hold or zero gap).
3. Put every §3 row in `examples.json`; the tests read it, plus the §2.6 cost properties and all 576 key pairs.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd services && python -m pytest common/tests/test_transition_scoring.py -q` passes, and each row of `examples.json` matches the §3 table.

## Checks
`cd services && python -m pytest common/tests`; the scope guard. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups (M6-F2 parity test, M6-DS design-system words).
