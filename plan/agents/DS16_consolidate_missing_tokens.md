DS16: Consolidate missing design-system tokens from all audits

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md (section 4, the design system, is mandatory). No access to the user's laptop, local data or secrets; work from the repo only. Open one PR against main; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:DS16 BEGIN/END). Send this package only after the DS1 to DS15 PRs are merged.

## Task
Read every docs/design-system/audits/DS*.md. Produce docs/design-system/audits/MISSING_TOKENS.md:
1. De-duplicated list of all MISSING TOKEN findings across pages, merged where the same need appears more than once, with the count of uses and every file:line.
2. For each, a concrete proposal: token name (following the naming pattern in design-system/tokens.css), value with units, the design-system section and the source file it belongs in under design-system/source/, and whether an existing token could cover it instead (with reasoning).
3. The same for MISSING COMPONENTS AND PATTERNS and for requested exceptions.
4. A proposed version bump per design-system/17-governance.md and the exact steps (edit source, build_tokens.py, build_bundle.py, scripts/sync-design-system.sh) for the maintainers to run.
5. A short table of which audit pages are clean.
Owned paths: docs/design-system/audits/MISSING_TOKENS.md only. Do NOT edit design-system/, frontend/src/styles/design-system/ or any app code, and do not invent tokens that no audit reported.
Checks: none to run beyond reading; say so. Hand-back: totals and the three most widespread gaps.
