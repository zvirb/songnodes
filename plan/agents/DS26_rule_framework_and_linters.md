DS26: Integrate design system rule framework, linters and governance tooling

Base: main at 398167ac (design system 1.9.1). Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Open one PR titled "DS26: Integrate design system rule framework, linters and governance tooling". Edit only the lines inside your own STATUS.md slot (SLOT:DS26).

## Job
Integrate the formal design-system rule framework (`rules/`), reference linter (`linters/`), conformance fixtures (`fixtures/`), ADR decision records (`history/`), DTCG tokens and reference tables (`tokens/`, `reference/`), agent router (`INDEX.md`), and build/validation tooling (`source/agentconf/`) into `design-system/` while preserving all 1.9.1 tokens, bundles, and guidelines.

## Owned paths
- design-system/**
- plan/agents/DS26_rule_framework_and_linters.md
- STATUS.md (SLOT:DS26 only)

## Do
1. Extract `INDEX.md`, `rules/`, `linters/`, `fixtures/`, `history/`, `reference/`, `tokens/tokens.json`, and `source/agentconf/` into `design-system/`.
2. Reconstruct rule fragments (`design-system/rules/frag/`) and compile DTCG tokens and reference tables against the 1.9.1 `tokens.json`.
3. Ensure `build_agentconf.py` and `validate.py` run cleanly across platforms.

## Done when (reviewer check)
`python design-system/source/agentconf/validate.py` reports `PASS: 1691 rules, fixture 20/20, INDEX 61 lines`, and `scripts/sync-design-system.sh --check` confirms 1.9.1 remains in sync.

## Checks
`python design-system/source/agentconf/validate.py`; `python scripts/check_design_system.py --check`; `bash scripts/sync-design-system.sh --check`; scope guard.
