# SongNodes design system: index

Router for agents. Read this file first; open only the sheet you need. Rules are normative and live in `rules/`; prose guidelines, history and decisions are background.

## How to work

1. Pick the topic rows below that match the task.
2. Read the rule sheet (`rules/sheets/<PREFIX>.md`), or filter `rules/rules.yaml` by `scope` and `check_type`.
3. Use tokens from `tokens/tokens.json` (DTCG) or `tokens.css`. Never write a raw colour, size, duration or z-index.
4. Copy the component pattern from `components/<Name>/preview.html`.
5. Run `python3 linters/check.py <file>` before finishing. Every finding cites a rule family.
6. Never override a rule in a page. If an exception is needed, change the rule and record an ADR.

## Topic router

| Prefix | Topic | Rules | Sheet | Prose guideline |
|---|---|---|---|---|
| WRT | Copy, labels, dates, empty states | 118 | rules/sheets/WRT.md | 01-writing.md |
| IA | Page inventory, module map, naming | 59 | rules/sheets/IA.md | 02-information-architecture.md |
| COL | Colour, themes, status, charts | 124 | rules/sheets/COL.md | 03-colour.md |
| TYP | Fonts, sizes, titles | 88 | rules/sheets/TYP.md | 04-typography.md |
| LAY | Spacing, grid, depth, z-index | 95 | rules/sheets/LAY.md | 05-layout.md |
| A11Y | Keyboard, focus, contrast, targets | 110 | rules/sheets/A11Y.md | 06-interaction-accessibility.md |
| FBK | Toasts, banners, status, errors | 90 | rules/sheets/FBK.md | 07-feedback-status.md |
| MOT | Motion, reduced motion | 64 | rules/sheets/MOT.md | 08-motion.md |
| COG | Load, defaults, progressive disclosure | 106 | rules/sheets/COG.md | 09-cognitive-load.md, 22-forms-and-load.md |
| NAV | Header, drawer, breadcrumbs, links | 135 | rules/sheets/NAV.md | 10-navigation.md |
| DATA | Tables, charts, keys, BPM, energy | 163 | rules/sheets/DATA.md | 11-data-display.md |
| INP | Buttons, fields, filters, forms | 164 | rules/sheets/INP.md | 12-inputs.md, 22-forms-and-load.md |
| PAT | Page templates | 80 | rules/sheets/PAT.md | 13-page-patterns.md |
| ICO | Icons, wordmark, favicon | 42 | rules/sheets/ICO.md | 14-identity-icons.md |
| PRT | Print and export | 84 | rules/sheets/PRT.md | 15-print-export.md |
| PLT | Platform, devices, offline | 79 | rules/sheets/PLT.md | 16-platform.md |
| MUS | Rotation, sets, recommendations | 80 | rules/sheets/MUS.md | 18-music-domain.md |
| MIG | Repo migration acceptance | 23 | rules/sheets/MIG.md | 19-songnodes-migration.md |
| BRD | Brand and voice | 46 | rules/sheets/BRD.md | README.md |
| QSV | Quick load and quick save: start-up, ordered save queue | 30 | rules/sheets/QSV.md | components/QuickSave/README.md |
| DIA | Diagnostics: one console line format, names and counts only | 30 | rules/sheets/DIA.md | components/Diagnostics/README.md |
| RSP | Responsive pages: presses, stale slots, lazy drawing, optimistic changes | 40 | rules/sheets/RSP.md | 20-responsive-pages.md |
| SKL | Skeleton | 23 | rules/sheets/SKL.md | components/Skeleton/README.md |
| SVM | SaveMark | 23 | rules/sheets/SVM.md | components/SaveMark/README.md |
| OBX | Outbox | 25 | rules/sheets/OBX.md | 20-responsive-pages.md, components/Outbox/README.md |
| KPG | Figure pages: summary band, one home per figure, units | 36 | rules/sheets/KPG.md | 21-figure-pages.md |
| FIG | Figure components: tile states and link form, held scale, not measured | 39 | rules/sheets/FIG.md | 21-figure-pages.md |
| CFL | Card flags on rows and cards | 20 | rules/sheets/CFL.md | components/CardFlag/README.md |
| SUG | Suggestion row actions | 16 | rules/sheets/SUG.md | components/SuggestionActions/README.md |
| LIV | Live changes in lists, sets and tables | 21 | rules/sheets/LIV.md | components/LiveChange/README.md |
| RAC | Row and card actions, static tiles | 40 | rules/sheets/RAC.md | components/RowActions/README.md |
| TSK | Task notices for findings that need action | 3 | rules/sheets/TSK.md | components/TaskNotice/README.md |
| BAN | Toast wrap | 1 | rules/sheets/BAN.md | 07-feedback-status.md |
| PSZ | Page size | 1 | rules/sheets/PSZ.md | 17-governance.md |
| INT | Empty state and page header action | 1 | rules/sheets/INT.md | components/EmptyState/README.md |
| GOV | Versioning, conformance, exceptions | 38 | rules/sheets/GOV.md | 17-governance.md |

## What to load

Start from the work, then open only the sheets, cards and helper named.

| The work touches | Sheets | Cards and guideline | Helper |
|---|---|---|---|
| Every page | A11Y, WRT, LAY, TYP, COL, QSV, DIA | `PageHeader`, `AppHeader`, `QuickSave`, `Diagnostics` | `SongNodes.save.start`, `SongNodes.diag` |
| A table or list | DATA, RAC, CFL, LIV | `DataTable`, `RowActions`, `CardFlag`, `LiveChange` | `SongNodes.live`, `SongNodes.cardFlag`, `SongNodes.rowAsk` |
| A form | INP, COG | `TextField`, `SelectField`, `InlineMessage`; 22-forms-and-load.md | `SongNodes.format` |
| Anything the page saves | QSV, SVM, OBX, FBK | `QuickSave`, `SaveMark`, `Outbox`; 20-responsive-pages.md | `SongNodes.save`, `SongNodes.resp` |
| Loading and slow data | RSP, SKL, FBK, MOT | `Skeleton`, `LoadingState`, `ErrorState`; 20-responsive-pages.md | `SongNodes.resp` |
| Figures and tiles | KPG, FIG, DATA | `FigureTile`, `ProgressBar`, `Heatmap`; 21-figure-pages.md | `SongNodes.format` |
| Charts and the graph | DATA, COL, MOT | `ChartFrame`, `Sparkline`, `GraphControls`, `GraphStyles` | `SongNodes.format` |
| Track rows, set slots, their flags and actions | CFL, SUG, RAC, LIV | `TrackCell`, `SetSlot`, `CardFlag`, `SuggestionActions`, `RowActions` | `SongNodes.cardFlag`, `SongNodes.suggestionActions`, `SongNodes.rowAsk` |
| Print or export | PRT | `PrintSheet`, `CopyButton`; 15-print-export.md | `SongNodes.csv` |
| Settings and preferences | PLT, INP, QSV | `SettingsPage`, `PreferencesPanel`, `Switch`; 16-platform.md | `SongNodes.prefs` |

## Where things live

| Need | Path |
|---|---|
| All rules (generated) | `rules/rules.yaml`, schema `rules/rules.schema.yaml` |
| Rule to source line map | `rules/sources.yaml`, `rules/TRACEABILITY.md` |
| Tokens (W3C DTCG) | `tokens/tokens.json` |
| Tokens (CSS, generated) | `tokens.css` |
| Token and component tables | `reference/tokens.md`, `reference/components.md` |
| Component specs | `components/<Name>/README.md`, `preview.html` |
| Linters | `linters/stylelint.config.json`, `linters/eslint.config.json`, `linters/check.py` |
| Regression fixture | `fixtures/violations.html` (20 seeded violations) |
| Changelog and decisions | `history/CHANGELOG.md`, `history/decisions/ADR-nnn.md` |
| Open questions | `history/open-questions.md` |
| Audit procedure | `history/runbooks/agent-audit.md` |
| Rebuild everything | `python3 source/agentconf/build_agentconf.py` then `python3 source/agentconf/validate.py` |

## Conventions

- Rule ids: `PREFIX-NNN`. Statements use shall / shall not / should and carry no dates or versions.
- `check_type`: lint, ast, dom, visual or judgement. Only judgement rules need a human or agent opinion.
- Themes: dark (default), light, booth. Every rule holds in all three.
- Edit `rules/frag/` and prose files, never the generated files.
