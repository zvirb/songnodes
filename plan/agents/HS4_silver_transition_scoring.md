HS4: Silver transitions store their harmonic scoring

Base: main at a071a2e. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md. Open one PR against main titled "HS4: Silver transitions store their harmonic scoring" on a branch starting with "hs4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:HS4 BEGIN/END, added at the end of the file if missing). Depends on: HS1 (#497, `common.metadata.transition_scoring.score_transition`). Before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths.

## Job
Implement spec package M6-P1 (docs/specs/HARMONIC_SCORING.md section 4): store the section 2.7 scoring fields on observed Silver transitions, written at ingest time from the two tracks' key, BPM and energy, with an idempotent backfill for existing rows. Unknown inputs stay unknown (NULL).

## Owned paths
- sql/migrations/270_transition_scoring_up.sql (new)
- sql/migrations/270_transition_scoring_down.sql (new)
- scripts/start-dev.sh (apply 270 and queue the one-shot backfill job)
- services/common/datalayer/transition_scores.py (new: column mapping, writer values, backfill)
- services/common/datalayer/ingest.py (the bronze to silver transition writer)
- services/common/datalayer/handlers.py (the `transition_scoring` job kind)
- services/common/tests/test_transition_scores_store.py (new)
- plan/agents/HS4_silver_transition_scoring.md (this brief)

(Complete list. Graph projection (M6-P2), the REST API and the graph API (M6-R1, M6-U1) are other packages.)

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd services && python -m pytest common/tests/test_transition_scores_store.py -q` passes; on a running stack after `bash scripts/start-dev.sh`, `SELECT scoring_version, count(*) FROM silver_track_transitions GROUP BY 1` shows every row at `harmonic-1` once the worker has drained the `transition_scoring` job.

## Checks
`cd services && python -m pytest common/tests`; the scope guard.
