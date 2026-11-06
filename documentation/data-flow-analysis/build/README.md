# Data flow report: build

One command rebuilds every deliverable from `../findings.json`:

```bash
python3 documentation/data-flow-analysis/build/build.py          # figures, Markdown, web report, print sheet, PDF, gates
python3 documentation/data-flow-analysis/build/build.py --no-pdf # quick check without the PDF and gates
```

A refresh is a file swap: drop in a new `findings.json` and run the command.

## Pipeline

| Step | File | Reads | Writes |
|---|---|---|---|
| 0. Merge (only when the scans change) | `merge.py` | `fragments/*.json`, `synthesis.json`, `verification.json` | `../findings.json` |
| 0. Synthesis | `synthesis.py` | `fragments/` | `synthesis.json` (profile, rules, personas, modules, backbone, roadmap, tasks; computed severity and effort) |
| 1. Token import | `ds.py` | `design-system/tokens.css`, `tokens.json`, `components/bundle.css`, `bundle.js`, `fonts/` | inline-safe copies, fonts embedded |
| 2. Figures | `figures.py` → `diagrams.py` (D-series, graphviz layout), `charts.py` (C-series, ChartFrame) | `findings.json` | `../*.svg` standalone figures (design-system tokens as CSS variables) |
| 3. Markdown | `md.py` | `findings.json`, figures | `../DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md`, `../ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`, `../PAGE_CLASSIFICATION_AUDIT.md`, `../todo/*.md` |
| 4. Web report | `build.py`, `render.py`, `sections.py`, `report.js` | the above | `../report/index.html` (self-contained, offline) |
| 5. Print sheet | `build.py` | the above | `../report/print-sheet.html` (static, no scripts) |
| 6. PDF | `pdf.py` (two passes for contents page numbers) | print sheet | `../DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` |
| 7. Gates | `verify.py`, `browser_gates.mjs`, `check_diagrams.mjs` | everything | `../gates.json`, `evidence/` screenshots and page images |

## Requirements

Python 3.10+ with `playwright` and `pypdf`; Node with `playwright`; graphviz `dot`; poppler (`pdftoppm`, `pdffonts`, `pdftotext`, `pdfinfo`).

## Design system

Everything is styled by the SongNodes design system (`design-system/`, 1.10.0). The report uses its shell (AppHeader, NavDrawer, PageHeader), components and the ReportPage, diagram and print-document patterns added in 1.10.0. Nothing is overridden locally; `verify.py` gate 2 fails on any colour, size, spacing or radius literal in the report's own markup. The page linter is `design-system/linters/check.py` (gate 1).

The same build source is kept in the Claude project folder (`data-flow-analysis/build/`).

## Scripts kept from PR #581

`build_findings.py`, `build_html.py`, `build_reports.py`, `build_svgs.py`, `generate_pdf.py`, `rebuild_all.py` and `verify_gates.py` came from the parallel run in PR #581 and are kept unchanged (nothing is deleted in a merge). They are not used by `build.py`. Running `rebuild_all.py` would overwrite this report's outputs with that run's smaller model (12 pages, 8 stores), so use `build.py`.
