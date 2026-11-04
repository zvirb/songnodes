DS27: Fix CSV export guards, toast error misuse, warning source links and AISetlists copy

Base: main at 0a159c43. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Open one PR titled "DS27: Fix CSV export guards, toast error misuse, warning source links and AISetlists copy". Edit only the lines inside your own STATUS.md slot (SLOT:DS27).

## Job
Address high-impact design system non-conformances identified in Sprint 1:
1. ExportDialog CSV: adopt `SN.csv.file` with formula guard, BOM and CRLF.
2. ScraperProgressPage: replace illegal error toast on retry failure with an explicit inline warning.
3. AISetlistsPage: add source link to Settings on unconfigured AI warning (`DR-040`, `DR-042`), fix all-caps figure labels, and use typographical ellipsis `…`.

## Owned paths
- frontend/src/features/setBuilder/ExportDialog.tsx
- frontend/src/features/setBuilder/ExportDialog.test.tsx
- frontend/src/features/aiSetlists/AISetlistsPage.tsx
- frontend/src/pages/ScraperProgressPage.tsx
- plan/agents/DS27_conformance_sprint1.md
- STATUS.md (SLOT:DS27 only)

## Do
1. In `frontend/src/features/setBuilder/ExportDialog.tsx`, replace ad-hoc `escapeCsv` and `exportCsv` with `SN.csv.file` / `SN.csv.row`. Update test if needed.
2. In `frontend/src/pages/ScraperProgressPage.tsx`, avoid `showToast` for retry failure; display an inline banner/error message.
3. In `frontend/src/features/aiSetlists/AISetlistsPage.tsx`, add source link `a.sn-link.sn-link--src` with go icon to `/settings/api-keys`, change all-caps labels to sentence case, and replace `...` with `…`.

## Done when (reviewer check)
- Exporting a set to CSV produces UTF-8 BOM, sentence-case headers, CRLF, and formula guard.
- AISetlistsPage displays proper source link to Settings and sentence-case figure labels.
- ScraperProgressPage shows failure messages in-place without error toasts.
- Tests, linter and design checks pass.

## Checks
`python scripts/check_design_system.py --check`; `bash scripts/sync-design-system.sh --check`; `python design-system/source/agentconf/validate.py`; frontend tests; scope guard.
