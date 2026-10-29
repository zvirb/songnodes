E1: Local MusicBrainz provider in the enrichment waterfall

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "E1: Local MusicBrainz provider in the enrichment waterfall" on a branch starting with "e1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:E1 BEGIN/END). Depends on: C1. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add the local MusicBrainz provider (refmb) to the enrichment provider list ahead of the web provider.

## Context (verified on main 2026-10-26)
services/common/refmb/provider.py is built; services/common/providers/list_providers.py lists the providers; enrichment calls them in order. The local provider needs REFMB_DATABASE_URL; when unset or unreachable it returns None (skip).

## Owned paths
- services/common/providers/list_providers.py
- services/common/providers/musicbrainz_local.py
- services/common/tests/test_mb_local_provider.py
- docs/enrichment/providers.md
- plan/agents/E1_mb_local_provider.md

## Do
1. Register the local provider in list_providers ahead of the web MusicBrainz provider.
2. Graceful skip: no database -> returns None immediately, no exception, no network call.
3. Test with a mock refmb database: finds a track, returns fields matching the provider contract; returns None on no match.
4. docs/enrichment/providers.md: updated order and required environment variable.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python -m pytest services/common/tests/test_mb_local_provider.py` passes and prints the provider chain showing local ahead of web.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
