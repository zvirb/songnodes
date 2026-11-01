HS8: Remove the dead harmonic-matching copies

Base: main at 62795a7. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Spec package M6-F3 in docs/specs/HARMONIC_SCORING.md (§1.2 "Dead copies", §4). Branch `hs8-remove-dead-matching`, PR title "HS8: Remove the dead harmonic-matching copies".

## Job
Delete the four harmonic-matching duplicates that nothing imports.

## Owned paths
- frontend/src/utils/harmonicMatching.ts (delete)
- frontend/src/utils/harmonicUtils.ts (delete)
- frontend/src/utils/intelligentBrowserUtils.ts (delete)
- frontend/src/components/IntelligentBrowser.legacy.tsx (delete)
- plan/agents/HS8_remove_dead_matching.md (this brief)

Deletions are allowed for the four files above, and only for them. Anything else is read-only.

## Do
1. Prove each file has no importers: static and dynamic imports, `import.meta.glob`, tests, route registration, `frontend/design-system-pending.txt`, `.oxlintrc.json`, `vite.config.ts`. If one is still imported, keep it and report.
2. Delete the files with no importers. Remove test files that only test them (none exist on 62795a7).
3. `frontend/design-system-pending.txt` already records `IntelligentBrowser.legacy.tsx` and `harmonicUtils.ts` as commented `# migrated` lines; the file's header says deleted files keep that record, so it is not edited.

## Done when
`git grep -n "harmonicMatching\|harmonicUtils\|intelligentBrowserUtils\|IntelligentBrowser.legacy" frontend/src` finds nothing, and the frontend still type-checks, lints, tests and builds.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; `python3 scripts/check_feature_imports.py --check`; scope guard.
