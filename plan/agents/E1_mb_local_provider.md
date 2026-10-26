E1: Local MusicBrainz provider in the enrichment waterfall

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "E1: Local MusicBrainz provider in the enrichment waterfall" on a branch starting with "e1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:E1 BEGIN/END). Depends on: C1. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add MusicBrainzLocalProvider, using the local resolver, ahead of the web MusicBrainz provider.

## Context (verified on main 2026-10-26)
Providers: services/common/providers/base.py (Provider protocol), musicbrainz.py (the web provider), registry.py build_providers(); evidence via datalayer.evidence.record. ref_mb is a separate read-only database; everything is behind MB_LOCAL_ENABLED (default off). Migrations 160-169 are yours.

## Owned paths
- services/common/providers/musicbrainz_local.py
- services/common/providers/registry.py (only the block that builds musicbrainz_local)
- sql/migrations/16[0-9]_*
- tests/enrichment_local/test_provider.py
- docs/integration/WP4/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/E1/ if you need to record a decision.)

## Do
1. Implement Provider; no network. Fields carry source musicbrainz_local, matched_by, confidence, dump_version, licence (CC0; CC-BY-NC-SA-3.0 for tag-derived genre). Evidence through evidence.record only.
2. Waterfall seed rows (up/down) placing it before the web provider for mbid, isrc, label, release_date, genre, aliases and external ids, using the existing waterfall configuration mechanism.
3. Off unless MB_LOCAL_ENABLED is true; tests use a throwaway Postgres built from the real ref_mb column lists, never the real database.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Tests show the provider filling fields from the fixture and doing nothing when MB_LOCAL_ENABLED is unset.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
