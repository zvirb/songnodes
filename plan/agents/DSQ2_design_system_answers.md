DSQ2: Design system 1.7.1: record the owner's answers to Q23–Q27

Base: main. Repo: zvirb/songnodes. Markus answered Q23–Q27 (the 1.6.0 fitted choices) on 2 Nov 2026 (Melbourne). Record them as DR-051 to DR-055 in design-system/17-governance.md, close the questions, and change the design-system source where an answer differs from what DS25 built. Q23–Q26 match the 1.6.0 build; Q27 does not (InfoTip opens after 500 ms on hover, like Tooltip, not at once), so `SongNodes.infoTips` and the InfoTip card change. Patch bump to 1.7.1 (a changed value, nothing added), rebuild with build_tokens.py and build_bundle.py, and re-sync the frontend copy with scripts/sync-design-system.sh. No React InfoTip port exists in frontend/src/components/ds, so no React code changes.

## Owned paths
- design-system/**
- frontend/src/styles/design-system/**
- docs/sdlc/SDLC.md
- STATUS.md (DSQ2 slot only)
- plan/agents/DSQ2_design_system_answers.md
