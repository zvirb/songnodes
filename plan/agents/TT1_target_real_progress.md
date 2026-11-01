TT1: Target tracks show real search progress, not a hand-set slider

Base: main at ae56475. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md; the design system rules apply. Branch `tt1-target-real-progress`. Edit only the lines inside your own STATUS.md slot (SLOT:TT1).

## Job
Replace the per-target "Progress: N%" bar and its range slider on /sources/targets (a hand-typed `completion_percentage` saved back to the API) with an honest search status built from real data: `last_searched`, `playlists_found` and the scrape jobs of the target's latest search.

## Context (owner report, 2 Nov 2026)
"why is there a slider below progress that moves progress? shouldn't it show real ingestion or search progress?" No backend computes a completion percentage; the slider wrote whatever the user dragged it to.

## Owned paths
- frontend/src/components/TargetTracksManager.tsx
- frontend/src/components/TargetTracksManager.css
- frontend/src/components/TargetTracksManager.test.tsx
- frontend/src/components/targetSearchStatus.ts (new)
- frontend/src/components/targetSearchStatus.test.ts (new)
- services/rest_api/routers/target_tracks.py (`list_targets` only)
- tests/rest_api/test_target_tracks_search_jobs.py (new)
- plan/agents/TT1_target_real_progress.md (this brief)
- STATUS.md (SLOT:TT1 only)

## Do
1. `GET /api/v1/target-tracks` adds `search_jobs` per target: counts of the latest search's scrape jobs (created at or after `last_searched`, the rule `record_playlists_found` uses) by status, the newest finish time and the newest failure message.
2. The row shows a StatusPill plus one detail line: Never searched / Queued / Searching… (n of m sources done) / Searched <date, time> · N playlists found / Partly done / Search failed (with a Retry search action). No percentage.
3. Remove the slider, the bar and `handleUpdateCompletion`. The embedded "pending" filter uses the real status (everything not finished).
4. Leave the `completion_percentage` column and the PUT field alone (the integration test still sends it); dropping them is a separate package with a migration.

## Checks
Frontend: tsc, oxlint, vitest, vite build, `sync-design-system.sh --check`, `check_design_system.py --check`. Backend: `python -m pytest tests/rest_api`. Scope guard.
