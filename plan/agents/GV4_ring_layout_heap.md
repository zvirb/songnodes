GV4: Ring layout keeps up with a growing library

Base: main at 0d50d762 (design system 1.9.0). Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Change the design system at source (`design-system/source/bundle.src.js`, then `build_tokens.py` and `build_bundle.py`), bump the version per `design-system/17-governance.md`, re-sync. Open one PR titled "GV4: Ring layout keeps up with a growing library" on a branch starting with "gv4-". Edit only the lines inside your own STATUS.md slot (SLOT:GV4).

## Job
Make `SongNodes.ringLayout` fast enough for a library that grows exponentially, without changing a single seat.

## Context
Markus, 2 Nov 2026: the library is expected to grow exponentially. Measured in this session: 4,000 tracks took about 1.0–1.4 s and the time roughly quadrupled per doubling, because each placement scanned every track for the next one and built and sorted every seat of each ring it tried.

## Owned paths
- design-system/**
- frontend/src/styles/design-system/**
- plan/agents/GV4_ring_layout_heap.md
- STATUS.md (SLOT:GV4 only)

## Do
1. Next track from a binary heap with the scan's ordering (strongest seated link, then more links, then node order); unlinked fallback from a list sorted by links then node order.
2. Seats walked outward from the nearest one in both directions and merged by the sort's ordering (angle difference, then seat number), computed on demand.
3. Version 1.9.1 (a patch: same output, no signature change), governance entry, re-sync.

## Done when (reviewer check)
Same seats as 1.9.0 for the same input; 4,000 tracks under 200 ms in node.

## Checks
Old-vs-new equivalence script on random graphs; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python scripts/check_design_system.py --check`; frontend `npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; scope guard.
