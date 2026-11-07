# Architectural improvements: design-system

Written 7 Nov 2026 by the data-flow investigation. 1 task for this sub-project.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `e469b41763f1`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

Each task is one job package (AGENTS.md rules 1–3: one verb, owned paths only, about 400 changed lines). UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns, and no local overrides; a missing pattern is added to the design system first.

## DS-T01: Publish 1.10.0 to the design-system artifact

- **Type:** design-system
- **Owned paths:** `design-system artifact 7f37707d`
- **Depends on:** –
- **Verification:** artifact tokens.json version is 1.10.0
- **Impact:** closes a release-process step

