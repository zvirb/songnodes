IB1: Recommendation rows no longer overlap the reason text

Base: main at 07567b3. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md; the design system decides the row markup. Branch `ib1-track-row-reason-overlap`; edit only your STATUS.md slot (SLOT:IB1).

## Job
Make each Intelligent Browser ("Up next") recommendation row show its reason inside its own meta line, never painted over the next row's title.

## Context (owner report, 2 Nov 2026, screenshot)
Reasons ("Perfect harmonic match", "Harmonically compatible") showed over the title line of the row below, clipped at the left by that row's artwork thumb. Root cause: the list is virtualised with absolutely positioned rows of a fixed 64px (`height: virtualItem.size`; `measureElement` is configured but no row is ever measured), while the row content was three lines tall: a 32px thumb in the title line, a wrapping meta line (`flex-wrap: wrap`) and the reason (`sn-track-cell__mix`, used outside `sn-track-cell__meta`, so it had no ellipsis rule and wrapped onto its own line). The overflow spilled into the next row, whose thumb covered the first letters.

## Owned paths
- frontend/src/components/IntelligentBrowser/TrackItem.tsx
- frontend/src/components/IntelligentBrowser/TrackItem.test.tsx (new)
- frontend/src/components/IntelligentBrowser/IntelligentBrowser.tsx (row height constant only)
- frontend/src/components/IntelligentBrowser/IntelligentBrowser.module.css (row styles only)
- plan/agents/IB1_track_row_reason_overlap.md (this file)
- STATUS.md (SLOT:IB1 only)

## Do
1. Row identity uses the TrackCell card markup (`sn-track-cell` → `__title` > `__name` with `__artist`; `__meta` with BPM, key, `__dur`, genre tag, `__sep`, `__mix` for the reason). The meta line is one line; the reason ellipsises (`title` holds the full text).
2. Artwork thumb sits beside the cell, not in the title line.
3. Virtual row height is derived: `TRACK_ROW_HEIGHT` = row-two-line (56) + 2 × space-2 = 72, used as the virtualiser's size; rows clip (`overflow: hidden`) so nothing paints into the next row.
4. Vitest: the reason renders inside `sn-track-cell__meta`, the cell follows the card, the row height is 72.

## Not in scope
The low score band ("35 weak" next to a perfect key match): scoring in `utils.ts` is unchanged; explained in the PR as a follow-up.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; scope guard.
