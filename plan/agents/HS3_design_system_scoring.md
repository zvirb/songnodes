HS3: Design system speaks the accepted harmonic scoring

Base: main. Repo: zvirb/songnodes. Spec package M6-DS in docs/specs/HARMONIC_SCORING.md (accepted; owner answers in §5, 2 Nov 2026). Change the design system at its source so `SongNodes.bpmStep`, `energyStep` and the energy-move words agree with `harmonic-1` and the HS1 classifier (`services/common/metadata/transition_scoring.py`, fixture `tests/fixtures/harmonic_scoring/examples.json`): half/double time judged like a direct gap capped at compatible, "half time"/"double time" (Q-B1); absolute gap rounded half up (Q-B2); fractional energy rounded half away from zero (Q-E3); `step_down` (Q-E1); "trough reset" narrowed to drops of 2–4, drops of 5+ and rises of 4+ jarring (Q-E2); the energy move `lift` worded apart from the "+7 lift" key move (Q-E6); the missing −2 row in 11-data-display; the tiers-vs-bands note (Q-E5). Record DR-056, bump to 1.8.0 (new fields and a helper: minor), rebuild with build_tokens.py and build_bundle.py, re-sync with scripts/sync-design-system.sh. Frontend usages change only if tsc or vitest break.

## Owned paths
- design-system/**
- frontend/src/styles/design-system/**
- STATUS.md (HS3 slot only)
- plan/agents/HS3_design_system_scoring.md
