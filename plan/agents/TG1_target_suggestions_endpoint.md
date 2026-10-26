TG1: Target tracks: suggestions endpoint based on crate and graph gaps

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "TG1: Target tracks: suggestions endpoint based on crate and graph gaps" on a branch starting with "tg1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:TG1 BEGIN/END). Depends on: G3. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add GET /api/v1/target-tracks/suggestions to the REST API, returning prioritized candidates for discovery and scraping.

## Context (verified on main 2026-10-26)
services/rest_api/routers/target_tracks.py only lists and creates target tracks. When the target queue is empty, background scrapers have zero work. Silver library tracks with high rotation or missing graph adjacencies are prime candidates.

## Owned paths
- services/rest_api/routers/target_tracks.py
- services/rest_api/target_suggestions.py
- tests/rest_api/test_target_suggestions.py

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/TG1/ if you need to record a decision.)

## Do
1. Implement target_suggestions.py: query candidate tracks from silver and graph projection.
2. Scoring rules: priority given to tracks played on >=2 Melbourne shows, tracks with 0 existing target/scrape records, and tracks in camelot keys with low graph edge density.
3. Endpoint GET /api/v1/target-tracks/suggestions?limit=20 returning: [{ title, artist, genres, rationale, priority_score }].
4. Honest error handling: 503 if DB pool uninitialized, empty list if no silver tracks exist.
5. Tests: mock database pool returning sample silver records; verify rationale generation and priority ordering.

## Done when (the reviewer's under-10-minute check; put it in the PR)
GET /api/v1/target-tracks/suggestions returns JSON array of suggested tracks with rationale (e.g. 'Heard on 3 shows').

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
