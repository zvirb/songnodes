"""C-series charts for the data-flow report, computed from findings.json. Deterministic: no clock, no randomness.

Practice notes (Cleveland & McGill 1984; Few, "Bullet graph design spec" 2013; Tufte 1983/2001):
1. Position on a common scale beats length, angle and area: horizontal bars from a zero baseline, sorted by value, labelled directly.
2. Small multiples / stacked parts keep one scale and one series order everywhere; the part order is fixed (state order), never re-sorted.
3. Bullet graph: one featured measure (current) against one comparative measure (limit) over quiet qualitative bands; ratio scale so unlike units compare.
4. Log axes only for data spanning decades, ticked at named units (1 s, 1 min, 1 h, 1 d) and labelled as log; never bars on a log axis.
5. Matrices: seriate rows and columns by connection count, put the meaning in the cell (letter / number), colour only as redundant emphasis.

API: build(F) -> list of figure dicts; recompute(F, fig) re-derives a chart's table from F and asserts equality.
"""
import html
import math
import re
from collections import Counter, defaultdict

E = lambda s: html.escape(str(s), quote=True)

W_PORTRAIT, W_WIDE = 703, 1032
CW = {"label": 6.6, "value": 6.7, "data": 6.7}      # mean advance per character in px (12px Inter, 11px mono)

# ---- colour maps: defined once, assigned to the entity, never to rank -------------------------------
# Domains use F["colour_map"]. Non-domain categories:
MEASURE_COLOUR = "chart-1"                          # single measured series (C3 signal counts, C6 request load)
FLOW_DIR_COLOUR = {"in": "chart-6", "out": "chart-7"}   # C4 fan-in / fan-out
# State categories use status tokens with glyph + word (mirrors render.py OUTCOME_STATUS / RULE_STATUS).
GLYPH = {"ok": "●", "fair": "◐", "warn": "▲", "bad": "✕", "info": "○", "idle": "–"}
RULE_ORDER = [("pass", "ok", "Pass"), ("exception", "fair", "Accepted exception"), ("violation", "bad", "Violation"), ("n/a", "idle", "n/a")]
OUTCOME_ORDER = [("confirmed", "ok", "Confirmed"), ("corrected", "fair", "Corrected"), ("refuted", "bad", "Refuted"),
                 ("not-reproducible", "warn", "Not reproducible"), ("open", "info", "Open")]
SEVERITY_ORDER = [("critical", "bad", "Critical"), ("high", "warn", "High"), ("medium", "fair", "Medium"), ("low", "info", "Low")]
EFFORT_ORDER = [("S", "Small"), ("M", "Medium"), ("L", "Large")]
AREA_NAME = {"ml": "musicLibrary", "sn-backend": "songnodes backend", "sn-frontend": "songnodes frontend"}
REPO_CODE = [("sn-be-", "be"), ("sn-fe-", "fe"), ("ml-", "ml"), ("sn-", "sn")]


# ---- small helpers -----------------------------------------------------------------------------------
def fmt(v):
    if isinstance(v, int) or (isinstance(v, float) and v.is_integer() and abs(v) >= 1):
        return "{:,}".format(int(v))
    if v == 0:
        return "0"
    if abs(v) >= 100:
        return "{:,}".format(int(round(v)))
    if abs(v) >= 1:
        return ("%.1f" % v).rstrip("0").rstrip(".")
    s = "%.3g" % v
    return s


def trunc(s, n):
    s = str(s)
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def nice_ticks(vmax, count=5):
    if vmax <= 0:
        return [0, 1]
    raw = vmax / count
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    top = math.ceil(vmax / step) * step
    ticks, v = [], 0.0
    while v <= top + 1e-9:
        ticks.append(int(v) if float(v).is_integer() else round(v, 6))
        v += step
    return ticks


def short_code(pid):
    for pre, code in REPO_CODE:
        if pid.startswith(pre):
            return code, pid[len(pre):]
    return "", pid


def store_short(name):
    """Display name for a store: the part before a parenthesis or a slash list."""
    s = re.split(r" \(| / ", name)[0].strip()
    return s or name


def page_name(P, pid):
    p = P.get(pid)
    return p["title"] if p else pid


def t(x, y, s, cls, anchor="start", extra=""):
    a = ' text-anchor="%s"' % anchor if anchor != "start" else ""
    return '<text x="%s" y="%s" class="%s"%s%s>%s</text>' % (r(x), r(y), cls, a, extra, E(s))


def r(v):
    return ("%.1f" % v).rstrip("0").rstrip(".")


def rect(x, y, w, h, cls, colour=None, title=None, extra=""):
    st = ' style="--c: var(--%s)"' % colour if colour else ""
    body = "<title>%s</title>" % E(title) if title else ""
    return '<rect x="%s" y="%s" width="%s" height="%s" class="%s"%s%s>%s</rect>' % (r(x), r(y), r(max(w, 0)), r(max(h, 0)), cls, st, extra, body)


def hatch_defs(cid):
    return ('<defs><pattern id="%s-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            '<line x1="0" y1="0" x2="0" y2="6" class="sn-rchart__pat-line"/></pattern></defs>') % cid


def svg_wrap(cid, W, H, title, desc, body):
    lid = cid.lower()
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" aria-labelledby="%s-t %s-d" class="sn-chart">'
            '<title id="%s-t">%s</title><desc id="%s-d">%s</desc>%s</svg>') % (W, math.ceil(H), lid, lid, lid, E(title), lid, E(desc), body)


def legend(items, x, y):
    """items: (kind, colour, word). kind: solid | hatch | proj | status | none. Returns (svg, width)."""
    out, cx = [], x
    for kind, colour, word, cid in items:
        if kind == "proj":
            out.append(rect(cx, y - 9, 12, 10, "sn-rchart__bar--proj"))
        elif kind == "none":
            out.append(rect(cx, y - 9, 12, 10, "sn-rchart__bar--none"))
        else:
            out.append(rect(cx, y - 9, 12, 10, "sn-rchart__bar", colour))
            if kind == "hatch":
                out.append('<rect x="%s" y="%s" width="12" height="10" fill="url(#%s-hatch)"/>' % (r(cx), r(y - 9), cid))
        out.append(t(cx + 17, y, word, "sn-rchart__label"))
        cx += 17 + len(word) * CW["label"] + 18
    return "".join(out), cx - x


def x_axis(ticks, sx, y_top, y_bot, unit_title, W, x0, fmt_tick=fmt):
    out = []
    for v in ticks:
        x = sx(v)
        out.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-chart-frame__grid"/>' % (r(x), r(y_top), r(x), r(y_bot)))
        out.append(t(x, y_bot + 14, fmt_tick(v), "sn-chart-frame__tick", "middle"))
    out.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-chart-frame__base"/>' % (r(x0), r(y_top), r(x0), r(y_bot)))
    out.append(t(sx(ticks[-1]), y_bot + 30, unit_title, "sn-chart-frame__axis-title", "end"))
    return "".join(out)


def state_of(states):
    return "projected" if any(s != "built" for s in states) else "built"


def seg_label(x, w, y, text, cls="sn-rchart__value sn-rchart__halo"):
    if w >= len(text) * CW["value"] + 6:
        return t(x + w / 2, y, text, cls, "middle")
    return ""


def fig(cid, slug, title, caption, unit, n, state, source, method, svg, table, wide=False, filter_table=None):
    d = {"id": cid, "kind": "chart", "title": title, "caption": caption, "unit": unit, "n": n, "state": state,
         "source": source, "method": method, "svg": svg, "table": table, "wide": wide,
         "file": "%s-%s.svg" % (cid.lower().replace("c", "c0", 1) if len(cid) == 2 else cid.lower(), slug)}
    if filter_table:
        d["filter_table"] = filter_table
    return d


def desc(takeaway, n, unit, state, source):
    return "%s n = %s %s. State: %s. Source: findings.json %s." % (takeaway, n, unit, state.capitalize(), source)


# ==== C1 pages by domain and status ====================================================================
def data_c1(F):
    order = {d: i for i, d in enumerate(F["domain_order"])}
    agg = defaultdict(lambda: [0, 0, 0])
    for p in F["pages"]:
        a = agg[p["domain"]]
        if p["state"] != "built":
            a[2] += 1
        elif p["classification"] == "production":
            a[0] += 1
        else:
            a[1] += 1
    rows = sorted(agg.items(), key=lambda kv: (-sum(kv[1]), order.get(kv[0], 99), kv[0]))
    table = {"columns": ["Domain", "Series colour", "Production (built)", "Non-final (built)", "Queued", "Total"],
             "rows": [[d, F["colour_map"].get(d, "chart-8"), a[0], a[1], a[2], sum(a)] for d, a in rows]}
    return {"rows": rows, "table": table, "n": len(F["pages"]), "state": state_of(p["state"] for p in F["pages"])}


def c1(F):
    D = data_c1(F)
    cid, W = "C1", W_PORTRAIT
    x0, x1, top, rh, bh = 96, W - 48, 34, 28, 18
    vmax = max(sum(a) for _, a in D["rows"])
    ticks = nice_ticks(vmax)
    sx = lambda v: x0 + (x1 - x0) * v / ticks[-1]
    y_bot = top + rh * len(D["rows"]) + 4
    b = [hatch_defs(cid)]
    lg, _ = legend([("solid", "fg-3", "Production", cid), ("hatch", "fg-3", "Non-final", cid), ("proj", None, "Queued", cid)], x0, 14)
    b.append(lg)
    b.append(x_axis(ticks, sx, top - 6, y_bot, "Pages", W, x0))
    for i, (dom, a) in enumerate(D["rows"]):
        y = top + i * rh + (rh - bh) / 2
        col = F["colour_map"].get(dom, "chart-8")
        b.append(t(x0 - 8, y + bh - 5, dom, "sn-rchart__label", "end"))
        x = x0
        for k, (v, word) in enumerate(zip(a, ("production", "non-final", "queued"))):
            if not v:
                continue
            w = sx(v) - x0
            tip = "%s: %d %s pages" % (dom, v, word)
            if k == 2:
                b.append(rect(x, y, w, bh, "sn-rchart__bar--proj", title=tip))
                b.append(seg_label(x, w, y + bh - 5, "Q %d" % v, "sn-rchart__value"))
            else:
                b.append(rect(x, y, w, bh, "sn-rchart__bar", col, tip))
                if k == 1:
                    b.append('<rect x="%s" y="%s" width="%s" height="%s" fill="url(#%s-hatch)"/>' % (r(x), r(y), r(w), bh, cid))
                b.append(seg_label(x, w, y + bh - 5, str(v)))
            x += w
        b.append(t(x + 5, y + bh - 5, "%d" % sum(a), "sn-rchart__value"))
    H = y_bot + 36
    title = "Pages by domain and status"
    top_dom = D["rows"][0]
    take = "%s holds the most pages (%d of %d); %d pages are non-final and %d queued." % (
        top_dom[0], sum(top_dom[1]), D["n"], sum(a[1] for _, a in D["rows"]), sum(a[2] for _, a in D["rows"]))
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "pages", D["state"], "pages[]"), "".join(b))
    return fig(cid, "pages-by-domain", title, take, "pages", D["n"], D["state"], "pages[].domain, pages[].classification, pages[].state",
               "Count of pages per domain; built pages split by classification, queued pages counted separately; sorted by total.",
               svg, D["table"], filter_table="t-pages")


# ==== C2 page x store access matrix ====================================================================
def access_links(F):
    S = {s["id"] for s in F["stores"]}
    P = {p["id"] for p in F["pages"]}
    acc = defaultdict(set)
    queued = set()
    for s in F["signals"]:
        a, b, d = s["from"], s["to"], s["direction"]
        if a in P and b in S:
            key, letters = (a, b), {"write": "W", "read": "R", "both": "RW"}[d]
        elif a in S and b in P:
            key, letters = (b, a), {"write": "R", "read": "R", "both": "RW"}[d]
        else:
            continue
        acc[key].update(letters)
        if s["state"] != "built":
            queued.add(key)
    for f in F["flows"]:
        if f["from"] in P and f["to"] in S:
            key, letter = (f["from"], f["to"]), "W"
        elif f["from"] in S and f["to"] in P:
            key, letter = (f["to"], f["from"]), "R"
        else:
            continue
        acc[key].add(letter)
        if f["state"] != "built":
            queued.add(key)
    return {k: ("RW" if v >= {"R", "W"} else "".join(sorted(v))) for k, v in acc.items()}, queued


def data_c2(F, max_pages=25, max_stores=15):
    acc, queued = access_links(F)
    deg = Counter(p for p, _ in acc)
    pages = sorted(deg, key=lambda p: (-deg[p], p))[:max_pages]
    sdeg = Counter(s for p, s in acc if p in pages)
    stores = sorted(sdeg, key=lambda s: (-sdeg[s], s))[:max_stores]
    pages = [p for p in pages if any((p, s) in acc for s in stores)]
    cells = [(p, s, acc[(p, s)], (p, s) in queued) for p in pages for s in stores if (p, s) in acc]
    P = {p["id"]: p for p in F["pages"]}
    SN = {s["id"]: s["name"] for s in F["stores"]}
    table = {"columns": ["Page", "Store", "Access", "State"],
             "rows": [[page_name(P, p), SN[s], a, "queued" if q else "built"] for p, s, a, q in cells]}
    return {"pages": pages, "stores": stores, "cells": cells, "acc": acc, "table": table,
            "n_links": len(acc), "n_pages": len(deg), "n_stores": len({s for _, s in acc}),
            "state": "projected" if queued else "built"}


def c2(F):
    D = data_c2(F)
    cid, W = "C2", W_PORTRAIT
    P = {p["id"]: p for p in F["pages"]}
    SN = {s["id"]: s["name"] for s in F["stores"]}
    lab_w, cw, ch = 236, 30, 20
    head = 150
    x0 = lab_w + 8
    b = []
    for j, s in enumerate(D["stores"]):
        cx = x0 + j * cw + cw / 2
        b.append('<text x="%s" y="%s" class="sn-rchart__label" transform="rotate(-90 %s %s)">%s<title>%s</title></text>'
                 % (r(cx + 4), head - 6, r(cx + 4), head - 6, E(trunc(store_short(SN[s]), 22)), E(SN[s])))
    cellmap = {(p, s): (a, q) for p, s, a, q in D["cells"]}
    for i, p in enumerate(D["pages"]):
        y = head + i * ch
        b.append('<text x="%s" y="%s" class="sn-rchart__label" text-anchor="end">%s<title>%s</title></text>'
                 % (r(x0 - 8), r(y + ch - 6), E(trunc(page_name(P, p), 36)), E(page_name(P, p))))
        for j, s in enumerate(D["stores"]):
            x = x0 + j * cw
            if (p, s) in cellmap:
                a, q = cellmap[(p, s)]
                words = {"R": "reads", "W": "writes", "RW": "reads and writes"}[a]
                b.append(rect(x + 1, y + 1, cw - 2, ch - 2, "sn-rchart__cell" + (" sn-rchart__cell--queued" if q else ""),
                              title="%s %s %s%s" % (page_name(P, p), words, SN[s], " (queued)" if q else "")))
                b.append(t(x + cw / 2, y + ch - 6, a, "sn-rchart__cell-text", "middle"))
            else:
                b.append(rect(x + 1, y + 1, cw - 2, ch - 2, "sn-rchart__cell--empty"))
    H = head + len(D["pages"]) * ch + 8
    lg, _ = legend([("none", None, "R reads · W writes · RW both", cid), ("proj", None, "Queued", cid)], 8, 16)
    b.insert(0, lg)
    title = "Page and store access matrix"
    cap = ("The %d most connected pages against the %d most used stores (of %d pages and %d stores with %d access links); "
           "letters give the access, R read, W write, RW both.") % (len(D["pages"]), len(D["stores"]), D["n_pages"], D["n_stores"], D["n_links"])
    svg = svg_wrap(cid, W, H, title, desc(cap, D["n_links"], "page–store links", D["state"], "signals[], flows[]"), "".join(b))
    return fig(cid, "page-store-matrix", title, cap, "page–store links", D["n_links"], D["state"],
               "signals[] (from, to, direction, state), flows[] (from, to, state)",
               "A link is any signal or flow between a page and a store; signal direction gives R/W/RW, a flow into a store is W and out of a store is R. "
               "Rows and columns ranked by distinct connections (ties by id) and capped at 25 by 15.", svg, D["table"], filter_table="t-signals")


# ==== C3 signal primitive prevalence ===================================================================
def data_c3(F):
    b, q = Counter(), Counter()
    for s in F["signals"]:
        (b if s["state"] == "built" else q)[s["type"]] += 1
    types = sorted(set(b) | set(q), key=lambda k: (-(b[k] + q[k]), -b[k], k))
    table = {"columns": ["Signal type", "Built", "Queued", "Projected"], "rows": [[k, b[k], q[k], b[k] + q[k]] for k in types]}
    return {"types": types, "b": b, "q": q, "table": table, "n": len(F["signals"]), "state": state_of(s["state"] for s in F["signals"])}


def c3(F):
    D = data_c3(F)
    cid, W = "C3", W_PORTRAIT
    x0, x1, top, rh = 120, W - 48, 34, 26
    vmax = max(D["b"][k] + D["q"][k] for k in D["types"])
    ticks = nice_ticks(vmax)
    sx = lambda v: x0 + (x1 - x0) * v / ticks[-1]
    y_bot = top + rh * len(D["types"]) + 4
    b = []
    lg, _ = legend([("solid", MEASURE_COLOUR, "Built", cid), ("proj", None, "Projected (built + queued)", cid)], x0, 14)
    b += [lg, x_axis(ticks, sx, top - 6, y_bot, "Signals", W, x0)]
    for i, k in enumerate(D["types"]):
        y = top + i * rh + 3
        bv, pv = D["b"][k], D["b"][k] + D["q"][k]
        b.append(t(x0 - 8, y + 13, k, "sn-rchart__label", "end"))
        b.append(rect(x0, y, sx(bv) - x0, 9, "sn-rchart__bar", MEASURE_COLOUR, "%s built: %d" % (k, bv)))
        b.append(t(sx(bv) + 4, y + 8, str(bv), "sn-rchart__value"))
        b.append(rect(x0, y + 11, sx(pv) - x0, 9, "sn-rchart__bar--proj", title="%s projected: %d" % (k, pv)))
        if pv != bv:
            b.append(t(sx(pv) + 4, y + 19, "%d projected" % pv, "sn-rchart__value"))
    H = y_bot + 36
    title = "Signal primitives, built and projected"
    top_k = D["types"][0]
    added = sorted(k for k in D["types"] if D["q"][k])
    take = "%s carries %d of %d signals; queued work adds %d signals (%s)." % (
        top_k, D["b"][top_k] + D["q"][top_k], D["n"], sum(D["q"].values()), ", ".join(added) or "none")
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "signals", D["state"], "signals[]"), "".join(b))
    return fig(cid, "signal-primitives", title, take, "signals", D["n"], D["state"], "signals[].type, signals[].state",
               "Count of signals per type; Built = state built, Projected = built + queued; sorted by projected count.", svg, D["table"], filter_table="t-signals")


# ==== C4 store fan-in / fan-out ========================================================================
def data_c4(F):
    S = {s["id"]: s for s in F["stores"]}
    sig = {s["id"]: s for s in F["signals"]}
    v = defaultdict(lambda: [0, 0, 0, 0])       # in built, in queued, out built, out queued
    chans = defaultdict(Counter)
    n = 0
    for f in F["flows"]:
        q = f["state"] != "built"
        hit = False
        if f["to"] in S:
            v[f["to"]][1 if q else 0] += 1
            chans[f["to"]][f.get("channel")] += 1
            hit = True
        if f["from"] in S:
            v[f["from"]][3 if q else 2] += 1
            chans[f["from"]][f.get("channel")] += 1
            hit = True
        n += hit

    def contract(sid):
        for ch, _ in sorted(chans[sid].items(), key=lambda kv: (-kv[1], str(kv[0]))):
            if ch in sig:
                return "%s (%s)" % (sig[ch]["name"], sig[ch].get("format") or "–")
        return "–"
    ids = sorted(v, key=lambda s: (-sum(v[s]), -(v[s][0] + v[s][1]), S[s]["name"]))
    table = {"columns": ["Store", "In (built)", "In (queued)", "Out (built)", "Out (queued)", "Main contract"],
             "rows": [[S[s]["name"], v[s][0], v[s][1], v[s][2], v[s][3], contract(s)] for s in ids]}
    st = state_of(f["state"] for f in F["flows"] if f["to"] in S or f["from"] in S)
    return {"ids": ids, "v": v, "S": S, "table": table, "n": n, "state": st}


def c4(F):
    D = data_c4(F)
    cid, W = "C4", W_PORTRAIT
    lab, top, rh, bh = 212, 40, 22, 14
    xc = lab + (W - lab) / 2
    half = (W - lab) / 2 - 34
    vmax = max(max(a[0] + a[1], a[2] + a[3]) for a in D["v"].values())
    ticks = nice_ticks(vmax, 3)
    sc = half / ticks[-1]
    y_bot = top + rh * len(D["ids"]) + 2
    b = [hatch_defs(cid)]
    for tv in ticks:
        for sgn in ((-1, 1) if tv else (1,)):
            x = xc + sgn * tv * sc
            b.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-chart-frame__grid"/>' % (r(x), top - 4, r(x), r(y_bot)))
            b.append(t(x, y_bot + 14, fmt(tv), "sn-chart-frame__tick", "middle"))
    b.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-chart-frame__base"/>' % (r(xc), top - 4, r(xc), r(y_bot)))
    b.append(t(xc - 6, top - 12, "← In: flows to the store", "sn-rchart__label sn-rchart__label--strong", "end"))
    b.append(t(xc + 6, top - 12, "Out: flows from the store →", "sn-rchart__label sn-rchart__label--strong"))
    b.append(t(W - 8, y_bot + 30, "Flows", "sn-chart-frame__axis-title", "end"))
    lg, _ = legend([("solid", FLOW_DIR_COLOUR["in"], "In", cid), ("hatch", FLOW_DIR_COLOUR["out"], "Out", cid), ("proj", None, "Queued", cid)], 8, 12)
    b.append(lg)
    for i, s in enumerate(D["ids"]):
        a = D["v"][s]
        name = D["S"][s]["name"]
        y = top + i * rh + (rh - bh) / 2
        b.append('<text x="%s" y="%s" class="sn-rchart__label" text-anchor="end">%s<title>%s</title></text>' % (lab - 4, r(y + bh - 3), E(trunc(store_short(name), 32)), E(name)))
        # in (left)
        w_in = a[0] * sc
        if a[0]:
            b.append(rect(xc - w_in, y, w_in, bh, "sn-rchart__bar", FLOW_DIR_COLOUR["in"], "%s in: %d flows" % (name, a[0])))
        if a[1]:
            b.append(rect(xc - w_in - a[1] * sc, y, a[1] * sc, bh, "sn-rchart__bar--proj", title="%s in, queued: %d" % (name, a[1])))
        if a[0] + a[1]:
            b.append(t(xc - (a[0] + a[1]) * sc - 4, y + bh - 3, str(a[0] + a[1]) + (" (%d Q)" % a[1] if a[1] else ""), "sn-rchart__value", "end"))
        w_out = a[2] * sc
        if a[2]:
            b.append(rect(xc, y, w_out, bh, "sn-rchart__bar", FLOW_DIR_COLOUR["out"], "%s out: %d flows" % (name, a[2])))
            b.append('<rect x="%s" y="%s" width="%s" height="%s" fill="url(#%s-hatch)"/>' % (r(xc), r(y), r(w_out), bh, cid))
        if a[3]:
            b.append(rect(xc + w_out, y, a[3] * sc, bh, "sn-rchart__bar--proj", title="%s out, queued: %d" % (name, a[3])))
        if a[2] + a[3]:
            b.append(t(xc + (a[2] + a[3]) * sc + 4, y + bh - 3, str(a[2] + a[3]) + (" (%d Q)" % a[3] if a[3] else ""), "sn-rchart__value"))
    H = y_bot + 36
    title = "Store fan-in and fan-out"
    s0 = D["ids"][0]
    take = "%s is the busiest store (%d flows in, %d out); %d of %d stores sit on a numbered flow." % (
        store_short(D["S"][s0]["name"]), D["v"][s0][0] + D["v"][s0][1], D["v"][s0][2] + D["v"][s0][3], len(D["ids"]), len(F["stores"]))
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "flows", D["state"], "flows[]"), "".join(b))
    return fig(cid, "store-fan-in-out", title, take, "flows", D["n"], D["state"], "flows[] (from, to, channel, state), stores[], signals[] for the contract",
               "In = flows whose target is the store, out = flows whose source is the store; main contract = the signal named by the store's most frequent flow channel.",
               svg, D["table"], filter_table="t-stores")


# ==== C5 timing constants on a log axis ================================================================
LOG_TICKS = [(100, "100 ms"), (1000, "1 s"), (10000, "10 s"), (60000, "1 min"), (600000, "10 min"), (3600000, "1 h"),
             (86400000, "1 d"), (604800000, "1 wk"), (2592000000, "30 d"), (31536000000, "1 y")]
REF_RULES = [  # (label, predicate on a timing) — the key thresholds the data names
    ("Heartbeat stale", lambda x: x["kind"] == "heartbeat" and "stale" in x["name"]),
    ("Job lease", lambda x: x["kind"] == "lease" and x["id"].endswith("lease-default")),
    ("Job stall", lambda x: "stall threshold" in x["name"]),
    ("Token lifetime", lambda x: x["kind"] == "expiry" and "default" in x["name"] and "token" in x["name"].lower()),
]


def human_ms(ms):
    for unit, size in (("d", 86400000), ("h", 3600000), ("min", 60000), ("s", 1000)):
        if ms >= size and (ms % size == 0 or ms >= 10 * size):
            return "%s %s" % (fmt(ms / size), unit)
    return "%s ms" % fmt(ms)


def data_c5(F):
    T = sorted(F["timings"], key=lambda x: (x["value_ms"], x["id"]))
    by = defaultdict(list)
    for x in T:
        by[x["kind"]].append(x)
    kinds = sorted(by, key=lambda k: (sorted(v["value_ms"] for v in by[k])[(len(by[k]) - 1) // 2], k))
    refs = []
    for label, pred in REF_RULES:
        hit = [x for x in T if pred(x)]
        if hit:
            refs.append((label, hit[0]["value_ms"], hit[0]["id"]))
    table = {"columns": ["Timing", "Kind", "Value (ms)", "Value", "Where", "State"],
             "rows": [[x["name"], x["kind"], x["value_ms"], human_ms(x["value_ms"]), x["where"], x["state"]] for k in kinds for x in by[k]]}
    return {"kinds": kinds, "by": by, "refs": refs, "table": table, "n": len(T), "state": state_of(x["state"] for x in T)}


def c5(F):
    D = data_c5(F)
    cid, W = "C5", W_WIDE
    x0, x1 = 112, W - 24
    lo, hi = math.log10(60), math.log10(5e10)
    sx = lambda v: x0 + (x1 - x0) * (math.log10(v) - lo) / (hi - lo)
    # reference labels in lanes
    lanes, ref_svg_lab = [], []
    for label, v, rid in D["refs"]:
        text = "%s %s" % (label, human_ms(v))
        x = sx(v)
        wl = len(text) * 6.0 + 8
        lane = 0
        while any((l == lane and abs(x - px) < (wl + pw) / 2 + 6)        # labels in one lane overlap
                  or (l > lane and abs(x - px) < pw / 2 + 4)            # my line would cut a lower label
                  or (l < lane and abs(px - x) < wl / 2 + 4)            # an earlier line would cut my label
                  for l, px, pw in lanes):
            lane += 1
        lanes.append((lane, x, wl))
        ref_svg_lab.append((x, lane, text, rid))
    nlanes = 1 + max([l for l, _, _ in lanes] or [0])
    top = 34 + nlanes * 15
    rows, y = [], top
    for k in D["kinds"]:
        placed = []
        for x in D["by"][k]:
            px = sx(x["value_ms"])
            ln = 0
            while any(l == ln and abs(px - q) < 8.5 for l, q in placed):
                ln += 1
            placed.append((ln, px))
        nl = 1 + max(l for l, _ in placed)
        hgt = max(22, 10 + nl * 9)
        rows.append((k, y, hgt, placed))
        y += hgt
    y_bot = y
    b = []
    lg, _ = legend([("solid", None, "Built", cid), ("proj", None, "Queued", cid)], x0, 14)
    b.append(lg.replace('class="sn-rchart__bar"', 'class="sn-rchart__bar" style="--c: var(--fg-2)"', 1))
    b.append(t(x0 + 170, 14, "Dashed lines: reference thresholds", "sn-rchart__ref-label"))
    for v, lab in LOG_TICKS:
        x = sx(v)
        b.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-chart-frame__grid"/>' % (r(x), top - 4, r(x), r(y_bot)))
        b.append(t(x, y_bot + 14, lab, "sn-chart-frame__tick", "middle"))
    b.append(t(x1, y_bot + 30, "Duration, log scale (each gridline a named unit)", "sn-chart-frame__axis-title", "end"))
    for k, yy, hgt, placed in rows:
        b.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-rchart__lane"/>' % (x0, r(yy + hgt), x1, r(yy + hgt)))
        b.append(t(x0 - 8, yy + hgt / 2 + 4, "%s (%d)" % (k, len(D["by"][k])), "sn-rchart__label", "end"))
        for (ln, px), x in zip(placed, D["by"][k]):
            cy = yy + 8 + ln * 9 if len(placed) else yy + hgt / 2
            cls = "sn-rchart__dot" if x["state"] == "built" else "sn-rchart__dot--proj"
            b.append('<circle cx="%s" cy="%s" r="4" class="%s"%s><title>%s: %s (%s, %s)</title></circle>' % (
                r(px), r(cy), cls, ' style="--c: var(--fg-2)"' if x["state"] == "built" else "",
                E(x["name"]), E(human_ms(x["value_ms"])), E(x["where"]), E(x["state"])))
    for (x, lane, text, rid) in ref_svg_lab:
        ly = 30 + lane * 15
        b.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-rchart__ref"><title>%s (%s)</title></line>' % (r(x), ly + 3, r(x), r(y_bot), E(text), E(rid)))
        b.append(t(x, ly, text, "sn-rchart__ref-label sn-rchart__halo", "middle"))
    H = y_bot + 36
    title = "Timing constants on a log axis"
    span = D["table"]["rows"]
    vals = sorted(x["value_ms"] for x in F["timings"])
    take = ("%d timing constants span %s to %s; reference lines mark %s." % (
        D["n"], human_ms(vals[0]), human_ms(vals[-1]), ", ".join("%s (%s)" % (l, rid) for l, _, rid in D["refs"])))
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "timing constants", D["state"], "timings[]"), "".join(b))
    return fig(cid, "timing-constants", title, take, "milliseconds (log scale)", D["n"], D["state"], "timings[].value_ms, timings[].kind, timings[].state",
               "Each constant is one dot on a log10 axis, one lane per kind (kinds ordered by median value); coincident dots stack. "
               "Reference lines are the timings matched by name: heartbeat staleness, default job lease, job stall threshold and default token lifetime.",
               svg, D["table"], wide=True, filter_table="t-timings")


# ==== C6 polling / request load by store ===============================================================
def poll_target(F, where):
    S = {s["id"]: store_short(s["name"]) for s in F["stores"]}
    P = {p["id"]: p for p in F["pages"]}
    if where in S:
        return S[where]
    linked = set()
    for s in F["signals"]:
        if s["from"] == where and s["to"] in S:
            linked.add(s["to"])
        if s["to"] == where and s["from"] in S:
            linked.add(s["from"])
    for f in F["flows"]:
        if f["from"] == where and f["to"] in S:
            linked.add(f["to"])
        if f["to"] == where and f["from"] in S:
            linked.add(f["from"])
    if len(linked) == 1:
        return S[linked.pop()]
    if not linked:
        return "via %s (store not traced)" % page_name(P, where)
    return "via %s (%d stores)" % (page_name(P, where), len(linked))


def data_c6(F):
    T = sorted((x for x in F["timings"] if x["kind"] in ("poll", "schedule")), key=lambda x: x["id"])
    g = defaultdict(lambda: [0.0, 0.0, []])
    for x in T:
        rph = 3600000.0 / x["value_ms"]
        a = g[poll_target(F, x["where"])]
        if x["state"] == "built":
            a[0] += rph
        a[1] += rph
        a[2].append(x["id"])
    keys = sorted(g, key=lambda k: (-g[k][1], k))
    table = {"columns": ["Target store", "Built (requests per hour)", "Projected (requests per hour)", "Timings"],
             "rows": [[k, round(g[k][0], 4), round(g[k][1], 4), ", ".join(g[k][2])] for k in keys]}
    return {"keys": keys, "g": g, "table": table, "n": len(T), "state": state_of(x["state"] for x in T)}


def c6(F):
    D = data_c6(F)
    cid, W = "C6", W_PORTRAIT
    x0, x1, top, rh = 280, W - 90, 34, 26
    vmax = max(D["g"][k][1] for k in D["keys"])
    ticks = nice_ticks(vmax, 4)
    sx = lambda v: x0 + (x1 - x0) * v / ticks[-1]
    y_bot = top + rh * len(D["keys"]) + 4
    b = []
    lg, _ = legend([("solid", MEASURE_COLOUR, "Built", cid), ("proj", None, "Projected", cid)], x0, 14)
    b += [lg, x_axis(ticks, sx, top - 6, y_bot, "Requests per hour (Estimate)", W, x0)]
    for i, k in enumerate(D["keys"]):
        bv, pv, ids = D["g"][k]
        y = top + i * rh + 3
        b.append('<text x="%s" y="%s" class="sn-rchart__label" text-anchor="end">%s<title>%s: %s</title></text>' % (x0 - 8, r(y + 13), E(trunc(k, 42)), E(k), E(", ".join(ids))))
        b.append(rect(x0, y, sx(bv) - x0, 9, "sn-rchart__bar", MEASURE_COLOUR, "%s built: %s requests per hour" % (k, fmt(bv))))
        b.append(t(sx(bv) + 4, y + 8, fmt(bv), "sn-rchart__value"))
        b.append(rect(x0, y + 11, sx(pv) - x0, 9, "sn-rchart__bar--proj", title="%s projected: %s requests per hour" % (k, fmt(pv))))
        if abs(pv - bv) > 1e-9:
            b.append(t(sx(pv) + 4, y + 19, fmt(pv), "sn-rchart__value"))
    H = y_bot + 36
    title = "Polling load by target store (Estimate)"
    k0 = D["keys"][0]
    same = all(abs(D["g"][k][0] - D["g"][k][1]) < 1e-9 for k in D["keys"])
    take = "Estimate: %s takes the most scheduled requests, %s per hour; %s." % (
        k0, fmt(D["g"][k0][1]), "queued work adds no polling" if same else "queued work changes the load")
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "poll and schedule timings", D["state"], "timings[] kind poll or schedule"), "".join(b))
    return fig(cid, "polling-load", title, take, "requests per hour (Estimate)", D["n"], D["state"],
               "timings[] (kind poll|schedule, value_ms, where), signals[] and flows[] to resolve the store",
               "Estimate: requests per hour = 3,600,000 / value_ms per poll or schedule timing, summed by target store; the target is the timing's own store, "
               "else the single store linked to its component by signals or flows, else the component is named with its store count. Assumes every tick makes one request.",
               svg, D["table"], filter_table="t-timings")


# ==== C7 size against limit ============================================================================
def parse_current(l):
    c, unit = l["current"], l.get("unit", "")
    if isinstance(c, (int, float)):
        return float(c), "as recorded"
    if isinstance(c, dict):
        nums = [v for v in c.values() if isinstance(v, (int, float))]
        mx = max(nums)
        key = sorted(k for k, v in c.items() if v == mx)[0]
        return (mx / 1048576.0 if unit == "MB" else float(mx)), "largest file (%s, %s bytes)" % (key, "{:,}".format(int(mx)))
    s = str(c)
    m = re.search(r"\d[\d,]*(?:\.\d+)?", s)
    v = float(m.group(0).replace(",", ""))
    if "bytes" in s and unit == "MB":
        return v / 1048576.0, "parsed from text, bytes to MB"
    return v, "parsed from text"


def is_floor(l):
    return bool(re.search(r"\b(floor|min|minimum)\b", l["name"].lower()))


def data_c7(F):
    L = [l for l in F["limits"] if "current" in l]
    rows = []
    for l in L:
        cur, how = parse_current(l)
        ratio = cur / l["value"]
        if is_floor(l):
            status = "bad" if ratio < 1 else ("warn" if ratio < 1.1 else "ok")
            word = {"bad": "below floor", "warn": "near limit", "ok": "above floor"}[status]
        else:
            status = "bad" if ratio > 1 else ("warn" if ratio >= 0.9 else "ok")
            word = {"bad": "over limit", "warn": "near limit", "ok": "within limit"}[status]
        rows.append((l, cur, ratio, status, word, how))
    rows.sort(key=lambda x: ((x[2] - 1) if is_floor(x[0]) else (1 - x[2]), x[0]["id"]))   # least headroom first
    table = {"columns": ["Limit", "Current", "Limit value", "Unit", "Per cent of limit", "Status", "Current taken from"],
             "rows": [[l["name"], round(cur, 4), l["value"], l["unit"], round(100 * ratio, 1), word, how] for l, cur, ratio, _, word, how in rows]}
    return {"rows": rows, "table": table, "n": len(L), "state": state_of(l["state"] for l in L)}


def c7(F):
    D = data_c7(F)
    cid, W = "C7", W_PORTRAIT
    x0, x1, top, rh = 246, W - 150, 36, 28
    smax = max(1.5, math.ceil(max(x[2] for x in D["rows"]) * 4) / 4)
    sx = lambda v: x0 + (x1 - x0) * min(v, smax) / smax
    y_bot = top + rh * len(D["rows"])
    b = []
    ticks = [i / 4 for i in range(int(smax * 4) + 1) if i % 2 == 0]
    for v in ticks:
        b.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-chart-frame__grid"/>' % (r(sx(v)), top - 4, r(sx(v)), r(y_bot)))
        b.append(t(sx(v), y_bot + 14, "%d%%" % round(v * 100), "sn-chart-frame__tick", "middle"))
    b.append(t(x1, y_bot + 30, "Current as per cent of limit", "sn-chart-frame__axis-title", "end"))
    b.append(t(x0, 14, "Band: 0–90 % · darker band: 90–100 % · black tick: the limit", "sn-rchart__ref-label"))
    for i, (l, cur, ratio, status, word, how) in enumerate(D["rows"]):
        y = top + i * rh
        nm = trunc(l["name"], 34) if not is_floor(l) else trunc(l["name"], 26) + " (floor)"
        b.append('<text x="%s" y="%s" class="sn-rchart__label" text-anchor="end">%s<title>%s</title></text>' % (x0 - 8, r(y + 16), E(nm), E(l["name"])))
        b.append(rect(x0, y + 4, sx(0.9) - x0, 16, "sn-rchart__band"))
        b.append(rect(sx(0.9), y + 4, sx(1.0) - sx(0.9), 16, "sn-rchart__band--near"))
        colour = {"ok": "fg-3", "warn": "status-warn", "bad": "status-bad"}[status]
        tip = "%s: %s of %s %s (%s%%, %s)" % (l["name"], fmt(cur), fmt(l["value"]), l["unit"], fmt(round(100 * ratio, 1)), word)
        b.append(rect(x0, y + 9, max(sx(ratio) - x0, 1.5), 6, "sn-rchart__bar", colour, tip))
        b.append('<line x1="%s" y1="%s" x2="%s" y2="%s" class="sn-rchart__mark"/>' % (r(sx(1)), y + 2, r(sx(1)), y + 22))
        val = "%s / %s" % (fmt(round(cur, 2) if cur < 1 else cur), fmt(l["value"]))
        b.append(t(x1 + 8, y + 16, val, "sn-rchart__value"))
        if status != "ok":
            b.append(t(x1 + 8 + len(val) * CW["value"] + 6, y + 16, "%s %s" % (GLYPH[status], word), "sn-rchart__label sn-rchart__label--strong"))
    H = y_bot + 36
    title = "Sizes against limits"
    near = [x for x in D["rows"] if x[3] != "ok"]
    take = ("%d of %d measured limits are near or past their limit: %s." % (len(near), D["n"], "; ".join("%s (%s)" % (x[0]["name"], x[4]) for x in near))
            if near else "None of the %d measured limits is within 10 %% of its limit; the one with least headroom is %s at %s %%%s." % (
                D["n"], D["rows"][0][0]["name"], fmt(round(100 * D["rows"][0][2], 1)), " of its floor" if is_floor(D["rows"][0][0]) else ""))
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "limits with a current value", D["state"], "limits[]"), "".join(b))
    return fig(cid, "size-vs-limit", title, take, "per cent of limit", D["n"], D["state"], "limits[] with current (value, unit, current)",
               "Bullet chart: current / limit. Text currents take their first number; a file map takes its largest file (the limit is per file), bytes to MB at 1,048,576. "
               "Floors (name says floor or minimum) are near when under 110 %, others when at or over 90 %.", svg, D["table"], filter_table="t-limits")


# ==== C8 standing-rule conformance =====================================================================
def data_c8(F):
    c = Counter((x["rule"], x["result"]) for x in F["rule_results"])
    rules = [x["id"] for x in F["standing_rules"]]
    text = {x["id"]: x["text"] for x in F["standing_rules"]}
    table = {"columns": ["Rule", "Text"] + [w for _, _, w in RULE_ORDER] + ["Total"],
             "rows": [[rid, text[rid]] + [c[(rid, k)] for k, _, _ in RULE_ORDER] + [sum(c[(rid, k)] for k, _, _ in RULE_ORDER)] for rid in rules]}
    return {"rules": rules, "c": c, "text": text, "table": table, "n": len(F["rule_results"]), "state": state_of(x["state"] for x in F["rule_results"])}


def stacked_status(cid, rows, order, label_w, W, unit_title, legend_y=14):
    """rows: [(label, tip_name, {key: count})]; order: [(key, status, word)]. Returns (svg body, height)."""
    x0, x1, top, rh, bh = label_w, W - 40, 34, 28, 18
    vmax = max(sum(v.values()) for _, _, v in rows)
    ticks = nice_ticks(vmax)
    sx = lambda v: x0 + (x1 - x0) * v / ticks[-1]
    y_bot = top + rh * len(rows) + 4
    b = []
    items = [("none" if st == "idle" else "solid", "status-%s" % st, "%s %s" % (GLYPH[st], w), cid) for _, st, w in order]
    lg, _ = legend(items, 8, legend_y)
    b += [lg, x_axis(ticks, sx, top - 6, y_bot, unit_title, W, x0)]
    for i, (label, name, v) in enumerate(rows):
        y = top + i * rh + (rh - bh) / 2
        b.append('<text x="%s" y="%s" class="sn-rchart__label" text-anchor="end">%s<title>%s</title></text>' % (x0 - 8, r(y + bh - 5), E(label), E(name)))
        x = x0
        for k, st, w in order:
            n = v.get(k, 0)
            if not n:
                continue
            ww = sx(n) - x0
            tip = "%s, %s: %d" % (name, w, n)
            if st == "idle":
                b.append(rect(x, y, ww - 1, bh, "sn-rchart__bar--none", title=tip))
            else:
                b.append(rect(x, y, ww - 1, bh, "sn-rchart__bar", "status-%s" % st, tip))
            lab = "%s %d" % (GLYPH[st], n)
            if ww - 1 >= len(lab) * CW["value"] + 6:
                b.append(t(x + (ww - 1) / 2, y + bh - 5, lab, "sn-rchart__value sn-rchart__halo", "middle"))
            elif ww - 1 >= len(str(n)) * CW["value"] + 4:
                b.append(t(x + (ww - 1) / 2, y + bh - 5, str(n), "sn-rchart__value sn-rchart__halo", "middle"))
            x += ww
        b.append(t(x + 5, y + bh - 5, str(sum(v.values())), "sn-rchart__value"))
    return "".join(b), y_bot + 36


def c8(F):
    D = data_c8(F)
    cid, W = "C8", W_PORTRAIT
    rows = [("%s %s" % (rid, trunc(D["text"][rid], 26)), "%s %s" % (rid, D["text"][rid]), {k: D["c"][(rid, k)] for k, _, _ in RULE_ORDER}) for rid in D["rules"]]
    body, H = stacked_status(cid, rows, RULE_ORDER, 210, W, "Page results")
    title = "Standing-rule conformance"
    viol = sorted(((D["c"][(rid, "violation")], rid) for rid in D["rules"]), key=lambda x: (-x[0], x[1]))
    take = "%d of %d page results are violations; %s has the most (%d)." % (
        sum(D["c"][(rid, "violation")] for rid in D["rules"]), D["n"], viol[0][1], viol[0][0])
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "page results", D["state"], "rule_results[]"), body)
    return fig(cid, "rule-conformance", title, take, "page results", D["n"], D["state"], "rule_results[] (rule, result), standing_rules[]",
               "Count of page results per rule R1–R8 (ordinal, not sorted) split by result.", svg, D["table"], filter_table="t-rules")


# ==== C9 persona x page matrix =========================================================================
def ranges(nums):
    nums = sorted(set(nums))
    out, i = [], 0
    while i < len(nums):
        j = i
        while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1:
            j += 1
        out.append(str(nums[i]) if i == j else ("%d,%d" % (nums[i], nums[j]) if j == i + 1 else "%d–%d" % (nums[i], nums[j])))
        i = j + 1
    return ",".join(out)


def data_c9(F):
    first, users, cells = {}, defaultdict(set), defaultdict(list)
    pos = 0
    for p in F["personas"]:
        for s in p["steps"]:
            if s["page"] not in first:
                first[s["page"]] = pos
            pos += 1
            users[s["page"]].add(p["id"])
            cells[(p["id"], s["page"])].append(s["n"])
    pages = sorted(first, key=lambda pg: (-len(users[pg]), first[pg]))
    P = {p["id"]: p for p in F["pages"]}
    table = {"columns": ["Persona", "Page", "Steps"],
             "rows": [[p["id"] + " " + p["short"], page_name(P, pg), ranges(cells[(p["id"], pg)])] for p in F["personas"] for pg in pages if (p["id"], pg) in cells]}
    n = sum(len(p["steps"]) for p in F["personas"])
    return {"pages": pages, "cells": cells, "table": table, "n": n, "state": state_of(p["state"] for p in F["personas"])}


def c9(F):
    D = data_c9(F)
    cid, W = "C9", W_WIDE
    P = {p["id"]: p for p in F["pages"]}
    lab, ch = 130, 24
    cw = min(34, (W - lab - 16) / len(D["pages"]))
    head = 160
    b = []
    for j, pg in enumerate(D["pages"]):
        cx = lab + j * cw + cw / 2
        b.append('<text x="%s" y="%s" class="sn-rchart__label" transform="rotate(-90 %s %s)">%s<title>%s</title></text>'
                 % (r(cx + 4), head - 6, r(cx + 4), head - 6, E(trunc(page_name(P, pg), 24)), E(page_name(P, pg))))
    for i, p in enumerate(F["personas"]):
        y = head + i * ch
        b.append(t(lab - 8, y + ch - 8, "%s %s" % (p["id"], p["short"]), "sn-rchart__label", "end"))
        for j, pg in enumerate(D["pages"]):
            x = lab + j * cw
            if (p["id"], pg) in D["cells"]:
                txt = ranges(D["cells"][(p["id"], pg)])
                b.append(rect(x + 1, y + 1, cw - 2, ch - 2, "sn-rchart__cell", title="%s, %s: step %s" % (p["name"], page_name(P, pg), txt)))
                nsteps = len(D["cells"][(p["id"], pg)])
                show = txt if len(txt) * CW["data"] <= cw - 4 else "×%d" % nsteps     # too wide: step count, detail in title and table
                b.append(t(x + cw / 2, y + ch - 8, show, "sn-rchart__cell-text", "middle"))
            else:
                b.append(rect(x + 1, y + 1, cw - 2, ch - 2, "sn-rchart__cell--empty"))
    H = head + len(F["personas"]) * ch + 10
    b.insert(0, t(8, 14, "Cell numbers are step numbers in that persona's journey; ×n = n steps (listed in the table)", "sn-rchart__ref-label"))
    title = "Personas by page, with step numbers"
    shared = [pg for pg in D["pages"] if sum(1 for p in F["personas"] if (p["id"], pg) in D["cells"]) > 1]
    take = ("%d personas take %d steps over %d pages; %d pages serve more than one persona. No ease scores: findings.json holds no evidence for them." % (
        len(F["personas"]), D["n"], len(D["pages"]), len(shared)))
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "steps", D["state"], "personas[].steps[]"), "".join(b))
    return fig(cid, "persona-page-matrix", title, take, "steps", D["n"], D["state"], "personas[].steps[] (n, page)",
               "Each cell lists the step numbers a persona takes on a page; columns ordered by number of personas, then by first appearance. Ease scores omitted (no evidence).",
               svg, D["table"], wide=True)


# ==== C10 risk matrix ==================================================================================
def debt_short(F):
    out, used = {}, set()
    for d in sorted(F["debt"], key=lambda x: x["id"]):
        code, tail = short_code(d["id"])
        tail = re.sub(r"^debt-", "", tail)
        words = tail.split("-")
        k = 2
        s = "%s:%s" % (code, "-".join(words[:k]))
        while s in used and k < len(words):
            k += 1
            s = "%s:%s" % (code, "-".join(words[:k]))
        used.add(s)
        out[d["id"]] = s
    return out


def data_c10(F):
    short = debt_short(F)
    cell = defaultdict(list)
    for d in sorted(F["debt"], key=lambda x: x["id"]):
        cell[(d["severity"], d["effort"])].append(d["id"])
    table = {"columns": ["Severity", "Effort", "Count", "Debt items"],
             "rows": [[w, ew, len(cell[(s, e)]), ", ".join(short[i] for i in cell[(s, e)])] for s, _, w in SEVERITY_ORDER for e, ew in EFFORT_ORDER]}
    return {"cell": cell, "short": short, "table": table, "n": len(F["debt"]), "state": state_of(d["state"] for d in F["debt"])}


def c10(F):
    D = data_c10(F)
    st_of = {d["id"]: d["state"] for d in F["debt"]}
    cid, W = "C10", W_PORTRAIT
    lab, head = 104, 40
    cw = (W - lab - 8) / 3
    per_line = max(1, int((cw - 12) // (17 * CW["data"])))
    b = []
    for j, (e, ew) in enumerate(EFFORT_ORDER):
        b.append(t(lab + j * cw + cw / 2, head - 10, "Effort %s (%s)" % (e, ew.lower()), "sn-rchart__label sn-rchart__label--strong", "middle"))
    y = head
    for s, st, w in SEVERITY_ORDER:
        lines = max(math.ceil(len(D["cell"][(s, e)]) / per_line) for e, _ in EFFORT_ORDER)
        hgt = max(44, 30 + lines * 14)
        b.append(t(lab - 8, y + 20, "%s %s" % (GLYPH[st], w), "sn-rchart__label sn-rchart__label--strong", "end"))
        for j, (e, ew) in enumerate(EFFORT_ORDER):
            ids = D["cell"][(s, e)]
            x = lab + j * cw
            tip = "%s severity, effort %s: %d items" % (w, e, len(ids))
            b.append(rect(x + 2, y + 2, cw - 4, hgt - 4, "sn-rchart__cell sn-rchart__cell--%s" % st, title=tip))
            b.append(t(x + 10, y + 20, "%d %s" % (len(ids), "item" if len(ids) == 1 else "items"), "sn-rchart__cell-text"))
            for k, i in enumerate(ids):
                lx = x + 10 + (k % per_line) * (cw - 12) / per_line
                ly = y + 36 + (k // per_line) * 14
                label = D["short"][i] + (" Q" if st_of[i] != "built" else "")
                b.append('<text x="%s" y="%s" class="sn-rchart__cell-id">%s<title>%s (%s)</title></text>' % (r(lx), r(ly), E(label), E(i), E(st_of[i])))
        y += hgt
    H = y + 26
    b.append(t(8, H - 8, "IDs: repo code (ml, be backend, fe frontend) and the first words of the debt id; Q = queued", "sn-rchart__ref-label"))
    title = "Risk matrix, severity by effort"
    hi_s = len(D["cell"][("critical", "S")]) + len(D["cell"][("high", "S")])
    take = "%d of %d debt items are critical or high; %d of those are small-effort fixes." % (
        sum(len(D["cell"][(s, e)]) for s in ("critical", "high") for e, _ in EFFORT_ORDER), D["n"], hi_s)
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "debt items", D["state"], "debt[]"), "".join(b))
    return fig(cid, "risk-matrix", title, take, "debt items", D["n"], D["state"], "debt[] (severity, effort, state)",
               "Count of debt items per severity (ordinal rows) and effort S/M/L (ordinal columns), with each item's short id.", svg, D["table"], filter_table="t-debt")


# ==== C11 verification outcome by area =================================================================
def data_c11(F):
    c = defaultdict(Counter)
    for x in F["claims"]:
        c[x["_agent"]][x["outcome"]] += 1
    areas = sorted(c, key=lambda a: (-sum(c[a].values()), a))
    table = {"columns": ["Area"] + [w for _, _, w in OUTCOME_ORDER] + ["Total"],
             "rows": [[AREA_NAME.get(a, a)] + [c[a][k] for k, _, _ in OUTCOME_ORDER] + [sum(c[a].values())] for a in areas]}
    return {"areas": areas, "c": c, "table": table, "n": len(F["claims"]), "state": state_of(x["state"] for x in F["claims"])}


def c11(F):
    D = data_c11(F)
    cid, W = "C11", W_PORTRAIT
    rows = [(AREA_NAME.get(a, a), AREA_NAME.get(a, a), dict(D["c"][a])) for a in D["areas"]]
    body, H = stacked_status(cid, rows, OUTCOME_ORDER, 150, W, "Claims")
    title = "Verification outcome by area"
    bad = sum(D["c"][a]["refuted"] for a in D["areas"])
    cor = sum(D["c"][a]["corrected"] for a in D["areas"])
    take = "%d of %d repo claims hold as written; %d needed correcting and %d are refuted." % (
        sum(D["c"][a]["confirmed"] for a in D["areas"]), D["n"], cor, bad)
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "claims", D["state"], "claims[]"), body)
    return fig(cid, "verification-outcome", title, take, "claims", D["n"], D["state"], "claims[] (outcome, _agent)",
               "Count of claims per scanning area split by outcome; sorted by total.", svg, D["table"], filter_table="t-claims")


# ==== C12 tasks by project, type and status ============================================================
def task_status(x):
    return "Ready" if not x["depends"] else "Waits on " + ", ".join(x["depends"])


def data_c12(F):
    T = F["tasks"]
    tc = Counter(x["type"] for x in T)
    pc = Counter(x["project"] for x in T)
    types = sorted(tc, key=lambda k: (-tc[k], k))
    projects = sorted(pc, key=lambda k: (-pc[k], k))
    cell = defaultdict(list)
    for x in sorted(T, key=lambda x: x["id"]):
        cell[(x["type"], x["project"])].append(x)
    table = {"columns": ["Task", "Project", "Type", "Status"], "rows": [[x["id"], x["project"], x["type"], task_status(x)] for x in sorted(T, key=lambda x: (x["project"], x["id"]))]}
    return {"types": types, "projects": projects, "cell": cell, "pc": pc, "tc": tc, "table": table, "n": len(T), "state": "queued"}


def c12(F):
    D = data_c12(F)
    cid, W = "C12", W_PORTRAIT
    lab, head = 130, 40
    cw = (W - lab - 8) / len(D["projects"])
    b = []
    for j, pr in enumerate(D["projects"]):
        b.append(t(lab + j * cw + cw / 2, head - 10, "%s (%d)" % (pr, D["pc"][pr]), "sn-rchart__label sn-rchart__label--strong", "middle"))
    y = head
    for ty in D["types"]:
        lines = max(len(D["cell"][(ty, pr)]) for pr in D["projects"])
        hgt = 10 + lines * 16
        b.append(t(lab - 8, y + 17, "%s (%d)" % (ty, D["tc"][ty]), "sn-rchart__label", "end"))
        for j, pr in enumerate(D["projects"]):
            x = lab + j * cw
            items = D["cell"][(ty, pr)]
            if not items:
                b.append(rect(x + 2, y + 2, cw - 4, hgt - 4, "sn-rchart__cell--empty"))
                continue
            b.append(rect(x + 2, y + 2, cw - 4, hgt - 4, "sn-rchart__cell sn-rchart__cell--queued", title="%s, %s: %d queued tasks" % (pr, ty, len(items))))
            for k, x_ in enumerate(items):
                st = task_status(x_)
                b.append('<text x="%s" y="%s" class="sn-rchart__cell-id"><tspan class="sn-rchart__cell-text">%s</tspan> %s<title>%s: %s (%s)</title></text>' % (
                    r(x + 10), r(y + 17 + k * 16), E(x_["id"]), E(st), E(x_["id"]), E(x_["title"]), E(st)))
        y += hgt
    H = y + 26
    b.append(t(8, H - 8, "Every task is Queued (dashed cell). Ready = no dependency; Waits on = blocked by the named task", "sn-rchart__ref-label"))
    title = "Sister tasks by project, type and status"
    ready = sum(1 for x in F["tasks"] if not x["depends"])
    take = "%d queued tasks over %d projects; %d are ready now and %d wait on another task." % (D["n"], len(D["projects"]), ready, D["n"] - ready)
    svg = svg_wrap(cid, W, H, title, desc(take, D["n"], "tasks", D["state"], "tasks[]"), "".join(b))
    return fig(cid, "tasks", title, take, "tasks", D["n"], D["state"], "tasks[] (project, type, depends)",
               "Tasks placed by type (rows, by count) and project (columns, by count). tasks[] has no status field: status is derived from depends (Ready when empty).",
               svg, D["table"], filter_table="t-tasks")


# ---- entry points ------------------------------------------------------------------------------------
CHARTS = [("C1", c1, data_c1), ("C2", c2, data_c2), ("C3", c3, data_c3), ("C4", c4, data_c4), ("C5", c5, data_c5), ("C6", c6, data_c6),
          ("C7", c7, data_c7), ("C8", c8, data_c8), ("C9", c9, data_c9), ("C10", c10, data_c10), ("C11", c11, data_c11), ("C12", c12, data_c12)]


def build(F):
    return [f(F) for _, f, _ in CHARTS]


def recompute(F, fig_):
    """Re-derive the chart's table straight from F and assert it equals the published one; also check n."""
    data = {cid: d for cid, _, d in CHARTS}[fig_["id"]](F)
    assert data["table"] == fig_["table"], "%s: table does not recompute from findings.json" % fig_["id"]
    want_n = data.get("n", data.get("n_links"))
    assert want_n == fig_["n"], "%s: n %s != %s" % (fig_["id"], fig_["n"], want_n)
    return True
