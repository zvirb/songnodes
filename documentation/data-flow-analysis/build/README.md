# SongNodes Architectural Investigation Build Pipeline

This directory contains the automated generator and build pipeline for the SongNodes architectural investigation and end-to-end data flow deliverables.

## Single Command Rebuild
To regenerate the entire suite of deliverables (`findings.json` → SVGs → Markdown Reports → Self-Contained Web Report → Printable PDF) from scratch:

```bash
python documentation/data-flow-analysis/build/rebuild_all.py
```

## Pipeline Source Files

| Script / Artifact | Description |
|---|---|
| `rebuild_all.py` | Master pipeline orchestrator running steps 1 through 5 sequentially. |
| `build_html.py` | Compiles `report/index.html` as a single self-contained document with embedded fonts, design tokens, component classes, and inlined SVGs. |
| `generate_pdf.py` | Invokes Headless Chromium (`chrome.exe` / `msedge.exe`) to print the HTML report to A4 PDF using `@media print` rules. |
| `scripts/build_findings.py` | Compiles the canonical `findings.json` single source of truth from repo evidence. |
| `scripts/build_svgs.py` | Generates the 4 standalone SVGs (viewBox 1800x1100) using design system tokens. |
| `scripts/build_reports.py` | Generates the canonical Markdown documents and sister-project TODO matrix. |

## Updating Findings
To refresh the investigation report with new findings, simply edit or replace `documentation/data-flow-analysis/findings.json` and run `python documentation/data-flow-analysis/build/rebuild_all.py`.
