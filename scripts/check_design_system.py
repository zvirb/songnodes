#!/usr/bin/env python3
"""Design system conformance checker.

Validates tracked frontend source files for design system governance rules:
- No raw colours (#hex, rgb, rgba, hsl, hsla, oklch, oklab, hwb) outside design-system exceptions
- No raw px font sizes (font-size: xxpx, fontSize: xxpx)
- No emojis outside code comments
- No browser dialogs (alert, confirm, prompt) outside code comments
- Shrink check for frontend/design-system-pending.txt
- One primary action when EmptyState carries it (INT-001)
"""

import sys
import os
import argparse
import re
import subprocess
import glob
import json
from typing import List, Tuple, Set, Optional

# Constants
PENDING_FILE_PATH = "frontend/design-system-pending.txt"
LAYOUT_BASELINE_PATH = "frontend/design-system-layout-baseline.txt"
# Page containers the design system defines (design-system/13-page-patterns.md, Page container).
PAGE_CONTAINERS = ("sn-page__main", "sn-page-error", "sn-page-auth", "sn-page-graph")
MAIN_TAG_PATTERN = re.compile(r"<main\b([^>]*)>")
CLASSNAME_LITERAL_PATTERN = re.compile(r"""className=(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{\s*["']([^"']*)["']\s*\})""")
SN_CLASS_PATTERN = re.compile(r"(?<![\w-])(sn-[A-Za-z0-9_-]*[A-Za-z0-9_])(?![\w-]*\$)")
CSS_CLASS_PATTERN = re.compile(r"\.(sn-[A-Za-z0-9_-]+)")
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
        raise RuntimeError(f"Cannot enumerate source files with git: {e}") from e

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



def extract_jsx_elements(content: str, tag_name: str) -> List[Tuple[int, str]]:
    """Extract <TagName ... /> or <TagName ...>...</TagName> with line number, tracking brace balance."""
    elements = []
    pattern = re.compile(rf'<{tag_name}\b')
    for m in pattern.finditer(content):
        start_idx = m.start()
        line_no = content[:start_idx].count('\n') + 1
        i = m.end()
        brace_depth = 0
        in_quote = None
        while i < len(content):
            ch = content[i]
            if in_quote:
                if ch == in_quote and content[i - 1] != '\\':
                    in_quote = None
            else:
                if ch in ('"', "'", '`'):
                    in_quote = ch
                elif ch == '{':
                    brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                elif ch == '>' and brace_depth == 0:
                    elements.append((line_no, content[start_idx : i + 1]))
                    break
            i += 1
    return elements


def has_unconditional_header_primary(tag_text: str) -> bool:
    """Check if PageHeader actions renders an unconditional primary button (.sn-btn--primary)."""
    m = re.search(r'actions=\{([\s\S]*)\}', tag_text)
    if not m:
        return False
    actions_body = m.group(1)

    for pm in re.finditer(r'sn-btn--primary', actions_body):
        prefix = actions_body[: pm.start()]
        # Check dynamic className={... ? '...sn-btn--primary' : ...}
        # If prefix ends with className={ without closing }, it is inside a dynamic className expression
        last_class = prefix.rfind('className=')
        if last_class != -1:
            cls_after = prefix[last_class + len('className='):].strip()
            if cls_after.startswith('{') and ('?' in cls_after or '&&' in cls_after):
                continue
        # Check conditional element rendering: {condition ? <button ...> : ...} or {condition && <button ...>}
        last_brace = prefix.rfind('{')
        if last_brace != -1:
            between = prefix[last_brace:]
            if re.search(r'\{[^{}]*(\?|&&)[^{}]*<[a-zA-Z]', between):
                continue
        return True
    return False


def empty_state_carries_primary(tag_text: str) -> bool:
    """Check if EmptyState has a primary button in its actions prop."""
    return bool(re.search(r'actions=\{[\s\S]*?\bsn-btn--primary\b[\s\S]*?\}', tag_text))


def check_previews_one_primary() -> List[Tuple[str, int, str]]:
    """DOM check on previews: a preview must not render both PageHeader primary and EmptyState primary."""
    violations = []
    preview_pattern = os.path.join("design-system", "components", "*", "preview.html")
    for f in glob.glob(preview_pattern):
        try:
            with open(f, "r", encoding="utf-8") as fh:
                html = fh.read()
        except OSError:
            continue
        has_ph_primary = bool(re.search(r'class="[^"]*\bsn-page-header\b[^"]*"[\s\S]*?\bsn-btn--primary\b', html))
        has_es_primary = bool(re.search(r'class="[^"]*\bsn-empty-state\b[^"]*"[\s\S]*?\bsn-btn--primary\b', html))
        if has_ph_primary and has_es_primary:
            violations.append((
                f.replace("\\", "/"),
                1,
                "Both .sn-page-header and .sn-empty-state contain a primary button (.sn-btn--primary); while EmptyState displays the primary action, PageHeader primary shall not be rendered (design-system/06-interaction-accessibility.md, INT-001)"
            ))
    return violations

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

        # Rule 6: a <main> must use a design-system page container (gutters, max width)
        if is_code_file and "design-system exception" not in raw_line:
            for m in MAIN_TAG_PATTERN.finditer(code_line):
                attrs = m.group(1)
                if not any(c in attrs for c in PAGE_CONTAINERS):
                    violations.append((i, "<main> without a page container; use className=\"sn-page__main\" (design-system/13-page-patterns.md, Page container)"))

    # Rule 7: One primary action when EmptyState carries it (INT-001, DR-058)
    if is_code_file and filepath.endswith(".tsx") and "PageHeader" in raw_content and "EmptyState" in raw_content:
        empty_tags = extract_jsx_elements(raw_content, "EmptyState")
        if any(empty_state_carries_primary(tag) for _, tag in empty_tags):
            ph_tags = extract_jsx_elements(raw_content, "PageHeader")
            for line_no, ph_tag in ph_tags:
                if has_unconditional_header_primary(ph_tag):
                    violations.append((
                        line_no,
                        "PageHeader renders an unconditional primary action (.sn-btn--primary) while EmptyState also carries a primary action; while EmptyState displays the primary action, the PageHeader primary action shall not be rendered (design-system/06-interaction-accessibility.md, INT-001)"
                    ))

    return violations


def load_layout_baseline() -> Set[str]:
    """Known layout debt: lines 'main <file>' or 'class <sn-class>'. Shrink-only."""
    if not os.path.exists(LAYOUT_BASELINE_PATH):
        return set()
    out = set()
    with open(LAYOUT_BASELINE_PATH, "r", encoding="utf-8") as f:
        for line in f.read().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                out.add(" ".join(line.split()))
    return out


def defined_sn_classes(css_files: List[str]) -> Set[str]:
    defined: Set[str] = set()
    for f in css_files:
        try:
            with open(f, "r", encoding="utf-8") as fh:
                defined.update(CSS_CLASS_PATTERN.findall(fh.read()))
        except OSError:
            continue
    return defined


def used_sn_classes(filepath: str) -> List[Tuple[int, str]]:
    """sn-* classes named in static className values of a TSX file (dynamic parts are skipped)."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = f.read()
    except OSError:
        return []
    code_lines = strip_comments(raw)
    found = []
    for i, line in enumerate(code_lines, 1):
        for m in CLASSNAME_LITERAL_PATTERN.finditer(line):
            text = next(g for g in m.groups() if g is not None)
            # a class glued to an interpolation (sn-m-${key}) is built at runtime: skip it
            text = re.sub(r"[\w-]*\$\{[^}]*\}[\w-]*", " ", text)
            for c in SN_CLASS_PATTERN.findall(text):
                found.append((i, c))
    return found


def check_undefined_classes(files: List[str], baseline: Set[str]) -> List[Tuple[str, int, str]]:
    """Every sn-* class used in TSX must be defined by a stylesheet (the sn- prefix is the design system's)."""
    css_files = [f for f in files if f.endswith(".css")]
    defined = defined_sn_classes(css_files)
    out = []
    for f in files:
        if not f.endswith(".tsx") or ".test." in f or f in EXCLUDED_FILES or any(f.startswith(p) for p in EXCLUDED_PREFIXES):
            continue
        for line_no, c in used_sn_classes(f):
            if c not in defined and f"class {c}" not in baseline:
                out.append((f, line_no, f"Class {c} is not defined by the design system or any stylesheet, so it renders no spacing or style; use a real sn-* class or token (design-system/17-governance.md, The sn- namespace)"))
    return out


def main():
    parser = argparse.ArgumentParser(description="Design system conformance checker.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true", help="Check all tracked frontend source files")
    group.add_argument("--staged", action="store_true", help="Check only staged frontend source files")
    parser.add_argument("--strict", action="store_true", help="Include pending files and layout debt")
    parser.add_argument("--json", action="store_true", help="Emit a machine-readable audit report")

    args = parser.parse_args()
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
        if f in pending_files and not args.strict:
            continue
        active_files.append(f)

    all_violations: List[Tuple[str, int, str]] = []

    for f in active_files:
        file_violations = check_file(f)
        for line_no, msg in file_violations:
            all_violations.append((f, line_no, msg))

    if mode == "check":
        baseline = set() if args.strict else load_layout_baseline()
        all_violations.extend(check_undefined_classes(files_to_check, baseline))
        all_violations.extend(check_previews_one_primary())
        # Baseline is shrink-only: drop entries that no longer apply
        css_defined = defined_sn_classes([f for f in files_to_check if f.endswith(".css")])
        still_used = {c for f in files_to_check if f.endswith(".tsx") for _, c in used_sn_classes(f)}
        mains_failing = set()
        for f in files_to_check:
            if f.endswith(".tsx"):
                if any("<main> without a page container" in msg for _, msg in check_file(f)):
                    mains_failing.add(f)
        for entry in sorted(baseline):
            kind, _, value = entry.partition(" ")
            stale = (kind == "class" and (value in css_defined or value not in still_used)) or \
                    (kind == "main" and value not in mains_failing)
            if stale:
                all_violations.append((LAYOUT_BASELINE_PATH, 1, f"'{entry}' is fixed; remove it from {LAYOUT_BASELINE_PATH}"))
        # main-container debt listed in the baseline is not reported again
        all_violations = [v for v in all_violations
                          if not ("<main> without a page container" in v[2] and f"main {v[0]}" in baseline)]

    # Shrink check for pending list (run during --check mode)
    if mode == "check":
        for pf in sorted(pending_files):
            if not has_unmigrated_violations(pf):
                all_violations.append(
                    (pf, 1, f"No longer needs an exemption; remove it from frontend/design-system-pending.txt")
                )

    if args.json:
        print(json.dumps({
            "strict": args.strict,
            "checkedFiles": len(active_files),
            "pendingFiles": sorted(pending_files),
            "excludedFiles": sorted(EXCLUDED_FILES),
            "excludedPrefixes": list(EXCLUDED_PREFIXES),
            "findings": [{"file": f, "line": line, "message": msg}
                         for f, line, msg in all_violations],
        }))
        sys.exit(1 if all_violations else 0)

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
