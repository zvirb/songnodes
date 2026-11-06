#!/usr/bin/env python3
"""Merge the scanner fragments and the curated synthesis into findings.json.

    python3 merge.py <fragments dir> <synthesis.json> <out findings.json>

Run once per investigation; build.py only reads findings.json, so a refresh is a file swap.
Reconciles ids across fragments (ALIASES), adds external systems as stores, numbers every edge as a flow,
assigns a domain to every page, merges personas per synthesis["persona_merge"], and stamps state/evidence defaults.
"""
import json
import re
import sys
from pathlib import Path

ALIASES = {
    "sn-be-rest-api": "sn-be-svc-rest-api", "sn-be-graph-api": "sn-be-svc-graph-api",
    "sn-be-library-ingest": "sn-be-svc-rest-api", "sn-be-library-search": "sn-be-svc-rest-api", "sn-be-catalog-writes": "sn-be-svc-rest-api",
    "sn-be-refmb": "sn-be-store-refmb", "sn-scripts": "sn-be-cli-import-music-library", "claude-artifact-db": "ml-store-artifact-db",
    "ml-inbox-artifact-sets": "ml-store-inbox", "sn-fe-shell": "sn-fe-home", "sn-fe-musicLibrary": "sn-fe-library",
    "songnodes/frontend/src/features/musicLibrary": "sn-fe-library", "ml-weekly-export": "ml-cli-db", "sn-store-library-schema": "sn-be-tbl-library",
    "sn-be-store-postgres-svc": "sn-be-store-postgres",
}
EXTERNAL = {
    "ext-pbs-airnet": ("PBS airnet API", "ingest"), "ext-3rrr": ("3RRR episode pages", "ingest"), "ext-abc-plays": ("ABC plays API (triple j, Double J)", "ingest"),
    "ext-aria": ("ARIA Club Chart", "ingest"), "ext-balance-wp": ("Balance Selections WordPress API", "ingest"), "ext-tidal": ("TIDAL developer API", "services"),
    "ext-deezer": ("Deezer API", "ingest"), "ext-metabrainz": ("MetaBrainz dumps", "ingest"), "ext-rekordbox": ("Rekordbox / Lexicon (XML)", "sets"),
    "ext-jules": ("Jules sessions (Google)", "ops"),
}


def domain_of(p):
    s = " ".join(str(p.get(k) or "") for k in ("id", "path", "route", "module", "title")).lower()
    for key, dom in [("design-system", "design"), ("ds-", "design"), ("graph", "graph"), ("pathfinder", "paths"), ("/paths", "paths"), ("paths", "paths"),
                     ("harmony", "harmony"), ("camelot", "harmony"), ("set-builder", "sets"), ("setbuilder", "sets"), ("/sets", "sets"), ("sync-sets", "sets"), ("sets", "sets"),
                     ("scrape", "ingest"), ("sources", "ingest"), ("ingest", "ingest"), ("resolve", "ingest"), ("metabrainz", "ingest"), ("ref-mb", "ingest"), ("refmb", "ingest"),
                     ("tidal", "services"), ("settings", "services"), ("oauth", "services"), ("login", "services"), ("auth", "services"), ("duo", "services"), ("cloudflare", "services"),
                     ("library", "library"), ("process", "library"), ("calibrate", "library"), ("ledger", "library"), ("cli-db", "library"), ("status", "library")]:
        if key in s:
            return dom
    return "ops"


def main(frag_dir, synth_path, out_path):
    frags = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(Path(frag_dir).glob("*.json"))]
    S = json.loads(Path(synth_path).read_text(encoding="utf-8"))
    A = dict(ALIASES, **S.get("aliases", {}))
    al = lambda x: A.get(x, x)
    F = {k: [] for k in ["pages", "signals", "stores", "edges", "personas", "protocols", "debt", "gaps", "method_notes", "unverified", "timings", "limits",
                         "secrets", "rule_results", "claims", "queued"]}
    for fr in frags:
        for k in F:
            for x in fr.get(k, []):
                if isinstance(x, dict):
                    x.setdefault("_agent", fr.get("agent"))
                F[k].append(x)
    # stores: externals + drop alias duplicates
    have = {s["id"] for s in F["stores"]}
    F["stores"] = [s for s in F["stores"] if s["id"] not in A]
    for eid, (name, dom) in EXTERNAL.items():
        if eid not in have:
            F["stores"].append({"id": eid, "repo": "external", "name": name, "kind": "external-api", "location": "internet", "owner": "third party", "readers": [],
                                "concurrency": "rate limits and retries on the caller side", "domain": dom, "state": "built", "evidence": ["see signals that reference %s" % eid]})
    for s in F["stores"]:
        s.setdefault("domain", domain_of(s))
        s.setdefault("state", "built")
    for p in F["pages"]:
        p["domain"] = S.get("page_domains", {}).get(p["id"]) or p.get("domain") or domain_of(p)
        p.setdefault("state", "built")
    for k in ("signals", "debt", "gaps", "protocols", "timings", "limits", "secrets", "claims", "rule_results"):
        for x in F[k]:
            x.setdefault("state", "built")
            for end in ("from", "to", "where", "page"):
                if isinstance(x.get(end), str):
                    x[end] = al(x[end])
    # flows: every edge, de-duplicated, numbered in a stable order (by domain stage, then from, to)
    stage = {d: i for i, d in enumerate(S["domain_order"])}
    seen, flows = set(), []
    for e in F["edges"]:
        e["from"], e["to"] = al(e["from"]), al(e["to"])
        key = (e["from"], e["to"], e.get("label", ""))
        if key in seen or e["from"] == e["to"]:
            continue
        seen.add(key)
        flows.append(e)
    for e in S.get("extra_flows", []):
        flows.append(e)
    flows.sort(key=lambda e: (stage.get(e.get("domain", "ops"), 99), e["from"], e["to"], e.get("label", "")))
    for i, e in enumerate(flows, 1):
        e["n"] = i
        e["id"] = "F%02d" % i
        e.setdefault("state", "built")
        e.setdefault("evidence", [])
    F["flows"] = flows
    del F["edges"]
    # personas: merge per synthesis
    byid = {p["id"]: p for p in F["personas"]}
    merged = []
    for m in S["persona_merge"]:
        parts = [byid[i] for i in m["from"] if i in byid]
        steps, n = [], 0
        for p in parts:
            for st in p.get("steps") or p.get("journey") or []:
                n += 1
                st = dict(st, n=n)
                st["page"] = al(st.get("page"))
                steps.append(st)
        merged.append({"id": m["id"], "name": m["name"], "short": m["short"], "domain": m["domain"], "basis": m.get("basis", "Inferred from pages and docs"),
                       "objective": m.get("objective") or (parts[0].get("objective") if parts else ""), "device": "; ".join(dict.fromkeys(p.get("device") or "" for p in parts if p.get("device"))),
                       "entry": al(parts[0].get("entry")) if parts else None, "routine": sum([p.get("routine") or [] for p in parts], []),
                       "steps": steps, "failure_modes": sum([p.get("failure_modes") or [] for p in parts], []),
                       "evidence": sum([p.get("evidence") or [] for p in parts], []), "merged_from": m["from"], "state": "built"})
    F["personas"] = merged
    # queued: fragments' queued list + synthesis (open PRs etc.)
    qids = {q["id"] for q in F["queued"]}
    F["queued"] += [q for q in S.get("queued", []) if q["id"] not in qids]
    for k in ("summary", "standing_rules", "modules", "backbone", "roadmap", "tasks", "assumptions", "meta", "handover", "colour_map", "domain_order", "diagrams", "loop"):
        if k in S:
            F[k] = S[k]
    for coll, patches in S.get("patch", {}).items():
        idx = {x.get("id"): x for x in F.get(coll, []) if isinstance(x, dict)}
        for i, fields in patches.items():
            if i in idx:
                idx[i].update(fields)
            else:
                print("patch: no %s %s" % (coll, i))
    for k in S.get("append", {}):
        F[k] += S["append"][k]
    vpath = Path(synth_path).with_name("verification.json")      # independent re-check of every claim (verification agent)
    if vpath.exists():
        V = {v["id"]: v for v in json.loads(vpath.read_text(encoding="utf-8"))["items"]}
        for c in F["claims"]:
            v = V.get(c["id"])
            if v:
                c["verifier"] = v["outcome_verifier"] + ("" if v["agree"] else " (disagrees)")
                c["verifier_method"] = v.get("method")
                c["evidence"] = (c.get("evidence") or []) + [e for e in v.get("evidence") or [] if e not in (c.get("evidence") or [])]
                if not v["agree"]:
                    F["method_notes"].append({"item": "claim " + c["id"], "methods_used": ["scanner: " + (c.get("_agent") or ""), "verifier: " + (v.get("method") or "")], "agreement": "disagree", "note": v.get("note", "")})
    Path(out_path).write_text(json.dumps(F, indent=1, ensure_ascii=False), encoding="utf-8")
    print({k: len(v) for k, v in F.items() if isinstance(v, list)})


if __name__ == "__main__":
    main(*sys.argv[1:4])
