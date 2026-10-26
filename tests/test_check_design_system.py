"""Unit tests for scripts/check_design_system.py."""

import os
import sys
import importlib.util
from unittest.mock import patch
import pytest

script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts", "check_design_system.py"))
spec = importlib.util.spec_from_file_location("check_design_system", script_path)
cds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cds)


def test_clean_file_passes(tmp_path):
    f = tmp_path / "CleanComponent.tsx"
    f.write_text(
        'import React from "react";\n'
        'export const CleanComponent = () => {\n'
        '  return <div className="sn-card">Clean</div>;\n'
        '};\n'
    )
    violations = cds.check_file(str(f))
    assert violations == []


def test_raw_colours_trigger_error(tmp_path):
    f = tmp_path / "BadColourComponent.tsx"
    f.write_text(
        'const color1 = "#ff0000";\n'
        'const color2 = "rgba(0,0,0,0.5)";\n'
        'const color3 = "hsl(120, 100%, 50%)";\n'
        'const color4 = "oklch(0.6 0.25 140)";\n'
    )
    violations = cds.check_file(str(f))
    line_numbers = [line for line, _ in violations]
    assert line_numbers == [1, 2, 3, 4]
    for _, msg in violations:
        assert "Raw colour found" in msg


def test_approved_exception_comment_is_tolerated(tmp_path):
    f = tmp_path / "ExceptedColourComponent.tsx"
    f.write_text(
        'const color1 = "#ff0000"; /* design-system exception EX-001 */\n'
        'const color2 = "rgba(0,0,0,0.5)"; // design-system exception EX-002\n'
    )
    violations = cds.check_file(str(f))
    assert violations == []


def test_px_font_size_triggers_error(tmp_path):
    f = tmp_path / "BadFontComponent.tsx"
    f.write_text(
        'const style = { fontSize: "16px" };\n'
        'const css = "font-size: 14px;";\n'
    )
    violations = cds.check_file(str(f))
    line_numbers = [line for line, _ in violations]
    assert line_numbers == [1, 2]
    for _, msg in violations:
        assert "Raw px font size found" in msg


def test_emoji_in_comment_passes_in_jsx_fails(tmp_path):
    f = tmp_path / "EmojiComponent.tsx"
    f.write_text(
        '// Valid comment with rocket emoji 🚀\n'
        '/* Another comment with 🎛️ */\n'
        'export const EmojiComp = () => <div>Forbidden 🚀</div>;\n'
    )
    violations = cds.check_file(str(f))
    assert len(violations) == 1
    line, msg = violations[0]
    assert line == 3
    assert "Emoji found" in msg


def test_dialog_in_comment_passes_window_alert_fails(tmp_path):
    f = tmp_path / "DialogComponent.tsx"
    f.write_text(
        '// Never call confirm() directly\n'
        '/* window.alert("old way") */\n'
        'function bad() {\n'
        '  window.alert("Bad alert");\n'
        '}\n'
    )
    violations = cds.check_file(str(f))
    assert len(violations) == 1
    line, msg = violations[0]
    assert line == 4
    assert "Browser dialog found" in msg


def test_crlf_handling_in_pending_list_and_shrink_check(tmp_path):
    pending_file = tmp_path / "design-system-pending.txt"
    # Write with CRLF line endings
    pending_file.write_bytes(b"file1.tsx\r\nfile2.tsx\r\n# comment\r\n\r\n")

    with patch.object(cds, "PENDING_FILE_PATH", str(pending_file)):
        loaded = cds.load_pending_files()
        assert loaded == ["file1.tsx", "file2.tsx"]

    # Shrink check testing
    file_clean = tmp_path / "file1.tsx"
    file_clean.write_text("export const A = () => <div>Clean</div>;\n")

    file_dirty = tmp_path / "file2.tsx"
    file_dirty.write_text('const color = "#ff0000";\n')

    assert not cds.has_unmigrated_violations(str(file_clean))
    assert cds.has_unmigrated_violations(str(file_dirty))
