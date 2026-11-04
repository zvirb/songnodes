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
| WRT | Copy, labels, dates, empty states | 115 | rules/sheets/WRT.md | 01-writing.md |
| IA | Page inventory, module map, naming | 59 | rules/sheets/IA.md | 02-information-architecture.md |
| COL | Colour, themes, status, charts | 124 | rules/sheets/COL.md | 03-colour.md |
| TYP | Fonts, sizes, titles | 85 | rules/sheets/TYP.md | 04-typography.md |
| LAY | Spacing, grid, depth, z-index | 93 | rules/sheets/LAY.md | 05-layout.md |
| A11Y | Keyboard, focus, contrast, targets | 108 | rules/sheets/A11Y.md | 06-interaction-accessibility.md |
| FBK | Toasts, banners, status, errors | 75 | rules/sheets/FBK.md | 07-feedback-status.md |
| MOT | Motion, reduced motion | 64 | rules/sheets/MOT.md | 08-motion.md |
| COG | Load, defaults, progressive disclosure | 89 | rules/sheets/COG.md | 09-cognitive-load.md |
| NAV | Header, drawer, breadcrumbs, links | 133 | rules/sheets/NAV.md | 10-navigation.md |
| DATA | Tables, charts, keys, BPM, energy | 161 | rules/sheets/DATA.md | 11-data-display.md |
| INP | Buttons, fields, filters, forms | 124 | rules/sheets/INP.md | 12-inputs.md |
| PAT | Page templates | 80 | rules/sheets/PAT.md | 13-page-patterns.md |
| ICO | Icons, wordmark, favicon | 42 | rules/sheets/ICO.md | 14-identity-icons.md |
| PRT | Print and export | 79 | rules/sheets/PRT.md | 15-print-export.md |
| PLT | Platform, devices, offline | 75 | rules/sheets/PLT.md | 16-platform.md |
| MUS | Rotation, sets, recommendations | 79 | rules/sheets/MUS.md | 18-music-domain.md |
| MIG | Repo migration acceptance | 23 | rules/sheets/MIG.md | 19-songnodes-migration.md |
| BRD | Brand and voice | 46 | rules/sheets/BRD.md | README.md |
| GOV | Versioning, conformance, exceptions | 37 | rules/sheets/GOV.md | 17-governance.md |

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
