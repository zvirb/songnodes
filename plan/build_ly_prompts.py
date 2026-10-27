"""Write the LY (layout debt) briefs and their STATUS.md slots.

Each LY package clears the undefined sn-* classes listed in
frontend/design-system-layout-baseline.txt for a group of files, so those
elements get real design-system spacing and styling. Run from the repo root:

    python plan/build_ly_prompts.py

It writes plan/agents/LY<n>_*.md and adds any missing SLOT:LY<n> blocks to
STATUS.md just above "## Scheduled run". It never edits an existing slot.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / 'frontend/design-system-layout-baseline.txt'

PACKAGES = [
    ('LY1', 'ai_setlists', 'AI setlists page', [
        'frontend/src/features/aiSetlists/AISetlistsPage.tsx',
        'frontend/src/features/aiSetlists/components/ui.tsx',
    ]),
    ('LY2', 'music_library', 'music library and set builder pages', [
        'frontend/src/features/musicLibrary/components/ui.tsx',
        'frontend/src/features/musicLibrary/components/AITransitionHelper.tsx',
        'frontend/src/features/musicLibrary/LibraryPage.tsx',
        'frontend/src/features/musicLibrary/SetBuilderPage.tsx',
        'frontend/src/features/musicLibrary/components/CrateFilterRail.tsx',
    ]),
    ('LY3', 'pathfinder_camelot', 'pathfinder and Camelot pages', [
        'frontend/src/features/pathfinder/PathfinderPage.tsx',
        'frontend/src/features/pathfinder/PathfinderPage.test.tsx',
        'frontend/src/features/camelot/CamelotPage.tsx',
        'frontend/src/components/CamelotWheel.tsx',
    ]),
    ('LY4', 'pipeline_export', 'pipeline page and export dialog', [
        'frontend/src/pages/ScraperProgressPage.tsx',
        'frontend/src/features/setBuilder/ExportDialog.tsx',
        'frontend/src/features/setBuilder/ExportDialog.test.tsx',
    ]),
    ('LY5', 'shared_components', 'shared components and the DJ interface page container', [
        'frontend/src/components/OAuthCallback.tsx',
        'frontend/src/components/ds/index.tsx',
        'frontend/src/components/ds/index.test.tsx',
        'frontend/src/components/AIAssistantModal.tsx',
        'frontend/src/components/NowPlayingDeck.tsx',
        'frontend/src/examples/spatialIndexUsage.example.tsx',
        'frontend/src/components/DJInterface/DJInterface.tsx',
    ]),
]


def baseline_classes() -> list[str]:
    return [l.split()[1] for l in BASELINE.read_text(encoding='utf-8').splitlines() if l.startswith('class ')]


def baseline_mains() -> list[str]:
    return [l.split()[1] for l in BASELINE.read_text(encoding='utf-8').splitlines() if l.startswith('main ')]


def users(cls: str) -> list[str]:
    pat = re.compile(r'(?<![\w-])' + re.escape(cls) + r'(?![\w-])')
    out = []
    for p in sorted((ROOT / 'frontend/src').rglob('*.ts*')):
        rel = p.relative_to(ROOT).as_posix()
        if '/styles/design-system/' in rel:
            continue
        if pat.search(p.read_text(encoding='utf-8', errors='ignore')):
            out.append(rel)
    return out


def brief(code: str, title: str, files: list[str]) -> str:
    rows, mains = [], [m for m in baseline_mains() if m in files]
    for cls in baseline_classes():
        u = users(cls)
        mine = [f for f in u if f in files]
        if not mine:
            continue
        others = [f for f in u if f not in files]
        rows.append(f"| `{cls}` | {', '.join(f'`{Path(f).name}`' for f in mine)} | "
                    f"{', '.join(f'`{f}`' for f in others) if others else 'none: remove the line when fixed'} |")
    main_note = ''.join(f"\n- `main {m}`: this `<main>` is not a design-system page container. Give it `sn-page__main` "
                        f"(see design-system/13-page-patterns.md, Page container) or, if the page is a full-bleed "
                        f"workspace like the graph, register an exception the way GraphPage.tsx documents its own, "
                        f"and remove the line." for m in mains)
    owned = '\n'.join(f'- {f}' for f in files)
    table = '\n'.join(rows) or '| (none) | | |'
    return f"""{code}: Layout debt: {title}

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md (section 4, the design system, is mandatory). No access to the user's laptop, local data or secrets; work from the repo only. Open one PR against main titled "{code}: Layout debt: {title}" on a branch starting with "{code.lower()}-"; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:{code} BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below.

## Why
These files use `sn-*` class names that no design-system stylesheet defines. An undefined class renders nothing, so those elements have no padding, gap, margin or type style, which is why parts of these pages look cramped and unfinished. `scripts/check_design_system.py --check` lists every undefined class in `frontend/design-system-layout-baseline.txt`; that list may only shrink.

## Read first
1. design-system/README.md, 05-layout.md, 13-page-patterns.md (Page container), 17-governance.md (The sn- namespace, Conformance checking), and the sections for whatever the elements are (11-data-display, 12-inputs, 07-feedback-status, 04-typography).
2. frontend/src/styles/design-system/bundle.css and tokens.css: the only real `sn-*` classes and `--*` tokens. Grep them; never take a class or token name from memory, from another file in the app, or from this brief.
3. design-system/api/components/<Comp>.md and design-system/components/<Comp>/README.md for every component you use, and frontend/src/lib/songnodes.tsx and frontend/src/shell/ for the React helpers.

## Task
For every undefined class below, in your owned files only:
- Replace it with what the design system actually provides: a shipped component (Banner, InlineMessage, Card, Field, DataTable, StatusPill and so on) or a defined `sn-*` class from bundle.css, chosen by what the element IS, not by its old name.
- Spacing-only helpers (`sn-mt-*`, `sn-mb-*`, `sn-ml-*`, `sn-gap-*`, `sn-u-*` and similar) become the layout the design system describes (stack/cluster with gaps from the page or card pattern) or, if nothing fits, an inline style using only `var(--space-*)` tokens that exist in tokens.css. Put `border` before padding/gap/margin in an inline style object.
- Text helpers (`sn-body`, `sn-label`, `sn-color-*` and similar) become the type classes and colour tokens in 04-typography and 03-colour.
- NEVER invent an `sn-` class, never add CSS that defines one, and never edit design-system/ or frontend/src/styles/design-system/. If the system has no class or component for something a page genuinely needs, keep the element working with `var(--space-*)` inline styles and record it under MISSING PATTERNS in your audit file.
- Behaviour, copy and data must not change. Keep en-AU sentence case.{main_note}

| Undefined class | Your files using it | Also used outside your package |
|---|---|---|
{table}

## The baseline file
In frontend/design-system-layout-baseline.txt, remove a `class` line only when, after your change, no file anywhere under frontend/src uses that class (grep for it). If a class is still used in a file you do not own (third column), leave its line; the last package to clear it removes it. Never add a line. `python scripts/check_design_system.py --check` fails on a stale line and on a new undefined class, so it tells you which lines to remove.

## Audit file (required)
Create docs/design-system/audits/{code}.md: files reviewed, each class replaced and with what (file:line), lines removed from the baseline, lines left and why, MISSING PATTERNS (need, where, nearest existing class or component and why it is not enough), and checks not run.

## Owned paths
{owned}
- frontend/design-system-layout-baseline.txt (remove lines only)
- docs/design-system/audits/{code}.md

(Files listed are the complete set. Test files may be updated only to keep them passing after your fixes.)

## Checks (run all you can; say which you could not)
- `python scripts/check_design_system.py --check` (must pass with your baseline lines removed)
- `cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (oxlint warnings must not increase)
- `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
- If you can run a browser, open each changed page at 390px and 1440px wide and check that text never touches the viewport edge or its container border (16px and 32px page gutters) and that nothing is clipped. Otherwise say the Playwright E2E and visual tests could not run in your sandbox.

## Hand-back
Classes cleared, baseline lines removed, lines left for other packages, missing patterns reported.
"""


def main() -> None:
    status_path = ROOT / 'STATUS.md'
    status = status_path.read_text(encoding='utf-8')
    new_slots = []
    for code, slug, title, files in PACKAGES:
        missing = [f for f in files if not (ROOT / f).exists()]
        if missing:
            raise SystemExit(f'{code}: missing files {missing}')
        (ROOT / 'plan/agents' / f'{code}_{slug}.md').write_text(brief(code, title, files), encoding='utf-8')
        if f'<!-- SLOT:{code} BEGIN -->' not in status:
            new_slots.append(f"<!-- SLOT:{code} BEGIN -->\n### {code}: Layout debt: {title}\n"
                             f"- Start: _not started_\n- End: _not finished_\n<!-- SLOT:{code} END -->\n")
    if new_slots:
        marker = '\n## Scheduled run\n'
        if marker not in status:
            raise SystemExit('STATUS.md has no "## Scheduled run" section')
        status = status.replace(marker, '\n' + '\n'.join(new_slots) + marker, 1)
        status_path.write_text(status, encoding='utf-8')
    print(f'wrote {len(PACKAGES)} briefs, added {len(new_slots)} slots')


if __name__ == '__main__':
    main()
