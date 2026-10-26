#!/usr/bin/env python3
"""Build the design-system audit briefs (plan/agents/DS*.md), one per page or code area.

Ownership is computed from the import graph of the routed pages in frontend/src/App.tsx: each file is owned by
the first page (in ENTRIES order) that reaches it; files no page reaches are grouped by folder.
Re-run after the routes or components change:  python plan/build_ds_prompts.py
"""
import json
import os
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT.parent / "frontend" / "src"
BS = chr(92)


def rel(f):
    return os.path.relpath(f, SRC).replace(BS, "/")


files = [os.path.join(d, f) for d, _, fs in os.walk(SRC) for f in fs if f.endswith((".ts", ".tsx", ".css"))]
files = [os.path.abspath(f) for f in files if "styles" + os.sep + "design-system" not in f]
fset = set(files)


def resolve(base, spec):
    p = os.path.abspath(SRC / spec[2:]) if spec.startswith("@/") else os.path.normpath(os.path.join(os.path.dirname(base), spec))
    for c in (p, p + ".ts", p + ".tsx", p + ".css", os.path.join(p, "index.ts"), os.path.join(p, "index.tsx")):
        if c in fset:
            return c
    return None


def deps(f):
    s = open(f, encoding="utf-8", errors="ignore").read()
    out = set()
    for m in re.finditer(r"""(?:from|import)\s*\(?\s*['"]((?:\.|@/)[^'"]*)['"]""", s):
        r = resolve(f, m.group(1))
        if r:
            out.add(r)
    return out


# code, title, route, entry files (not followed past App.tsx/main.tsx)
ENTRIES = [
    ("DS1", "App shell, navigation drawer and home page", "/ (HomePage, AppShell)", ["pages/HomePage.tsx", "shell/AppShell.tsx", "App.tsx", "main.tsx"]),
    ("DS2", "Graph page", "/graph", ["pages/GraphPage.tsx"]),
    ("DS3", "Library page", "/library", ["features/musicLibrary/LibraryPage.tsx"]),
    ("DS4", "Set builder page", "/sets", ["features/musicLibrary/SetBuilderPage.tsx"]),
    ("DS5", "Paths, sources and not-found pages", "/paths, /sources/targets, * (pages/ModulePages.tsx)", ["pages/ModulePages.tsx"]),
    ("DS6", "Harmony (Camelot) page", "/harmony", ["pages/CamelotPage.tsx"]),
    ("DS8", "Pipeline page", "/pipeline", ["pages/ScraperProgressPage.tsx"]),
    ("DS9", "Settings page", "/settings", ["pages/SettingsPage.tsx"]),
    ("DS10", "OAuth callback page", "/callback/spotify, /oauth/callback", ["components/OAuthCallback.tsx"]),
]
FOLLOW_STOP = {"App.tsx", "main.tsx"}

owned, taken = {}, set()
# smaller pages claim shared files first, so each page owns its own components; the big graph page goes last
for code, _t, _r, entries in sorted(ENTRIES, key=lambda e: e[0] == "DS2"):
    seen, st = set(), [os.path.abspath(SRC / e) for e in entries]
    while st:
        f = st.pop()
        if f in seen or f not in fset:
            continue
        seen.add(f)
        if rel(f) not in FOLLOW_STOP:
            st += list(deps(f))
    owned[code] = sorted(rel(f) for f in seen if f not in taken)
    taken |= seen

# the graph page reaches ~70 files: split it in two so one agent is not overloaded
g = owned.pop("DS2")
half = len(g) // 2
owned["DS2A"], owned["DS2B"] = g[:half], g[half:]

rest = sorted(rel(f) for f in files if f not in taken)


def group(f):
    if f.startswith(("components/DJInterface", "components/SetlistBuilder", "components/PathfinderPanel", "components/ds/")):
        return "DS12"
    if f.startswith("components/"):
        return "DS11"
    if f.startswith(("features/aiSetlists", "features/camelot", "features/musicLibrary", "features/pipeline")):
        return "DS13"
    if f.startswith(("styles/", "index.css")):
        return "DS15"
    return "DS14"


for f in rest:
    owned.setdefault(group(f), []).append(f)

TITLES = {c: (t, r) for c, t, r, _ in ENTRIES}
TITLES.update({
    "DS2A": ("Graph page, first half of its files", "/graph"),
    "DS2B": ("Graph page, second half of its files", "/graph"),
    "DS11": ("Unrouted components, legacy UI", "none (not reached from a route)"),
    "DS12": ("DJ interface, setlist builder and pathfinder components", "none (not reached from a route)"),
    "DS13": ("Feature folders: aiSetlists, camelot and leftovers", "none (not reached from a route)"),
    "DS14": ("Utils, hooks, lib, services, types and examples", "none (code only)"),
    "DS15": ("Global stylesheets and legacy CSS", "all pages"),
})

HEADER = """{code}: Design system audit and fix: {title}

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md (section 4, the design system, is mandatory). No access to the user's laptop, local data or secrets; work from the repo only. Open one PR against main titled "{code}: Design system audit and fix: {title}" on a branch starting with "{code_lower}-"; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:{code} BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below.

"""

BODY = """## Scope
Page or area: {title}. Route: {route}.
Review EVERY file listed under Owned paths for deviations from the SongNodes design system, and fix them. Read the page the way a user sees it: layout, every state (loading, empty, error, populated), every control, every piece of copy.

## Read first
1. design-system/README.md, then the sections that apply: 01-writing, 03-colour, 04-typography, 05-layout, 06-interaction-accessibility, 07-feedback-status, 08-motion, 10-navigation, 11-data-display, 12-inputs, 13-page-patterns, 14-identity-icons, 18-music-domain, 19-songnodes-migration.
2. design-system/tokens.css (the real token names; grep it, never copy a name from memory or from another file) and design-system/api/components/<Comp>.md plus design-system/components/<Comp>/README.md for every component you use or could use.
3. docs/design-system/EXCEPTIONS.md (registered exceptions EX-001, EX-002) and frontend/design-system-pending.txt.

## Check each file for
- Colour: hex, rgb()/hsl(), named colours, legacy `--color-*` variables, Tailwind colour classes. Use `var(--token)` or `sn-*` classes.
- Type: px or rem font sizes, wrong families (Sora titles with a dimmed lead-in plus bold title, Inter body, JetBrains Mono for BPM, keys, durations and IDs), raw font weights.
- Spacing, radius, shadow, z-index, motion duration/easing, breakpoints: ad-hoc numbers instead of tokens. Touch targets 44px, visible focus, reduced motion respected, valid at 360px width.
- Components: hand-built markup where a shipped component exists (DataTable, KeyBadge, EmptyState, Dialog, ConfirmDialog, Toast, CamelotWheel, EnergyBar, StatusPill and so on). New Tailwind classes. Inline `style` for values that belong to tokens.
- Interaction: `alert`, `confirm`, `prompt`; more than one primary button per view; site navigation other than the NavDrawer.
- Formatting: dates, durations, counts, BPM, keys, energy and statuses must go through `SN.format`, `SN.camelot`/`keyName`, `SN.compat`/`energyStep`/`bpmStep`, `SN.status`, `EnergyBar`, `KeyBadge`, `Bpm`, `StatusPill`. Statuses show a glyph plus a word; no colour-only meaning.
- Writing: en-AU spelling, sentence case (no Title Case labels), Australia/Melbourne 24-hour time, no emoji, Lucide icons plus a word, missing values as an en dash (`sn-none`), never "N/A" or "Unknown".
- Accessibility: WCAG AA contrast, names for icon-only controls, focus order, labels on inputs, roles for custom widgets.

## Fix what you can, report what you cannot
- Fix every deviation inside the owned paths with existing tokens, `sn-*` classes and shipped components. Behaviour must not change except where the design system requires it (for example replacing `confirm()` with `ConfirmDialog`).
- NEVER invent a token name and NEVER edit design-system/ or frontend/src/styles/design-system/ (the synced copy). If the system has no token, class or component for something the page needs (a missing colour step, size, radius, shadow, z-index layer, motion value, icon, component or pattern), do not hack around it: keep the file working, and record it as a MISSING TOKEN or MISSING COMPONENT finding (below). A conflict the system does not settle is a change to the system at its source, which the maintainers decide.
- Where a value is only close to an existing token, say so and use the token only if the visual difference is imperceptible; otherwise report it.
- frontend/design-system-pending.txt: you may only REMOVE lines for files you fully migrated or deleted. Never add a line.
- Do not edit files outside the owned paths. If a deviation lives in a file another package owns, list it under "Elsewhere" in your audit file.

## Audit file (required)
Create docs/design-system/audits/{code}.md with these sections, in this order:
1. Summary: files reviewed (all of them, by path), deviations found, fixed, left open.
2. Findings table: file, line, rule (section of the design system), what was wrong, fixed (yes/no), how.
3. MISSING TOKENS: one row each: the value or need found, where it is used (file:line), what token name the design system would need (propose a name that follows the naming pattern in tokens.css; mark it a proposal), the nearest existing token and why it is not enough, and which design-system section would own it.
4. MISSING COMPONENTS AND PATTERNS: same layout.
5. Exceptions requested: anything that should be registered in docs/design-system/EXCEPTIONS.md, with a reason.
6. Elsewhere: deviations seen in files you do not own.
7. Could not check: states you could not reach statically, and checks you could not run.

## Owned paths
{paths}

(Files listed are the complete set. Test files may be updated only to keep them passing after your fixes.)

## Checks (run all you can; say which you could not)
- `cd frontend && npm ci && npx tsc --noEmit -p . && npx vitest run src && npx vite build`
- `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`
- a grep of your changed files for hex colours, rgb(, px font sizes, z-index numbers and `var(--` names that are absent from design-system/tokens.css (report the result)
- Playwright visual/E2E tests cannot run in your sandbox; say so.

## Hand-back
What was fixed, what is open, the number of missing tokens/components reported, and anything the wiring or token-consolidation package (DS16) needs to know.
"""

CONSOLIDATE = """DS16: Consolidate missing design-system tokens from all audits

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md (section 4, the design system, is mandatory). No access to the user's laptop, local data or secrets; work from the repo only. Open one PR against main titled "DS16: Consolidate missing design-system tokens from all audits" on a branch starting with "ds16-"; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:DS16 BEGIN/END). Send this package only after the DS1 to DS15 PRs are merged.

## Task
Read every docs/design-system/audits/DS*.md. Produce docs/design-system/audits/MISSING_TOKENS.md:
1. De-duplicated list of all MISSING TOKEN findings across pages, merged where the same need appears more than once, with the count of uses and every file:line.
2. For each, a concrete proposal: token name (following the naming pattern in design-system/tokens.css), value with units, the design-system section and the source file it belongs in under design-system/source/, and whether an existing token could cover it instead (with reasoning).
3. The same for MISSING COMPONENTS AND PATTERNS and for requested exceptions.
4. A proposed version bump per design-system/17-governance.md and the exact steps (edit source, build_tokens.py, build_bundle.py, scripts/sync-design-system.sh) for the maintainers to run.
5. A short table of which audit pages are clean.

## Owned paths
- docs/design-system/audits/MISSING_TOKENS.md

(Do NOT edit design-system/, frontend/src/styles/design-system/ or any app code, and do not invent tokens that no audit reported.)

## Checks
None to run beyond reading; say so. Hand-back: totals and the three most widespread gaps.
"""


def paths_block(code):
    lines = ["- frontend/src/" + p for p in owned[code]]
    lines.append(f"- docs/design-system/audits/{code}.md")
    lines.append("- frontend/design-system-pending.txt (remove migrated lines only)")
    return "\n".join(lines)


def title_of(code):
    return TITLES[code]


agents = ROOT / "agents"
agents.mkdir(exist_ok=True)
for old in agents.glob("DS*.md"):
    old.unlink()
codes = []
for code in sorted(owned, key=lambda c: (int(re.sub(r"\D", "", c)), c)):
    if not owned[code]:
        continue
    t, r = title_of(code)
    text = HEADER.format(code=code, code_lower=code.lower(), title=t) + BODY.format(code=code, title=t, route=r, paths=paths_block(code))
    name = "{}_{}.md".format(code, re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")[:40])
    (agents / name).write_text(text, encoding="utf-8")
    codes.append(code)
(agents / "DS16_consolidate_missing_tokens.md").write_text(CONSOLIDATE, encoding="utf-8")
codes.append("DS16")
print(len(codes), "briefs:", ", ".join(codes))
for c in codes[:-1]:
    print(c, len(owned[c]), "files")
