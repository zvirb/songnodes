"""Unit tests for scripts/check_feature_imports.py (LINT1)."""

import importlib.util
import os

script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts", "check_feature_imports.py"))
spec = importlib.util.spec_from_file_location("check_feature_imports", script_path)
cfi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cfi)


def _write(root, rel, text):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _frontend(tmp_path):
    """Two fake features, alpha and beta, plus shared lib code."""
    fe = tmp_path / "frontend"
    _write(fe, "src/lib/shared.ts", "export const x = 1;\n")
    _write(fe, "src/features/alpha/data.ts", "export const a = 1;\n")
    _write(fe, "src/features/alpha/sub/setBuilder.ts", "export const s = 1;\n")
    _write(
        fe,
        "src/features/alpha/Page.tsx",
        "import { x } from '../../lib/shared';\n"
        "import { a } from './data';\n"
        "import { s } from './sub/setBuilder';\n"
        "import React from 'react';\n",
    )
    _write(fe, "src/features/beta/data.ts", "import { x } from '@/lib/shared';\n")
    return fe


def test_clean_features_pass(tmp_path):
    fe = _frontend(tmp_path)
    assert cfi.scan(str(fe)) == set()
    assert cfi.check(str(fe), str(fe / "allow.txt")) == []


def test_relative_cross_feature_import_fails(tmp_path):
    fe = _frontend(tmp_path)
    _write(fe, "src/features/beta/Page.tsx", "import { a } from '../alpha/data';\n")
    problems = cfi.check(str(fe), str(fe / "allow.txt"))
    assert len(problems) == 1
    assert "frontend/src/features/beta/Page.tsx: imports frontend/src/features/alpha/data" in problems[0]


def test_alias_dynamic_reexport_and_mock_imports_fail(tmp_path):
    fe = _frontend(tmp_path)
    _write(
        fe,
        "src/features/beta/Other.test.tsx",
        "import type { A } from '@/features/alpha/data.ts';\n"
        "export { s } from '../alpha/sub/setBuilder';\n"
        "const lazy = () => import('../alpha');\n"
        "vi.mock('../../features/alpha/Page', () => ({}));\n",
    )
    found = {dst for _src, dst in cfi.scan(str(fe))}
    assert found == {
        "src/features/alpha/data",
        "src/features/alpha/sub/setBuilder",
        "src/features/alpha",
        "src/features/alpha/Page",
    }


def test_same_named_folder_inside_own_feature_is_allowed(tmp_path):
    fe = _frontend(tmp_path)
    # '../setBuilder' from alpha/sub/x resolves inside alpha, even though a feature could share the name.
    _write(fe, "src/features/setBuilder/index.ts", "export const z = 1;\n")
    _write(fe, "src/features/alpha/sub/x.ts", "import { s } from '../sub/setBuilder';\n")
    assert cfi.scan(str(fe)) == set()


def test_allowlisted_import_passes_and_stale_line_fails(tmp_path):
    fe = _frontend(tmp_path)
    _write(fe, "src/features/beta/Page.tsx", "import { a } from '../alpha/data';\n")
    allow = fe / "allow.txt"
    allow.write_text(
        "# comment\n"
        "src/features/beta/Page.tsx -> src/features/alpha/data | shared type, belongs in src/types\n",
        encoding="utf-8",
    )
    assert cfi.check(str(fe), str(allow)) == []

    _write(fe, "src/features/beta/Page.tsx", "import { x } from '../../lib/shared';\n")
    problems = cfi.check(str(fe), str(allow))
    assert len(problems) == 1
    assert "line 2" in problems[0] and "remove it from the allowlist" in problems[0]


def test_allowlist_line_without_reason_is_rejected(tmp_path):
    fe = _frontend(tmp_path)
    _write(fe, "src/features/beta/Page.tsx", "import { a } from '../alpha/data';\n")
    allow = fe / "allow.txt"
    allow.write_text("src/features/beta/Page.tsx -> src/features/alpha/data\n", encoding="utf-8")
    problems = cfi.check(str(fe), str(allow))
    assert any("expected '<file> -> <target> | <reason>'" in p for p in problems)
    assert any("imports frontend/src/features/alpha/data" in p for p in problems)


def test_main_exit_codes(tmp_path, capsys):
    fe = _frontend(tmp_path)
    assert cfi.main(["--check", "--frontend", str(fe)]) == 0
    _write(fe, "src/features/alpha/Bad.ts", "import { x } from '../beta/data';\n")
    assert cfi.main(["--check", "--frontend", str(fe)]) == 1
    assert "feature-boundary problem" in capsys.readouterr().out
