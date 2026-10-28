DS19: React DateRange, FileDrop and StagedProgress

Base: main at 34bd016 (includes DS18, PR #356, merged 2026-10-28: 1.3.0's synced bundle.css and types). Started stacked on ds18-design-system-1-3-0 at 05d13ef and rebased once #356 merged. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Push a branch starting with "ds19-"; the lead opens the PR titled "DS19: React DateRange, FileDrop and StagedProgress"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:DS19 BEGIN/END). Depends on: DS18 (design system 1.3.0).

## Job
Add the React components for three design-system components that have no React implementation yet: FileDrop and StagedProgress (1.2.0) and DateRange (new in 1.3.0), matching their published specs, and export them from the ds bridge.

## Context (verified on main 2026-10-28)
`frontend/src/components/ds/` holds the React bridge (`index.tsx`, plus `AutocompleteSearchField.tsx` re-exported from it). `SN` in `frontend/src/lib/songnodes.tsx` already types `SN.calendar`, `SN.format.range` and `SN.format.dayLong` from bundle.js 1.3.0, so DateRange uses them and does not reimplement the calendar maths. Three components plus tests exceed the ~400-line budget; Markus asked for all three in one package.

## Owned paths
- frontend/src/components/ds/FileDrop.tsx
- frontend/src/components/ds/FileDrop.test.tsx
- frontend/src/components/ds/StagedProgress.tsx
- frontend/src/components/ds/StagedProgress.test.tsx
- frontend/src/components/ds/DateRange.tsx
- frontend/src/components/ds/DateRange.test.tsx
- frontend/src/components/ds/index.tsx (exports only)
- plan/agents/DS19_react_daterange_filedrop_staged_progress.md
- STATUS.md (only the SLOT:DS19 block, appended at the end)

(Complete list.)

## Do
1. FileDrop: spec `design-system/components/FileDrop/` and `api/components/FileDrop.md`; types `FileDropProps`; classes `.sn-file-drop*`.
2. StagedProgress: spec `design-system/components/StagedProgress/`; types `StagedProgressProps`; classes `.sn-staged-progress*`.
3. DateRange: spec `design-system/components/DateRange/`; types `DateRangeProps`, `DateRangeMark`, `DateRangePreset`; classes in `source/css/25-date-range.css`; markup, ARIA and keys as `SongNodes.dateRange` in `source/bundle.src.js`.
4. Tests (vitest + testing-library) for each; export all three and their prop types from `index.tsx`.

## Done when
`npx vitest run src/components/ds` passes and the three components render the preview markup.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; `python3 scripts/scope_guard.py --base origin/main --head HEAD --title "DS19: React DateRange, FileDrop and StagedProgress" --branch ds19-react-daterange-filedrop-staged`. Lint must not get worse.

## Hand-back
Files changed, checks run and not run, spec ambiguities and how they were resolved, follow-ups (adopt in TargetTracksManager, TracklistImporter, ScraperProgressPage, AuthCallback per design-system/19-songnodes-migration.md).
