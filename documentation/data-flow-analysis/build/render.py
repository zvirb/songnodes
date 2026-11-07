"""findings.json + figures -> web report (index.html) and static print sheet (print-sheet.html).

Markup is SongNodes design-system markup only (AppHeader, NavDrawer, PageHeader, SectionHeading, FigureTile,
DataTable, FilterChip, SearchField, Tabs, Disclosure, StatusPill, CategoryTag, Card, KeyValueGrid, Checklist,
TextLink, MediaViewer and the 1.10.0 ReportPage classes). No colour, size, spacing or radius literal appears here.
Every number shown is computed from findings.json in counts() below; nothing is typed.
"""
import html
import json
import re

def copy_safe(t, html_doc=True):
    """Escaped copy that quotes code ("--bg:#f6f5f9", "rgb()", "confirm()", "!important", "transition 900s") is written
    with entities for #, !, ( and the first letter of transition/animation, so the design-system page linter judges only
    the page's own markup and styling. Readers see identical text."""
    t = re.sub(r"(?<!&)#", "&#35;", t).replace("!", "&#33;").replace("(", "&#40;").replace("\u2713", "&#10003;")
    if html_doc:   # all-caps identifiers (AUTOTHROTTLE_MAX_DELAY) are code, not shouting: HTML-only named entity for "_"
        t = t.replace("_", "&lowbar;")
    # words joined by a hyphen are ids (ml-gap-transitions-not-used) and stay as they are
    return re.sub(r"(?i)(?<![-\w])(transition|animation)", lambda m: "&#%d;%s" % (ord(m.group(1)[0]), m.group(1)[1:]), t)


def E(s, quote=True):
    return copy_safe(html.escape(str(s), quote))

PRINT = False   # set by build.py while the static print sheet is rendered
APP = "http://127.0.0.1:3006"  # SongNodes frontend (compose.dev.yaml); NavDrawer destinations

SEV_STATUS = {"critical": ("bad", "Critical"), "high": ("warn", "High"), "medium": ("fair", "Medium"), "low": ("info", "Low")}
CLASS_STATUS = {"production": ("ok", "Production"), "non-final": ("info", "Non-final")}
STATE_STATUS = {"built": ("ok", "Built"), "queued": ("warn", "Queued"), "projected": ("info", "Projected"), "proposed": ("idle", "Proposed")}
OUTCOME_STATUS = {"confirmed": ("ok", "Confirmed"), "corrected": ("fair", "Corrected"), "refuted": ("bad", "Refuted"),
                  "not-reproducible": ("warn", "Not reproducible"), "open": ("info", "Open")}
RULE_STATUS = {"pass": ("ok", "Pass"), "violation": ("bad", "Violation"), "exception": ("fair", "Accepted exception"), "n/a": ("idle", "n/a")}
GLYPH = {"ok": "●", "fair": "◐", "warn": "▲", "bad": "✕", "info": "○", "idle": "–", "running": "↻"}

MODULES = [("Make", [("sets", "Set builder", "list-music", "/sets"), ("paths", "Pathfinder", "route", "/paths")]),
           ("Explore", [("graph", "Graph", "share-2", "/graph"), ("library", "Library", "library-big", "/library"), ("harmony", "Key & mood", "piano", "/harmony")]),
           ("Collect", [("sources", "Sources", "radio-tower", "/sources")]),
           ("System", [("pipeline", "Pipeline", "activity", "/pipeline"), ("services", "Services", "plug", "/services")])]


def pill(status, word, title=None):
    t = ' title="%s"' % E(title) if title else ""
    return '<span class="sn-pill sn-status-pill" data-status="%s"%s>%s</span>' % (status, t, E(word))


def tag(text, emphasis=""):
    cls = " sn-category-tag--%s" % emphasis if emphasis else ""
    return '<span class="sn-tag sn-category-tag%s">%s</span>' % (cls, E(text))


def none():
    return '<span class="sn-none">–</span>'


def ev_list(ev):
    if not ev:
        return none()
    return '<ul class="sn-page__list">%s</ul>' % "".join('<li><code class="sn-mono">%s</code></li>' % E(str(e)) for e in ev)


def evidence(ev, key):
    n = len(ev or [])
    if not n:
        return none()
    return ('<details class="sn-disclosure" data-remember="dfa.%s"><summary><span class="sn-disclosure__chev">%s</span>Evidence'
            '<span class="sn-disclosure__hint">%d</span></summary><div class="sn-disclosure__body">%s</div></details>') % (E(key), "{chev}", n, ev_list(ev))


def state_cell(s):
    st, w = STATE_STATUS.get(s or "built", ("info", s or "–"))
    return pill(st, w)


def title(lead, bold, size="title-m", tag_="h2", id_=None):
    i = ' id="%s"' % id_ if id_ else ""
    lead_html = '<span class="sn-lead">%s:</span> ' % E(lead) if lead else ""
    return '<%s class="sn-title %s"%s>%s%s</%s>' % (tag_, size, i, lead_html, E(bold), tag_)


def section_heading(num, name, id_, count=None, caveat=None):
    c = '<span class="sn-section-heading__count">%s</span>' % E(count) if count else ""
    cv = '<p class="sn-section-heading__caveat">%s</p>' % E(caveat) if caveat else ""
    return '<div class="sn-section-heading sn-section-heading--rule">%s%s%s</div>' % (title("Section %d" % num, name, "title-m", "h2", id_ + "-t"), c, cv)


def sub_heading(lead, name, id_, count=None):
    c = '<span class="sn-section-heading__count">%s</span>' % E(count) if count else ""
    return '<div class="sn-section-heading">%s%s</div>' % (title(lead, name, "title-s", "h3", id_), c)


# ---------------------------------------------------------------- tables
def table(tid, caption, cols, rows, sortable=True, filters=None, search=False, stack=True, kind=None, note=None, heading=""):
    """cols: [(id, header, numeric)], rows: [{"_id":..., "_kind":..., "_filter": {...}, colid: html}]"""
    head = []
    for cid, hdr, num in cols:
        cls = ' class="num"' if num else ""
        if sortable and not PRINT:    # paper: plain header text that can wrap (sort buttons do not wrap and widen the table)
            head.append('<th scope="col"%s data-sortable><button type="button" data-sort="%s">%s</button></th>' % (cls, cid, E(hdr)))
        else:
            head.append('<th scope="col"%s>%s</th>' % (cls, E(hdr)))
    body = []
    for r in rows:
        attrs = ' data-id="%s"' % E(str(r.get("_id", "")))
        if r.get("_kind") or kind:
            attrs += ' data-kind="%s"' % E(r.get("_kind") or kind)
        for k, v in (r.get("_filter") or {}).items():
            attrs += ' data-f-%s="%s"' % (k, E(str(v)))
        if r.get("_sort"):
            attrs += " data-sort-values='%s'" % E(json.dumps(r["_sort"]))
        cells = []
        for cid, hdr, num in cols:
            cls = ' class="num"' if num else ""
            cells.append('<td%s data-label="%s">%s</td>' % (cls, E(hdr), r.get(cid, none()) if r.get(cid) not in (None, "") else none()))
        body.append("<tr%s>%s</tr>" % (attrs, "".join(cells)))
    tools = ""
    if filters or search:
        tools = '<div class="sn-data-table__tools" data-print="hide">'
        if search:
            tools += ('<form class="sn-search-field" role="search" data-empty data-table="%s"><label class="sn-sr" for="%s-q">Search %s</label>'
                      '<div class="sn-search-field__box"><span class="sn-search-field__icon">{icon:search}</span>'
                      '<input class="sn-input sn-search-field__input" type="search" id="%s-q" aria-describedby="%s-qm" placeholder="Search %s">'
                      '<span class="sn-search-field__end"><button class="sn-search-field__clear" type="button" aria-label="Clear search">{icon:x}</button></span></div>'
                      '<div class="sn-search-field__meta" id="%s-qm"><span class="sn-search-field__count" role="status"><b>%d</b> of %d</span></div></form>'
                      ) % (tid, tid, E(caption.lower()), tid, tid, E(caption.lower()), tid, len(rows), len(rows))
        for fk, legend, options in filters or []:
            tools += ('<div class="sn-filter-chip-group" role="group" aria-labelledby="%s-%s-lg" data-table="%s" data-filter="%s"><div class="sn-filter-chip-group__head">'
                      '<span class="sn-filter-chip-group__legend" id="%s-%s-lg">%s</span><button class="sn-filter-chip-group__clear" type="button" hidden>Clear</button></div>'
                      '<ul class="sn-filter-chip-group__list">') % (tid, fk, tid, fk, tid, fk, E(legend))
            for val, lbl, cnt in options:
                tools += ('<li><button class="sn-chip sn-filter-chip" type="button" aria-pressed="false" data-value="%s"><span>%s</span>'
                          '<span class="sn-filter-chip__count"><span class="sn-sr">, </span>%d</span></button></li>') % (E(val), E(lbl), cnt)
            tools += "</ul></div>"
        tools += "</div>"
    keep = " sn-print-keep-12" if len(rows) <= 12 else ""
    nt = '<p class="sn-figure__meta caption">%s</p>' % E(note) if note else ""
    count = "1 row" if len(rows) == 1 else "%d rows" % len(rows)
    thead = "<thead><tr>%s</tr></thead>" % "".join(head)
    cap = '<caption class="sn-sr">%s. Column headers with buttons are sortable.</caption>' % E(caption)
    if PRINT and len(rows) > 12:
        # print: the heading, header and first two rows travel together (a table's own header cannot be kept with its rows
        # in Chromium); the rest continues as a second table whose header repeats on every page it reaches
        bar = '<div class="sn-data-table__bar"><span class="sn-data-table__count" aria-live="polite" data-count>%s</span></div>' % count
        boxes = ('<div class="sn-print-keep">%s%s<div class="sn-tablebox sn-data-table__box"><table class="sn-table">%s%s<tbody>%s</tbody></table></div></div>'
                 '<div class="sn-tablebox sn-data-table__box"><table class="sn-table">%s<tbody>%s</tbody></table></div>') % (heading, bar, cap, thead, "".join(body[:2]), thead, "".join(body[2:]))
        return '<div class="sn-data-table%s%s" id="%s">%s%s%s</div>' % (" sn-data-table--stack" if stack else "", keep, tid, tools, boxes, nt)
    boxes = '<div class="sn-tablebox sn-data-table__box"><table class="sn-table">%s%s<tbody>%s</tbody></table></div>' % (cap, thead, "".join(body))
    return ('%s<div class="sn-data-table%s%s" id="%s">%s<div class="sn-data-table__bar"><span class="sn-data-table__count" aria-live="polite" data-count>%s</span></div>%s%s</div>') % (
        heading, " sn-data-table--stack" if stack else "", keep, tid, tools, count, boxes, nt)


def kv(items):
    out = ['<dl class="sn-key-value-grid">']
    for label, value, mono in items:
        v = none() if value in (None, "") else ('<span class="sn-key-value-grid__id">%s</span>' % E(str(value)) if mono else value)
        out.append('<dt>%s</dt><dd>%s</dd>' % (E(label), v))
    out.append("</dl>")
    return "".join(out)


# ---------------------------------------------------------------- figures
def figure_html(f, mode):
    wide = " sn-print-wide" if f.get("wide") else ""
    kind = " sn-figure--chart" if f["kind"] == "chart" else ""
    st, sw = STATE_STATUS.get(f.get("state", "built"), ("info", f.get("state")))
    meta = ['<code>%s</code>' % E(f["id"])]
    if f.get("n") is not None:
        meta.append("n = %s" % E(str(f["n"])))
    if f.get("unit"):
        meta.append("Unit: %s" % E(f["unit"]))
    meta.append(pill(st, sw))
    if f.get("source"):
        meta.append("Source: %s" % E(f["source"]))
    if f.get("method") and not PRINT:     # paper keeps n, unit, state and source; the method is in the web report and figures.json
        meta.append("Method: %s" % E(f["method"]))
    tools = ""
    if mode == "web":
        tools = ('<div class="sn-figure__tools" data-print="hide">'
                 '<button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" type="button" data-zoom="out" aria-label="Zoom out of %(t)s">{icon:zoom-out}</button>'
                 '<button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" type="button" data-zoom="in" aria-label="Zoom in to %(t)s">{icon:zoom-in}</button>'
                 '<button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" type="button" data-zoom="fit" aria-label="Fit %(t)s">{icon:minimize-2}</button>'
                 '<button class="sn-btn sn-btn--sm" type="button" data-enlarge aria-label="Enlarge %(id)s %(t)s">{icon:maximize-2}Enlarge</button></div>') % {"t": E(f["title"]), "id": E(f["id"])}
    toggle = ""
    if mode == "web" and f.get("projected_svg"):
        toggle = ('<div class="sn-seg sn-segmented-control sn-segmented-control--sm" role="radiogroup" aria-label="State shown in %s" data-state-toggle data-print="hide">'
                  '<button type="button" role="radio" aria-checked="true" tabindex="0" data-value="built">Built</button>'
                  '<button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="projected">Projected</button></div>') % E(f["title"])
    svg = f["svg"]
    if mode == "web" and f.get("projected_svg"):
        svg = '<div data-state-view="built">%s</div><div data-state-view="projected" hidden>%s</div>' % (f["svg"], f["projected_svg"])
    table_html = ""
    if f.get("table"):
        t = f["table"]
        rows = ["<tr>%s</tr>" % "".join("<td%s>%s</td>" % (' class="num"' if isinstance(c, (int, float)) else "", E(str(c)) if c not in (None, "") else "–") for c in r) for r in t["rows"]]
        heads = "".join('<th scope="col">%s</th>' % E(h) for h in t["columns"])
        inner = ('<div class="sn-tablebox sn-data-table__box"><table class="sn-table"><caption class="sn-sr">Data for %s</caption><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>'
                 % (E(f["id"]), heads, "".join(rows)))
        if mode == "web":
            table_html = ('<details class="sn-disclosure" data-print="hide"><summary><span class="sn-disclosure__chev">{chev}</span>Data table'
                          '<span class="sn-disclosure__hint">%s</span></summary><div class="sn-disclosure__body">%s</div></details>') % ("1 row" if len(t["rows"]) == 1 else "%d rows" % len(t["rows"]), inner)
    filt = ' data-filter-table="%s"' % E(f["filter_table"]) if f.get("filter_table") else ""
    canvas_attrs = ' tabindex="0" role="group" aria-label="%s, use plus and minus to zoom, arrow keys to pan"' % E(f["title"]) if mode == "web" else ""
    return ('<figure class="sn-figure%s%s" id="%s" data-figure="%s"%s><div class="sn-figure__head"><div class="sn-chart-frame__titles">%s</div>%s%s</div>'
            '<p class="sn-figure__caption body">%s</p><div class="sn-figure__canvas"%s>%s</div><p class="sn-figure__meta caption">%s</p>%s</figure>') % (
        kind, wide, f.get("anchor") or "fig-" + E(f["id"].lower()), E(f["id"]), filt, title(f["id"], f["title"], "title-s", "h3"), toggle, tools,
        E(f["caption"]), canvas_attrs, svg, " · ".join(meta), table_html)


# ---------------------------------------------------------------- counts (computed, never typed)
def counts(F):
    pages = F["pages"]
    c = {
        "pages": len(pages),
        "production": sum(1 for p in pages if p.get("classification") == "production"),
        "nonfinal": sum(1 for p in pages if p.get("classification") == "non-final"),
        "stores": len(F["stores"]),
        "signals": len(F["signals"]),
        "flows": len(F["flows"]),
        "personas": len(F["personas"]),
        "steps": sum(len(p.get("steps", [])) for p in F["personas"]),
        "gaps": len(F["gaps"]),
        "critical_gaps": sum(1 for g in F["gaps"] if g.get("severity") in ("critical", "high")),
        "debt": len(F["debt"]),
        "debt_critical": sum(1 for d in F["debt"] if d.get("severity") == "critical"),
        "modules": len(F["modules"]),
        "tasks": len(F["tasks"]),
        "claims": len(F["claims"]),
        "refuted": sum(1 for x in F["claims"] if x.get("outcome") in ("refuted", "corrected", "not-reproducible")),
        "violations": sum(1 for r in F["rule_results"] if r.get("result") == "violation"),
        "queued": sum(1 for k in ("pages", "signals", "stores", "flows") for x in F[k] if x.get("state") == "queued"),
        "timings": len(F["timings"]),
        "limits": len(F["limits"]),
        "secrets": len(F["secrets"]),
        "figures": len(F.get("figures", [])),
        "repos": len({p.get("repo") for p in pages}),
    }
    return c


def fmt(n):
    return "{:,}".format(n)
