"""Collect every figure (diagrams.py D-series, charts.py C-series), write the standalone SVGs, return {id: figure}.

Standalone SVGs carry the design system verbatim as CSS variables (light and dark): tokens.css without
@font-face, the generated light block, the .sn-m-* scopes, and the diagram/chart rules from
design-system/source/css/64-diagram.css and 65-report-charts.css (read from the design system, not copied by hand).
"""
import re

import charts
import render
import diagrams
from ds import DS


def _order(fid):
    m = re.match(r"([DC])(\d+)([a-z]?)(?:-(P\d+))?", fid)
    if not m:
        return (9, 999, fid)
    return (0 if m.group(1) == "D" else 1, int(m.group(2)), m.group(3) or "", m.group(4) or "")


def figure_css():
    out = []
    for name in ("64-diagram.css", "65-report-charts.css"):
        p = DS / "source" / "css" / name
        if p.exists():
            out.append(p.read_text(encoding="utf-8"))
    b = (DS / "components" / "bundle.css").read_text(encoding="utf-8")
    out += re.findall(r"^\.sn-chart-frame__(?:grid|base|tick|axis-title)\s*\{[^}]*\}", b, re.M)
    return "\n".join(out)


def standalone(svg, css):
    i = svg.index(">", svg.index("<svg")) + 1
    return svg[:i] + "<style>" + css + "</style>" + svg[i:]


def build_all(F, D, OUT):
    figs = diagrams.build(F) + charts.build(F)
    for f in figs:
        if f["kind"] == "chart" and hasattr(charts, "recompute"):
            charts.recompute(F, f)                     # gate: every chart value recomputes from findings.json
    css = D["svg_css"] + "\n" + figure_css()
    for f in figs:   # copy that quotes code is entity-escaped (render.copy_safe); standalone files are XML, inline copies HTML
        if f.get("file"):
            xml = re.sub(r">([^<]*)", lambda m: ">" + render.copy_safe(m.group(1), html_doc=False), f["svg"])
            (OUT / f["file"]).write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + standalone(xml, css), encoding="utf-8")
        for k in ("svg", "projected_svg"):
            if f.get(k):
                f[k] = re.sub(r">([^<]*)", lambda m: ">" + render.copy_safe(m.group(1)), f[k])
    return {f["id"]: f for f in sorted(figs, key=lambda f: _order(f["id"]))}
