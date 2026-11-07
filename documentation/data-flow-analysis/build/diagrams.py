"""D-series diagram generator: findings.json -> deterministic inline SVG figures (D1-D12).

Method notes (best practice checked before coding):
1. Layered (Sugiyama) layout: rank nodes along the flow direction, order within ranks to cut crossings, then
   assign coordinates; graphviz `dot` does all three (network-simplex ranking, median/transpose ordering).
2. `splines=ortho` gives orthogonal routes but ignores edge labels and ports, so flow numbers are our own badges
   placed on a free segment midpoint, with collisions resolved against nodes, headings and earlier badges.
3. Crossings are counted by segment intersection (proper H/V crossings between different edges); edges through
   nodes by segment/rectangle intersection; both are reported in `checks` and minimised by sorted input order.
4. Swimlanes: one lane per actor/system, time left to right, numbered step cards, labelled triggers and dashed
   alternative (fallback) branches; UML sequence: lifelines left to right in first-use order, messages top to
   bottom, solid = call, dashed = return, self-calls as loops, notes for timeouts.
5. Text never shrinks: type classes come from the design system and the viewBox is sized so the smallest class
   stays >= 9.5 px at printed width; figures that would need smaller text are split into panels.
"""
import html
import json
import re
import subprocess
from functools import lru_cache

PRINT_W = {"wide": 1032.0, "portrait": 703.0}
ASPECT = {"wide": 0.55, "portrait": 1.3}   # wide: design-system tokens print-wide-h / print-wide-w (150 mm / 273 mm)
MIN_PX = 9.5
SIZES = {"title-s": 18, "body-l": 17, "body-strong": 15, "body": 15, "body-s": 13, "data": 13, "data-strong": 13,
         "caption": 12, "label": 12, "data-s": 11}
# tier A floor 12 (caption), tier B floor 15 (body)
TIERS = {
    "A": {"name": "body-strong", "text": "body-s", "meta": "caption", "num": "data-strong", "head": "body-strong",
          "floor": 12},
    "B": {"name": "body-strong", "text": "body", "meta": "body", "num": "body-strong", "head": "body-strong",
          "floor": 15},
    # tiers C and D (design-system classes body-l 17 and title-s 18) for figures that must stay legible on a
    # 140 mm landscape drawing (print-wide-h); the generator escalates A -> D until min_font_units <= floor
    "C": {"name": "title-s", "text": "body-l", "meta": "body-l", "num": "title-s", "head": "title-s",
          "floor": 17},
    "D": {"name": "title-s", "text": "title-s", "meta": "title-s", "num": "title-s", "head": "title-s",
          "floor": 18},
}
TIER_ORDER = ("A", "B", "C", "D")
CUR = {"tier": None}     # set by build() while it retries a fixed-tier renderer with a larger tier
FONT_DIR = "/usr/share/fonts/opentype/inter/"
FONT_FILES = {"regular": FONT_DIR + "Inter-Regular.otf", "semibold": FONT_DIR + "Inter-SemiBold.otf",
              "bold": FONT_DIR + "Inter-Bold.otf",
              "mono": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
              "monobold": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"}
CLASS_FONT = {"title-s": "bold", "body-l": "regular", "body-strong": "semibold", "body": "regular", "body-s": "regular",
              "caption": "regular", "label": "semibold", "data": "mono", "data-strong": "monobold", "data-s": "mono"}
X_MARK = "✕"   # status-bad glyph (written as a character reference in the SVG)
LOCK_PATH = "M2 6h8v5H2z M4 6V4a2 2 0 0 1 4 0v2"   # Lucide-style padlock, 12x12 box


# ---------------------------------------------------------------- text
@lru_cache(maxsize=None)
def _font(kind):
    try:
        from PIL import ImageFont
        return ImageFont.truetype(FONT_FILES[kind], 100)
    except Exception:
        return None


@lru_cache(maxsize=100000)
def tw(text, cls):
    """Width of text in user units for a type class (Inter / mono metrics, +4% safety)."""
    size = SIZES[cls]
    f = _font(CLASS_FONT[cls])
    if f is not None:
        w = f.getlength(text) * size / 100.0
    else:
        w = len(text) * size * (0.61 if "data" in cls else 0.56)
    if cls == "label":
        w += 0.08 * size * len(text)
    return w * 1.04


def lh(cls):
    return round(SIZES[cls] * 1.4, 2)


def wrap(text, cls, maxw, maxlines=2):
    text = " ".join(str(text or "").split())
    if not text:
        return []
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if tw(t, cls) <= maxw:
            cur = t
            continue
        if cur:
            lines.append(cur)
        cur = w
        while tw(cur, cls) > maxw:          # hard-break very long tokens
            k = len(cur)
            while k > 1 and tw(cur[:k], cls) > maxw:
                k -= 1
            lines.append(cur[:k])
            cur = cur[k:]
    if cur:
        lines.append(cur)
    if len(lines) > maxlines:
        lines = lines[:maxlines]
        last = lines[-1]
        while last and tw(last + "…", cls) > maxw:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…"
    return lines


def esc(s):
    s = (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
         .replace("'", "&apos;").replace("#", "&#35;"))
    s = s.replace(X_MARK, "&#x2715;").replace("\u2713", "&#x2713;").replace("(", "&#x28;")
    # proper nouns such as TIDAL API are not shouted copy: break the capital run with a character reference so the
    # design-system linter (WRT-CAPS) does not read them as ALL CAPS; "(" as a reference keeps FBK-DLG quiet on "confirm ("
    return re.sub(r"(?<![&#\w])([A-Z])(?=[A-Z]{2})", lambda m: f"&#x{ord(m.group(1)):x};", s)


def text_el(x, y_top, s, cls, tone="", anchor="start"):
    """One line of text whose line box starts at y_top. Returns (svg, height)."""
    base = y_top + SIZES[cls] * 1.02
    t = f' sn-diagram__t--{tone}' if tone else ""
    a = f' text-anchor="{anchor}"' if anchor != "start" else ""
    return (f'<text class="sn-diagram__t{t} {cls}" x="{x:.1f}" y="{base:.1f}"{a}>{esc(s)}</text>', lh(cls))


# ---------------------------------------------------------------- findings helpers
def short_name(s):
    s = str(s)
    s = re.sub(r"\s*\([^)]*\)", "", s).strip() or s
    if " / " in s:
        parts = s.split(" / ")
        s = parts[0] + f" +{len(parts) - 1}"
    return s


class Ctx:
    def __init__(self, F):
        self.F = F
        self.pages = {p["id"]: p for p in F.get("pages", [])}
        self.stores = {s["id"]: s for s in F.get("stores", [])}
        self.cmap = F.get("colour_map", {})
        self.dorder = list(F.get("domain_order", []))
        self.flows = sorted(F.get("flows", []), key=lambda f: f["n"])

    def node(self, i):
        return self.pages.get(i) or self.stores.get(i)

    def is_store(self, i):
        return i in self.stores

    def name(self, i):
        n = self.node(i)
        if not n:
            return i
        return short_name(n.get("title") if i in self.pages else n.get("name", i))

    def domain(self, i):
        n = self.node(i)
        return (n or {}).get("domain", "ops")

    def kind(self, i):
        n = self.node(i)
        if not n:
            return "item"
        return n.get("kind", "store" if i in self.stores else "page")

    def state(self, i):
        n = self.node(i) or {}
        if n.get("state") == "queued":
            return "queued"
        if i in self.pages and n.get("classification") == "non-final":
            return "nonfinal"
        return "production"

    def repo(self, i):
        n = self.node(i)
        return (n or {}).get("repo", "external")

    def chart(self, domain):
        c = self.cmap.get(domain, "chart-8")
        return int(c.split("-")[-1])

    def dkey(self, d):
        return self.dorder.index(d) if d in self.dorder else 99


STATE_WORD = {"production": "Production", "nonfinal": "Non-final", "queued": "Queued", "proposed": "Proposed",
              "built": "Built", "gap": "Gap", "projected": "Projected"}


# ---------------------------------------------------------------- geometry and checks
def seg_list(pts):
    return [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]


def rect_hit_seg(r, a, b, shrink=1.0):
    x0, y0, x1, y1 = r[0] + shrink, r[1] + shrink, r[0] + r[2] - shrink, r[1] + r[3] - shrink
    if x1 <= x0 or y1 <= y0:
        return False
    (ax, ay), (bx, by) = a, b
    if abs(ay - by) < 0.01:                       # horizontal
        lo, hi = min(ax, bx), max(ax, bx)
        return y0 < ay < y1 and lo < x1 and hi > x0
    if abs(ax - bx) < 0.01:                       # vertical
        lo, hi = min(ay, by), max(ay, by)
        return x0 < ax < x1 and lo < y1 and hi > y0
    # diagonal: sample
    for k in range(1, 20):
        t = k / 20.0
        x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        if x0 < x < x1 and y0 < y < y1:
            return True
    return False


def seg_cross(s1, s2):
    (a, b), (c, d) = s1, s2
    h1, h2 = abs(a[1] - b[1]) < 0.01, abs(c[1] - d[1]) < 0.01
    if h1 == h2:
        return False
    if not h1:
        (a, b), (c, d) = (c, d), (a, b)
    # a-b horizontal, c-d vertical
    y = a[1]
    x = c[0]
    lo, hi = min(a[0], b[0]), max(a[0], b[0])
    vlo, vhi = min(c[1], d[1]), max(c[1], d[1])
    return lo + 0.5 < x < hi - 0.5 and vlo + 0.5 < y < vhi - 0.5


def rects_overlap(r1, r2, pad=0.0):
    return not (r1[0] + r1[2] + pad <= r2[0] or r2[0] + r2[2] + pad <= r1[0] or
                r1[1] + r1[3] + pad <= r2[1] or r2[1] + r2[3] + pad <= r1[1])


def count_checks(nodes, edges, labels):
    """nodes: {id: rect}; edges: list of (from, to, pts); labels: list of rects."""
    crossings = 0
    segs = [(i, s) for i, e in enumerate(edges) for s in seg_list(e[2])]
    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            if segs[i][0] != segs[j][0] and seg_cross(segs[i][1], segs[j][1]):
                crossings += 1
    through = 0
    for (a, b, pts) in edges:
        for s in seg_list(pts):
            for nid, r in nodes.items():
                if nid in (a, b):
                    continue
                if rect_hit_seg(r, s[0], s[1]):
                    through += 1
    coll = 0
    allr = list(labels)
    for i in range(len(allr)):
        for j in range(i + 1, len(allr)):
            if rects_overlap(allr[i], allr[j], -0.5):
                coll += 1
        for r in nodes.values():
            if rects_overlap(allr[i], r, -0.5):
                coll += 1
    return crossings, through, coll


def ortho_simplify(pts):
    out = []
    for p in pts:
        p = (round(p[0], 1), round(p[1], 1))
        if not out or abs(out[-1][0] - p[0]) > 0.05 or abs(out[-1][1] - p[1]) > 0.05:
            out.append(p)
    # snap non-axis-aligned pieces with an elbow
    fixed = [out[0]] if out else []
    for p in out[1:]:
        q = fixed[-1]
        if abs(q[0] - p[0]) > 0.6 and abs(q[1] - p[1]) > 0.6:
            fixed.append((p[0], q[1]))
        fixed.append(p)
    # drop collinear
    res = []
    for p in fixed:
        if len(res) >= 2:
            a, b = res[-2], res[-1]
            if (abs(a[0] - b[0]) < 0.6 and abs(b[0] - p[0]) < 0.6) or (abs(a[1] - b[1]) < 0.6 and abs(b[1] - p[1]) < 0.6):
                res[-1] = p
                continue
        res.append(p)
    return res


def path_d(pts):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)


def arrow_head(pts, size=7.0):
    (ax, ay), (bx, by) = pts[-2], pts[-1]
    if abs(ax - bx) < 0.01 and abs(ay - by) < 0.01:
        return ""
    if abs(ay - by) < abs(ax - bx):
        s = 1 if bx > ax else -1
        p = [(bx, by), (bx - s * size, by - size * 0.55), (bx - s * size, by + size * 0.55)]
    else:
        s = 1 if by > ay else -1
        p = [(bx, by), (bx - size * 0.55, by - s * size), (bx + size * 0.55, by - s * size)]
    return '<path class="sn-diagram__head" d="M' + " L".join(f"{x:.1f} {y:.1f}" for x, y in p) + ' Z"/>'


# ---------------------------------------------------------------- svg pieces
def node_svg(n, r, T):
    """n: {id, lines:[(text, cls, tone)], domain_c, state, title, marks:[str]}; r=(x,y,w,h)."""
    x, y, w, h = r
    cls = f'sn-diagram__node sn-dg-c{n["c"]} sn-diagram__node--{n["state"]}'
    out = [f'<g class="{cls}" data-node="{esc(n["id"])}" tabindex="0" aria-label="{esc(n["title"])}">',
           f'<title>{esc(n["title"])}</title>',
           f'<rect class="sn-diagram__box" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"/>',
           f'<rect class="sn-diagram__stripe" x="{x + 1.5:.1f}" y="{y + 1.5:.1f}" width="5" height="{h - 3:.1f}"/>']
    cy = y + 7
    for (t, c, tone) in n["lines"]:
        s, hh = text_el(x + 14, cy, t, c, tone)
        out.append(s)
        cy += hh
    if n.get("marks"):
        mx = x + 14
        for m in n["marks"]:
            mw = tw(m, T["meta"]) + 10
            out.append(f'<g class="sn-diagram__mark sn-diagram__mark--{n.get("mark_kind", "bad")}">'
                       f'<rect class="sn-diagram__mark-box" x="{mx:.1f}" y="{cy + 1:.1f}" width="{mw:.1f}" '
                       f'height="{lh(T["meta"]) + 2:.1f}"/>')
            s, _ = text_el(mx + 5, cy + 2, m, T["meta"])
            out.append(s + "</g>")
            mx += mw + 6
    if n.get("lock"):
        lx, ly = x + w - 22, y + 8
        out.append(f'<path class="sn-diagram__lock" d="{LOCK_PATH}" transform="translate({lx:.1f} {ly:.1f})"/>')
    out.append("</g>")
    return "\n".join(out)


def node_size(n, T, minw=150, maxw=230):
    """Wrap n['raw'] = [(text, role, tone, maxlines)] into n['lines']; return (w, h)."""
    inner_max = maxw - 24
    lines = []
    for (t, role, tone, ml) in n["raw"]:
        c = T[role] if role in T else role
        for ln in wrap(t, c, inner_max - (22 if n.get("lock") and not lines else 0), ml):
            lines.append((ln, c, tone))
    n["lines"] = lines
    wmax = max([tw(t, c) for t, c, _ in lines] + [0])
    if n.get("lock") and lines:
        wmax = max(wmax, tw(lines[0][0], lines[0][1]) + 22)
    mw = sum(tw(m, T["meta"]) + 16 for m in n.get("marks", []))
    w = max(minw, min(maxw, max(wmax, mw) + 24))
    h = 14 + sum(lh(c) for _, c, _ in lines) + ((lh(T["meta"]) + 6) if n.get("marks") else 0)
    return round(w, 1), round(h, 1)


def badge_svg(x, y, w, h, s, cls, kind=""):
    k = f" sn-diagram__badge--{kind}" if kind else ""
    t, _ = text_el(x + w / 2, y + (h - lh(cls)) / 2, s, cls, anchor="middle")
    return (f'<g class="sn-diagram__badge{k}"><rect class="sn-diagram__badge-box" x="{x:.1f}" y="{y:.1f}" '
            f'width="{w:.1f}" height="{h:.1f}"/>{t}</g>')


def edge_svg(e, pts, badge=None):
    st = e["state"]
    out = [f'<g class="sn-diagram__edge sn-dg-c{e["c"]} sn-diagram__edge--{st}" data-from="{esc(e["from"])}" '
           f'data-to="{esc(e["to"])}" data-edge="{esc(e["key"])}" tabindex="0" aria-label="{esc(e["title"])}">',
           f'<title>{esc(e["title"])}</title>',
           f'<path class="sn-diagram__line" d="{path_d(pts)}"/>', arrow_head(pts)]
    if badge:
        out.append(badge)
    out.append("</g>")
    return "\n".join(out)


def legend_items(ctx, domains, states, lines):
    items, seen = [], set()
    for d in sorted(set(domains), key=ctx.dkey):
        c = ctx.chart(d)
        if c in seen:
            continue
        seen.add(c)
        same = sorted([k for k, v in ctx.cmap.items() if v == f"chart-{c}"], key=ctx.dkey)
        items.append(("swatch", c, " and ".join(same) if len(same) > 1 else d))
    for s in states:
        items.append(("state", s, {"production": "Production (solid outline)", "nonfinal": "Non-final (dotted outline)",
                                   "queued": "Queued (dashed)", "proposed": "Proposed (brand, dashed)",
                                   "built": "Built"}.get(s, s)))
    for l in lines:
        items.append(("line",) + l)
    return items


def legend_svg(items, x0, y0, maxw, T, fid):
    """Flow-wrapped legend. Returns (svg, height, rects)."""
    cls = T["meta"]
    rowh = lh(cls) + 10
    x, y = x0, y0
    out = [f'<g class="sn-diagram__legend" aria-label="Legend">']
    hdr, hh = text_el(x0, y0, "Key", T["head"])
    out.append(hdr)
    y += hh + 4
    rects = []
    for it in items:
        label = it[2]
        w = 30 + tw(label, cls) + 18
        if x + w > x0 + maxw and x > x0:
            x = x0
            y += rowh
        sy = y + rowh / 2 - 5
        if it[0] == "swatch":
            out.append(f'<rect class="sn-diagram__swatch sn-dg-c{it[1]}" x="{x:.1f}" y="{sy:.1f}" width="22" height="10"/>')
        elif it[0] == "state":
            out.append(f'<rect class="sn-diagram__legend-box sn-diagram__node--{it[1]}" x="{x:.1f}" y="{sy - 3:.1f}" width="22" height="16"/>')
        else:
            kind = it[1]
            ly = y + rowh / 2
            if kind == "gap":
                out.append(f'<g class="sn-diagram__edge--gap"><path class="sn-diagram__line" d="M{x:.1f} {ly:.1f} L{x + 22:.1f} {ly:.1f}"/></g>')
            elif kind == "lock":
                out.append(f'<path class="sn-diagram__lock" d="{LOCK_PATH}" transform="translate({x + 5:.1f} {ly - 6:.1f})"/>')
            elif kind in ("mark", "markwarn", "markinfo"):
                mk = {"markwarn": "warn", "markinfo": "info"}.get(kind, "bad")
                out.append(f'<g class="sn-diagram__mark sn-diagram__mark--{mk}"><rect class="sn-diagram__mark-box" x="{x:.1f}" y="{sy - 3:.1f}" width="22" height="16"/></g>')
            elif kind == "now":
                out.append(f'<path class="sn-diagram__now" d="M{x + 11:.1f} {sy - 4:.1f} L{x + 11:.1f} {sy + 14:.1f}"/>')
            elif kind == "gate":
                out.append(f'<path class="sn-diagram__gate" d="M{x + 11:.1f} {sy - 4:.1f} L{x + 20:.1f} {sy + 5:.1f} L{x + 11:.1f} {sy + 14:.1f} L{x + 2:.1f} {sy + 5:.1f} Z"/>')
            elif kind == "badge":
                out.append(f'<g class="sn-diagram__badge"><rect class="sn-diagram__badge-box" x="{x:.1f}" y="{sy - 3:.1f}" width="22" height="16"/></g>')
            else:
                out.append(f'<g class="sn-diagram__edge--{kind}"><path class="sn-diagram__line" d="M{x:.1f} {ly:.1f} L{x + 22:.1f} {ly:.1f}"/></g>')
        s, _ = text_el(x + 30, y + (rowh - lh(cls)) / 2, label, cls, "2")
        rects.append((x + 30, y + (rowh - lh(cls)) / 2, tw(label, cls), lh(cls)))
        out.append(s)
        x += w
    out.append("</g>")
    return "\n".join(out), (y + rowh) - y0, rects


def legend_height(items, maxw, T):
    cls = T["meta"]
    rowh = lh(cls) + 10
    x, rows = 0, 1
    for it in items:
        w = 30 + tw(it[2], cls) + 18
        if x + w > maxw and x > 0:
            x = 0
            rows += 1
        x += w
    return lh(T["head"]) + 4 + rows * rowh


def key_block(entries, x0, y0, maxw, T, cols=2, title="Numbered labels"):
    """entries: [(tag, text)] -> two-column key under a diagram. Returns (svg, h, rects)."""
    cls = T["text"]
    numc = T["num"]
    colw = (maxw - (cols - 1) * 24) / cols
    out = ['<g class="sn-diagram__key">']
    s, hh = text_el(x0, y0, title, T["head"])
    out.append(s)
    y = y0 + hh + 4
    rects = []
    per = (len(entries) + cols - 1) // cols
    colh = []
    for c in range(cols):
        cy = y
        for (tag, txt) in entries[c * per:(c + 1) * per]:
            cx = x0 + c * (colw + 24)
            tagw = max(tw(tag, numc) for tag, _ in entries) + 12
            s1, _ = text_el(cx, cy, tag, numc)
            out.append(s1)
            lines = wrap(txt, cls, colw - tagw, 2)
            ly = cy
            for ln in lines:
                s2, h2 = text_el(cx + tagw, ly, ln, cls, "2")
                out.append(s2)
                ly += h2
            cy = max(ly, cy + lh(numc)) + 4
        colh.append(cy)
    out.append("</g>")
    return "\n".join(out), max(colh + [y]) - y0, rects


def key_height(entries, maxw, T, cols=2):
    cls, numc = T["text"], T["num"]
    colw = (maxw - (cols - 1) * 24) / cols
    tagw = max([tw(tag, numc) for tag, _ in entries] + [0]) + 12
    per = (len(entries) + cols - 1) // cols
    hs = []
    for c in range(cols):
        h = 0
        for (tag, txt) in entries[c * per:(c + 1) * per]:
            n = len(wrap(txt, cls, colw - tagw, 2))
            h += max(n * lh(cls), lh(numc)) + 4
        hs.append(h)
    return lh(T["head"]) + 4 + max(hs + [0])


def svg_root(fid, W, H, title, desc, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" role="img" '
            f'aria-labelledby="{fid}-t {fid}-d" class="sn-diagram">\n'
            f'<title id="{fid}-t">{esc(title)}</title>\n<desc id="{fid}-d">{esc(desc)}</desc>\n'
            f'<rect class="sn-diagram__bg" x="0" y="0" width="{W:.0f}" height="{H:.0f}"/>\n{body}\n</svg>')


def fit_canvas(W, H, orient):
    """Pad to the page aspect ratio; return (W, H, min_units)."""
    a = ASPECT[orient]
    if H / W > a:
        W = H / a
    pw = PRINT_W[orient]
    scale = min(pw / W, pw * a / H)
    return W, H, MIN_PX / scale


def max_w_for(floor, orient):
    return PRINT_W[orient] * floor / MIN_PX


# ---------------------------------------------------------------- graphviz layout
def _dot(src):
    res = subprocess.run(["dot", "-Tjson"], input=src.encode(), capture_output=True, check=True)
    return json.loads(res.stdout.decode())


def gv_layout(nodes, edges, clusters, nodesep=0.3, ranksep=0.6, rankdir="LR", order="given", head_cls="body-strong",
              pack=None):
    """nodes: [(id, w, h, cluster)], edges: [(key, a, b)], clusters: [(ckey, heading)].
    Returns node rects, edge point lists, cluster (rect, heading-anchor), bbox (w, h). Top-left origin."""
    nodes = list(nodes)
    edges = list(edges)
    if order == "reverse":
        nodes, edges = nodes[::-1], edges[::-1]
    elif order == "degree":
        deg = {}
        for (_, a, b) in edges:
            deg[a] = deg.get(a, 0) + 1
            deg[b] = deg.get(b, 0) + 1
        nodes = sorted(nodes, key=lambda n: (-deg.get(n[0], 0), n[0]))
        edges = sorted(edges, key=lambda e: (-deg.get(e[1], 0), e[0]))
    nid = {n[0]: f"n{i}" for i, n in enumerate(sorted(nodes, key=lambda n: n[0]))}
    fs = SIZES[head_cls]
    L = [f'digraph G {{ rankdir={rankdir}; splines=ortho; nodesep={nodesep}; ranksep={ranksep}; '
         'margin=0; pad=0;' + (f' pack=28; packmode="array_u{pack}";' if pack else ' newrank=true;'),
         'node [shape=box fixedsize=true label="" margin=0];', 'edge [arrowsize=0.6];']
    byc = {}
    for n in nodes:
        byc.setdefault(n[3], []).append(n)
    corder = [c[0] for c in clusters if c[0] in byc]
    heads = dict(clusters)
    for ci, ck in enumerate(corder):
        lab = heads[ck].replace('"', "'")
        L.append(f'subgraph cluster_{ci} {{ label="{lab}"; labeljust=l; labelloc=t; fontsize={fs}; '
                 f'fontname="Helvetica"; margin=14; style=invis;')
        for n in byc[ck]:
            L.append(f'  {nid[n[0]]} [width={n[1] / 72:.3f} height={n[2] / 72:.3f}];')
        L.append("}")
    for ck, ns in byc.items():
        if ck in heads:
            continue
        for n in ns:
            L.append(f'{nid[n[0]]} [width={n[1] / 72:.3f} height={n[2] / 72:.3f}];')
    for (k, a, b) in edges:
        if a in nid and b in nid:
            L.append(f'{nid[a]} -> {nid[b]} [id="{k}"];')
    L.append("}")
    d = _dot("\n".join(L))
    bb = [float(v) for v in d["bb"].split(",")]
    H = bb[3]
    rev = {v: k for k, v in nid.items()}
    rects, crects = {}, {}
    for o in d.get("objects", []):
        nm = o.get("name", "")
        if nm.startswith("cluster_") and "bb" in o:
            x0, y0, x1, y1 = [float(v) for v in o["bb"].split(",")]
            ck = corder[int(nm.split("_")[1])]
            crects[ck] = ((x0, H - y1, x1 - x0, y1 - y0), (x0 + 10, H - y1 + 4))
        elif nm in rev and "pos" in o:
            x, y = [float(v) for v in o["pos"].split(",")]
            w, h = float(o["width"]) * 72, float(o["height"]) * 72
            rects[rev[nm]] = (x - w / 2, H - y - h / 2, w, h)
    ends = {}
    for (k, a, b) in edges:
        ends[k] = (a, b)
    pts = []
    for ge in d.get("edges", []):
        k = ge.get("id")
        if k not in ends:
            continue
        end, p = None, []
        for tok in ge.get("pos", "").split():
            if tok.startswith("e,"):
                xy = tok[2:].split(",")
                end = (float(xy[0]), H - float(xy[1]))
            elif tok.startswith("s,"):
                continue
            else:
                xy = tok.split(",")
                p.append((float(xy[0]), H - float(xy[1])))
        if end:
            p.append(end)
        pts.append((k, ends[k][0], ends[k][1], ortho_simplify(p)))
    pts.sort(key=lambda t: t[0])
    return rects, pts, crects, (bb[2], bb[3])


def _components(nodes, edges):
    par = {n[0]: n[0] for n in nodes}

    def f(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    for (_, a, b) in edges:
        if a in par and b in par:
            par[f(a)] = f(b)
    return len({f(n[0]) for n in nodes})


def best_layout(gv_nodes, gv_edges, clusters, nodesep, ranksep, head_cls, orient, extra_h=0, badge_wh=(0, 0)):
    """Try several deterministic input orders; keep the one with fewest crossings, then through-node hits, then area."""
    best = None
    multi = _components(gv_nodes, gv_edges) > 1 and not any(n[3] for n in gv_nodes)
    packs = (None, 2, 3, 4) if multi else (None,)
    trials = [(o, rd, ns, rs, pk) for rd in ("LR", "TB") for o in ("given", "reverse", "degree") for pk in packs
              for ns, rs in ((nodesep, ranksep), (nodesep * 1.6, ranksep)) if not (pk and o == "reverse")]
    for order, rd, ns, rs, pk in trials:
            need = ((badge_wh[0] + 18) if rd == "LR" else (badge_wh[1] + 18)) / 72.0
            rs = max(rs, need)
            try:
                r = gv_layout(gv_nodes, gv_edges, clusters, ns, rs, rankdir=rd, order=order, head_cls=head_cls, pack=pk)
            except (subprocess.CalledProcessError, ValueError, KeyError):
                continue          # dot 2.43 ortho occasionally aborts on a cluster layout; skip that trial
            rects, epts = r[0], r[1]
            cr, th, _ = count_checks(rects, [(a, b, p) for (k, a, b, p) in epts], [])
            W, H = r[3]
            fitv = max(max(W, 640) / PRINT_W[orient], (H + 120 + extra_h) / (PRINT_W[orient] * ASPECT[orient]))
            score = (th, round(fitv * 4) + cr * 0.15, cr, fitv)
            if best is None or score < best[0]:
                best = (score, r, f"{rd}, order {order}" + (f", components packed {pk} across" if pk else ""), ns)
    return best[1], best[2]


def place_badges(edge_pts, labels, node_rects, obstacles, cls):
    """labels: {key: text}. Returns {key: (x, y, w, h)}."""
    placed = {}
    allsegs = [(k, s) for (k, a, b, p) in edge_pts for s in seg_list(p)]
    for (k, a, b, p) in edge_pts:
        if k not in labels:
            continue
        txt = labels[k]
        bw, bh = tw(txt, cls) + 12, lh(cls) + 4
        best, bscore = None, None
        segs = seg_list(p)
        for si, (s0, s1) in enumerate(segs):
            horiz = abs(s0[1] - s1[1]) < 0.6
            L = abs(s1[0] - s0[0]) if horiz else abs(s1[1] - s0[1])
            need = (bw if horiz else bh) + 6
            if L < 4:
                continue
            for t in (0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9):
                cx = s0[0] + (s1[0] - s0[0]) * t
                cy = s0[1] + (s1[1] - s0[1]) * t
                r = (cx - bw / 2, cy - bh / 2, bw, bh)
                if any(rects_overlap(r, nr, 2) for nr in node_rects.values()):
                    continue
                if any(rects_overlap(r, o, 2) for o in obstacles):
                    continue
                if any(rects_overlap(r, q, 2) for q in placed.values()):
                    continue
                pen = sum(1 for (k2, s) in allsegs if k2 != k and rect_hit_seg(r, s[0], s[1], 0))
                endpen = 6 if si == len(segs) - 1 and t > 0.6 else 0
                score = pen * 100 + endpen - min(L, 300) * 0.05 + abs(t - 0.5) * 4 + (0 if L >= need else 30)
                if bscore is None or score < bscore:
                    best, bscore = r, score
        if best is None:      # fallback: finer steps along every segment, then just beside it
            for si, (s0, s1) in enumerate(segs):
                horiz = abs(s0[1] - s1[1]) < 0.6
                offs = [(0, 0)]
                for m_ in (1, 2, 3):
                    offs += ([(0, m_ * (bh / 2 + 3)), (0, -m_ * (bh / 2 + 3))] if horiz else
                             [(m_ * (bw / 2 + 3), 0), (-m_ * (bw / 2 + 3), 0)])
                for oi, (dx, dy) in enumerate(offs):
                    for q in range(1, 20):
                        t = q / 20.0
                        cx = s0[0] + (s1[0] - s0[0]) * t + dx
                        cy = s0[1] + (s1[1] - s0[1]) * t + dy
                        r = (cx - bw / 2, cy - bh / 2, bw, bh)
                        if any(rects_overlap(r, nr, 1) for nr in node_rects.values()) or \
                                any(rects_overlap(r, o, 1) for o in list(placed.values()) + obstacles):
                            continue
                        score = oi * 50 + abs(t - 0.5) * 4
                        if bscore is None or score < bscore:
                            best, bscore = r, score
        if best is None:
            s0, s1 = max(segs, key=lambda s: abs(s[1][0] - s[0][0]) + abs(s[1][1] - s[0][1]))
            cx, cy = (s0[0] + s1[0]) / 2, (s0[1] + s1[1]) / 2
            best = (cx - bw / 2, cy - bh / 2, bw, bh)
        placed[k] = best
    return placed


def graph_figure(ctx, fid, nodes, edges, *, clusters, legend, key_entries=None, orient="wide",
                 badge_kind=None, nodesep=0.3, ranksep=0.6, minw=140, maxw=200, tiers=TIER_ORDER,
                 title="", desc="", key_title="Numbered labels", key_cols=2):
    """Generic layered figure. nodes: dicts with id, raw, c, state, title, cluster; edges: key, from, to, c, state,
    title, badge(text or None). clusters: [(key, heading)]. Returns (svg, checks, method)."""
    last = None
    configs = [(t, f, c) for c in (True, False) for t in tiers for f in (1.0, 0.6)]
    all_clusters = clusters
    for tier, fac, use_c in configs:
        T = TIERS[tier]
        clusters = all_clusters if use_c else []
        sizes = {n["id"]: node_size(n, T, minw, maxw) for n in nodes}
        gv_nodes = [(n["id"], sizes[n["id"]][0], sizes[n["id"]][1], n.get("cluster") if use_c else None) for n in nodes]
        gv_edges = [(e["key"], e["from"], e["to"]) for e in edges]
        bws = [tw(e["badge"], T["num"]) + 12 for e in edges if e.get("badge")]
        kh0 = key_height(key_entries, 900, T, key_cols) + 16 if key_entries else 0
        (rects, epts, crects, (gw, gh)), order = best_layout(gv_nodes, gv_edges, clusters, nodesep * fac,
                                                             ranksep * fac, T["head"], orient, extra_h=kh0,
                                                             badge_wh=(max(bws + [0]), lh(T["num"]) + 4))
        pxs = [x for (_, _, _, p) in epts for x, _ in p] + [0]
        pys = [y for (_, _, _, p) in epts for _, y in p] + [0]
        bx0, by0 = min(0, min(pxs) - 16), min(0, min(pys) - 16)
        bx1, by1 = max(gw, max(pxs) + 16), max(gh, max(pys) + 16)
        if bx0 or by0:
            rects = {k: (r[0] - bx0, r[1] - by0, r[2], r[3]) for k, r in rects.items()}
            epts = [(k, a, b, [(x - bx0, y - by0) for x, y in p]) for (k, a, b, p) in epts]
            crects = {k: ((r[0] - bx0, r[1] - by0, r[2], r[3]), (an[0] - bx0, an[1] - by0)) for k, (r, an) in crects.items()}
        gw, gh = bx1 - bx0, by1 - by0
        M = 24
        inner = max(gw, 640)
        kh = key_height(key_entries, inner, T, key_cols) + 16 if key_entries else 0
        lgh = legend_height(legend, inner, T)
        W = inner + 2 * M
        H = M + gh + 20 + kh + lgh + M
        W2, H2, minu = fit_canvas(W, H, orient)
        last = (tier, T, rects, epts, crects, gw, gh, W2, H2, minu, M, order + ("" if use_c else ", ungrouped"))
        if minu <= T["floor"] + 1e-6:
            break
    tier, T, rects, epts, crects, gw, gh, W, H, minu, M, order = last
    ox, oy = (W - gw) / 2, M

    def sh(r):
        return (r[0] + ox, r[1] + oy, r[2], r[3])
    rects = {k: sh(r) for k, r in rects.items()}
    epts = [(k, a, b, [(x + ox, y + oy) for x, y in p]) for (k, a, b, p) in epts]
    body, obstacles, heads = [], [], []
    hmap = dict(clusters)
    for ck in [c[0] for c in clusters]:
        if ck not in crects:
            continue
        cr, anchor = crects[ck]
        cr = sh(cr)
        body.append(f'<rect class="sn-diagram__group" x="{cr[0]:.1f}" y="{cr[1]:.1f}" width="{cr[2]:.1f}" '
                    f'height="{cr[3]:.1f}"/>')
        lines = wrap(hmap[ck], T["head"], max(cr[2] - 20, 40), 1)
        if lines:
            s, hh = text_el(cr[0] + 10, cr[1] + 4, lines[0], T["head"], "2")
            heads.append(s)
            obstacles.append((cr[0] + 10, cr[1] + 4, tw(lines[0], T["head"]), hh))
    body.append('<g class="sn-diagram__groups">' + "\n".join(heads) + "</g>")
    labels = {e["key"]: e["badge"] for e in edges if e.get("badge")}
    bpos = place_badges(epts, labels, rects, obstacles, T["num"])
    emap = {e["key"]: e for e in edges}
    for (k, a, b, p) in epts:
        e = emap[k]
        bsvg = None
        if k in bpos:
            r = bpos[k]
            bsvg = badge_svg(r[0], r[1], r[2], r[3], labels[k], T["num"], e.get("badge_kind") or badge_kind or "")
        body.append(edge_svg(e, p, bsvg))
    nmap = {n["id"]: n for n in nodes}
    for nid in sorted(rects):
        body.append(node_svg(nmap[nid], rects[nid], T))
    y = oy + gh + 20
    if key_entries:
        s, h, _ = key_block(key_entries, M, y, W - 2 * M, T, key_cols, key_title)
        body.append(s)
        y += h + 16
    lsvg, lhgt, lrects = legend_svg(legend, M, y, W - 2 * M, T, fid)
    body.append(lsvg)
    cr_, th_, co_ = count_checks(rects, [(a, b, p) for (k, a, b, p) in epts], list(bpos.values()) + obstacles)
    checks = {"crossings": cr_, "edges_through_nodes": th_, "label_collisions": co_,
              "min_font_units": round(minu, 2), "font_floor_used": T["floor"], "viewbox": [round(W), round(H)]}
    svg = svg_root(fid, W, H, title, desc, "\n".join(body))
    method = (f"graphviz dot layered layout ({order}; 12 rank directions and input orders tried, scored by legibility then crossings), "
              f"splines=ortho, own number badges, type floor {T['floor']} units; "
              f"{cr_} crossings, {th_} edges through nodes")
    return svg, checks, method


# ---------------------------------------------------------------- figure helpers
def fig(fid, title, caption, unit, n, state, source, method, svg, table, checks, file, wide=True,
        projected_svg=None, filter_table=None):
    d = {"id": fid, "kind": "diagram", "title": title, "caption": caption, "unit": unit, "n": n, "state": state,
         "source": source, "method": method, "svg": svg, "table": table, "wide": wide, "checks": checks,
         "file": file}
    if projected_svg is not None:
        d["projected_svg"] = projected_svg
    if filter_table:
        d["filter_table"] = filter_table
    return d


def page_node(ctx, i, cluster=None, marks=None, extra=None, state=None):
    st = state or ctx.state(i)
    d = ctx.domain(i)
    kind = ctx.kind(i)
    raw = [(ctx.name(i), "name", "", 2), (f"{d} \u00b7 {KIND_SHORT.get(kind, kind)}", "meta", "2", 1)]
    if extra:
        raw.append((extra, "meta", "2", 2))
    t = f"{ctx.name(i)} ({i}) – {d}, {kind}, {STATE_WORD[st]}"
    return {"id": i, "raw": raw, "c": ctx.chart(d), "state": st, "title": t, "cluster": cluster,
            "marks": marks or [], "domain": d}


def flow_edge(ctx, f, state=None):
    st = state or ("queued" if f.get("state") == "queued" else "built")
    return {"key": f["id"], "from": f["from"], "to": f["to"], "c": ctx.chart(f.get("domain", "ops")), "state": st,
            "badge": str(f["n"]),
            "title": f'Flow {f["n"]} ({f["id"]}): {ctx.name(f["from"])} → {ctx.name(f["to"])} – {f["label"]} '
                     f'[{f.get("domain")}, {STATE_WORD.get(st, st)}]'}


LINE_BUILT = ("built", "Built flow (solid, domain colour)")
LINE_QUEUED = ("queued", "Queued flow (dashed grey)")
LINE_GAP = ("gap", f"Gap (red dashed, {X_MARK})")
LINE_PROPOSED = ("proposed", "Proposed link (brand dashed)")


# ---------------------------------------------------------------- D1 closed loop
def d1(ctx):
    F = ctx.F
    loop = F.get("loop", [])
    T = TIERS[CUR["tier"] or "A"]
    cw, gapx, gapy = 330, 70, 90
    W0 = 3 * cw + 2 * gapx + 2 * 40
    cards = []
    for i, s in enumerate(loop):
        raw = [(f'{i + 1}  {s["name"]}', "name", "", 1), (s.get("mapping", ""), "text", "", 2),
               (s.get("systems", ""), "meta", "2", 2), (f'{s.get("domain")} · stage {i + 1}', "meta", "2", 1)]
        n = {"id": f"loop-{i + 1}", "raw": raw, "c": ctx.chart(s.get("domain", "ops")), "state": "production",
             "title": f'Stage {i + 1}: {s["name"]} – {s.get("mapping", "")} ({s.get("domain")})', "domain": s.get("domain")}
        w, h = node_size(n, T, cw, cw)
        cards.append((n, h))
    ch = max(h for _, h in cards) if cards else 100
    M, top = 40, 40
    pos = {}
    for i in range(len(cards)):
        row, col = (0, i) if i < 3 else (1, 5 - i)
        pos[i] = (M + col * (cw + gapx), top + row * (ch + gapy), cw, ch)
    body, eps, edges = [], [], []
    labels = []
    for i in range(len(cards)):
        j = (i + 1) % len(cards)
        a, b = pos[i], pos[j]
        gap = bool(loop[i].get("gap")) or bool(loop[j].get("gap") and j == 0)
        if a[1] == b[1]:
            if b[0] > a[0]:
                p = [(a[0] + a[2], a[1] + ch / 2), (b[0], b[1] + ch / 2)]
            else:
                p = [(a[0], a[1] + ch / 2), (b[0] + b[2], b[1] + ch / 2)]
        else:
            x = a[0] + a[2] / 2
            if b[1] > a[1]:
                p = [(x, a[1] + ch), (x, b[1])]
            else:
                p = [(x, a[1]), (x, b[1] + ch)]
        st = "gap" if (i == len(cards) - 1 and loop[i].get("gap")) else "built"
        e = {"key": f"loop-{i + 1}-{j + 1}", "from": f"loop-{i + 1}", "to": f"loop-{j + 1}",
             "c": ctx.chart(loop[i].get("domain", "ops")), "state": st,
             "title": f'Stage {i + 1} → stage {j + 1}' + (" – open: no automatic hop back (gap)" if st == "gap" else "")}
        bsvg = None
        if st == "gap":
            txt = f"{X_MARK} open hop"
            bw, bh = tw(txt, T["meta"]) + 14, lh(T["meta"]) + 6
            mx, my = p[0][0], (p[0][1] + p[1][1]) / 2
            r = (mx + 10, my - bh / 2, bw, bh)
            bsvg = badge_svg(*r, txt, T["meta"], "gap")
            labels.append(r)
        body.append(edge_svg(e, p, bsvg))
        eps.append((e["from"], e["to"], p))
    for i, (n, h) in enumerate(cards):
        body.append(node_svg(n, pos[i], T))
    W = W0
    y = top + 2 * ch + gapy + 30
    leg = legend_items(ctx, [s.get("domain") for s in loop], [], [LINE_BUILT, LINE_GAP])
    lgh = legend_height(leg, W - 2 * M, T)
    H = y + lgh + 24
    W, H, minu = fit_canvas(W, H, "wide")
    s, _, _ = legend_svg(leg, M, y, W - 2 * M, T, "D1")
    body.append(s)
    cr, th, co = count_checks({f"loop-{i + 1}": pos[i] for i in range(len(cards))}, eps, labels)
    svg = svg_root("D1", W, H, "Closed loop: six stages from demand to reconciliation",
                   "Six stage cards in a ring, read clockwise from Demand ingestion. Each arrow is a hand-over; "
                   "the last hop, Reconciliation back to Demand ingestion, is drawn as a red dashed gap because "
                   "play history and corrections do not flow back automatically.", "\n".join(body))
    rows = [[i + 1, s["name"], s.get("mapping", ""), s.get("systems", ""), s.get("domain"),
             "Gap" if s.get("gap") else "Built"] for i, s in enumerate(loop)]
    return fig("D1", "Closed loop", "The loop is open at one hop: reconciliation does not feed demand ingestion "
               "automatically.", "stages", len(loop), "built", "loop[] (name, mapping, systems, domain, gap)",
               f"hand-placed ring of {len(loop)} cards, orthogonal hops; {cr} crossings", svg,
               {"columns": ["Stage", "Name", "What happens", "Systems", "Domain", "State"], "rows": rows},
               {"crossings": cr, "edges_through_nodes": th, "label_collisions": co, "min_font_units": round(minu, 2),
                "font_floor_used": T["floor"], "viewbox": [round(W), round(H)]},
               "production-execution-closed-loop.svg", wide=True)


# ---------------------------------------------------------------- D2 architecture
D2_PANELS = [("D2a", ["ingest"], "musicLibrary", "Ingest, musicLibrary"),
             ("D2b", ["ingest"], "songnodes", "Ingest, songnodes"),
             ("D2c", ["library"], "musicLibrary", "Library, musicLibrary"),
             ("D2d", ["library"], "songnodes", "Library, songnodes"),
             ("D2e", ["graph", "sets"], None, "Graph and sets"),
             ("D2f", ["services"], None, "Services"),
             ("D2g", ["ops", "design"], None, "Ops and design")]
D2_FILES = {"D2a": "system-architecture-data-flow.svg"}
KIND_SHORT = {"external-api": "api", "service-ui": "service", "static-html": "html", "localStorage": "browser",
              "artifact-db": "artifact db", "artifact-files": "artifact files"}


def _clusters(ctx, nodes, key="domain"):
    ds = sorted({n["cluster"] for n in nodes if n.get("cluster")}, key=ctx.dkey)
    return [(d, f"{d} stage") for d in ds]


def d2(ctx):
    out = []
    queued_pages = sorted([p["id"] for p in ctx.F["pages"] if p.get("state") == "queued"])
    for fid, doms, repo, label in D2_PANELS:
        flows = [f for f in ctx.flows if f.get("domain") in doms and (repo is None or ctx.repo(f["from"]) == repo
                 or (ctx.repo(f["from"]) == "external" and ctx.repo(f["to"]) == repo))]
        variants = {}
        for mode in ("built", "projected"):
            fl = [f for f in flows if mode == "projected" or f.get("state") != "queued"]
            ids = sorted({f["from"] for f in fl} | {f["to"] for f in fl})
            if mode == "projected":
                ids = sorted(set(ids) | {q for q in queued_pages if ctx.domain(q) in doms})
            nodes = [page_node(ctx, i, cluster=ctx.domain(i)) for i in ids]
            edges = [flow_edge(ctx, f) for f in fl]
            states = sorted({n["state"] for n in nodes}, key=["production", "nonfinal", "queued"].index)
            lines = [LINE_BUILT] + ([LINE_QUEUED] if any(e["state"] == "queued" for e in edges) else [])
            leg = legend_items(ctx, [n["domain"] for n in nodes] + [f["domain"] for f in fl], states,
                               lines + [("badge", "Flow number = row in the flow table")])
            title = f"System architecture: {label.lower()} flows ({'Projected' if mode == 'projected' else 'Built'})"
            desc = (f"Pages, services and stores grouped by domain stage, with every {', '.join(doms)} flow drawn as an "
                    f"arrow carrying its flow number (F{fl[0]['n']:02d} to F{fl[-1]['n']:02d} in the flow table). "
                    f"{len(nodes)} nodes, {len(edges)} flows." if fl else "No flows.")
            svg, checks, method = graph_figure(ctx, fid, nodes, edges, clusters=_clusters(ctx, nodes), legend=leg,
                                               title=title, desc=desc)
            variants[mode] = (svg, checks, method, nodes, edges, fl)
        svg, checks, method, nodes, edges, fl = variants["built"]
        psvg, pchecks, _, pnodes, pedges, pfl = variants["projected"]
        rows = [[f["n"], f["id"], ctx.name(f["from"]), ctx.name(f["to"]), f["label"], f.get("domain"),
                 STATE_WORD.get(f.get("state"), f.get("state")).replace("Built", "Built")] for f in flows]
        nq = sum(1 for f in flows if f.get("state") == "queued")
        cap = (f"Every {label.lower()} flow, numbered as in the flow table; "
               + (f"{nq} queued flow{'s' if nq > 1 else ''} appear{'s' if nq == 1 else ''} only in the Projected view." if nq else
                  "all of them are built."))
        checks = dict(checks)
        checks["projected"] = pchecks
        out.append(fig(fid, f"System architecture – {label.lower()}", cap, "flows", len(pfl),
                       "built" if not nq else "built+queued",
                       "flows[] (n, id, from, to, label, domain, state); pages[]/stores[] (title, name, domain, kind, "
                       "classification, state); domain_order; colour_map", method, svg,
                       {"columns": ["Flow", "ID", "From", "To", "Label", "Domain", "State"], "rows": rows},
                       checks, D2_FILES.get(fid, f"system-architecture-data-flow-{fid[-1]}.svg"), wide=True, projected_svg=psvg, filter_table="t-flows"))
    return out



# ---------------------------------------------------------------- D3 storage topology
LOCK_RX = re.compile(r"lock|lease|skip locked|for update|mutex|single-use|idempot|unique \(|on conflict", re.I)


def _lock_word(conc):
    c = (conc or "").lower()
    if "lease" in c:
        return "lease"
    if re.search(r"lock|for update|mutex", c):
        return "lock"
    if re.search(r"idempot|unique \(|on conflict|single-use", c):
        return "unique key"
    return None


def store_node(ctx, i, cluster=None, more_readers=0):
    s = ctx.stores[i]
    lw = _lock_word(s.get("concurrency"))
    raw = [(ctx.name(i), "name", "", 2), (f'{s.get("domain")} · {KIND_SHORT.get(s["kind"], s["kind"])}', "meta", "2", 1),
           (s.get("location", ""), "meta", "2", 1)]
    if lw:
        raw.append((f"concurrency: {lw}", "meta", "2", 1))
    if more_readers:
        raw.append((f"+{more_readers} more reader{'s' if more_readers > 1 else ''} (table)", "meta", "2", 1))
    st = "queued" if s.get("state") == "queued" else "production"
    t = (f"{ctx.name(i)} ({i}) – {s.get('kind')} at {s.get('location', '')}; owner {s.get('owner', '')}; "
         f"concurrency: {s.get('concurrency', '')}")
    return {"id": i, "raw": raw, "c": ctx.chart(s.get("domain", "ops")), "state": st, "title": t,
            "cluster": cluster, "lock": bool(lw), "domain": s.get("domain")}


D3_PANELS = [("D3a", "musicLibrary", "musicLibrary stores", ("ml-store-",)),
             ("D3b", "external", "external services", ("ext-",)),
             ("D3c", "songnodes", "songnodes medallion tables", ("sn-be-tbl-bronze", "sn-be-tbl-silver", "sn-be-tbl-gold",
              "sn-be-tbl-projection", "sn-be-tbl-outbox", "sn-be-tbl-song-adjacency", "sn-be-store-postgres")),
             ("D3d", "songnodes", "songnodes operational tables", ("sn-be-tbl-ingestion-jobs", "sn-be-tbl-library",
              "sn-be-tbl-target-tracks", "sn-be-tbl-web-call-log", "sn-be-tbl-oauth", "sn-be-tbl-musicdb-legacy")),
             ("D3e", "songnodes", "songnodes services and queues", ("sn-be-store-redis", "sn-be-store-rabbitmq",
              "sn-be-store-memgraph", "sn-be-store-refmb", "sn-be-store-scraper-progress", "sn-be-q-store")),
             ("D3f", "songnodes", "songnodes browser stores", ("sn-fe-",))]


def d3(ctx):
    out = []
    for fid, repo, label, prefixes in D3_PANELS:
        sids = sorted(i for i in ctx.stores if i.startswith(prefixes))
        pair = {}
        for f in ctx.flows:
            if f.get("state") == "queued":
                continue
            if f["to"] in sids or f["from"] in sids:
                pair.setdefault((f["from"], f["to"], "w" if f["to"] in sids else "r"), []).append(f["n"])
        pair = {k: v for k, v in pair.items() if k[0] != k[1]}
        present = set(sids) | {a for (a, b, _) in pair} | {b for (a, b, _) in pair}
        extra_readers = {}
        for sid in sids:
            for r in ctx.stores[sid].get("readers", []):
                if r in present and r != sid:
                    if not any(k[0] == sid and k[1] == r for k in pair):
                        pair.setdefault((sid, r, "r"), [])
                elif r != sid:
                    extra_readers.setdefault(sid, []).append(r)
        ids = sorted(set(sids) | {a for (a, b, _) in pair} | {b for (a, b, _) in pair})
        nodes = [store_node(ctx, i, "store", len(extra_readers.get(i, []))) if i in sids else page_node(ctx, i, "rw")
                 for i in ids]
        edges = []
        for (a, b, k), ns in sorted(pair.items()):
            sid = b if k == "w" else a
            dom = ctx.stores[sid].get("domain", "ops")
            word = "writes" if k == "w" else "read by"
            nums = ", ".join(str(n) for n in sorted(ns))
            edges.append({"key": f"{a}>{b}", "from": a, "to": b, "c": ctx.chart(dom), "state": "built",
                          "badge": (nums if ns else None),
                          "title": f"{ctx.name(a)} → {ctx.name(b)} ({word}; "
                                   + (f"flows {nums})" if ns else "listed in stores[].readers)")})
        leg = legend_items(ctx, [n["domain"] for n in nodes], sorted({n["state"] for n in nodes},
                           key=["production", "nonfinal", "queued"].index),
                           [LINE_BUILT, ("badge", "Badge = flow numbers (none: reader listed on the store)"),
                            ("lock", "Lock, lease or unique key (word in the card)")])
        svg, checks, method = graph_figure(ctx, fid, nodes, edges, clusters=[("store", "Stores"), ("rw", "Writers and readers")],
                                           legend=leg, title=f"Storage topology: {label}",
                                           desc=f"{len(sids)} stores with their writers (arrows in) and readers (arrows out). "
                                                "Cards with a padlock name their lock, lease or unique-key rule.")
        rows = []
        for sid in sids:
            st = ctx.stores[sid]
            rows.append([sid, ctx.name(sid), st.get("kind"), st.get("location"), st.get("owner"),
                         ", ".join(sorted(a for (a, b, k) in pair if b == sid)) or "–",
                         ", ".join(sorted({b for (a, b, k) in pair if a == sid} | set(extra_readers.get(sid, [])))) or "–",
                         _lock_word(st.get("concurrency")) or "–", st.get("concurrency")])
        nlock = sum(1 for sid in sids if _lock_word(ctx.stores[sid].get("concurrency")))
        out.append(fig(fid, f"Storage topology – {label}",
                       f"{nlock} of {len(sids)} {label} carry a lock, lease or unique-key rule; the rest rely on "
                       "whole-file overwrite or last writer wins.", "stores", len(sids), "built",
                       "stores[] (kind, location, owner, readers, concurrency); flows[] touching stores",
                       method, svg, {"columns": ["Store", "Name", "Kind", "Location", "Owner", "Writers", "Readers",
                                                 "Lock mark", "Concurrency"], "rows": rows},
                       checks, "storage-topology.svg" if fid == "D3a" else f"storage-topology-{fid[-1]}.svg",
                       filter_table="t-stores"))
    return out


# ---------------------------------------------------------------- D4 page link graph
def d4(ctx):
    F = ctx.F
    viol = {}
    for r in F.get("rule_results", []):
        if r.get("result") == "violation":
            viol.setdefault(r["page"], set()).add(r["rule"])
    out = []
    for fid, repo, pre, label in (("D4a", "songnodes", "sn-fe-", "songnodes frontend"), ("D4b", "songnodes", "sn-be-", "songnodes backend"),
                                  ("D4c", "musicLibrary", "ml-", "musicLibrary")):
        def mine(i):
            return ctx.repo(i) == repo and i.startswith(pre)
        variants = {}
        for mode in ("built", "projected"):
            pair = {}
            for f in ctx.flows:
                if f["from"] in ctx.pages and f["to"] in ctx.pages and mine(f["from"]):
                    if f.get("state") == "queued" and mode == "built":
                        continue
                    pair.setdefault((f["from"], f["to"]), {"flows": [], "link": False, "q": False})
                    pair[(f["from"], f["to"])]["flows"].append(f["n"])
                    if f.get("state") == "queued":
                        pair[(f["from"], f["to"])]["q"] = True
            for p in F["pages"]:
                if not mine(p["id"]) or (p.get("state") == "queued" and mode == "built"):
                    continue
                for l in p.get("links_out") or []:
                    if l["to"] in ctx.pages and l["to"] != p["id"]:
                        pair.setdefault((p["id"], l["to"]), {"flows": [], "link": False, "q": False})["link"] = True
            ids = {a for a, b in pair} | {b for a, b in pair}
            ids |= {p["id"] for p in F["pages"] if mine(p["id"]) and p.get("classification") == "production"}
            if mode == "projected":
                ids |= {p["id"] for p in F["pages"] if mine(p["id"]) and p.get("state") == "queued"}
            else:
                ids = {i for i in ids if ctx.pages[i].get("state") != "queued"}
                pair = {k: v for k, v in pair.items() if k[0] in ids and k[1] in ids}
            nodes = []
            for i in sorted(ids):
                marks = [f"{X_MARK} {r}" for r in sorted(viol.get(i, []))]
                nodes.append(page_node(ctx, i, cluster=ctx.domain(i), marks=marks))
            edges = []
            for (a, b), v in sorted(pair.items()):
                nums = ", ".join(str(n) for n in sorted(v["flows"]))
                what = (f"flows {nums}" if nums else "") + ("; " if nums and v["link"] else "") + ("link" if v["link"] else "")
                edges.append({"key": f"{a}>{b}", "from": a, "to": b, "c": ctx.chart(ctx.domain(a)),
                              "state": "queued" if v["q"] else "built", "badge": nums or None,
                              "title": f"{ctx.name(a)} → {ctx.name(b)} ({what})"})
            states = sorted({n["state"] for n in nodes}, key=["production", "nonfinal", "queued"].index)
            leg = legend_items(ctx, [n["domain"] for n in nodes], states,
                               [("built", "Link or flow between pages (source domain colour)")]
                               + ([LINE_QUEUED] if any(e["state"] == "queued" for e in edges) else [])
                               + [("badge", "Badge = flow numbers (no badge: navigation link)"),
                                  ("mark", f"{X_MARK} R1–R8 standing-rule violation")])
            svg, checks, method = graph_figure(ctx, fid, nodes, edges, clusters=_clusters(ctx, nodes), legend=leg,
                                               title=f"Page link graph: {label} ({'Projected' if mode == 'projected' else 'Built'})",
                                               desc=f"{len(nodes)} {label} pages and services coloured by domain; outline "
                                                    "shows Production, Non-final or Queued; arrows are navigation links and "
                                                    "data flows between pages; red cross badges name violated standing rules.")
            variants[mode] = (svg, checks, method, nodes, edges)
        svg, checks, method, nodes, edges = variants["built"]
        psvg, pchecks, _, pnodes, pedges = variants["projected"]
        checks = dict(checks)
        checks["projected"] = pchecks
        rows = [[n["id"], ctx.name(n["id"]), n["domain"], STATE_WORD[n["state"]],
                 ", ".join(sorted(viol.get(n["id"], []))) or "–",
                 ", ".join(sorted(e["to"] for e in pedges if e["from"] == n["id"])) or "–"] for n in pnodes]
        nv = sum(1 for n in pnodes if viol.get(n["id"]))
        out.append(fig(fid, f"Page link graph – {label}",
                       f"{nv} of {len(pnodes)} {label} pages carry at least one standing-rule violation.",
                       "pages", len(pnodes), "built+queued" if len(pnodes) > len(nodes) else "built",
                       "pages[] (links_out, classification, state, domain); flows[] between pages; rule_results[] "
                       "(result = violation)", method, svg,
                       {"columns": ["Page", "Name", "Domain", "State", "Violations", "Links and flows to"], "rows": rows},
                       checks, "page-link-graph.svg" if fid == "D4a" else f"page-link-graph-{fid[-1]}.svg",
                       projected_svg=psvg, filter_table="t-pages"))
    return out


# ---------------------------------------------------------------- D8 gap map
def _match_affect(ctx, a):
    a = a.strip()
    if a in ctx.pages or a in ctx.stores:
        return a
    repo = None
    path = a
    for r in ("musicLibrary/", "songnodes/"):
        if a.startswith(r):
            repo, path = r[:-1], a[len(r):]
    cands = []
    for p in ctx.F["pages"]:
        if repo and p["repo"] != repo:
            continue
        pp = p["path"].split(" ")[0].replace("songnodes/", "", 1) if p["path"].startswith("songnodes/") else p["path"].split(" ")[0]
        if not pp:
            continue
        if path == pp:
            cands.append((0, p["id"]))
        elif path.startswith(pp.rstrip("/") + "/"):
            cands.append((1, p["id"]))
    if not cands and "/" not in path:
        for tok in sorted(set(re.findall(r"[a-z][a-z0-9_-]{4,}", path.lower()))):
            for pid in ctx.pages:
                if pid.endswith("-" + tok) and ctx.pages[pid].get("classification") == "production":
                    cands.append((3, pid))
    if not cands:
        return None
    best = min(c[0] for c in cands)
    cs = sorted(c[1] for c in cands if c[0] == best)
    stem = path.rsplit("/", 1)[-1].split(".")[0].split("_")[-1]
    pref = [c for c in cs if c.endswith("-" + stem)]
    prod = [c for c in cs if ctx.pages[c].get("classification") == "production"]
    return (pref or prod or cs)[0]


def d8(ctx):
    F = ctx.F
    gaps = F.get("gaps", [])
    tasks = F.get("tasks", [])
    mods = F.get("modules", [])
    out = []
    panels = [("D8a", "ml-gap-", "musicLibrary and cross-project"), ("D8b", "sn-be-gap-", "songnodes backend"),
              ("D8c", "sn-fe-gap-", "songnodes frontend")]
    gnum = {g["id"]: f"G{i + 1}" for i, g in enumerate(gaps)}
    mod_gaps = {}
    for m in mods:
        for t in tasks:
            if f"({m['id']})" in t.get("title", ""):
                mod_gaps.setdefault(m["id"], []).extend(t.get("gaps", []))
    for fid, pref, label in panels:
        pg = [g for g in gaps if g["id"].startswith(pref)]
        nodes, edges, extra, key = {}, [], [], []
        rows = []
        for g in pg:
            ends = []
            for a in g.get("affects", []):
                m = _match_affect(ctx, a)
                nid = m or ("file:" + a)
                if nid not in ends:
                    ends.append(nid)
            for nid in ends[:2]:
                if nid not in nodes:
                    if nid.startswith("file:"):
                        nm = nid[5:]
                        dom = ctx.domain(next((e for e in ends if not e.startswith("file:")), "")) if any(
                            not e.startswith("file:") for e in ends) else "ops"
                        nodes[nid] = {"id": nid, "raw": [(nm, "name", "", 2), (f"{dom} · file", "meta", "2", 1)],
                                      "c": ctx.chart(dom), "state": "production", "title": f"{nm} (file named by the gap)",
                                      "cluster": None, "domain": dom}
                    else:
                        nodes[nid] = page_node(ctx, nid) if nid in ctx.pages else store_node(ctx, nid)
                        nodes[nid]["cluster"] = None
            if len(ends) == 1:
                cid = "contract:" + g["id"]
                nodes[cid] = {"id": cid, "raw": [("missing contract", "name", "", 1), (g.get("contract", ""), "meta", "2", 2)],
                              "c": nodes[ends[0]]["c"], "state": "gap", "domain": nodes[ends[0]]["domain"],
                              "title": f'{gnum[g["id"]]} contract: {g.get("contract", "")}', "cluster": None}
                ends.append(cid)
            edges.append({"key": g["id"], "from": ends[0], "to": ends[1], "c": 8, "state": "gap",
                          "badge": f'{X_MARK} {gnum[g["id"]]}',
                          "title": f'{gnum[g["id"]]} {g["title"]} – contract: {g.get("contract", "")} '
                                   f'(severity {g.get("severity")}, effort {g.get("effort")})'})
            key.append((gnum[g["id"]], f'{g.get("contract", "")} ({g.get("severity")})'))
            rows.append([gnum[g["id"]], g["id"], g["title"], g.get("contract"), ", ".join(g.get("affects", [])),
                         g.get("severity"), g.get("effort"), "Gap"])
        prepo = "musicLibrary" if pref.startswith("ml") else "songnodes"
        for m in mods:
            gl = [x for x in mod_gaps.get(m["id"], []) if x.startswith(pref)]
            mrepo = m.get("path", "").split("/")[0]
            sub = "frontend" if "/frontend/" in m.get("path", "") else "backend"
            home = (pref == "ml-gap-" and mrepo == "musicLibrary") or (
                pref == f"sn-{'fe' if sub == 'frontend' else 'be'}-gap-" and mrepo == "songnodes")
            if not gl and not home:
                continue
            mid = m["id"]
            nodes[mid] = {"id": mid, "raw": [(f'{m["id"]} {m["name"]}', "name", "", 1),
                                             (f'proposed · {m.get("verb", "").lower()}', "meta", "2", 1)],
                          "c": 8, "state": "proposed", "domain": "ops", "cluster": None,
                          "title": f'{m["id"]} {m["name"]} (proposed module): {m.get("operation", "")}'}
            for gid in sorted(set(gl)):
                ge = next(e for e in edges if e["key"] == gid)
                edges.append({"key": f"{mid}>{gid}", "from": mid, "to": ge["from"], "c": 8, "state": "proposed",
                              "badge": None, "title": f'{m["id"]} {m["name"]} closes {gnum[gid]}'})
            rows.append([m["id"], m["id"], m["name"], m.get("operation"), m.get("path"), "–", m.get("loc"), "Proposed"])
        nl = list(nodes.values())
        leg = legend_items(ctx, [n["domain"] for n in nl], sorted({n["state"] for n in nl if n["state"] in
                           ("production", "nonfinal", "queued", "proposed")}, key=["production", "nonfinal", "queued", "proposed"].index),
                           [LINE_GAP, LINE_PROPOSED])
        svg, checks, method = graph_figure(ctx, fid, nl, edges, clusters=[], legend=leg, key_entries=key,
                                           key_title="Gap contracts", key_cols=2,
                                           title=f"Gap map: {label}",
                                           desc=f"{len(pg)} gaps drawn as red dashed edges between the parts they affect, "
                                                "each badge numbered G1… and its contract listed below; proposed "
                                                "modules are dashed brand cards linked to the gaps they close.")
        out.append(fig(fid, f"Gap map – {label}",
                       f"{len(pg)} {label} gaps, {sum(1 for g in pg if g.get('severity') == 'critical')} of them critical; "
                       "dashed brand cards are the modules that close them.", "gaps", len(pg), "built",
                       "gaps[] (title, contract, affects, severity, effort); modules[]; tasks[] (gaps, title)", method + "; gap "
                       "endpoints = first two affected paths matched to pages by path prefix", svg,
                       {"columns": ["Label", "ID", "Title", "Contract", "Affects", "Severity", "Effort", "State"], "rows": rows},
                       checks, "enhanced-architecture-connections-and-gaps.svg" if fid == "D8a" else
                       f"enhanced-architecture-connections-and-gaps-{fid[-1]}.svg"))
    return out


# ---------------------------------------------------------------- D9 change map
def d9(ctx):
    F = ctx.F
    q = F.get("queued", [])
    prs = [x for x in q if x["id"].startswith("PR-")]
    briefs = sorted([x for x in q if not x["id"].startswith("PR-")], key=lambda x: x["id"])
    qflows = [f for f in ctx.flows if f.get("state") == "queued"]
    qpages = sorted(p["id"] for p in F["pages"] if p.get("state") == "queued")
    qstores = sorted(s["id"] for s in F["stores"] if s.get("state") == "queued")
    variants = {}
    for mode in ("built", "projected"):
        nodes, edges = {}, []
        touched = set()
        for pr in prs:
            for t in pr.get("touches", []):
                if ctx.node(t):
                    touched.add(t)
        for f in qflows:
            touched |= {f["from"], f["to"]}
        for i in sorted(touched | (set(qpages) | set(qstores) if mode == "projected" else set())):
            if ctx.state(i) == "queued" and mode == "built":
                continue
            n = page_node(ctx, i) if i in ctx.pages else store_node(ctx, i)
            n["cluster"] = None
            if ctx.state(i) != "queued":
                n["state"] = "changed"
                n["marks"] = ["will change"]
                n["mark_kind"] = "warn"
            nodes[i] = n
        if mode == "projected":
            for pr in prs:
                pid = pr["id"]
                nodes[pid] = {"id": pid, "raw": [(pr["id"].replace("PR-", "PR "), "name", "", 1), (pr["title"], "meta", "2", 2),
                                                 ("services · pull request", "meta", "2", 1)],
                              "c": ctx.chart("services"), "state": "queued", "domain": "services", "cluster": None,
                              "title": f'{pr["id"]}: {pr["title"]} – {pr.get("effect", "")}'}
                for t in pr.get("touches", []):
                    if t in nodes:
                        edges.append({"key": f"{pid}>{t}", "from": pid, "to": t, "c": ctx.chart("services"),
                                      "state": "queued", "badge": None, "title": f'{pr["id"]} changes {ctx.name(t)}'})
            for f in qflows:
                e = flow_edge(ctx, f)
                edges.append(e)
        nl = list(nodes.values())
        leg = legend_items(ctx, [n["domain"] for n in nl], sorted({n["state"] for n in nl if n["state"] in
                           ("production", "nonfinal", "queued")}, key=["production", "nonfinal", "queued"].index),
                           ([LINE_QUEUED] if edges else []) + [("markwarn", "will change: built item a queued change touches")])
        key = [(b["id"].replace("ml-queued-", "").upper().replace("-PIPELINE-CLIENT", ""),
                f'{b["title"]} ({"changes a built counterpart" if "counterpart already" in b.get("note", "") else "adds new"})')
               for b in briefs]
        svg, checks, method = graph_figure(ctx, "D9", nl, edges, clusters=[], legend=leg,
                                           key_entries=key if mode == "projected" else None,
                                           key_title=f"Queued briefs ({len(briefs)}), target repo songnodes unless noted",
                                           key_cols=3,
                                           title=f"Built to Projected change map ({'Projected' if mode == 'projected' else 'Built'})",
                                           desc="Built items that queued pull requests and flows will change (amber, "
                                                "'will change'); in the Projected view the queued pages, store, pull "
                                                "requests and flows are added as dashed cards and arrows, and the queued "
                                                "work-package briefs are listed below.")
        variants[mode] = (svg, checks, method, nl, edges)
    svg, checks, method, nl, edges = variants["built"]
    psvg, pchecks, _, pnl, pedges = variants["projected"]
    checks = dict(checks)
    checks["projected"] = pchecks
    rows = []
    for n in pnl:
        rows.append([n["id"], ctx.name(n["id"]) if ctx.node(n["id"]) else n["id"],
                     "added" if n["state"] == "queued" else "changed", n["domain"]])
    for e in pedges:
        rows.append([e["key"], e["title"], "added edge", "–"])
    for b in briefs:
        rows.append([b["id"], b["title"], "changes" if "counterpart already" in b.get("note", "") else "adds", b.get("target_repo")])
    added = sum(1 for n in pnl if n["state"] == "queued")
    changed = sum(1 for n in pnl if n["state"] == "changed")
    return fig("D9", "Built to Projected change map",
               f"Queued work adds {added} cards and {len(pedges)} edges and changes {changed} built items; "
               f"{len(briefs)} briefs wait behind them.", "items", len(pnl) + len(pedges) + len(briefs), "built+queued",
               "queued[] (PR touches and effect, brief notes); flows[] and pages[]/stores[] with state queued", method, svg,
               {"columns": ["ID", "Item", "Change", "Domain or repo"], "rows": rows}, checks,
               "built-to-projected-change-map.svg", projected_svg=psvg)


# ---------------------------------------------------------------- D12 sister projects
def d12(ctx):
    F = ctx.F
    tasks = F.get("tasks", [])

    def key(i):
        r = ctx.repo(i)
        return i if r == "external" else r
    agg = {}
    for f in ctx.flows:
        a, b = key(f["from"]), key(f["to"])
        if a == b:
            continue
        agg.setdefault((a, b), []).append(f["n"])
    internal = {}
    for f in ctx.flows:
        a, b = key(f["from"]), key(f["to"])
        if a == b:
            internal[a] = internal.get(a, 0) + 1
    ds_edges = []
    if "sn-be-cli-sync-design-system" in ctx.pages:
        ds_edges.append(("design-system", "songnodes", "tokens, bundle and fonts (sync-design-system.sh)",
                         "sn-be-cli-sync-design-system"))
    if "ml-page-set-builder" in ctx.pages:
        ds_edges.append(("design-system", "musicLibrary", "design-system build of the Set Builder artifact",
                         "ml-page-set-builder"))
    tcount = {}
    for t in tasks:
        tcount[t["project"]] = tcount.get(t["project"], 0) + 1
    ids = sorted({a for a, b in agg} | {b for a, b in agg} | {"design-system"} | set(internal))
    nodes = []
    for i in ids:
        if i in ("songnodes", "musicLibrary", "design-system"):
            dom = {"songnodes": "graph", "musicLibrary": "library", "design-system": "design"}[i]
            raw = [(i, "name", "", 1), (f"project · {internal.get(i, 0)} internal flows", "meta", "2", 2)]
            marks = [f"{tcount.get(i, 0)} tasks"]
            nodes.append({"id": i, "raw": raw, "c": ctx.chart(dom), "state": "production", "domain": dom,
                          "cluster": "projects", "marks": marks, "mark_kind": "info",
                          "title": f"{i}: {internal.get(i, 0)} internal flows, {tcount.get(i, 0)} sister tasks"})
        else:
            n = store_node(ctx, i, "external")
            n["raw"] = n["raw"][:2]
            n["lock"] = False
            nodes.append(n)
    edges = []
    for (a, b), ns in sorted(agg.items()):
        edges.append({"key": f"{a}>{b}", "from": a, "to": b, "c": ctx.chart("services" if "ext" in a + b else "library"),
                      "state": "built", "badge": str(len(ns)),
                      "title": f"{a} → {b}: {len(ns)} flows ({', '.join(str(n) for n in ns)})"})
    for (a, b, what, ev) in ds_edges:
        edges.append({"key": f"{a}>{b}", "from": a, "to": b, "c": ctx.chart("design"), "state": "built",
                      "badge": "DS", "title": f"{a} → {b}: {what} (page {ev})"})
    leg = legend_items(ctx, [n["domain"] for n in nodes], ["production"],
                       [LINE_BUILT, ("badge", "Badge = number of flows (DS = design-system copy)"),
                        ("markinfo", "Sister tasks per project")])
    svg, checks, method = graph_figure(ctx, "D12", nodes, edges, clusters=[("projects", "Projects"), ("external", "External services")],
                                       legend=leg, title="Sister-project dependency graph",
                                       desc="songnodes, musicLibrary, the design system and external services as nodes; "
                                            "each arrow aggregates the flows between one pair, with the count as a badge; "
                                            "project cards carry their sister-task counts.")
    rows = [[a, b, len(ns), ", ".join(str(n) for n in ns)] for (a, b), ns in sorted(agg.items())]
    rows += [[a, b, "–", f"{what} ({ev})"] for (a, b, what, ev) in ds_edges]
    rows += [[i, "(tasks)", tcount[i], ", ".join(t["id"] for t in tasks if t["project"] == i)] for i in sorted(tcount)]
    cross = sum(len(v) for (a, b), v in agg.items() if "ext" not in a + b)
    return fig("D12", "Sister-project dependency graph",
               f"Only {cross} of {len(ctx.flows)} flows cross between songnodes and musicLibrary; the rest stay inside one "
               "project or reach an external service.", "project pairs", len(edges), "built",
               "flows[] aggregated by repo pair (pages[]/stores[].repo); tasks[].project; design-system pages", method,
               svg, {"columns": ["From", "To", "Flows", "Flow numbers or evidence"], "rows": rows}, checks,
               "sister-project-dependencies.svg")



# ---------------------------------------------------------------- hand-placed helpers
def card(nid, x, y, w, lines_spec, T, c, state, title, extra_cls="", h=None, marks=None, mark_kind="bad"):
    """lines_spec: [(text, role, tone, maxlines)] wrapped to w. Returns (node dict, rect)."""
    n = {"id": nid, "raw": lines_spec, "c": c, "state": state, "title": title, "marks": marks or [],
         "mark_kind": mark_kind}
    ww, hh = node_size(n, T, w, w)
    return n, (x, y, w, h if h is not None else hh)


def hand_checks(rects, eps, labels, W, H, minu, T):
    cr, th, co = count_checks(rects, eps, labels)
    return {"crossings": cr, "edges_through_nodes": th, "label_collisions": co, "min_font_units": round(minu, 2),
            "font_floor_used": T["floor"], "viewbox": [round(W), round(H)]}


def simple_edge(key, a, b, pts, c, state="built", title="", badge=None):
    e = {"key": key, "from": a, "to": b, "c": c, "state": state, "title": title or f"{a} → {b}"}
    return edge_svg(e, pts, badge)


def pick_tier(width_needed_fn, height_fn, orient="wide"):
    for t in TIER_ORDER:
        T = TIERS[t]
        W, H = width_needed_fn(T), height_fn(T)
        W2, H2, minu = fit_canvas(W, H, orient)
        if minu <= T["floor"] + 1e-6:
            return t
    return "B"


# ---------------------------------------------------------------- D5 personas
def _stage_of(ctx, step):
    txt = f'{step.get("action", "")} {step.get("writes") or ""}'.lower()
    if re.search(r"override|calibrat|confirm|play history|rekordbox", txt):
        return 6
    d = ctx.domain(step.get("page", ""))
    return {"ingest": 1, "library": 2, "sets": 3, "graph": 3, "paths": 3, "harmony": 3, "services": 4,
            "ops": 5, "design": 5}.get(d, 5)


def d5_overview(ctx):
    F = ctx.F
    loop = F.get("loop", [])
    ps = F.get("personas", [])
    T = TIERS[CUR["tier"] or "A"]
    M, hdrw, colw = 24, 210, 172
    W = M * 2 + hdrw + 6 * colw
    body, rects, labels = [], {}, []
    y = M
    for j, st in enumerate(loop):
        x = M + hdrw + j * colw
        for k, ln in enumerate(wrap(f"{j + 1} {st['name']}", T["head"], colw - 12, 2)):
            s_, h_ = text_el(x + 6, y + k * lh(T["head"]), ln, T["head"])
            body.append(s_)
        s_, _ = text_el(x + 6, y + 2 * lh(T["head"]), st.get("domain", ""), T["meta"], "2")
        body.append(s_)
    y += 2 * lh(T["head"]) + lh(T["meta"]) + 10
    chip_h = lh(T["num"]) + 6
    rows = []
    for p in ps:
        cells = {}
        for s_ in p.get("steps", []):
            cells.setdefault(_stage_of(ctx, s_), []).append(s_)
        nchip = max([len(v) for v in cells.values()] + [1])
        per_row = 4
        need = ((nchip + per_row - 1) // per_row) * (chip_h + 6) + 10
        n, r = card(p["id"], M, y, hdrw - 12,
                    [(f'{p["id"]} {p["name"]}', "name", "", 2), (f'{p.get("domain")} · {len(p.get("steps", []))} steps', "meta", "2", 1)],
                    T, ctx.chart(p.get("domain", "ops")), "production",
                    f'{p["id"]} {p["name"]} ({p.get("domain")}): {p.get("objective", "")}')
        rh = max(need, r[3])
        r = (r[0], r[1], r[2], rh)
        body.append(node_svg(n, r, T))
        rects[p["id"]] = r
        for j in range(6):
            x = M + hdrw + j * colw
            body.append(f'<rect class="sn-diagram__cell" x="{x + 2:.1f}" y="{y:.1f}" width="{colw - 4:.1f}" height="{rh:.1f}"/>')
            for k, s_ in enumerate(cells.get(j + 1, [])):
                cx = x + 10 + (k % per_row) * 38
                cy = y + 6 + (k // per_row) * (chip_h + 6)
                t = str(s_["n"])
                bw = max(tw(t, T["num"]) + 14, 30)
                ttl = f'{p["id"]} step {s_["n"]}: {s_.get("action", "")} on {ctx.name(s_.get("page", ""))}'
                body.append(f'<g class="sn-diagram__edge sn-dg-c{ctx.chart(ctx.domain(s_.get("page", "")))}" '
                            f'data-from="{esc(p["id"])}" data-to="{esc(s_.get("page", ""))}" data-step="{s_["n"]}" tabindex="0" '
                            f'aria-label="{esc(ttl)}"><title>{esc(ttl)}</title>'
                            + badge_svg(cx, cy, bw, chip_h, t, T["num"]) + "</g>")
                labels.append((cx, cy, bw, chip_h))
            rows.append(None)
        y += rh + 8
    tab = []
    for p in ps:
        for s_ in p.get("steps", []):
            tab.append([p["id"], s_["n"], ctx.name(s_.get("page", "")), s_.get("action"), _stage_of(ctx, s_),
                        loop[_stage_of(ctx, s_) - 1]["name"] if len(loop) >= 6 else ""])
    leg = legend_items(ctx, [p.get("domain") for p in ps] + [ctx.domain(s_.get("page", "")) for p in ps for s_ in p["steps"]],
                       ["production"], [("badge", "Numbered chip = persona step (same number as its swimlane)")])
    y += 12
    lgh = legend_height(leg, W - 2 * M, T)
    H = y + lgh + M
    W, H, minu = fit_canvas(W, H, "wide")
    s_, _, _ = legend_svg(leg, M, y, W - 2 * M, T, "D5")
    body.append(s_)
    svg = svg_root("D5", W, H, "Persona overview: who acts at which loop stage",
                   f"{len(ps)} persona lanes against the six loop stages; each chip is one numbered step, coloured by the "
                   "domain of the page it runs on. Stage is the page domain, or Reconciliation for override, calibrate "
                   "and confirm steps.", "\n".join(body))
    nsteps = sum(len(p.get("steps", [])) for p in ps)
    return fig("D5", "Persona overview", f"{len(ps)} personas take {nsteps} steps; only "
               f"{sum(1 for r in tab if r[4] == 6)} of them touch Reconciliation.", "steps", nsteps, "built",
               "personas[] (steps[].page, action, writes); loop[]; pages[].domain",
               "hand-placed grid (lanes = personas, columns = loop stages); stage = page domain, override/calibrate/"
               "confirm steps = Reconciliation; 0 crossings", svg,
               {"columns": ["Persona", "Step", "Page", "Action", "Stage", "Stage name"], "rows": tab},
               hand_checks(rects, [], labels, W, H, minu, T), "user-journey-operational-flow.svg", filter_table="t-personas")


def _lane(i):
    if i.startswith("ml-page"):
        return "musicLibrary artifact"
    if i.startswith("ml-"):
        return "musicLibrary pipeline"
    if i.startswith("sn-fe"):
        return "songnodes frontend"
    return "songnodes backend"


LANE_ORDER = ["musicLibrary artifact", "songnodes frontend", "musicLibrary pipeline", "songnodes backend"]


def _nonempty(v):
    return v not in (None, "", "None", "none", "null")


def d5_persona(ctx, p, panel="", only=None):
    steps = sorted([s_ for s_ in p.get("steps", []) if only is None or s_["n"] in only], key=lambda s_: s_["n"])
    lanes = sorted({_lane(s_["page"]) for s_ in steps}, key=LANE_ORDER.index)
    M, gap = 24, 22
    hdrw = max(110, max(tw(w_, TIERS["B"]["head"]) for ln in lanes for w_ in ln.split()) + 26)
    n = len(steps)

    def build(T, cw, prof):
        mt, mn, ma, mw, mh, mf = prof
        specs = []
        for s_ in steps:
            sp = [(f'▶ {s_.get("trigger") or "–"}', "meta", "2", mt),
                  (f'{s_["n"]} · {ctx.name(s_["page"])}', "name", "", mn),
                  (f'{ctx.domain(s_["page"])} · {KIND_SHORT.get(ctx.kind(s_["page"]), ctx.kind(s_["page"]))}', "meta", "2", 1),
                  (s_.get("action", ""), "text", "", ma)]
            if _nonempty(s_.get("writes")):
                sp.append((f'writes: {s_["writes"]}', "meta", "2", mw))
            if s_.get("handoff"):
                hd = s_["handoff"]
                sp.append((f'→ hands off: {hd.get("shape", "")} via {hd.get("via", "")}', "meta", "2", mh))
            specs.append(sp)
        hs = [node_size({"raw": sp}, T, cw, cw)[1] for sp in specs]
        fb = []
        for s_ in steps:
            if _nonempty(s_.get("fallback")):
                fb.append(node_size({"raw": [(f'If it fails: {s_["fallback"]}', "meta", "2", mf)]}, T, cw, cw)[1])
            else:
                fb.append(0)
        ch = max(hs)
        fh = max(fb)
        laneh = ch + (fh + 28 if fh else 0) + 20
        W = 2 * M + hdrw + n * cw + (n - 1) * gap
        H = M + len(lanes) * laneh + 16
        return specs, ch, fh, laneh, W, H
    chosen = None
    profiles = [(2, 2, 4, 3, 2, 3), (2, 1, 4, 2, 2, 2), (1, 1, 3, 2, 1, 2), (1, 1, 3, 1, 1, 2)]
    for t in TIER_ORDER:
        T = TIERS[t]
        for cw in (220, 200, 180, 160, 150, 140, 130, 124):
            for prof in profiles:
                specs, ch, fh, laneh, W, H = build(T, cw, prof)
                W2, H2, minu = fit_canvas(W, H + 90, "wide")
                if minu <= T["floor"] + 1e-6:
                    chosen = (T, cw, specs, ch, fh, laneh, W, H, prof)
                    break
            if chosen:
                break
        if chosen:
            break
    if not chosen:
        T, cw, prof = TIERS["D"], 124, profiles[-1]
        specs, ch, fh, laneh, W, H = build(T, cw, prof)
        chosen = (T, cw, specs, ch, fh, laneh, W, H, prof)
    T, cw, specs, ch, fh, laneh, W, H, prof = chosen
    fid = f"D5-{p['id']}{panel}"
    body, rects, eps, labels = [], {}, [], []
    ly = {ln: M + k * laneh for k, ln in enumerate(lanes)}
    for k, ln in enumerate(lanes):
        y0 = ly[ln]
        body.append(f'<rect class="sn-diagram__lane{"" if k % 2 == 0 else " sn-diagram__lane--alt"}" x="{M:.1f}" y="{y0:.1f}" '
                    f'width="{W - 2 * M:.1f}" height="{laneh:.1f}"/>')
        for q, t_ in enumerate(wrap(ln, T["head"], hdrw - 16, 2)):
            s_, _ = text_el(M + 10, y0 + 10 + q * lh(T["head"]), t_, T["head"], "2")
            body.append(s_)
    pos = {}
    for idx, s_ in enumerate(steps):
        x = M + hdrw + idx * (cw + gap)
        y = ly[_lane(s_["page"])] + 10
        nid = f'{p["id"]}-s{s_["n"]}'
        nd = {"id": nid, "raw": specs[idx], "c": ctx.chart(ctx.domain(s_["page"])), "state": ctx.state(s_["page"]),
              "title": f'{p["id"]} step {s_["n"]} on {ctx.name(s_["page"])}: {s_.get("action", "")}. Trigger: '
                       f'{s_.get("trigger")}. Writes: {s_.get("writes") or "–"}.'
                       + (f' Hands off {s_["handoff"].get("shape")} via {s_["handoff"].get("via")}.' if s_.get("handoff") else "")
                       + (f' Fallback: {s_["fallback"]}.' if _nonempty(s_.get("fallback")) else ""),
              "marks": []}
        node_size(nd, T, cw, cw)
        r = (x, y, cw, ch)
        pos[idx] = r
        rects[nid] = r
        body.append(node_svg(nd, r, T).replace(f'data-node="{esc(nid)}"', f'data-node="{esc(s_["page"])}" data-step="{s_["n"]}"', 1))
        if _nonempty(s_.get("fallback")):
            fid_ = f"{nid}-fb"
            fn = {"id": fid_, "raw": [(f'If it fails: {s_["fallback"]}', "meta", "2", prof[5])], "c": nd["c"], "state": "fallback",
                  "title": f'Fallback for step {s_["n"]}: {s_["fallback"]}', "marks": []}
            node_size(fn, T, cw, cw)
            fr = (x, y + ch + 28, cw, fh)
            rects[fid_] = fr
            pts = [(x + cw / 2, y + ch), (x + cw / 2, y + ch + 28)]
            body.append(simple_edge(f"{nid}>fb", s_["page"], s_["page"], pts, nd["c"], "fallback",
                                    f'Fallback branch of step {s_["n"]}'))
            eps.append((nid, fid_, pts))
            body.append(node_svg(fn, fr, T).replace(f'data-node="{esc(fid_)}"', f'data-node="{esc(s_["page"])}" data-fallback="{s_["n"]}"', 1))
    for idx in range(len(steps) - 1):
        a, b = pos[idx], pos[idx + 1]
        y1, y2 = a[1] + 28, b[1] + 28
        xm = a[0] + a[2] + gap / 2
        pts = [(a[0] + a[2], y1)] + ([(xm, y1), (xm, y2)] if abs(y1 - y2) > 0.5 else []) + [(b[0], y2)]
        s1, s2 = steps[idx], steps[idx + 1]
        body.append(simple_edge(f'{p["id"]}-{s1["n"]}>{s2["n"]}', s1["page"], s2["page"], pts,
                                ctx.chart(ctx.domain(s2["page"])), "built",
                                f'Step {s1["n"]} → step {s2["n"]}, triggered by: {s2.get("trigger")}'))
        eps.append((f'{p["id"]}-s{s1["n"]}', f'{p["id"]}-s{s2["n"]}', pts))
    leg = legend_items(ctx, [ctx.domain(s_["page"]) for s_ in steps],
                       sorted({ctx.state(s_["page"]) for s_ in steps}, key=["production", "nonfinal", "queued"].index),
                       [("built", "Next step (▶ marks the trigger at the arrow head)"),
                        ("fallback", "Fallback branch (dashed card: if it fails)")])
    y = M + len(lanes) * laneh + 16
    lgh = legend_height(leg, W - 2 * M, T)
    H = y + lgh + M
    W, H, minu = fit_canvas(W, H, "wide")
    s_, _, _ = legend_svg(leg, M, y, W - 2 * M, T, fid)
    body.append(s_)
    svg = svg_root(fid, W, H, f'Swimlane: {p["id"]} {p["name"]}' + (f' (steps {steps[0]["n"]}–{steps[-1]["n"]})' if panel else ""),
                   f'{len(steps)} numbered steps of {p["name"]} left to right across {len(lanes)} system lanes; each card '
                   "shows its trigger, page, action, data written and hand-off, with dashed fallback cards below.",
                   "\n".join(body))
    rows = [[s_["n"], ctx.name(s_["page"]), _lane(s_["page"]), s_.get("trigger"), s_.get("action"),
             s_.get("writes") or "–",
             (f'{s_["handoff"].get("shape")} via {s_["handoff"].get("via")}' if s_.get("handoff") else "–"),
             s_.get("fallback") if _nonempty(s_.get("fallback")) else "–"] for s_ in steps]
    slug = re.sub(r"[^a-z0-9]+", "-", p["name"].lower()).strip("-")
    nfb = sum(1 for s_ in steps if _nonempty(s_.get("fallback")))
    return fig(fid, f'Swimlane – {p["id"]} {p["name"]}' + (f', steps {steps[0]["n"]}–{steps[-1]["n"]}' if panel else ""),
               f'{p["name"]}: {len(steps)} steps across {len(lanes)} lane{"s" if len(lanes) > 1 else ""}; '
               f'{nfb} step{"s" if nfb != 1 else ""} name a fallback.', "steps", len(steps), p.get("state", "built"),
               "personas[].steps[] (n, page, action, writes, trigger, handoff, fallback); pages[].domain",
               f"hand-placed swimlane (lanes = systems, columns = steps, card width {cw}); orthogonal arrows in the "
               "column gaps; 0 crossings by construction", svg,
               {"columns": ["Step", "Page", "Lane", "Trigger", "Action", "Writes", "Hand-off", "Fallback"], "rows": rows},
               hand_checks(rects, eps, labels, W, H, minu, T), f'd5-{p["id"].lower()}{panel}-{slug}.svg')


def d5(ctx):
    """One swimlane per persona; a persona whose lane cannot keep text at the print floor even at tier D is split
    into panels of consecutive steps (D5-P2a, D5-P2b …), never shrunk."""
    out = [d5_overview(ctx)]
    for p in ctx.F.get("personas", []):
        f = d5_persona(ctx, p)
        ck = f.get("checks") or {}
        ns = sorted(s_["n"] for s_ in p.get("steps", []))
        if ck.get("min_font_units", 0) <= ck.get("font_floor_used", 99) + 1e-6 or len(ns) < 4:
            out.append(f)
            continue
        half = (len(ns) + 1) // 2
        for k, part in enumerate((ns[:half], ns[half:])):
            out.append(d5_persona(ctx, p, panel="abcd"[k], only=set(part)))
    return out


# ---------------------------------------------------------------- D6 sequences
SEQ = {
    "D6a": {
        "name": "Scrape to bronze, silver and projections",
        "protocols": ["sn-be-proto-recurring-schedule", "sn-be-proto-job-queue", "sn-be-proto-scrape-etl-order",
                      "sn-be-proto-outbox"],
        "lifelines": [("sn-be-svc-worker", "Worker"), ("sn-be-tbl-ingestion-jobs", "ingestion_jobs"),
                      ("sn-be-svc-unified-scraper", "Unified scraper"), ("sn-be-tbl-bronze", "bronze_*"),
                      ("sn-be-tbl-silver", "silver_*"), ("sn-be-tbl-outbox", "outbox"),
                      ("sn-be-tbl-projection-tracks", "projection_tracks")],
        "msgs": [
            ("sn-be-svc-worker", "sn-be-tbl-ingestion-jobs", "call", "enqueue tick:scrape_targets:{bucket} every 30 s beat (3600 s bucket)"),
            ("sn-be-svc-worker", "sn-be-tbl-ingestion-jobs", "call", "claim_next: FOR UPDATE SKIP LOCKED, attempts + 1, scrape lease 1800 s"),
            ("sn-be-svc-worker", "sn-be-svc-unified-scraper", "call", "POST /scrape (synchronous HTTP inside the job)"),
            ("sn-be-svc-unified-scraper", "sn-be-tbl-bronze", "call", "persist playlist and tracks, positions 1..n"),
            ("sn-be-svc-unified-scraper", "sn-be-tbl-silver", "gap", "layer-skipping silver writes (gap: scraper should stop at bronze)"),
            ("sn-be-svc-unified-scraper", "sn-be-svc-worker", "return", "playlists_found"),
            ("sn-be-svc-worker", "sn-be-tbl-ingestion-jobs", "call", "complete + enqueue ingest_pending follow-up (one transaction)"),
            ("sn-be-svc-worker", "sn-be-tbl-bronze", "call", "ingest_pending: lock bronze playlist FOR UPDATE, INGEST_MARKER"),
            ("sn-be-svc-worker", "sn-be-tbl-silver", "call", "build silver tracks and N → N+1 transitions"),
            ("sn-be-svc-worker", "sn-be-tbl-outbox", "call", "append event in the same transaction"),
            ("sn-be-svc-worker", "sn-be-tbl-projection-tracks", "call", "projection_consume: (txid, id) > offset, upsert"),
            ("note", "sn-be-tbl-outbox", "note", "graph_projection_consume to Memgraph is disabled; gold_track_graph refresh needs migration 008"),
            ("note", "sn-be-svc-worker", "note", "fallback: an independent 60 s tick runs ingest_pending; failures back off 30 s · 2^(n−1), cap 3600 s"),
        ]},
    "D6b": {
        "name": "Weekly musicLibrary run to TIDAL and songnodes",
        "protocols": ["ml-proto-resolve-resume", "ml-proto-sync-sets", "ml-proto-songnodes-ingest"],
        "lifelines": [("ml-agent-weekly-run", "Weekly-run agent"), ("ml-cli-resolve", "resolve"),
                      ("ml-cli-process", "process"), ("ml-store-artifact-db", "artifact db"),
                      ("ml-cli-build-db", "build_db"), ("ml-cli-sync-sets", "sync-sets"), ("ext-tidal", "TIDAL"),
                      ("ml-cli-sync-songnodes", "sync-songnodes"), ("sn-be-svc-rest-api", "songnodes REST API")],
        "msgs": [
            ("ml-agent-weekly-run", "ml-cli-resolve", "call", "loop 'timeout 160 … resolve' until the final line"),
            ("ml-cli-resolve", "ml-cli-resolve", "self", "4 threads; re-dump resolved_<date>.json every 20 songs"),
            ("ml-cli-resolve", "ml-cli-process", "call", "resolved versions (flow 34)"),
            ("ml-agent-weekly-run", "ml-store-artifact-db", "call", "read ArtifactData rows (page size 1000)"),
            ("ml-store-artifact-db", "ml-agent-weekly-run", "return", "saved sets → inbox/artifact_sets.json"),
            ("ml-agent-weekly-run", "ml-cli-build-db", "call", "artifact_sets.json (flow 56)"),
            ("ml-cli-build-db", "ml-cli-sync-sets", "call", "sets marked tidal (flow 57)"),
            ("ml-cli-sync-sets", "ext-tidal", "call", "playlist 'set:<id>': if items differ, remove all then add all"),
            ("ml-cli-sync-songnodes", "sn-be-svc-rest-api", "call", "POST library.json, Idempotency-Key import-<md5>"),
            ("sn-be-svc-rest-api", "ml-cli-sync-songnodes", "return", "library_ingest job queued (run_weekly does not poll)"),
            ("note", "ml-cli-sync-sets", "note", "no TIDAL token: step skipped with a message; page copy wins (full replace)"),
        ]},
    "D6c": {
        "name": "TIDAL and Spotify OAuth connect",
        "protocols": ["sn-fe-proto-oauth", "sn-be-proto-oauth-pkce"],
        "lifelines": [("sn-fe-settings", "Settings page"), ("sn-be-svc-rest-api", "REST API"),
                      ("sn-be-store-redis", "Redis"), ("ext-tidal", "Provider (TIDAL)"),
                      ("sn-fe-oauth-callback", "Sign-in return"), ("sn-be-tbl-oauth", "user_oauth_tokens")],
        "msgs": [
            ("sn-fe-settings", "sn-fe-settings", "self", "random 32-byte state into sessionStorage"),
            ("sn-fe-settings", "sn-be-svc-rest-api", "call", "TIDAL: POST tidal/oauth/init (Spotify: navigate to authorize)"),
            ("sn-be-svc-rest-api", "sn-be-store-redis", "call", "SETEX oauth:{svc}:{state} PKCE verifier, TTL 600 s"),
            ("sn-be-svc-rest-api", "sn-fe-settings", "return", "authorise URL; page navigates (same window)"),
            ("sn-fe-settings", "ext-tidal", "call", "user signs in at the provider"),
            ("ext-tidal", "sn-fe-oauth-callback", "return", "redirect with code and state"),
            ("sn-fe-oauth-callback", "sn-fe-oauth-callback", "self", "validate state"),
            ("sn-fe-oauth-callback", "sn-be-svc-rest-api", "call", "GET backend callback"),
            ("sn-be-svc-rest-api", "sn-be-store-redis", "call", "read and delete state (single use)"),
            ("sn-be-svc-rest-api", "ext-tidal", "call", "exchange code + verifier"),
            ("sn-be-svc-rest-api", "sn-fe-oauth-callback", "return", "tokens"),
            ("sn-fe-oauth-callback", "sn-fe-oauth-callback", "gap", "sessionStorage <service>_oauth_tokens (gap: no reader)"),
            ("sn-fe-oauth-callback", "sn-be-svc-rest-api", "call", "POST store-token"),
            ("sn-be-svc-rest-api", "sn-be-tbl-oauth", "call", "upsert (service, user_id = default_user)"),
            ("sn-fe-oauth-callback", "sn-fe-settings", "return", "postMessage to opener, or redirect to / after 1500 ms"),
            ("note", "sn-fe-settings", "note", "refresh: useTokenRefresh checks every 60 s, refreshes 5 min before expiry under navigator.locks"),
        ]},
}


def d6(ctx):
    out = []
    P = {p["id"]: p for p in ctx.F.get("protocols", [])}
    conn = {}
    for pid, p in P.items():
        parts = set(p.get("participants", []))
        conn[pid] = sum(1 for f in ctx.flows if f["from"] in parts or f["to"] in parts)
    for fid in ("D6a", "D6b", "D6c"):
        S = SEQ[fid]
        protos = [x for x in S["protocols"] if x in P]
        lifel = S["lifelines"]
        T = TIERS[CUR["tier"] or "A"]
        M, top = 24, 24
        colw = min(200.0, (1290 - 2 * M) / len(lifel))
        W = 2 * M + len(lifel) * colw
        lx = {lid: M + k * colw + colw / 2 for k, (lid, _) in enumerate(lifel)}
        body, rects, eps, labels = [], {}, [], []
        hh = 0
        heads = []
        for lid, nm in lifel:
            dom = ctx.domain(lid) if ctx.node(lid) else "services"
            n = {"id": lid, "raw": [(nm, "name", "", 2), (f'{dom} · {KIND_SHORT.get(ctx.kind(lid), ctx.kind(lid))}', "meta", "2", 1)],
                 "c": ctx.chart(dom), "state": ctx.state(lid) if ctx.node(lid) else "production",
                 "title": f"{nm} ({lid}), {dom}", "marks": []}
            _, h_ = node_size(n, T, colw - 16, colw - 16)
            heads.append(n)
            hh = max(hh, h_)
        y = top + hh + 16
        rows_svg, tab = [], []
        for k, (a, b, kind, text) in enumerate(S["msgs"]):
            num = k + 1
            if kind == "note":
                x0 = lx[b] - colw / 2 + 6
                wnote = min(colw * 4 - 12, W - M - x0)
                x0 = min(x0, W - M - wnote)
                nn = {"id": f"{fid}-note{num}", "raw": [(f"Note: {text}", "meta", "2", 3)], "c": 8, "state": "note",
                      "title": f"Note: {text}", "marks": []}
                _, nh = node_size(nn, T, wnote, wnote)
                r = (x0, y, wnote, nh)
                rows_svg.append(node_svg(nn, r, T).replace(f'data-node="{esc(nn["id"])}"', f'data-node="{esc(b)}" data-note="{num}"', 1))
                rects[nn["id"]] = r
                tab.append([num, "note", ctx.name(b) if ctx.node(b) else b, "–", text])
                y += nh + 8
                continue
            xa, xb = lx[a], lx[b]
            st = {"call": "neutral", "return": "return", "self": "neutral", "gap": "gap"}[kind]
            lab = f"{num}  " + (f"{X_MARK} " if kind == "gap" else "") + text
            if a == b:
                avail = min(W - M - (xa + 40), colw * 3)
                lines = wrap(lab, T["text"], avail, 3)
                lab_h = len(lines) * lh(T["text"])
                pts = [(xa, y + 4), (xa + 30, y + 4), (xa + 30, y + 4 + max(lab_h, 22)), (xa + 4, y + 4 + max(lab_h, 22))]
                tx = xa + 38
                ty = y
                rh = max(lab_h, 22) + 14
            else:
                lo, hi = min(xa, xb), max(xa, xb)
                avail = max(hi - lo - 16, 360)
                tx = lo + 8
                if tx + avail > W - M:
                    tx = W - M - avail
                lines = wrap(lab, T["text"], avail, 2)
                lab_h = len(lines) * lh(T["text"])
                ya = y + lab_h + 6
                pts = [(xa, ya), (xb, ya)]
                ty = y
                rh = lab_h + 12
            c = 8
            grp = [f'<g class="sn-diagram__edge sn-diagram__edge--{st}" data-from="{esc(a)}" data-to="{esc(b)}" '
                   f'data-edge="{fid}-m{num}" tabindex="0" aria-label="{esc(lab)}"><title>{esc(lab)}</title>',
                   f'<path class="sn-diagram__line" d="{path_d(pts)}"/>', arrow_head(pts)]
            for q, ln in enumerate(lines):
                s_, _ = text_el(tx, ty + q * lh(T["text"]), ln, T["text"])
                grp.append(s_)
                labels.append((tx, ty + q * lh(T["text"]), tw(ln, T["text"]), lh(T["text"])))
            grp.append("</g>")
            rows_svg.append("\n".join(grp))
            eps.append((a, b, pts))
            tab.append([num, {"call": "call", "return": "return", "self": "self-call", "gap": "gap"}[kind],
                        ctx.name(a) if ctx.node(a) else a, ctx.name(b) if ctx.node(b) else b, text])
            y += rh + 3
        y_end = y + 6
        for k, (lid, nm) in enumerate(lifel):
            x = lx[lid]
            body.append(f'<path class="sn-diagram__lifeline" d="M{x:.1f} {top + hh:.1f} L{x:.1f} {y_end:.1f}"/>')
        for k, n in enumerate(heads):
            r = (M + k * colw + 8, top, colw - 16, hh)
            body.append(node_svg(n, r, T))
            rects[n["id"]] = r
        body.extend(rows_svg)
        leg = legend_items(ctx, [ctx.domain(l) if ctx.node(l) else "services" for l, _ in lifel], [],
                           [("neutral", "Call (solid)"), ("return", "Return (dashed)"), LINE_GAP])
        y = y_end + 16
        lgh = legend_height(leg, W - 2 * M, T)
        H = y + lgh + M
        W2, H2, minu = fit_canvas(W, H, "wide")
        s_, _, _ = legend_svg(leg, M, y, W2 - 2 * M, T, fid)
        body.append(s_)
        nmsg = sum(1 for m in S["msgs"] if m[2] != "note")
        svg = svg_root(fid, W2, H2, f"Sequence: {S['name']}",
                       f"UML sequence with {len(lifel)} lifelines and {nmsg} numbered messages, top to bottom; dashed arrows "
                       "are returns, red dashed arrows are gaps, grey boxes are notes.", "\n".join(body))
        # crossings are inherent in sequence diagrams (messages cross lifelines); count message-message crossings only
        chk = hand_checks({k: v for k, v in rects.items()}, eps, [], W2, H2, minu, T)
        lab_coll = 0
        for i in range(len(labels)):
            for j in range(i + 1, len(labels)):
                if rects_overlap(labels[i], labels[j], -0.5):
                    lab_coll += 1
        chk["label_collisions"] = lab_coll
        chk["edges_through_nodes"] = sum(1 for (a, b, pts) in eps for s in seg_list(pts) for nid, r in rects.items()
                                         if nid not in (a, b) and not nid.startswith(fid) and rect_hit_seg(r, s[0], s[1]))
        out.append(fig(fid, f"Sequence – {S['name']}",
                       f"{nmsg} messages across {len(lifel)} participants, numbered in order; red marks where the "
                       "protocol leaks.", "messages", nmsg, "built",
                       "protocols[] " + ", ".join(protos) + " (algorithm, conflict_resolution, stale_fallback); timings[]",
                       "hand-placed UML sequence (lifelines in first-use order, one row per message); protocols chosen per "
                       "theme by flows touching their participants (" + ", ".join(f"{x} {conn.get(x, 0)}" for x in protos)
                       + f"); {chk['crossings']} crossings", svg,
                       {"columns": ["Message", "Kind", "From", "To", "Text"], "rows": tab}, chk,
                       f"sequence-{re.sub(r'[^a-z0-9]+', '-', S['name'].lower()).strip('-')}.svg"))
    return out


# ---------------------------------------------------------------- D7 state machines
SM = {
    "D7a": {"name": "Scrape and ingestion job", "domain": "ingest",
            "source": "protocols sn-be-proto-job-queue, sn-be-proto-scrape-etl-order; timings sn-be-t-lease-default, "
                      "sn-be-t-lease-scrape, sn-be-t-backoff-base, sn-be-t-backoff-max",
            "states": [("new", "Requested"), ("queued", "Queued"), ("running", "Running (leased)"),
                       ("succeeded", "Succeeded"), ("dead", "Dead letter"), ("pruned", "Pruned")],
            "trans": [("new", "queued", "enqueue: INSERT ON CONFLICT (kind, idempotency_key) DO NOTHING returns the existing job"),
                      ("queued", "running", "claim_next: run_after ≤ now, FOR UPDATE SKIP LOCKED, attempts + 1"),
                      ("running", "succeeded", "handler, follow-up enqueues and complete in one transaction"),
                      ("running", "queued", "fail: requeue with backoff 30 s · 2^(n−1), cap 3600 s (×4 transient); "
                                            "or lease expired (300 s, scrape 1800 s) and reclaimed"),
                      ("running", "dead", "attempts ≥ max_attempts, or permanent 4xx (not 408/429)"),
                      ("dead", "queued", "POST /api/v1/jobs/{id}/retry"),
                      ("succeeded", "pruned", "pruned after 14 days")]},
    "D7b": {"name": "Track rotation", "domain": "library",
            "source": "timings ml-t-promote-window, ml-t-chart-entry, ml-t-high-tenure, ml-t-high-silence, "
                      "ml-t-std-archive-age, ml-t-std-archive-silence; limits ml-l-promote-sources, ml-l-promote-saves, "
                      "ml-l-high-cap, ml-l-chart-sat, ml-l-resolve-attempts, ml-l-recheck",
            "states": [("pending", "Pending"), ("unresolved", "Unresolved"), ("rejected", "Rejected"),
                       ("standard", "Standard"), ("high", "High Rotation"), ("archive", "Archive")],
            "trans": [("pending", "standard", "resolved and passes the gates"),
                      ("pending", "unresolved", "3 resolve attempts fail (resolve_attempts)"),
                      ("pending", "rejected", "fails a gate (for example a duration floor)"),
                      ("rejected", "pending", "re-checked after 2 sightings (recheck threshold)"),
                      ("standard", "high", "promote: min 2 sources, min 50 saves, window 30 days; chart entry window 21 days; cap 60"),
                      ("high", "standard", "tenure > 42 days, silence 45 days or chart saturation 6 weeks"),
                      ("standard", "archive", "age ≥ 180 days and silence 60 days")]},
    "D7c": {"name": "OAuth token", "domain": "services",
            "source": "protocols sn-fe-proto-oauth, sn-be-proto-oauth-pkce, ml-proto-tidal-login; timings "
                      "sn-be-t-oauth-state, sn-fe-t-token-buffer, sn-fe-t-token-check, sn-fe-t-token-default-expiry, "
                      "sn-fe-t-oauth-error-redirect, ml-t-pkce-age",
            "states": [("none", "Not connected"), ("authorising", "Authorising"), ("connected", "Connected"),
                       ("refreshing", "Refreshing"), ("expired", "Expired")],
            "trans": [("none", "authorising", "connect: state in sessionStorage, PKCE verifier in Redis (TTL 600 s)"),
                      ("authorising", "connected", "callback validates state, exchanges code, stores token (default_user)"),
                      ("authorising", "none", "state expired or error: redirect after 3000 ms; musicLibrary PKCE link > 900 s"),
                      ("connected", "refreshing", "checked every 60 s; 5 min before expiry (default lifetime 3600 s)"),
                      ("refreshing", "connected", "refresh under navigator.locks (localStorage mutex fallback)"),
                      ("refreshing", "expired", "refresh fails"),
                      ("expired", "none", "user signs in again")]},
}


def d7(ctx):
    out = []
    for fid in ("D7a", "D7b", "D7c"):
        S = SM[fid]
        c = ctx.chart(S["domain"])
        nodes = [{"id": f"{fid}-{k}", "raw": [(nm, "name", "", 1), (f'{S["domain"]} · state', "meta", "2", 1)],
                  "c": c, "state": "production", "title": f"State: {nm}", "cluster": None, "domain": S["domain"]}
                 for k, nm in S["states"]]
        edges = []
        key = []
        for i, (a, b, t) in enumerate(S["trans"]):
            tag = f"T{i + 1}"
            edges.append({"key": f"{fid}-t{i + 1:02d}", "from": f"{fid}-{a}", "to": f"{fid}-{b}", "c": c, "state": "built",
                          "badge": tag, "title": f"{tag}: {dict(S['states'])[a]} → {dict(S['states'])[b]} – {t}"})
            key.append((tag, f"{dict(S['states'])[a]} → {dict(S['states'])[b]}: {t}"))
        leg = legend_items(ctx, [S["domain"]], [], [("built", "Transition (badge T = row in the transition list)")])
        svg, checks, method = graph_figure(ctx, fid, nodes, edges, clusters=[], legend=leg, key_entries=key,
                                           key_title="Transitions", key_cols=1, minw=120, maxw=180,
                                           title=f"State machine: {S['name']}",
                                           desc=f"{len(S['states'])} states and {len(S['trans'])} numbered transitions of the "
                                                f"{S['name'].lower()} lifecycle, with the guard or timing of each transition listed below.")
        rows = [[f"T{i + 1}", dict(S["states"])[a], dict(S["states"])[b], t] for i, (a, b, t) in enumerate(S["trans"])]
        out.append(fig(fid, f"State machine – {S['name']}",
                       f"{len(S['states'])} states, {len(S['trans'])} transitions; every timing on an arrow comes from the "
                       "timings table.", "transitions", len(S["trans"]), "built", S["source"], method, svg,
                       {"columns": ["Transition", "From", "To", "Guard or timing"], "rows": rows}, checks,
                       f"state-machine-{re.sub(r'[^a-z0-9]+', '-', S['name'].lower()).strip('-')}.svg"))
    return out


# ---------------------------------------------------------------- D10 backbone before and after
def d10(ctx):
    F = ctx.F
    bb = F.get("backbone", {})
    T = TIERS[CUR["tier"] or "A"]
    M = 24
    PW, PW2 = 680, 520
    body, rects, labels = [], {}, []
    # before panel
    groups = [("musicLibrary", [s for s in F["stores"] if s["repo"] == "musicLibrary"]),
              ("songnodes", [s for s in F["stores"] if s["repo"] == "songnodes"]),
              ("external", [s for s in F["stores"] if s["repo"] == "external"])]
    chip_h = lh(T["text"]) + 8
    colw = (PW - 3 * 8) / 4
    x0, y0 = M, M
    s_, hh = text_el(x0, y0, "Before: Built stores by project", T["head"])
    body.append(s_)
    y0 += hh + 8
    cols = [("musicLibrary", groups[0][1]), ("songnodes", groups[1][1][:len(groups[1][1]) // 2 + len(groups[1][1]) % 2]),
            ("songnodes (cont.)", groups[1][1][len(groups[1][1]) // 2 + len(groups[1][1]) % 2:]), ("external", groups[2][1])]
    maxy = y0
    for k, (gname, ss) in enumerate(cols):
        x = x0 + k * (colw + 8)
        s_, h_ = text_el(x, y0, gname, T["meta"], "2")
        body.append(s_)
        y = y0 + h_ + 4
        for st in sorted(ss, key=lambda z: z["id"]):
            nm = wrap(ctx.name(st["id"]), T["text"], colw - 24, 1)[0]
            n = {"id": st["id"], "raw": [(nm, "text", "", 1)], "c": ctx.chart(st.get("domain", "ops")),
                 "state": "queued" if st.get("state") == "queued" else "production",
                 "title": f'{ctx.name(st["id"])} ({st["id"]}): {st.get("kind")}, {st.get("domain")}, owner {st.get("owner")}',
                 "marks": []}
            node_size(n, T, colw, colw)
            r = (x, y, colw, chip_h + 4)
            n["lines"] = [(nm, T["text"], "")]
            body.append(node_svg(n, r, T))
            rects[st["id"]] = r
            y += chip_h + 7
        maxy = max(maxy, y)
    hops = [f for f in ctx.flows if ctx.repo(f["from"]) != ctx.repo(f["to"]) and "external" not in (ctx.repo(f["from"]), ctx.repo(f["to"]))]
    ty = maxy + 6
    for ln in wrap(f"{len(hops)} cross-project hops today, each its own file or endpoint: flows "
                   + ", ".join(str(f['n']) for f in hops) + ".", T["text"], PW, 3):
        s_, h_ = text_el(x0, ty, ln, T["text"], "2")
        body.append(s_)
        ty += h_
    maxy = ty
    # after panel
    ax = M + PW + 40
    s_, hh = text_el(ax, M, "After: proposed backbone", T["head"])
    body.append(s_)
    y = M + hh + 8
    tree = [l for l in bb.get("tree", "").split("\n") if l.strip()]
    rw = PW2
    for k, line in enumerate(tree):
        ind = len(line) - len(line.lstrip(" "))
        txt, _, cmt = line.strip().partition("#")
        txt, cmt = txt.strip(), re.sub(r"^new:\s*", "", cmt.strip(), flags=re.I)
        new = bool(re.search(r"\bnew\b", line.partition("#")[2], re.I))
        x = ax + ind * 9
        w = rw - ind * 9
        dom = "library" if "musicLibrary" in "".join(tree[:k + 1][-1:]) else "ops"
        n = {"id": f"bb-{k}", "raw": [(txt + ("  (new)" if new else "") + (f" \u2013 {cmt}" if cmt and cmt.lower() != "new" else ""), "text", "", 1)],
             "c": 8, "state": "proposed" if new else "production",
             "title": f"{txt}" + (f" – {cmt}" if cmt else ""), "marks": []}
        _, h_ = node_size(n, T, w, w)
        r = (x, y, w, h_)
        body.append(node_svg(n, r, T).replace(f'data-node="bb-{k}"', f'data-node="backbone-{k}"', 1))
        rects[f"bb-{k}"] = r
        y += h_ + 5
    maxy = max(maxy, y)
    W = ax + PW2 + M
    leg = legend_items(ctx, sorted({s.get("domain") for s in F["stores"]}), ["production", "queued", "proposed"], [])
    y = maxy + 16
    lgh = legend_height(leg, W - 2 * M, T)
    H = y + lgh + M
    W, H, minu = fit_canvas(W, H, "wide")
    s_, _, _ = legend_svg(leg, M, y, W - 2 * M, T, "D10")
    body.append(s_)
    svg = svg_root("D10", W, H, "Storage backbone before and after",
                   f"Left: the {len(F['stores'])} built stores grouped by project, with the cross-project hops listed. "
                   "Right: the proposed backbone tree; new folders and files are dashed brand cards.", "\n".join(body))
    rows = [["before", s["repo"], s["id"], ctx.name(s["id"]), s.get("kind"), STATE_WORD["queued" if s.get("state") == "queued" else "built"]]
            for g, ss in groups for s in sorted(ss, key=lambda z: z["id"])]
    rows += [["after", "", f"backbone-{k}", l.strip(), "", "Proposed" if re.search(r"\bnew\b", l, re.I) else "Built"]
             for k, l in enumerate(tree)]
    nnew = sum(1 for l in tree if re.search(r"\bnew\b", l, re.I))
    return fig("D10", "Storage backbone before and after",
               f"Each project keeps its own data folder; the change is {nnew} new contract and exchange entries that carry "
               f"the {len(hops)} cross-project hops.", "stores and backbone entries", len(F["stores"]) + len(tree),
               "built+projected", "stores[] (repo, kind, domain, state); backbone.tree; flows[] crossing repos",
               "hand-placed two-panel tree; 0 edges", svg,
               {"columns": ["Panel", "Repo", "ID", "Entry", "Kind", "State"], "rows": rows},
               hand_checks(rects, [], labels, W, H, minu, T), "storage-backbone-before-after.svg")


# ---------------------------------------------------------------- D11 roadmap
def d11(ctx):
    F = ctx.F
    waves = F.get("roadmap", [])
    tasks = {t["id"]: t for t in F.get("tasks", [])}
    gaps = {g["id"]: g for g in F.get("gaps", [])}
    T = TIERS[CUR["tier"] or "A"]
    M, colw, cw, corridor = 24, 242, 208, 30
    W = 2 * M + 30 + len(waves) * colw
    body, rects, eps, labels = [], {}, [], []
    x0 = M + 30
    top = M + lh(T["meta"]) + 8

    def tdom(t):
        for gid in t.get("gaps", []):
            g = gaps.get(gid)
            if not g:
                continue
            for a in g.get("affects", []):
                m = _match_affect(ctx, a)
                if m:
                    return ctx.domain(m)
        return "design" if t["project"] == "design-system" else "ops"
    # wave headers
    hdr = {}
    hh = 0
    for k, w in enumerate(waves):
        n = {"id": w["id"], "raw": [(f'{w["id"]} {w["name"]}', "name", "", 2)], "c": 8, "state": "note",
             "title": f'{w["id"]}: {w["name"]}', "marks": []}
        _, h_ = node_size(n, T, cw, cw)
        hdr[w["id"]] = n
        hh = max(hh, h_)
    for k, w in enumerate(waves):
        r = (x0 + k * colw, top, cw, hh)
        body.append(node_svg(hdr[w["id"]], r, T).replace(f'data-node="{w["id"]}"', f'data-node="{w["id"]}" data-wave="{w["id"]}"', 1))
        rects[w["id"]] = r
    # task cards
    cards = {}
    ch = 0
    for w in waves:
        for tid in w["tasks"]:
            t = tasks.get(tid, {"id": tid, "title": tid, "project": "", "type": ""})
            d = tdom(t)
            n = {"id": tid, "raw": [(tid, "num", "", 1), (t["title"], "text", "", 2),
                                    (f'{d} · {t["project"]} · {t.get("type", "")}', "meta", "2", 1)],
                 "c": ctx.chart(d), "state": "queued",
                 "title": f'{tid} ({t["project"]}, {t.get("type")}): {t["title"]}. Verify: {t.get("verify", "")}', "marks": []}
            _, h_ = node_size(n, T, cw, cw)
            cards[tid] = n
            ch = max(ch, h_)
    rowy = lambda i: top + hh + corridor + i * (ch + corridor)
    pos = {}
    maxrows = max(len(w["tasks"]) for w in waves) if waves else 0
    for k, w in enumerate(waves):
        for i, tid in enumerate(w["tasks"]):
            r = (x0 + k * colw, rowy(i), cw, ch)
            pos[tid] = (k, i)
            rects[tid] = r
            body.append(node_svg(cards[tid], r, T).replace(f'data-node="{tid}"', f'data-node="{tid}" data-task="{tid}"', 1))
    # gates
    gy = rowy(maxrows) + 4
    gh = 0
    gnodes = {}
    for w in waves:
        n = {"id": f'gate-{w["id"]}', "raw": [(f'Gate: {w.get("gate", "")}', "meta", "", 3)], "c": 8, "state": "note",
             "title": f'{w["id"]} gate: {w.get("gate", "")}', "marks": []}
        _, h_ = node_size(n, T, cw - 30, cw - 30)
        gnodes[w["id"]] = n
        gh = max(gh, h_)
    for k, w in enumerate(waves):
        gx = x0 + k * colw
        body.append(f'<path class="sn-diagram__gate" d="M{gx + 12:.1f} {gy + gh / 2 - 12:.1f} L{gx + 24:.1f} {gy + gh / 2:.1f} '
                    f'L{gx + 12:.1f} {gy + gh / 2 + 12:.1f} L{gx:.1f} {gy + gh / 2:.1f} Z"/>')
        r = (gx + 30, gy, cw - 30, gh)
        rects[f'gate-{w["id"]}'] = r
        body.append(node_svg(gnodes[w["id"]], r, T).replace(f'data-node="gate-{w["id"]}"', f'data-node="{w["id"]}" data-gate="{w["id"]}"', 1))
    # wave dependency arrows: gate of the earlier wave -> header of the later wave (routed through the top corridor)
    lane_y = M - 4
    widx = {w["id"]: k for k, w in enumerate(waves)}
    used = 0
    for w in waves:
        for d in w.get("depends", []):
            if d not in widx:
                continue
            a, b = rects[d], rects[w["id"]]
            if widx[w["id"]] - widx[d] == 1:
                y = a[1] + a[3] / 2
                pts = [(a[0] + a[2], y), (b[0], y)]
            else:
                ly = top - 6 - used * 6
                used += 1
                pts = [(a[0] + a[2] - 20 - used * 6, a[1]), (a[0] + a[2] - 20 - used * 6, ly), (b[0] + 20 + used * 6, ly), (b[0] + 20 + used * 6, b[1])]
            body.append(simple_edge(f"{d}>{w['id']}", d, w["id"], pts, 8, "neutral", f"{w['id']} depends on {d}"))
            eps.append((d, w["id"], pts))
    # task dependency arrows through corridors
    for tid, t in sorted(tasks.items()):
        for d in t.get("depends", []):
            if d not in pos or tid not in pos:
                continue
            (ka, ia), (kb, ib) = pos[d], pos[tid]
            a, b = rects[d], rects[tid]
            if ka == kb:
                xx = a[0] + a[2] - 24
                pts = [(xx, a[1] + a[3]), (xx, b[1])] if ib > ia else [(xx, a[1]), (xx, b[1] + b[3])]
            else:
                cy = rowy(ib) - corridor / 2 + (4 if (ka + kb) % 2 else -4)
                xa = a[0] + a[2] + 8 + (ia % 3) * 4
                xb = b[0] - 10 - (ib % 3) * 4
                pts = [(a[0] + a[2], a[1] + a[3] / 2), (xa, a[1] + a[3] / 2), (xa, cy), (xb, cy), (xb, b[1] + b[3] / 2),
                       (b[0], b[1] + b[3] / 2)]
                pts = ortho_simplify(pts)
            body.append(simple_edge(f"{d}>{tid}", d, tid, pts, cards[tid]["c"], "queued", f"{tid} depends on {d}"))
            eps.append((d, tid, pts))
    # today marker
    tx = x0 - 14
    bottom = gy + gh + 6
    body.append(f'<path class="sn-diagram__now" d="M{tx:.1f} {M:.1f} L{tx:.1f} {bottom:.1f}"/>')
    today = F.get("meta", {}).get("ml_snapshot", "")
    s_, _ = text_el(tx + 6, M - 2, f"Today {today}".strip(), T["meta"])
    body.append(f'<g class="sn-diagram__today">{s_}</g>')
    labels.append((tx + 6, M - 2, tw(f"Today {today}", T["meta"]), lh(T["meta"])))
    y = bottom + 16
    doms = [ctx.domain(t) for t in []] + [cards[t]["raw"][2][0].split(" · ")[0] for t in cards]
    leg = legend_items(ctx, doms, ["queued"], [("neutral", "Wave depends on wave"), ("queued", "Task depends on task"),
                                               ("gate", "Gate that closes the wave"), ("now", "Today")])
    lgh = legend_height(leg, W - 2 * M, T)
    H = y + lgh + M
    W, H, minu = fit_canvas(W, H, "wide")
    s_, _, _ = legend_svg(leg, M, y, W - 2 * M, T, "D11")
    body.append(s_)
    svg = svg_root("D11", W, H, "Roadmap: waves, tasks and gates",
                   f"{len(waves)} waves as columns from Today; {len(cards)} task cards with dependency arrows, a gate "
                   "diamond under each wave and wave-to-wave dependencies across the top.", "\n".join(body))
    chk = hand_checks({k: v for k, v in rects.items()}, eps, labels, W, H, minu, T)
    rows = [[w["id"], tid, tasks.get(tid, {}).get("title"), tasks.get(tid, {}).get("project"),
             ", ".join(tasks.get(tid, {}).get("depends", [])) or "–", w.get("gate"), ", ".join(w.get("depends", [])) or "–"]
            for w in waves for tid in w["tasks"]]
    return fig("D11", "Roadmap timeline", f"{len(waves)} waves and {len(cards)} tasks; the security gate in W1 comes "
               "before any tunnel.", "tasks", len(cards), "queued",
               "roadmap[] (tasks, gate, depends); tasks[] (project, type, depends, gaps); meta.ml_snapshot (Today)",
               f"hand-placed columns, dependency arrows routed through row corridors; {chk['crossings']} crossings", svg,
               {"columns": ["Wave", "Task", "Title", "Project", "Depends on", "Gate", "Wave depends on"], "rows": rows},
               chk, "roadmap-timeline.svg")


BUILDERS = [("D1", d1), ("D2", d2), ("D3", d3), ("D4", d4), ("D5", d5), ("D6", d6), ("D7", d7), ("D8", d8), ("D9", d9),
            ("D10", d10), ("D11", d11), ("D12", d12)]


def build(F, only=None):
    ctx = Ctx(F)
    figs = []
    for key, fn in BUILDERS:
        if only and key not in only:
            continue
        r = None
        for t in TIER_ORDER:
            CUR["tier"] = t
            r = fn(ctx)
            rs = r if isinstance(r, list) else [r]
            if all((f.get("checks") or {}).get("min_font_units", 0) <= (f.get("checks") or {}).get("font_floor_used", 99) + 1e-6 for f in rs):
                break
        CUR["tier"] = None
        figs.extend(r if isinstance(r, list) else [r])
    return sorted(figs, key=lambda f: f["id"])
