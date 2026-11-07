"""findings.json -> Markdown (canonical text). Same counts as the web report and PDF (render.counts).

Writes:
  DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md      master report, every figure embedded with its caption
  ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md   gaps, modules, storage backbone (D8-D10)
  PAGE_CLASSIFICATION_AUDIT.md                   Phase 2 audit table
  todo/<project>.md                              sister-project TODO bodies (copied to each repo root as
                                                 TODO-ARCHITECTURAL-IMPROVEMENTS.md by the orchestrator)
"""
from render import counts, fmt
from sections import SECTIONS, num_of

REPORT_WEB = "documentation/data-flow-analysis/report/index.html"
REPORT_PDF = "documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf"
REPORT_MD = "documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md"
GAPS_MD = "documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md"


def cell(v):
    s = "–" if v in (None, "", []) else (", ".join(map(str, v)) if isinstance(v, list) else str(v))
    return s.replace("|", "\\|").replace("\n", " ")


def mtable(cols, rows):
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    out += ["| " + " | ".join(cell(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def fig(FG, fid):
    f = FG.get(fid)
    if not f:
        return ""
    img = "![%s: %s](%s)\n\n" % (f["id"], f["title"], f["file"]) if f.get("file") else ""
    return "%s**%s %s.** %s *n = %s · %s · state %s · source %s · method %s*\n" % (
        img, f["id"], f["title"], f["caption"], f.get("n"), f.get("unit") or "–", f.get("state"), f.get("source"), f.get("method"))


def head(n, sid):
    return "\n## %d. %s\n" % (n, dict(SECTIONS)[sid])


def write_all(F, FG, OUT, stamp, sha):
    C = counts(F)
    M = F["meta"]
    L = ["# SongNodes · Data flow report · %s" % stamp["date"], "",
         "Built %s by %s. songnodes `%s` (%s), musicLibrary snapshot %s, `findings.json` sha256 `%s`. Web report: `report/index.html`; PDF: `DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf`. Every number below is computed from `findings.json`." % (
             stamp["text"], M["builder"], M["songnodes_commit"][:7], M["branch"], M["ml_snapshot"], sha[:12]), "", "> " + M["reading"]]
    L.append(head(num_of("summary"), "summary"))
    L.append(mtable(["Figure", "Label"], [[fmt(k["figure"]) if isinstance(k["figure"], int) else k["figure"], k["label"]] for k in M["kpis"]]))
    L.append("\n**What holds**\n\n" + "\n".join("- " + x for x in F["summary"]["holds"]))
    L.append("\n**What strains**\n\n" + "\n".join("- " + x for x in F["summary"]["strains"]))
    L.append("\n**Closed loop.** " + F["summary"]["loop"] + "\n\n" + fig(FG, "D1"))
    L.append(head(num_of("architecture"), "architecture"))
    for i in sorted(k for k in FG if k.startswith("D2")):
        L.append(fig(FG, i))
    L.append(fig(FG, "D3"))
    L.append(mtable(["Flow", "From", "To", "Data contract", "Domain", "State", "Evidence"],
                    [[f["n"], f["from"], f["to"], f.get("label"), f.get("domain"), f.get("state"), (f.get("evidence") or ["–"])[0]] for f in F["flows"]]))
    L.append("\n" + fig(FG, "D12"))
    L.append(head(num_of("catalogue"), "catalogue"))
    L.append("%s pages and entry points: %s production, %s non-final. Standing rules:\n" % (fmt(C["pages"]), fmt(C["production"]), fmt(C["nonfinal"])))
    L.append(mtable(["Rule", "Text", "Source"], [[r["id"], r["text"], r["source"]] for r in F["standing_rules"]]))
    L.append("\n" + fig(FG, "C1") + "\n" + fig(FG, "D4") + "\n" + fig(FG, "C8") + "\n" + fig(FG, "C7"))
    L.append("\nThe full page catalogue with rule results is in `PAGE_CLASSIFICATION_AUDIT.md`.")
    L.append(head(num_of("stores"), "stores"))
    L.append(fig(FG, "C2") + "\n" + fig(FG, "C4") + "\n" + fig(FG, "C3"))
    L.append(mtable(["Store", "Kind", "Location", "Writer", "Readers", "Concurrency", "State"],
                    [[s["name"] + " (`%s`)" % s["id"], s.get("kind"), s.get("location"), s.get("owner"), s.get("readers"), s.get("concurrency"), s.get("state")] for s in F["stores"]]))
    L.append("\n### Signals (%s)\n" % fmt(C["signals"]))
    L.append(mtable(["ID", "Primitive", "Key or endpoint", "Direction", "From", "To", "Format", "State", "Evidence"],
                    [[g["id"], g.get("type"), g.get("name"), g.get("direction"), g.get("from"), g.get("to"), g.get("format"), g.get("state"), (g.get("evidence") or ["–"])[0]] for g in F["signals"]]))
    L.append(head(num_of("protocols"), "protocols"))
    for i in sorted(k for k in FG if k.startswith(("D6", "D7"))):
        L.append(fig(FG, i))
    for p in F["protocols"]:
        L.append("\n**%s** (`%s`, %s). Participants: %s. %s Conflicts: %s Stale data: %s Evidence: %s" % (
            p["name"], p["id"], p.get("state"), cell(p.get("participants")), p.get("algorithm") or "", p.get("conflict_resolution") or "–", p.get("stale_fallback") or "–", cell((p.get("evidence") or [])[:3])))
    L.append("\n" + fig(FG, "C5") + "\n" + fig(FG, "C6"))
    L.append(mtable(["Constant", "Kind", "Value", "Where", "State", "Evidence"], [[t["name"], t.get("kind"), t.get("raw"), t.get("where"), t.get("state"), (t.get("evidence") or ["–"])[0]] for t in F["timings"]]))
    L.append("")
    L.append(mtable(["Limit", "Value", "Unit", "Current", "Where", "State"], [[l["name"], l.get("value"), l.get("unit"), l.get("current"), l.get("where"), l.get("state")] for l in F["limits"]]))
    L.append(head(num_of("personas"), "personas"))
    L.append(fig(FG, "D5") + "\n" + fig(FG, "C9"))
    for p in F["personas"]:
        L.append("\n### %s (`%s`)\n\nObjective: %s Device: %s. Entry: `%s`. Basis: %s.\n" % (p["name"], p["id"], p.get("objective"), p.get("device") or "–", p.get("entry"), p.get("basis")))
        L.append(fig(FG, "D5-" + p["id"]))
        L.append(mtable(["Step", "Page", "Action", "Data written", "Trigger", "Handoff", "Fallback"],
                        [[s["n"], s.get("page"), s.get("action"), s.get("writes"), s.get("trigger"), " via ".join(x for x in [(s.get("handoff") or {}).get("shape"), (s.get("handoff") or {}).get("via")] if x), s.get("fallback")] for s in p["steps"]]))
    L.append(head(num_of("debt"), "debt"))
    L.append(fig(FG, "C10"))
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    L.append(mtable(["ID", "Severity", "Effort", "Item", "Kind", "Detail", "State", "Evidence"],
                    [[d["id"], d.get("severity"), d.get("effort"), d["title"], d.get("kind"), d.get("detail"), d.get("state"), (d.get("evidence") or ["–"])[0]] for d in sorted(F["debt"], key=lambda x: (order.get(x.get("severity"), 9), x["id"]))]))
    L.append("\n" + fig(FG, "D11"))
    L.append(mtable(["Wave", "Goal", "Tasks", "Gate", "Depends on"], [[w["id"], w["name"], w["tasks"], w.get("gate"), w.get("depends")] for w in F["roadmap"]]))
    L.append(head(num_of("gaps"), "gaps"))
    L.append("See `ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md` for the full gap analysis: %d gaps, %d proposed modules and the storage backbone.\n" % (C["gaps"], C["modules"]))
    L.append(fig(FG, "D8"))
    L.append(head(num_of("ux"), "ux"))
    L.append("%d proposals, each a one-job package in wave W6 of the roadmap. The full plan with problem, proposal, pattern, personas, evidence and verification is `UX_RECOMMENDATIONS_PLAN.md`.\n" % len(F.get("ux_proposals", [])))
    L.append(mtable(["ID", "Kind", "Proposal", "Module", "Personas", "Effort", "Task"],
                    [[u["id"], "New page" if u["kind"] == "page" else "Design system", u["title"], u["module"], u["personas"], u["effort"] + " (Estimate)", u["task"]] for u in F.get("ux_proposals", [])]))
    L.append(head(num_of("projected"), "projected"))
    L.append(fig(FG, "D9"))
    L.append(mtable(["ID", "What", "Source", "Effect", "Touches"], [[q["id"], q["title"], q.get("source"), q.get("effect") or q.get("note"), q.get("touches")] for q in F["queued"]]))
    L.append(head(num_of("tasks"), "tasks"))
    L.append(fig(FG, "C12"))
    L.append(mtable(["Task", "Project", "Package", "Type", "Owned paths", "Depends on", "Verification", "Gaps"],
                    [[t["id"], t["project"], t["title"], t.get("type"), t.get("owned"), t.get("depends"), t.get("verify"), t.get("gaps")] for t in F["tasks"]]))
    L.append(head(num_of("verification"), "verification"))
    L.append(fig(FG, "C11"))
    L.append(mtable(["ID", "Claim", "Source", "Outcome", "Verifier", "Finding"],
                    [[c["id"], c["claim"], c.get("source"), c.get("outcome"), c.get("verifier", "–"), c.get("finding")] for c in F["claims"]]))
    L.append(head(num_of("methods"), "methods"))
    L.append(mtable(["Item", "Value"], M["profile"]))
    L.append("\n" + mtable(["Pre-flight", "Value"], M["preflight"]))
    L.append("\n" + mtable(["Item", "Methods", "Agreement", "Note"], [[m.get("item"), m.get("methods_used"), m.get("agreement"), m.get("note")] for m in F["method_notes"]]))
    L.append("\n**Secrets scan (location and type only).**\n\n" + mtable(["Location", "Type", "Risk"], [[s["path"], s["type"], s.get("risk")] for s in F["secrets"]]))
    L.append("\n**Unverified.**\n\n" + "\n".join("- " + u for u in F["unverified"]))
    L.append("\n**Assumptions and open decisions.**\n\n" + "\n".join("- " + a for a in F["assumptions"]))
    L.append(head(num_of("handover"), "handover"))
    L.append(mtable(["Item", "Value"], F["handover"]["items"]))
    if F["handover"]["gates"]:
        L.append("\n" + mtable(["Gate", "Result", "Note"], [[g["name"], g["state"], g.get("note")] for g in F["handover"]["gates"]]))
    L.append("\n" + "\n".join("- " + n for n in F["handover"]["next"]))
    L.append("\n## Appendix: page relationships\n")
    L.append(mtable(["Page", "Links to", "New tab"], [[p["id"], (l.get("to")), l.get("new_tab")] for p in F["pages"] for l in (p.get("links_out") or [])]))
    (OUT / "DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    # enhancements and gaps
    G = ["# Architecture enhancements and gaps", "", "Part of the SongNodes data flow report (%s). Source: `findings.json` sha256 `%s`. Web: `report/index.html#gaps`; PDF section 8." % (stamp["date"], sha[:12]), ""]
    G.append("## 1. Critical data gaps\n")
    G.append(fig(FG, "D8"))
    sev = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    for g in sorted(F["gaps"], key=lambda x: (sev.get(x.get("severity"), 9), x["id"])):
        G.append("### %s (`%s`, %s, effort %s)\n\n%s\n\n- **Fix:** %s\n- **Data contract:** %s\n- **Affects:** %s\n- **Evidence:** %s\n" % (
            g["title"], g["id"], g.get("severity"), g.get("effort"), g.get("detail") or "", g.get("fix") or "–", ("`" + g["contract"] + "`") if g.get("contract") else "–", cell(g.get("affects")), cell(g.get("evidence"))))
    G.append("## 2. Proposed single-purpose modules\n")
    G.append(mtable(["ID", "Name", "Target users", "One verb", "Data inputs", "Core operation", "Size", "Path"],
                    [[m["id"], m["name"], m["users"], m["verb"], m["inputs"], m["operation"], m.get("loc"), m.get("path")] for m in F["modules"]]))
    G.append("\nEvery module is built from the SongNodes design system in full (tokens, `sn-*` classes, page patterns) and follows the standing rules R1–R8.\n")
    G.append("## 3. Unified storage backbone\n\n" + F["backbone"]["summary"] + "\n\n" + fig(FG, "D10") + "\n```\n" + F["backbone"]["tree"] + "\n```\n")
    G.append(mtable(["Migration risk", "Mitigation"], F["backbone"]["risks"]))
    (OUT / "ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md").write_text("\n".join(G) + "\n", encoding="utf-8")

    # page classification audit
    rr = {}
    for r in F["rule_results"]:
        rr.setdefault(r["page"], {})[r["rule"]] = r["result"]
    rules = [r["id"] for r in F["standing_rules"]]
    A = ["# Page classification and conformance audit (Phase 2)", "", "%s pages: %s production, %s non-final. Each category uses at least two independent signals. Rule columns: pass, violation, exception or – (not applicable)." % (fmt(C["pages"]), fmt(C["production"]), fmt(C["nonfinal"])), ""]
    A.append(mtable(["Page", "Path", "Repo", "Domain", "Category", "Subtype", "State", "Bytes"] + rules + ["Signals (evidence)"],
                    [[p["title"] + " (`%s`)" % p["id"], p["path"], p["repo"], p.get("domain"), p.get("classification"), p.get("subtype"), p.get("state"), p.get("size_bytes")]
                     + [rr.get(p["id"], {}).get(r, "–") for r in rules] + ["; ".join((p.get("signals") or [])[:3])] for p in F["pages"]]))
    (OUT / "PAGE_CLASSIFICATION_AUDIT.md").write_text("\n".join(A) + "\n", encoding="utf-8")

    write_ux_plan(F, OUT, stamp, sha)
    write_todos(F, OUT, stamp, sha)


def write_ux_plan(F, OUT, stamp, sha):
    P = F.get("ux_proposals", [])
    pid = {p["id"]: p for p in F["personas"]}
    tasks = {t["id"]: t for t in F["tasks"]}
    L = ["# User experience plan: proposed pages and design-system updates", "",
         "Part of the SongNodes data flow report of %s (`findings.json` sha256 `%s`). Web report section %d; PDF section %d. Every proposal answers evidence in the investigation (persona failure modes, standing-rule violations, gaps) and is sized as a one-job package in roadmap wave W6. State: Proposed (nothing built or queued). Effort is an Estimate against the AGENTS.md package budget." % (
             stamp["date"], sha[:12], num_of("ux"), num_of("ux")), ""]
    L.append("## Order of work\n")
    L.append("1. Design-system rules first (UX-07, UX-08, UX-10): they change what every page must do and make the checks catch today's violations.")
    L.append("2. The editable cell (UX-09) and the service-row rule (UX-11), which the new pages depend on.")
    L.append("3. Pages in persona order of pain: Review queue (UX-01), Pipeline health (UX-03), One Set builder (UX-05), Track detail (UX-02), Buy list (UX-04), then the tracker (UX-06).")
    L.append("4. Close Q-PRINT-1 and publish 1.10.0 (UX-12) with the first page that ships.\n")
    L.append("## Proposals by persona\n")
    cols = ["ID", "Proposal"] + [k for k in sorted({k for u in P for k in u["personas"]}, key=lambda k: int(k[1:]))]
    L.append(mtable(cols, [[u["id"], u["title"]] + ["●" if k in u["personas"] else "–" for k in cols[2:]] for u in P]))
    for kind, name in (("page", "New pages and page changes"), ("design-system", "Design-system updates")):
        L.append("\n## %s\n" % name)
        for u in [x for x in P if x["kind"] == kind]:
            t = tasks.get(u["task"], {})
            L.append("### %s: %s\n" % (u["id"], u["title"]))
            L.append("- **Module:** %s · **Route or place:** `%s` · **Effort:** %s (Estimate) · **State:** Proposed" % (u["module"], u.get("route"), u["effort"]))
            L.append("- **Problem:** %s" % u["problem"])
            L.append("- **Proposal:** %s" % u["proposal"])
            L.append("- **Design-system pattern:** %s" % u.get("pattern"))
            L.append("- **Personas served:** %s" % ", ".join("%s %s" % (k, pid[k]["name"]) for k in u["personas"] if k in pid))
            L.append("- **Rules it satisfies:** %s" % ", ".join(u.get("rules") or []))
            L.append("- **Task:** `%s` %s · owned paths: %s · depends on: %s" % (u["task"], t.get("title", ""), cell(["`%s`" % o for o in t.get("owned") or []]), cell(t.get("depends")) or "–"))
            L.append("- **Verification:** %s" % u.get("verify"))
            L.append("- **Evidence:** %s\n" % cell(u.get("evidence")))
    L.append("\nUI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns and components, and no local overrides; a missing pattern is added to the design system first (UX-07 to UX-12 are those additions).")
    (OUT / "UX_RECOMMENDATIONS_PLAN.md").write_text("\n".join(L) + "\n", encoding="utf-8")


def write_todos(F, OUT, stamp, sha):
    gaps = {g["id"]: g for g in F["gaps"]}
    viol = [r for r in F["rule_results"] if r.get("result") == "violation"]
    pages = {p["id"]: p for p in F["pages"]}
    (OUT / "todo").mkdir(exist_ok=True)
    def sub(t):
        o = " ".join(t.get("owned") or [])
        if t["project"] != "songnodes":
            return t["project"]
        for k in ("frontend", "services", "scrapers"):
            if o.startswith(k + "/") or (" " + k + "/") in o:
                return "songnodes-" + k
        return "songnodes"
    targets = {"songnodes": lambda t: t["project"] in ("songnodes", "design-system"), "musicLibrary": lambda t: t["project"] == "musicLibrary",
               "design-system": lambda t: t["project"] == "design-system"}
    for k in ("frontend", "services", "scrapers"):
        targets["songnodes-" + k] = (lambda key: (lambda t: sub(t) == key))("songnodes-" + k)
    for proj, pick in targets.items():
        T = [t for t in F["tasks"] if pick(t)]
        if not T:
            T = []
        repo_key = "musicLibrary" if proj == "musicLibrary" else "songnodes"
        L = ["# Architectural improvements: %s" % proj, "",
             "Written %s by the data-flow investigation. %d task%s for this %s." % (stamp["date"], len(T), "" if len(T) == 1 else "s", "repository" if proj in ("songnodes", "musicLibrary") else "sub-project"), "",
             "From the SongNodes data flow report of %s (`findings.json` sha256 `%s`). Master report, in the songnodes repo: `%s` (Markdown), `%s` (web), `%s` (PDF); gaps in `%s`." % (stamp["date"], sha[:12], REPORT_MD, REPORT_WEB, REPORT_PDF, GAPS_MD),
             "", "Each task is one job package (AGENTS.md rules 1–3: one verb, owned paths only, about 400 changed lines). UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns, and no local overrides; a missing pattern is added to the design system first.", ""]
        for t in T:
            L.append("## %s: %s\n" % (t["id"], t["title"]))
            L.append("- **Type:** %s\n- **Owned paths:** %s\n- **Depends on:** %s\n- **Verification:** %s" % (t.get("type"), cell(["`%s`" % o for o in t.get("owned") or []]), cell(t.get("depends")), t.get("verify")))
            for gid in t.get("gaps") or []:
                g = gaps.get(gid)
                if g:
                    L.append("- **Gap `%s` (%s):** %s\n  - Fix: %s\n  - Contract: %s\n  - Evidence: %s" % (gid, g.get("severity"), g["title"], g.get("fix") or "–", g.get("contract") or "–", cell((g.get("evidence") or [])[:4])))
            L.append("- **Impact:** closes %s\n" % (cell(t.get("gaps")) if t.get("gaps") else "a release-process step"))
        if not T:
            L.append("No task falls in this sub-project in this investigation; its pages and flows are covered by the songnodes root list.\n")
        pv = [r for r in viol if pages.get(r["page"], {}).get("repo") == repo_key and proj in ("songnodes", "musicLibrary")]
        if pv:
            L.append("## Standing-rule violations in this project (report only)\n")
            L.append(mtable(["Page", "Rule", "Detail", "Evidence"], [[r["page"], r["rule"], r.get("detail"), (r.get("evidence") or ["–"])[0]] for r in pv]))
        (OUT / "todo" / ("%s.md" % proj)).write_text("\n".join(L) + "\n", encoding="utf-8")
