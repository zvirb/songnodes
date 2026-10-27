#!/usr/bin/env python3
"""Design system conformance checker.

Validates tracked frontend source files for design system governance rules:
- No raw colours (#hex, rgb, rgba, hsl, hsla, oklch, oklab, hwb) outside design-system exceptions
- No raw px font sizes (font-size: xxpx, fontSize: xxpx)
- No emojis outside code comments
- No browser dialogs (alert, confirm, prompt) outside code comments
- Shrink check for frontend/design-system-pending.txt
"""

import sys
import os
import argparse
import re
import subprocess
from typing import List, Tuple, Set, Optional

# Constants
PENDING_FILE_PATH = "frontend/design-system-pending.txt"
EXCLUDED_FILES = {
    "frontend/src/lib/graphColours.ts",
}
EXCLUDED_PREFIXES = (
    "frontend/src/styles/design-system/",
)

# Rule regexes
RAW_COLOUR_PATTERN = re.compile(
    r"(#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(|oklch\s*\(|oklab\s*\(|hwb\s*\()"
)
FONT_SIZE_PATTERN = re.compile(
    r"(font-size:\s*[0-9.]+px|fontSize:\s*['\"]?[0-9]+px?)"
)
EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001FAFF\u2600-\u27BF]"
)
ALLOWED_GLYPHS = {'●', '◐', '○', '▲', '✓', '✕', '↻'}

DIALOG_PATTERN = re.compile(
    r"\b(window\.)?(alert|confirm|prompt)\s*\("
)
RAW_SPACING_CSS_PATTERN = re.compile(
    r"\b((?:padding|margin|gap)(?:-[a-z]+)?)\s*:\s*([^;\n]*?\b[1-9][0-9]*(\.[0-9]+)?px\b)",
    re.IGNORECASE
)
RAW_SPACING_JSX_PATTERN = re.compile(
    r"\b((?:padding|margin|gap)[A-Za-z]*)\s*:\s*(['\"]?[1-9][0-9]*(\.[0-9]+)?px?['\"]?)"
)


def get_git_files(mode: str) -> List[str]:
    """Get list of files to check based on mode (--check or --staged)."""
    if mode == "staged":
        cmd = ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"]
    else:
        cmd = ["git", "ls-files", "frontend/src/*.ts", "frontend/src/*.tsx", "frontend/src/*.css"]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        files = [line.strip().replace("\\", "/") for line in res.stdout.splitlines() if line.strip()]
    except Exception as e:
        sys.stderr.write(f"Error running git command: {e}\n")
        return []

    if mode == "staged":
        # Filter staged files to frontend/src/**/*.{ts,tsx,css}
        filtered = []
        for f in files:
            if f.startswith("frontend/src/") and f.endswith((".ts", ".tsx", ".css")):
                filtered.append(f)
        files = filtered

    return files


def load_pending_files() -> List[str]:
    """Load pending files list, normalizing line endings and paths."""
    if not os.path.exists(PENDING_FILE_PATH):
        return []

    pending = []
    with open(PENDING_FILE_PATH, "r", encoding="utf-8") as f:
        for line in f.read().splitlines():
            line = line.strip().replace("\\", "/")
            if line and not line.startswith("#"):
                pending.append(line)
    return pending


def strip_comments(content: str) -> List[str]:
    """Strip single-line and block comments, replacing commented characters with spaces

    to preserve exact line numbers and line lengths.
    """
    lines = content.splitlines()
    cleaned_lines = []
    in_block = False

    for line in lines:
        cleaned = []
        idx = 0
        n = len(line)
        while idx < n:
            if in_block:
                end_idx = line.find("*/", idx)
                if end_idx != -1:
                    in_block = False
                    cleaned.append(" " * (end_idx + 2 - idx))
                    idx = end_idx + 2
                else:
                    cleaned.append(" " * (n - idx))
                    idx = n
            else:
                sl_idx = line.find("//", idx)
                bl_idx = line.find("/*", idx)

                if sl_idx != -1 and (bl_idx == -1 or sl_idx < bl_idx):
                    cleaned.append(" " * (n - sl_idx))
                    idx = n
                elif bl_idx != -1:
                    cleaned.append(line[idx:bl_idx])
                    end_idx = line.find("*/", bl_idx + 2)
                    if end_idx != -1:
                        cleaned.append(" " * (end_idx + 2 - bl_idx))
                        idx = end_idx + 2
                    else:
                        in_block = True
                        cleaned.append(" " * (n - bl_idx))
                        idx = n
                else:
                    cleaned.append(line[idx:])
                    idx = n
        cleaned_lines.append("".join(cleaned))

    return cleaned_lines


def has_unmigrated_violations(filepath: str) -> bool:
    """Check if a pending file still contains unmigrated design system violations."""
    return len(check_file(filepath)) > 0


def check_file(filepath: str) -> List[Tuple[int, str]]:
    """Check a single file for design system violations.

    Returns list of (line_number, error_message).
    """
    violations = []
    if not os.path.isfile(filepath):
        return violations

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw_content = f.read()
    except Exception as e:
        return [(1, f"Could not read file: {e}")]

    raw_lines = raw_content.splitlines()
    code_lines = strip_comments(raw_content)

    is_code_file = filepath.endswith((".ts", ".tsx"))

    for i, raw_line in enumerate(raw_lines, 1):
        # Rule 1: Raw colours
        if RAW_COLOUR_PATTERN.search(raw_line):
            if "design-system exception" not in raw_line:
                # Exclude dynamic colour computation functions (e.g. getKeyColor HSL calculation)
                if not ("${" in raw_line and ("hsl" in raw_line or "rgb" in raw_line)) and not ("return 'hsl(" in raw_line):
                    violations.append((i, "Raw colour found; use a design-system token"))

        code_line = code_lines[i - 1] if i <= len(code_lines) else ""

        # Rule 2: Raw px font sizes
        if FONT_SIZE_PATTERN.search(code_line):
            if "design-system exception" not in raw_line:
                # Exclude root HTML font-size definition in CSS base resets
                if not ("font-size: 16px;" in code_line and "rem calculations" in raw_line):
                    violations.append((i, "Raw px font size found; use design-system type tokens or classes"))

        # Rule 3: Emoji outside code comments
        for emoji_match in EMOJI_PATTERN.finditer(code_line):
            glyph = emoji_match.group(0)
            if glyph not in ALLOWED_GLYPHS:
                if not re.search(r"\bconsole\.(log|error|warn|info|debug)\b", code_line):
                    violations.append((i, "Emoji found; use a Lucide icon plus a word"))
                    break

        # Rule 4: Browser dialogs in code
        if is_code_file and DIALOG_PATTERN.search(code_line):
            violations.append((i, "Browser dialog found; use ConfirmDialog/Toast"))

        # Rule 5: Raw pixel spacing
        if "design-system exception" not in raw_line:
            line_spacing_found = False
            for pattern in (RAW_SPACING_CSS_PATTERN, RAW_SPACING_JSX_PATTERN):
                if line_spacing_found:
                    break
                for m in pattern.finditer(code_line):
                    prop = m.group(1)
                    raw_val = m.group(2).strip()
                    val = raw_val.strip("'\"")
                    if val in ("1px", "-1px", "1.0px", "-1.0px"):
                        continue
                    violations.append((i, f"Raw pixel spacing found ({prop}: {val}); use a --space-* token (design-system/05-layout.md)"))
                    line_spacing_found = True
                    break

    return violations


def main():
    parser = argparse.ArgumentParser(description="Design system conformance checker.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true", help="Check all tracked frontend source files")
    group.add_argument("--staged", action="store_true", help="Check only staged frontend source files")

    args = parser.parse_args()
    mode = "staged" if args.staged else "check"

    is_gha = os.environ.get("GITHUB_ACTIONS") == "true"

    files_to_check = get_git_files(mode)
    pending_files = set(load_pending_files())

    # Exclude files
    active_files = []
    for f in files_to_check:
        if f in EXCLUDED_FILES:
            continue
        if any(f.startswith(prefix) for prefix in EXCLUDED_PREFIXES):
            continue
        if f in pending_files:
            continue
        active_files.append(f)

    all_violations: List[Tuple[str, int, str]] = []

    for f in active_files:
        file_violations = check_file(f)
        for line_no, msg in file_violations:
            all_violations.append((f, line_no, msg))

    # Shrink check for pending list (run during --check mode)
    if mode == "check":
        for pf in sorted(pending_files):
            if not has_unmigrated_violations(pf):
                all_violations.append(
                    (pf, 1, f"No longer needs an exemption; remove it from frontend/design-system-pending.txt")
                )

    if all_violations:
        for f, line_no, msg in all_violations:
            if is_gha:
                print(f"::error file={f},line={line_no}::{msg}")
            else:
                print(f"{f}:{line_no}: {msg}")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
