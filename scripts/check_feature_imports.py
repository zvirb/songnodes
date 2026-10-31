#!/usr/bin/env python3
"""Feature pages do not import each other (LINT1).

A file in frontend/src/features/<A>/ must never import from
frontend/src/features/<B>/ (B != A), whether by a relative path or the `@/` alias.
Shared code belongs in lib/, shell/, components/, hooks/, services/, utils/ or types/.

Imports that already existed when the rule arrived are listed in
frontend/feature-imports-allowlist.txt, one per line with its reason:

    src/features/a/File.tsx -> src/features/b/module | reason

The list can only shrink: an import not on the list fails, and a line whose import
no longer exists also fails ("remove it from the allowlist").

Usage: python3 scripts/check_feature_imports.py [--check] [--frontend DIR] [--allowlist FILE]
Pure Python, no dependencies.
"""

from __future__ import annotations

import argparse
import os
import posixpath
import re
import sys
from typing import Dict, List, Set, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_FRONTEND = os.path.join(REPO_ROOT, "frontend")
ALLOWLIST_NAME = "feature-imports-allowlist.txt"
SOURCE_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts")
STRIP_EXTS = SOURCE_EXTS + (".d.ts",)

# from 'x' / import 'x' / import('x') / require('x') / vi.mock('x') / typeof import('x')
SPEC_RE = re.compile(
    r"""(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bvi\.\w+\s*\(\s*)(['"])([^'"\n]+)\1"""
)

Edge = Tuple[str, str]  # (importing file, imported target), both relative to frontend/, posix


def feature_of(path: str) -> str | None:
    """Return the feature folder name for a frontend-relative posix path, or None."""
    parts = path.split("/")
    if len(parts) >= 3 and parts[0] == "src" and parts[1] == "features":
        return parts[2]
    return None


def resolve(importer: str, spec: str) -> str | None:
    """Resolve an import specifier to a frontend-relative posix path, or None for packages."""
    if spec.startswith("@/"):
        target = "src/" + spec[2:]
    elif spec.startswith("./") or spec.startswith("../") or spec in (".", ".."):
        target = posixpath.join(posixpath.dirname(importer), spec)
    else:
        return None
    target = posixpath.normpath(target)
    for ext in sorted(STRIP_EXTS, key=len, reverse=True):
        if target.endswith(ext):
            target = target[: -len(ext)]
            break
    return target


def scan(frontend: str) -> Set[Edge]:
    """Every import from one feature folder into another."""
    edges: Set[Edge] = set()
    features_dir = os.path.join(frontend, "src", "features")
    for dirpath, _dirs, files in os.walk(features_dir):
        for name in files:
            if not name.endswith(SOURCE_EXTS):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, frontend).replace(os.sep, "/")
            own = feature_of(rel)
            with open(full, encoding="utf-8", errors="replace") as fh:
                text = fh.read()
            for match in SPEC_RE.finditer(text):
                target = resolve(rel, match.group(2))
                if target is None:
                    continue
                other = feature_of(target)
                if other is not None and other != own:
                    edges.add((rel, target))
    return edges


def load_allowlist(path: str) -> Tuple[Dict[Edge, int], List[str]]:
    """Return ({edge: line number}, [format errors])."""
    entries: Dict[Edge, int] = {}
    errors: List[str] = []
    if not os.path.exists(path):
        return entries, errors
    with open(path, encoding="utf-8") as fh:
        for num, raw in enumerate(fh, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            edge_part, sep, reason = line.partition("|")
            src, arrow, dst = edge_part.partition("->")
            if not sep or not arrow or not reason.strip() or not src.strip() or not dst.strip():
                errors.append(f"line {num}: expected '<file> -> <target> | <reason>'")
                continue
            entries[(src.strip(), dst.strip())] = num
    return entries, errors


def check(frontend: str, allowlist_path: str) -> List[str]:
    """Return the list of problems; empty means the rule holds."""
    found = scan(frontend)
    allowed, problems = load_allowlist(allowlist_path)
    allow_name = os.path.basename(allowlist_path)
    for src, dst in sorted(found - set(allowed)):
        problems.append(
            f"frontend/{src}: imports frontend/{dst} from another feature; move the shared code to "
            "src/lib, src/components or src/hooks instead"
        )
    for edge in sorted(set(allowed) - found, key=lambda e: allowed[e]):
        problems.append(
            f"{allow_name} line {allowed[edge]}: '{edge[0]} -> {edge[1]}' no longer exists; "
            "remove it from the allowlist"
        )
    return problems


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail on any problem (CI mode)")
    parser.add_argument("--list", action="store_true", help="print every cross-feature import found")
    parser.add_argument("--frontend", default=DEFAULT_FRONTEND)
    parser.add_argument("--allowlist", default=None)
    args = parser.parse_args(argv)
    allowlist = args.allowlist or os.path.join(args.frontend, ALLOWLIST_NAME)

    if args.list:
        for src, dst in sorted(scan(args.frontend)):
            print(f"{src} -> {dst}")
        return 0

    problems = check(args.frontend, allowlist)
    for p in problems:
        print(p)
    if problems:
        print(f"{len(problems)} feature-boundary problem(s).")
        return 1
    print("Feature boundaries OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
