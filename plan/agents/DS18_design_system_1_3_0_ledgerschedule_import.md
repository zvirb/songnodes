DS18: Design system 1.3.0: calendar and text inset from LedgerSchedule

Base: main at 265a9df. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Open one PR against main titled "DS18: Design system 1.3.0: calendar and text inset from LedgerSchedule" on a branch starting with "ds18-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:DS18 BEGIN/END). Depends on: nothing.

## Job
Bring the SongNodes design system from 1.2.0 to 1.3.0, as published in the design-system artifact on 28 Oct 2026, and re-sync the frontend copy. 1.3.0 imports the LedgerSchedule / BeanAlliance v4.17–v4.17.3 updates on spacing and the calendar, fitted to SongNodes' themes.

## Context (verified on main 2026-10-28)
`design-system/` is the mirrored source of truth (CLAUDE.md section 4); `frontend/src/styles/design-system/` is written only by `scripts/sync-design-system.sh`. This is a mirror of an already-built system, so the line count is the generated bundle, not hand edits: the ~400-line package limit does not fit a sync, and the React work is split out into DS19.

## Owned paths
- design-system/**
- frontend/src/styles/design-system/**
- plan/agents/DS18_design_system_1_3_0_ledgerschedule_import.md

(Complete list.)

## Do
1. Copy the 1.3.0 files from the artifact into `design-system/` (new: `components/DateRange/`, `source/css/25-date-range.css`, `api/components/DateRange.md`).
2. `PYTHONUTF8=1 bash scripts/sync-design-system.sh`.

## Done when
`PYTHONUTF8=1 bash scripts/sync-design-system.sh --check` and `python3 scripts/check_design_system.py --check` pass; `design-system/17-governance.md` has the 1.3.0 entry.

## Checks
The design-system checks above, plus the frontend type-check, lint and unit tests (no React code changes; the synced bundle.css changes).

## Hand-back
Files changed, checks run and not run, follow-ups (DS19: React DateRange, FileDrop, StagedProgress).
