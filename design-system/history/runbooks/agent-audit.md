# Agent conformance audit runbook

Run these five stages in order against a page or component. Output one JSON report; never edit the target during the audit.

1. **Scope.** Read `INDEX.md`, then the rule sheets in `rules/sheets/` whose prefix matches the target (see the router table). Collect rules whose `scope` includes the target's kind.
2. **Lint.** Run `python3 linters/check.py <target> --json`. Record every finding with its check id and line. Run stylelint and eslint with `linters/*.config.json` where installed.
3. **DOM and visual.** Render the target in dark, light and booth. For each `dom` rule run its `test`; for each `visual` rule screenshot and compare to the component `preview.html`.
4. **Judgement.** For every `judgement` rule, give a pass, fail or n/a with one line of evidence. Do not infer a pass from silence.
5. **Report.** Write:

```json
{"target": "", "date": "", "rules_checked": 0, "findings": [{"rule": "COL-001", "stage": "lint|dom|visual|judgement", "severity": "fail|warn", "evidence": "", "fix": "token or class to use"}], "summary": {"fail": 0, "warn": 0, "pass": 0, "n_a": 0}}
```

An exception is never recorded in the page. If a rule must be broken, change the rule (and add an ADR in `history/decisions/`) so it applies to every page.
