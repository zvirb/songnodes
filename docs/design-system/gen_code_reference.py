#!/usr/bin/env python3
"""Regenerate the generated parts of docs/design-system/CODE_REFERENCE.md.

Run from the repo root:  python3 docs/design-system/gen_code_reference.py
Stdlib only. Reads design-system/ (read-only) and frontend/src/lib/songnodes.tsx,
and rewrites only the text between the <!-- BEGIN GENERATED: x --> / <!-- END GENERATED: x -->
markers. Everything outside the markers is hand-written and kept as is.

Generated parts:
  tokens      every token in design-system/tokens.json, grouped, value per theme where they differ
  helpers     the SongNodesHelpers interface from design-system/components/index.d.ts, verbatim
  react       export signatures from frontend/src/lib/songnodes.tsx
  components  first ```html block of each design-system/components/<Comp>/README.md, in README index order
              (components whose README has no html block fall back to preview.html, see fallback())
"""
import html.parser
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DS = ROOT / "design-system"
OUT = Path(__file__).resolve().parent / "CODE_REFERENCE.md"
WRAPPER = ROOT / "frontend" / "src" / "lib" / "songnodes.tsx"

FENCE = "`" * 3


# ---------------------------------------------------------------- tokens
def css_value(v):
    """tokens.json alias "{name}" -> var(--name), as tokens.css writes it."""
    if isinstance(v, str):
        m = re.fullmatch(r"\{([a-z0-9.-]+)\}", v)
        if m:
            return "var(--%s)" % m.group(1)
    return str(v)


def themed(v, themes):
    if isinstance(v, dict):
        vals = [css_value(v[t]) for t in themes]
        if len(set(vals)) == 1:
            return "`%s`" % vals[0]
        return " · ".join("%s `%s`" % (t, css_value(v[t])) for t in themes)
    return "`%s`" % css_value(v)


def cell(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


COLOUR_GROUPS = [
    ("Surfaces and lines", lambda n: n in ("bg", "sunk", "line", "line-strong", "overlay", "hover-bg", "flag-bg") or n.startswith("surface-")),
    ("Text", lambda n: n == "fg" or n.startswith("fg-")),
    ("Brand, link, focus", lambda n: n.startswith("brand") or n in ("on-brand", "link", "focus")),
    ("Modules", lambda n: n.startswith("mod-") or n.startswith("on-mod-")),
    ("Status", lambda n: n.startswith("status-") or n == "on-status-bad"),
    ("Compatibility", lambda n: n.startswith("compat-")),
    ("Progress", lambda n: n.startswith("progress-")),
    ("Energy 1–10", lambda n: n.startswith("energy-")),
    ("Camelot keys", lambda n: n.startswith("key-")),
    ("Charts", lambda n: n.startswith("chart-")),
    ("Now, similarity, services", lambda n: True),
]


def gen_tokens():
    d = json.loads((DS / "tokens.json").read_text(encoding="utf-8"))
    themes = [t["id"] for t in d["color"]["themes"]]
    out = ["<!-- tokens.json %s; themes: %s -->" % (d["version"], ", ".join("%s (%s)" % (t["id"], t["name"]) for t in d["color"]["themes"])), ""]
    n_total = 0

    # colour
    out.append("### Colour (`var(--name)`; value per theme where they differ)")
    out.append("")
    placed = set()
    for title, pred in COLOUR_GROUPS:
        rows = [t for t in d["color"]["tokens"] if t["name"] not in placed and pred(t["name"])]
        if not rows:
            continue
        out += ["#### " + title, "", "| Token | Value | Usage |", "|---|---|---|"]
        for t in rows:
            placed.add(t["name"])
            out.append("| `--%s` | %s | %s |" % (t["name"], cell(themed(t["value"], themes)), cell(t.get("usage", ""))))
            n_total += 1
        out.append("")

    # type
    ty = d["type"]
    out += ["### Type", "", "#### Families", "", "| Token | Value |", "|---|---|"]
    for k, v in ty["families"].items():
        out.append("| `--font-%s` | `%s` |" % (k, cell(v)))
        n_total += 1
    out += ["", "#### Font files (`@font-face` in tokens.css)", "", "| Family | File | Weight | Style |", "|---|---|---|---|"]
    for f in ty["fonts"]:
        out.append("| %s | `design-system/%s` | %s | %s |" % (f["family"], f["file"], f["weight"], f["style"]))
        n_total += 1
    out += ["", "#### Text styles (class `.name`; titles: `.sn-title .name`)", "",
            "| Class | Family | Size | Line height | Weight | Letter spacing | Usage |", "|---|---|---|---|---|---|---|"]
    for g in ty["groups"]:
        for s in g["styles"]:
            out.append("| `.%s` | `--font-%s` | `%s` | `%s` | `%s` | %s | %s |" % (
                s["name"], g["family"], s["fontSize"], s["lineHeight"], s["fontWeight"],
                "`%s`" % s["letterSpacing"] if s.get("letterSpacing") else "–", cell(s.get("usage", ""))))
            n_total += 1
    out.append("")

    # scales
    scale_titles = [("spacing", "Spacing"), ("radius", "Radius"), ("shadow", "Shadow"), ("size", "Size"),
                    ("zIndex", "Z-index"), ("duration", "Duration"), ("easing", "Easing"),
                    ("breakpoint", "Breakpoint (reference values; media queries cannot read var())"), ("opacity", "Opacity")]
    for key, title in scale_titles:
        grp = d[key]
        out += ["### " + title, ""]
        if grp.get("note"):
            out += ["<!-- %s -->" % grp["note"], ""]
        out += ["| Token | Value | Usage |", "|---|---|---|"]
        for t in grp["tokens"]:
            name = t["name"].replace(".", "\\.")  # tokens.css escapes the dot: --space-0\.5
            out.append("| `--%s` | %s | %s |" % (name, cell(themed(t["value"], themes)), cell(t.get("usage", ""))))
            n_total += 1
        out.append("")
    return "\n".join(out).rstrip() + "\n", n_total


# ---------------------------------------------------------------- helpers
def gen_helpers():
    src = (DS / "components" / "index.d.ts").read_text(encoding="utf-8")
    start = src.index("/* ---- window.SongNodes helpers")
    body = src[start:].rstrip()
    return "%sts\n// design-system/components/index.d.ts (verbatim)\n%s\n%s\n" % (FENCE, body, FENCE)


# ---------------------------------------------------------------- react wrapper
def gen_react():
    if not WRAPPER.exists():
        return "<!-- frontend/src/lib/songnodes.tsx not found -->\n"
    src = WRAPPER.read_text(encoding="utf-8")
    sigs = []
    for m in re.finditer(r"^export\s+(type|const|function|interface)\b", src, re.M):
        i = m.start()
        depth, j = 0, i
        while j < len(src):
            c = src[j]
            if c in "<({[":
                depth += 1
            elif c in ">)}]":
                # ignore the '>' of an arrow '=>'
                if not (c == ">" and src[j - 1] == "="):
                    depth -= 1
            elif depth == 0 and (src.startswith(" = ", j) or c == ";"):
                break
            j += 1
        sig = src[i:j].strip()
        sig = re.sub(r"\s+", " ", sig)
        if re.fullmatch(r"export const \w+", sig):  # untyped arrow: keep its parameter list
            line = src[i:src.index("\n", i)]
            sig = line.rstrip().rstrip(";")
        if sig.startswith("export type {"):
            sig += ";"
        sigs.append(sig + (";" if not sig.endswith(";") else ""))
    out = ["%stsx" % FENCE, "// frontend/src/lib/songnodes.tsx exports (signatures)",
           "import { SN, SnIcon, Title, EnergyBar, KeyBadge, Bpm, StatusPill, CompatPill, MODULE_ROUTES, moduleOf } from '../lib/songnodes';"]
    out += sigs
    shell = ROOT / "frontend" / "src" / "shell"
    for f in ("AppShell.tsx", "PageParts.tsx", "PreferencesPanel.tsx"):
        p = shell / f
        if not p.exists():
            continue
        s = p.read_text(encoding="utf-8")
        out.append("// frontend/src/shell/%s" % f)
        for m in re.finditer(r"^export\s+(?:const|function)\s+(\w+)[^\n]*", s, re.M):
            line = m.group(0)
            line = re.sub(r"\s*=\s*\(.*$", "", line).rstrip(" {")
            out.append(line + ";")
    out.append(FENCE)
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- components
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent, self.kids = tag, attrs, parent, []


class Tree(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node("#root", [])
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        if data.strip():
            self.cur.kids.append(re.sub(r"\s+", " ", data.strip()))

    def handle_entityref(self, name):
        self.handle_data("&%s;" % name)

    def handle_charref(self, name):
        self.handle_data("&#%s;" % name)


def attr_str(attrs):
    keep = []
    for k, v in attrs:
        if k == "style":
            continue
        keep.append(k if v is None else '%s="%s"' % (k, v.replace('"', "&quot;")))
    return (" " + " ".join(keep)) if keep else ""


def sig(n):
    return (n.tag, dict(n.attrs).get("class", "")) if isinstance(n, Node) else ("#text", "")


def skeleton(n, depth, max_depth, ind=""):
    lines = []
    kids = n.kids
    i = 0
    while i < len(kids):
        k = kids[i]
        j = i + 1
        while j < len(kids) and isinstance(k, Node) and sig(kids[j]) == sig(k):
            j += 1
        if isinstance(k, str):
            lines.append(ind + (k if len(k) <= 60 else k[:57].rstrip() + "…"))
        else:
            open_ = "<%s%s>" % (k.tag, attr_str(k.attrs))
            if k.tag in VOID:
                lines.append(ind + open_)
            elif not k.kids:
                lines.append(ind + open_ + "</%s>" % k.tag)
            elif depth >= max_depth:
                lines.append(ind + open_ + "…</%s>" % k.tag)
            else:
                lines.append(ind + open_)
                lines += skeleton(k, depth + 1, max_depth, ind + "  ")
                lines.append(ind + "</%s>" % k.tag)
            if j - i > 1:
                lines.append(ind + "<!-- … %d more like this -->" % (j - i - 1))
        i = j
    return lines


def dedent(s):
    ls = [l.rstrip() for l in s.strip("\n").splitlines()]
    pad = min((len(l) - len(l.lstrip()) for l in ls if l.strip()), default=0)
    return "\n".join(l[pad:] for l in ls)


def fallback(comp):
    """No ```html block in the README: take the static markup of components/<Comp>/preview.html.
    Scripts and preview labels are dropped and the .sn-preview wrapper is unwrapped. Short markup is
    kept verbatim; long page markup becomes a depth-limited skeleton (repeated siblings folded)."""
    p = DS / "components" / comp / "preview.html"
    src = p.read_text(encoding="utf-8")
    body = re.search(r"<body>(.*)</body>", src, re.S)
    body = body.group(1) if body else src
    body = re.sub(r"<script\b.*?</script[^>]*>", "", body, flags=re.S | re.I)
    body = re.sub(r'\s*<div class="sn-preview__label"[^>]*>.*?</div>', "", body, flags=re.S)
    m = re.match(r'\s*<div class="sn-preview[^"]*"[^>]*>(.*)</div>\s*$', body, re.S)
    inner = m.group(1) if m else body
    note = "<!-- %s/README.md has no html block: static markup from components/%s/preview.html" % (comp, comp)
    if len(inner) <= 3500:
        return note + " (verbatim, scripts removed) -->\n" + dedent(inner)
    t = Tree()
    t.feed(inner)
    return note + " (skeleton: depth 4, repeats folded; full markup there) -->\n" + "\n".join(skeleton(t.root, 0, 4))


def gen_components():
    readme = (DS / "README.md").read_text(encoding="utf-8")
    idx = readme[readme.index("## Index"):]
    out, n = [], 0
    for line in idx.splitlines():
        g = re.match(r"- \*\*(\w[\w ]*)\*\*: ", line)
        if not g:
            continue
        names = re.findall(r"`([A-Z][A-Za-z0-9]+)` — ", line)
        out += ["### %s (%d)" % (g.group(1), len(names)), ""]
        for comp in names:
            r = (DS / "components" / comp / "README.md").read_text(encoding="utf-8")
            m = re.search(r"^%shtml\n(.*?)^%s" % (FENCE, FENCE), r, re.S | re.M)
            code = m.group(1).rstrip("\n") if m else fallback(comp)
            out += ["#### %s" % comp, "", FENCE + "html", code, FENCE, ""]
            n += 1
    return "\n".join(out).rstrip() + "\n", n


# ---------------------------------------------------------------- write
def replace(doc, key, body):
    b, e = "<!-- BEGIN GENERATED: %s -->" % key, "<!-- END GENERATED: %s -->" % key
    if b not in doc or e not in doc:
        sys.exit("CODE_REFERENCE.md is missing the %s markers" % key)
    pre, rest = doc.split(b, 1)
    _, post = rest.split(e, 1)
    return pre + b + "\n" + body + e + post


def main():
    doc = OUT.read_text(encoding="utf-8")
    tokens, n_tokens = gen_tokens()
    comps, n_comps = gen_components()
    doc = replace(doc, "tokens", tokens)
    doc = replace(doc, "helpers", gen_helpers())
    doc = replace(doc, "react", gen_react())
    doc = replace(doc, "components", comps)
    OUT.write_text(doc, encoding="utf-8")
    print("CODE_REFERENCE.md: %d tokens, %d components" % (n_tokens, n_comps))


if __name__ == "__main__":
    main()
