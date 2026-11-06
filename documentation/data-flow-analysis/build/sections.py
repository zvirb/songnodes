"""Report sections, shared by the web report and the print sheet. Content only from findings.json and figures."""
import re
from render import (E, pill, tag, none, evidence, state_cell, title, section_heading, sub_heading, table, kv, figure_html,
                    counts, fmt, SEV_STATUS, CLASS_STATUS, STATE_STATUS, OUTCOME_STATUS, RULE_STATUS)

SECTIONS = [
    ("summary", "Executive summary"),
    ("architecture", "Architecture and numbered flows"),
    ("catalogue", "Page catalogue and standing rules"),
    ("stores", "Stores, signals and contracts"),
    ("protocols", "Synchronisation protocols, timings and limits"),
    ("personas", "Personas and journeys"),
    ("debt", "Technical debt, risk and roadmap"),
    ("gaps", "Gaps, proposed modules and storage backbone"),
    ("projected", "Built and Projected"),
    ("tasks", "Sister-project tasks"),
    ("verification", "Verification register"),
    ("methods", "Methods, assumptions and open decisions"),
    ("handover", "Handover"),
]


def num_of(sid):
    return [s[0] for s in SECTIONS].index(sid) + 1


DEFER = []   # print: landscape figures wait until the end of their section, so no heading is stranded before a forced page break


def figs(FG, *ids, mode="web", defer=True):
    """Figures by ID; an ID also takes its panels (D2 -> D2, D2a, D2b …), never the per-persona D5-P* figures."""
    out = []
    for i in ids:
        for k in FG:
            if k == i or re.fullmatch(re.escape(i) + r"[a-z]", k):
                h = figure_html(FG[k], mode)
                if mode == "print" and defer and FG[k].get("wide"):
                    DEFER.append(h)
                else:
                    out.append(h)
    return "".join(out)


def code(s):
    return '<code class="sn-mono">%s</code>' % E(str(s)) if s not in (None, "") else none()


def ev_short(ev):
    ev = ev or []
    return code(ev[0]) + (' <span class="caption">+%d</span>' % (len(ev) - 1) if len(ev) > 1 else "") if ev else none()


def sec(sid, inner, count=None, caveat=None):
    n = num_of(sid)
    name = dict(SECTIONS)[sid]
    tail = "".join(DEFER)
    DEFER.clear()
    return '<section class="sn-page__section" id="%s" aria-labelledby="%s-t">%s%s%s</section>' % (sid, sid, section_heading(n, name, sid, count, caveat), inner, tail)


def para(text):
    return '<p class="body sn-figure__caption">%s</p>' % E(text)


def bullets(items):
    return '<ul class="sn-prose-list">%s</ul>' % "".join('<li class="body">%s</li>' % E(i) for i in items)


# ------------------------------------------------------------------ 1
def s_summary(F, FG, C, mode):
    k = F["meta"]["kpis"]
    tiles = []
    for i, t in enumerate(k):
        foot = ""
        if t.get("status"):
            foot = '<div class="sn-figure-tile__foot">%s%s</div>' % (pill(t["status"][0], t["status"][1]), ('<a class="sn-link" href="#%s">%s</a>' % (t["href"], E(t["link"])) if t.get("href") else ""))
        tiles.append('<div class="sn-figure-tile" role="listitem"><span class="sn-figure-tile__figure">%s</span>%s<span class="sn-figure-tile__label">%s</span>%s%s</div>' % (
            E(t["figure"]), '<span class="sn-figure-tile__unit">%s</span>' % E(t["unit"]) if t.get("unit") else "", E(t["label"]),
            '<span class="sn-figure-tile__delta">%s</span>' % E(t["delta"]) if t.get("delta") else "", foot))
    first = '<div class="sn-figure-tile-row" role="list" aria-label="Investigation at a glance">%s</div>' % "".join(tiles[:4])
    more = ""
    if len(tiles) > 4:
        more = ('<details class="sn-disclosure" data-remember="dfa.more-figures"%s><summary><span class="sn-disclosure__chev">{chev}</span>More figures<span class="sn-disclosure__hint">%d</span></summary>'
                '<div class="sn-disclosure__body"><div class="sn-figure-tile-row" role="list" aria-label="More figures">%s</div></div></details>') % (" open" if mode == "print" else "", len(tiles) - 4, "".join(tiles[4:]))
    S = F["summary"]
    body = first + more
    body += '<div class="sn-page__cols sn-figure-grid sn-figure-grid--2">'
    body += '<section class="sn-card" aria-labelledby="holds-t">%s%s</section>' % (title("", "What holds", "title-s", "h3", "holds-t"), bullets(S["holds"]))
    body += '<section class="sn-card" aria-labelledby="strains-t">%s%s</section>' % (title("", "What strains", "title-s", "h3", "strains-t"), bullets(S["strains"]))
    body += "</div>"
    body += para(S["loop"])
    body += figs(FG, "D1", mode=mode)
    return sec("summary", body, caveat=F["meta"]["reading"])


# ------------------------------------------------------------------ 2
def s_architecture(F, FG, C, mode):
    rows = []
    for fl in F["flows"]:
        rows.append({"_id": fl["id"], "_kind": "flow", "_filter": {"node": "%s %s" % (fl["from"], fl["to"]), "state": fl.get("state", "built")},
                     "_sort": {"n": fl["n"]},
                     "n": '<span class="sn-mono">%d</span>' % fl["n"], "from": code(fl["from"]), "to": code(fl["to"]), "contract": E(fl.get("label", "")),
                     "channel": tag(fl.get("channel_type", "")) if fl.get("channel_type") else none(), "domain": tag(fl.get("domain", "")),
                     "state": state_cell(fl.get("state")), "ev": ev_short(fl.get("evidence"))})
    cols = [("n", "Flow", True), ("from", "From", False), ("to", "To", False), ("contract", "Data contract", False), ("channel", "Channel", False),
            ("domain", "Domain", False), ("state", "State", False), ("ev", "Evidence", False)]
    body = figs(FG, "D2", "D3", mode=mode)
    body += sub_heading("Table", "Numbered flows", "t-flows-h", "%s flows" % fmt(C["flows"]))
    body += table("t-flows", "Numbered flows", cols, rows, search=(mode == "web"), filters=None, kind="flow")
    body += figs(FG, "D12", mode=mode)
    return sec("architecture", body, "%s flows" % fmt(C["flows"]), "Every flow in the table is drawn in D2 with the same number.")


# ------------------------------------------------------------------ 3
def s_catalogue(F, FG, C, mode):
    rules = F["standing_rules"]
    rr = {}
    for r in F["rule_results"]:
        rr.setdefault(r["page"], {})[r["rule"]] = r
    rows = []
    for p in F["pages"]:
        cs, cw = CLASS_STATUS.get(p.get("classification"), ("info", p.get("classification", "–")))
        row = {"_id": p["id"], "_kind": "page", "_filter": {"repo": p["repo"], "cls": p.get("classification"), "state": p.get("state", "built"), "domain": p.get("domain")},
               "_sort": {"size": p.get("size_bytes") or 0},
               "page": '<span class="body-strong">%s</span><br><code class="sn-mono caption">%s</code>' % (E(p["title"]), E(p["path"])),
               "repo": E(p["repo"]), "domain": tag(p.get("domain", "")), "cat": pill(cs, cw, "; ".join(p.get("signals", [])[:2])) + (" " + tag(p["subtype"]) if p.get("subtype") else ""),
               "state": state_cell(p.get("state")), "size": ('<span class="sn-mono">%s</span>' % fmt(p["size_bytes"])) if p.get("size_bytes") else none(),
               "ev": evidence((p.get("signals") or []) + (p.get("evidence") or []), p["id"]) if mode == "web" else ev_short(p.get("evidence"))}
        for rule in rules:
            r = rr.get(p["id"], {}).get(rule["id"])
            if r:
                st, w = RULE_STATUS.get(r["result"], ("info", r["result"]))
                row[rule["id"]] = pill(st, w, r.get("detail") or "")
            else:
                row[rule["id"]] = '<span class="sn-none" title="Not applicable">–</span>'
        rows.append(row)
    cols = [("page", "Page", False), ("repo", "Repo", False), ("domain", "Domain", False), ("cat", "Category", False), ("state", "State", False), ("size", "Bytes", True)]
    cols += [(r["id"], r["id"], False) for r in rules] + [("ev", "Evidence", False)]
    def opts(key, vals):
        return [(v, l, sum(1 for p in F["pages"] if (p.get(key) or ("built" if key == "state" else "")) == v)) for v, l in vals]
    repos = sorted({p["repo"] for p in F["pages"]})
    filters = [("repo", "Repo", opts("repo", [(r, r) for r in repos])),
               ("cls", "Category", opts("classification", [("production", "Production"), ("non-final", "Non-final")])),
               ("state", "State", opts("state", [("built", "Built"), ("queued", "Queued")]))] if mode == "web" else None
    body = figs(FG, "C1", "D4", mode=mode)
    body += sub_heading("Rules", "Standing rules audited", "t-rules-h", "%d rules" % len(rules))
    body += table("t-rules", "Standing rules", [("id", "Rule", False), ("rule", "Rule text", False), ("src", "Source", False)],
                  [{"_id": r["id"], "_kind": "rule", "id": '<span class="sn-mono">%s</span>' % r["id"], "rule": E(r["text"]), "src": code(r["source"])} for r in rules], sortable=False, kind="rule")
    body += sub_heading("Table", "Page catalogue", "t-pages-h", "%s pages" % fmt(C["pages"]))
    body += table("t-pages", "Page catalogue", cols, rows, search=(mode == "web"), filters=filters, kind="page",
                  note="Category uses at least two independent signals per page (naming, live-data wiring, route registration or inbound links, docs status); hover a pill for the first two.")
    body += figs(FG, "C8", "C7", mode=mode)
    return sec("catalogue", body, "%s pages" % fmt(C["pages"]), "%s production, %s non-final, %s rule violations." % (fmt(C["production"]), fmt(C["nonfinal"]), fmt(C["violations"])))


# ------------------------------------------------------------------ 4
def s_stores(F, FG, C, mode):
    rows = []
    for s in F["stores"]:
        rows.append({"_id": s["id"], "_kind": "store", "_filter": {"node": s["id"], "repo": s.get("repo")},
                     "store": '<span class="body-strong">%s</span><br><code class="sn-mono caption">%s</code>' % (E(s["name"]), E(s["id"])),
                     "kind": tag(s.get("kind", "")), "loc": code(s.get("location")), "owner": E(s.get("owner") or "") or none(),
                     "readers": E(", ".join(s.get("readers") or [])) or none(), "conc": E(s.get("concurrency") or "") or none(),
                     "state": state_cell(s.get("state")), "ev": evidence(s.get("evidence"), s["id"]) if mode == "web" else ev_short(s.get("evidence"))})
    cols = [("store", "Store", False), ("kind", "Kind", False), ("loc", "Location", False), ("owner", "Writer", False), ("readers", "Readers", False),
            ("conc", "Concurrency", False), ("state", "State", False), ("ev", "Evidence", False)]
    srows = []
    for g in F["signals"]:
        srows.append({"_id": g["id"], "_kind": "signal", "_filter": {"type": g.get("type"), "node": "%s %s" % (g.get("from"), g.get("to")), "repo": g.get("repo")},
                      "type": tag(g.get("type", "")), "name": code(g.get("name")), "dir": E(g.get("direction", "")), "from": code(g.get("from")), "to": code(g.get("to")),
                      "fmt": E(g.get("format") or "") or none(), "schema": E(g.get("schema") or "") or none(), "state": state_cell(g.get("state")),
                      "m": E(", ".join(g.get("methods") or [])) or none(), "ev": ev_short(g.get("evidence"))})
    scols = [("type", "Primitive", False), ("name", "Key or endpoint", False), ("dir", "Direction", False), ("from", "From", False), ("to", "To", False),
             ("fmt", "Format", False), ("schema", "Schema", False), ("state", "State", False), ("m", "Methods", False), ("ev", "Evidence", False)]
    types = sorted({g.get("type") for g in F["signals"]})
    filters = [("type", "Primitive", [(t, t, sum(1 for g in F["signals"] if g.get("type") == t)) for t in types])] if mode == "web" else None
    body = figs(FG, "C2", "C4", "C3", mode=mode)
    body += sub_heading("Table", "Stores and contracts", "t-stores-h", "%s stores" % fmt(C["stores"]))
    body += table("t-stores", "Stores and contracts", cols, rows, search=(mode == "web"), kind="store")
    body += sub_heading("Table", "Signals", "t-signals-h", "%s signals" % fmt(C["signals"]))
    body += table("t-signals", "Signals", scols, srows, search=(mode == "web"), filters=filters, kind="signal")
    return sec("stores", body, "%s stores · %s signals" % (fmt(C["stores"]), fmt(C["signals"])))


# ------------------------------------------------------------------ 5
def s_protocols(F, FG, C, mode):
    cards = []
    for p in F["protocols"]:
        cards.append('<section class="sn-card" aria-labelledby="%s-t" id="%s">%s%s%s</section>' % (
            E(p["id"]), E(p["id"]), title("Protocol", p["name"], "title-s", "h3", p["id"] + "-t"),
            kv([("Participants", E(", ".join(p.get("participants") or [])), False), ("How it syncs", E(p.get("algorithm") or ""), False),
                ("Conflicts", E(p.get("conflict_resolution") or ""), False), ("Stale data", E(p.get("stale_fallback") or ""), False),
                ("State", state_cell(p.get("state")), False)]), evidence(p.get("evidence"), p["id"])))
    trows = [{"_id": t["id"], "_kind": "timing", "_sort": {"v": t.get("value_ms") or 0}, "name": E(t["name"]), "kind": tag(t.get("kind", "")),
              "v": '<span class="sn-mono">%s</span>' % E(t.get("raw") or ""), "where": code(t.get("where")), "state": state_cell(t.get("state")), "ev": ev_short(t.get("evidence"))} for t in F["timings"]]
    lrows = [{"_id": l["id"], "_kind": "limit", "name": E(l["name"]), "v": '<span class="sn-mono">%s %s</span>' % (E(str(l.get("value"))), E(l.get("unit") or "")),
              "cur": ('<span class="sn-mono">%s</span>' % E(str(l["current"]))) if l.get("current") not in (None, "") else none(),
              "where": code(l.get("where")), "state": state_cell(l.get("state")), "ev": ev_short(l.get("evidence"))} for l in F["limits"]]
    body = figs(FG, "D6", "D7", mode=mode)
    body += '<div class="sn-figure-grid sn-figure-grid--2">%s</div>' % "".join(cards)
    body += figs(FG, "C5", "C6", mode=mode)
    body += sub_heading("Table", "Timing constants", "t-timings-h", "%s constants" % fmt(C["timings"]))
    body += table("t-timings", "Timing constants", [("name", "Constant", False), ("kind", "Kind", False), ("v", "Value", True), ("where", "Where", False), ("state", "State", False), ("ev", "Evidence", False)], trows, search=(mode == "web"), kind="timing")
    body += sub_heading("Table", "Size and count limits", "t-limits-h", "%s limits" % fmt(C["limits"]))
    body += table("t-limits", "Limits", [("name", "Limit", False), ("v", "Value", True), ("cur", "Current", True), ("where", "Where", False), ("state", "State", False), ("ev", "Evidence", False)], lrows, search=(mode == "web"), kind="limit")
    return sec("protocols", body, "%d protocols" % len(F["protocols"]))


# ------------------------------------------------------------------ 6
def s_personas(F, FG, C, mode):
    ps = F["personas"]
    body = figs(FG, "D5", "C9", mode=mode)
    tabs, panels = [], []
    for i, p in enumerate(ps):
        sel = "true" if i == 0 else "false"
        tabs.append('<button class="sn-tab" role="tab" id="pt-%d" aria-controls="pp-%d" aria-selected="%s" tabindex="%d">%s</button>' % (i, i, sel, 0 if i == 0 else -1, E(p["short"])))
        srows = [{"_id": "%s-s%d" % (p["id"], s["n"]), "_kind": "step", "n": '<span class="sn-mono">%d</span>' % s["n"], "page": code(s["page"]), "act": E(s.get("action") or ""),
                  "w": E(s.get("writes") or "") or none(), "trig": E(s.get("trigger") or "") or none(),
                  "hand": E(" via ".join(x for x in [(s.get("handoff") or {}).get("shape"), (s.get("handoff") or {}).get("via")] if x)) or none(),
                  "fb": E(s.get("fallback") or "") or none()} for s in p.get("steps", [])]
        inner = kv([("Objective", E(p.get("objective") or ""), False), ("Device", E(p.get("device") or ""), False), ("Entry point", code(p.get("entry")), False),
                    ("Basis", E(p.get("basis") or "Stated in docs"), False)])
        inner += '<h4 class="sn-title title-s">Routine</h4>' + bullets(p.get("routine") or [])
        inner += figs(FG, "D5-" + p["id"], mode=mode)   # print: swimlanes move to the end of the section (landscape pages together)
        inner += table("t-steps-%d" % i, "Steps for " + p["name"], [("n", "Step", True), ("page", "Page", False), ("act", "Action", False), ("w", "Data written", False),
                       ("trig", "Trigger to next", False), ("hand", "Handoff", False), ("fb", "Fallback", False)], srows, sortable=False, kind="step")
        if p.get("failure_modes"):
            inner += '<h4 class="sn-title title-s">Failure modes and timeouts</h4>' + bullets(p["failure_modes"])
        hidden = "" if i == 0 else " hidden"
        panels.append('<div class="sn-tabs__panel sn-print-expand" role="tabpanel" id="pp-%d" aria-labelledby="pt-%d" tabindex="0"%s>%s%s</div>' % (
            i, i, hidden if mode == "web" else "", '<h3 class="sn-title title-s sn-print-only">%s</h3>' % E(p["name"]) if mode == "print" else "", inner))
    tablist = ""
    if mode == "web":
        tablist = '<div class="sn-tabs__wrap"><div class="sn-tabs" role="tablist" aria-label="Personas">%s</div></div>' % "".join(tabs)
    body += '<div class="sn-m-sets">%s%s</div>' % (tablist, "".join(panels))
    return sec("personas", body, "%d personas · %d steps" % (C["personas"], C["steps"]))


# ------------------------------------------------------------------ 7
def s_debt(F, FG, C, mode):
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    rows = []
    for d in sorted(F["debt"], key=lambda x: (order.get(x.get("severity"), 9), x["id"])):
        st, w = SEV_STATUS.get(d.get("severity"), ("info", d.get("severity")))
        rows.append({"_id": d["id"], "_kind": "debt", "_sort": {"sev": order.get(d.get("severity"), 9)}, "_filter": {"sev": d.get("severity")},
                     "id": '<span class="sn-mono">%s</span>' % E(d["id"]), "sev": pill(st, w), "title": '<span class="body-strong">%s</span>' % E(d["title"]),
                     "kind": tag(d.get("kind", "")), "effort": E(d.get("effort") or "") or none(), "detail": E(d.get("detail") or ""), "state": state_cell(d.get("state")), "ev": evidence(d.get("evidence"), d["id"]) if mode == "web" else ev_short(d.get("evidence"))})
    cols = [("id", "ID", False), ("sev", "Severity", False), ("title", "Item", False), ("kind", "Kind", False), ("effort", "Effort", False), ("detail", "Detail", False), ("state", "State", False), ("ev", "Evidence", False)]
    filters = [("sev", "Severity", [(k, SEV_STATUS[k][1], sum(1 for d in F["debt"] if d.get("severity") == k)) for k in ["critical", "high", "medium", "low"]])] if mode == "web" else None
    wrows = [{"_id": w["id"], "_kind": "wave", "id": '<span class="sn-mono">%s</span>' % E(w["id"]), "name": '<span class="body-strong">%s</span>' % E(w["name"]),
              "tasks": E(", ".join(w.get("tasks") or [])), "gate": E(w.get("gate") or "") or none(), "deps": E(", ".join(w.get("depends") or [])) or none()} for w in F["roadmap"]]
    body = figs(FG, "C10", mode=mode)
    body += sub_heading("Table", "Technical debt, severity ranked", "t-debt-h", "%d items" % C["debt"])
    body += table("t-debt", "Technical debt", cols, rows, search=(mode == "web"), filters=filters, kind="debt")
    body += figs(FG, "D11", mode=mode)
    body += sub_heading("Table", "Roadmap waves", "t-roadmap-h", "%d waves" % len(F["roadmap"]))
    body += table("t-roadmap", "Roadmap", [("id", "Wave", False), ("name", "Goal", False), ("tasks", "Tasks", False), ("gate", "Gate", False), ("deps", "Depends on", False)], wrows, sortable=False, kind="wave")
    return sec("debt", body, "%d items" % C["debt"])


# ------------------------------------------------------------------ 8
def s_gaps(F, FG, C, mode):
    cards = []
    for g in F["gaps"]:
        st, w = SEV_STATUS.get(g.get("severity", "medium"), ("info", g.get("severity")))
        cards.append('<section class="sn-card" id="%s" aria-labelledby="%s-t" data-kind="gap">%s<p class="sn-figure__meta caption"><code>%s</code> · %s · %s</p><p class="body">%s</p>%s%s</section>' % (
            E(g["id"]), E(g["id"]), title("Gap", g["title"], "title-s", "h3", g["id"] + "-t"), E(g["id"]), pill(st, w), state_cell(g.get("state")), E(g.get("detail") or ""),
            kv([("Fix", E(g.get("fix") or ""), False), ("Data contract", '<pre class="sn-code-block">%s</pre>' % E(g.get("contract") or "") if g.get("contract") else "", False),
                ("Affects", E(", ".join(g.get("affects") or [])), False)]), evidence(g.get("evidence"), g["id"])))
    mcards = []
    for m in F["modules"]:
        mcards.append('<section class="sn-card" id="%s" aria-labelledby="%s-t" data-kind="module">%s%s</section>' % (
            E(m["id"]), E(m["id"]), title("Module", m["name"], "title-s", "h3", m["id"] + "-t"),
            kv([("Target users", E(m["users"]), False), ("One verb", '<span class="body-strong">%s</span>' % E(m["verb"]), False), ("Data inputs", E(m["inputs"]), False),
                ("Core operation", E(m["operation"]), False), ("Size", E(m.get("loc") or ""), False), ("Where it lives", code(m.get("path")), False),
                ("Design system", E(m.get("ds") or "Built from the SongNodes design system in full (tokens, sn-* classes, page pattern)."), False)])))
    B = F["backbone"]
    body = figs(FG, "D8", mode=mode)
    body += sub_heading("Gaps", "Critical data gaps", "gaps-h", "%d gaps" % C["gaps"]) + '<div class="sn-figure-grid sn-figure-grid--2">%s</div>' % "".join(cards)
    body += sub_heading("Modules", "Proposed single-purpose modules", "modules-h", "%d modules" % C["modules"]) + '<div class="sn-figure-grid sn-figure-grid--2">%s</div>' % "".join(mcards)
    body += sub_heading("Backbone", "Unified storage backbone", "backbone-h")
    body += para(B["summary"]) + figs(FG, "D10", mode=mode)
    body += '<pre class="sn-code-block">%s</pre>' % E(B["tree"])
    body += table("t-backbone-risk", "Migration risks", [("risk", "Risk", False), ("mit", "Mitigation", False)],
                  [{"_id": "bb-r%d" % i, "_kind": "risk", "risk": E(r[0]), "mit": E(r[1])} for i, r in enumerate(B["risks"])], sortable=False, kind="risk")
    return sec("gaps", body, "%d gaps · %d modules" % (C["gaps"], C["modules"]))


# ------------------------------------------------------------------ 9
def s_projected(F, FG, C, mode):
    rows = [{"_id": q["id"], "_kind": "queued", "id": code(q["id"]), "what": E(q["title"]), "src": code(q.get("source")), "effect": E(q.get("effect") or "") or none(),
             "touches": E(", ".join(q.get("touches") or [])) or none()} for q in F["queued"]]
    body = figs(FG, "D9", mode=mode)
    body += sub_heading("Table", "Queued work", "t-queued-h", "%d items" % len(F["queued"]))
    body += table("t-queued", "Queued work", [("id", "ID", False), ("what", "What", False), ("src", "Source", False), ("effect", "Effect when applied", False), ("touches", "Touches", False)], rows, search=(mode == "web"), kind="queued")
    return sec("projected", body, "%d queued items" % len(F["queued"]), "Built = songnodes main @%s and the musicLibrary snapshot of %s. Projected = Built with every queued item applied." % (F["meta"]["songnodes_commit"][:7], F["meta"]["ml_snapshot"]))


# ------------------------------------------------------------------ 10
def s_tasks(F, FG, C, mode):
    rows = [{"_id": t["id"], "_kind": "task", "_filter": {"project": t["project"]}, "id": '<span class="sn-mono">%s</span>' % E(t["id"]), "project": E(t["project"]),
             "title": '<span class="body-strong">%s</span>' % E(t["title"]), "type": tag(t.get("type", "")), "owned": E(", ".join(t.get("owned") or [])) or none(),
             "deps": E(", ".join(t.get("depends") or [])) or none(), "verify": E(t.get("verify") or "") or none(), "status": pill(*{"todo": ("idle", "To do"), "queued": ("warn", "Queued"), "done": ("ok", "Done")}.get(t.get("status", "todo"), ("info", t.get("status"))))} for t in F["tasks"]]
    projects = sorted({t["project"] for t in F["tasks"]})
    filters = [("project", "Project", [(p, p, sum(1 for t in F["tasks"] if t["project"] == p)) for p in projects])] if mode == "web" else None
    body = figs(FG, "C12", mode=mode)
    body += sub_heading("Table", "Task matrix", "t-tasks-h", "%d tasks" % C["tasks"])
    body += table("t-tasks", "Sister-project task matrix", [("id", "Task", False), ("project", "Project", False), ("title", "Package", False), ("type", "Type", False), ("owned", "Owned paths", False),
                  ("deps", "Depends on", False), ("verify", "Verification", False), ("status", "Status", False)], rows, search=(mode == "web"), filters=filters, kind="task")
    return sec("tasks", body, "%d tasks in %d projects" % (C["tasks"], len(projects)))


# ------------------------------------------------------------------ 11
def s_verification(F, FG, C, mode):
    rows = []
    for c in F["claims"]:
        st, w = OUTCOME_STATUS.get(c.get("outcome"), ("info", c.get("outcome")))
        rows.append({"_id": c["id"], "_kind": "claim", "_filter": {"outcome": c.get("outcome")}, "id": '<span class="sn-mono">%s</span>' % E(c["id"]), "claim": E(c["claim"]),
                     "src": code(c.get("source")), "out": pill(st, w), "finding": E(c.get("finding") or ""), "ev": ev_short(c.get("evidence"))})
    filters = [("outcome", "Outcome", [(k, v[1], sum(1 for c in F["claims"] if c.get("outcome") == k)) for k, v in OUTCOME_STATUS.items()])] if mode == "web" else None
    body = figs(FG, "C11", mode=mode)
    body += table("t-claims", "Verification register", [("id", "ID", False), ("claim", "Claim", False), ("src", "Source", False), ("out", "Outcome", False), ("finding", "Finding", False), ("ev", "Evidence", False)], rows, search=(mode == "web"), filters=filters, kind="claim")
    return sec("verification", body, "%d claims" % C["claims"], "Baseline: PR #581 (area baseline-581), re-verified against this run; the register also re-checks the repos' own documentation.")


# ------------------------------------------------------------------ 12
def s_methods(F, FG, C, mode):
    mrows = [{"_id": "mn-%d" % i, "_kind": "method", "item": E(m.get("item", "")), "m": E(", ".join(m.get("methods_used") or [])), "ag": pill("ok", "Agree") if m.get("agreement") == "agree" else pill("warn", "Disagree"), "note": E(m.get("note", ""))} for i, m in enumerate(F["method_notes"])]
    srows = [{"_id": s["id"], "_kind": "secret", "path": code(s["path"]), "type": E(s["type"]), "risk": pill(*{"placeholder": ("ok", "Placeholder"), "real-looking": ("warn", "Real-looking"), "committed-real": ("bad", "Committed")}.get(s.get("risk"), ("info", s.get("risk"))))} for s in F["secrets"]]
    P = F["meta"]["profile"]
    body = sub_heading("Profile", "Project profile as applied", "profile-h")
    body += kv([(k, E(v), False) for k, v in P])
    body += sub_heading("Pre-flight", "Tools and access", "preflight-h") + kv([(k, E(v), False) for k, v in F["meta"]["preflight"]])
    body += sub_heading("Methods", "Where the methods agreed and disagreed", "methods-h", "%d notes" % len(mrows))
    body += table("t-methods", "Method notes", [("item", "Item", False), ("m", "Methods", False), ("ag", "Result", False), ("note", "Note", False)], mrows, search=(mode == "web"), kind="method")
    body += sub_heading("Secrets", "Secrets scan (location and type only)", "secrets-h", "%d findings" % len(srows))
    body += table("t-secrets", "Secrets scan", [("path", "Location", False), ("type", "Type", False), ("risk", "Risk", False)], srows, kind="secret")
    body += sub_heading("Unverified", "Unverified items", "unverified-h", "%d items" % len(F["unverified"])) + bullets(F["unverified"])
    body += sub_heading("Decisions", "Assumptions and open decisions", "decisions-h") + bullets(F["assumptions"])
    return sec("methods", body)


# ------------------------------------------------------------------ 13
def s_handover(F, FG, C, mode):
    H = F["handover"]
    items = [(k, E(v) if not str(v).startswith("http") else '<a class="sn-link sn-link--ext" href="%s" data-host="github.com">%s</a>' % (E(v), E(v)), False) for k, v in H["items"]]
    gates = '<ul class="sn-checklist">%s</ul>' % "".join(
        '<li class="sn-checklist__item" data-state="%s"><span class="sn-checklist__glyph">{icon:%s}</span><span class="sn-checklist__text"><span class="sn-checklist__label"><span class="sn-sr">%s: </span>%s</span><span class="sn-checklist__note">%s</span></span><span></span></li>'
        % (g["state"], {"pass": "check", "fail": "x", "warn": "triangle-alert", "pending": "clock"}[g["state"]], g["state"].title(), E(g["name"]), E(g.get("note", ""))) for g in H["gates"])
    body = '<section class="sn-card" aria-labelledby="ho-t">%s%s</section>' % (title("Handover", "Card", "title-s", "h3", "ho-t"), kv(items))
    body += sub_heading("Gates", "Verification gates", "gates-h", "%d gates" % len(H["gates"])) + gates
    body += sub_heading("Next", "Recommended next steps", "next-h") + bullets(H["next"])
    return sec("handover", body)


BUILDERS = [s_summary, s_architecture, s_catalogue, s_stores, s_protocols, s_personas, s_debt, s_gaps, s_projected, s_tasks, s_verification, s_methods, s_handover]


def all_sections(F, FG, mode):
    C = counts(F)
    return "".join(b(F, FG, C, mode) for b in BUILDERS)
