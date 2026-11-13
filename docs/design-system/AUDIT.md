# Design-system audit

Run from `frontend/` after installing the existing npm dependencies and Playwright Chromium:

```sh
npm run audit:design-system -- --list
npm run audit:design-system -- --source-only
npm run audit:design-system -- --base-url http://localhost:3006 --examples /absolute/path/routes.json
```

The audit reuses `scripts/check_design_system.py` with `--check --strict --json`.
Strict mode includes pending files and layout-baselined violations rather than
silently treating legacy debt as conformance. The normal CI checker retains its
existing shrink-only exemptions. Both modes work from any current directory.
The source report lists excluded generated directories and graph-colour code.

The browser audit uses the real running frontend and its real responses. It does
not install fixtures, click mutation controls or modify server data. It uses fresh
browser contexts, with dark/light/booth themes, 390/1440 widths and normal/XL text:
12 cases per concrete route. It checks landmarks, page headings, primary action
count (excluding the DateRange exception), locale, horizontal overflow, header
geometry/layer/controls, sticky behaviour after document scrolling, runtime errors,
and axe WCAG 2.2 AA rules. Short pages report that scrolling was not exercised.

Route discovery reads literal declarations in the registry, feature `route.tsx`
files and App.tsx. Unlike the existing E2E `SHELL_ROUTES` list, new literal feature
routes are included automatically. Dynamic routes and the wildcard must be mapped
to real examples; an unmapped route is a coverage failure, never silently skipped.
Example JSON (replace IDs with records that exist in your environment):

```json
{
  "/tracks/:id": "/tracks/real-track-id",
  "/track/:id": "/track/real-track-id",
  "/settings/:settingId": "/settings/display",
  "/callback/:service": "/callback/spotify",
  "*": "/audit-nonexistent-page"
}
```

Callback routes are visited without OAuth codes; this audits their error state.
Redirects are followed. Review authentication-dependent pages with appropriate
environment access; a redirect does not prove the requested page was audited.

Output defaults to `frontend/test-results/design-system-audit.json`; override with
`--output PATH`. Findings include route, theme, width and text size. Exit codes:
0 = selected automated checks passed, 1 = findings or missing route coverage,
2 = invocation/infrastructure failure. `--source-only` explicitly records that
browser coverage was not run. A zero exit code is not a full design certification.

## Existing coverage and limits

| Layer | Coverage |
| --- | --- |
| Source checker | Raw colours, pixel font sizes/spacing, emoji, browser dialogs, page containers, undefined sn-* classes, conflicting EmptyState/PageHeader primary actions, stale exemptions |
| This browser audit | Discovered routes and responsive/theme matrix, shell positioning, landmarks, primary count, runtime failures and axe |
| Existing E2E tests | Text insets/gutters, placeholders, drawer accessibility, keyboard behaviour and visual snapshots; run `npx playwright test design-rules accessibility visual --project=chromium` |
| Distribution | Run `bash scripts/sync-design-system.sh --check` from the repository root |
| Human review | Copy meaning, data truth/freshness, preview comparison, all interactive/loading/empty/error/offline states, print and reduced motion |

Static regex checks cannot prove arbitrary JSX/CSS or formatting-helper correctness.
Rendered checks inspect the reached state only. Computed route declarations need
manual inventory review. Unknown metadata, honest error causes, appropriate actions
and musical meaning cannot be certified by a generic linter. These gaps remain
explicit in every report; do not describe an automated pass as “fully compliant”.

Regression checks:

```sh
python -m pytest tests/test_check_design_system.py
cd frontend
node --test scripts/design-system-audit.test.mjs
```
