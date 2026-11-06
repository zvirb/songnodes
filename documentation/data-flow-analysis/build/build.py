#!/usr/bin/env python3
"""One-command rebuild: findings.json -> figures (SVG) -> Markdown -> web report -> print sheet -> PDF -> gates.
(merge.py builds findings.json from the scanner fragments and synthesis.json; run it only when the fragments change.)

    python3 documentation/data-flow-analysis/build/build.py            # full build
    python3 documentation/data-flow-analysis/build/build.py --no-pdf   # skip the PDF (fast)

A refresh is a file swap: replace ../findings.json and run this. Requires Python 3.10+, graphviz `dot`,
Python Playwright (Chromium) and pypdf for the PDF; Node Playwright for the diagram checks, poppler (pdftoppm, pdffonts, pdftotext) for the gates.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
OUT = HERE.parent                                   # documentation/data-flow-analysis
sys.path.insert(0, str(HERE))
import ds            # noqa: E402
import figures       # noqa: E402
import md            # noqa: E402
import render        # noqa: E402
import sections      # noqa: E402

MEL = ZoneInfo("Australia/Melbourne")


def icons_from_bundle(bundle_js):
    m = re.search(r"var ICONS = (\{.*?\});\n", bundle_js, re.S)
    return json.loads(m.group(1))


def icon_svg(icons, name, size=18):
    # Same markup as SongNodes.icon(name, {size}) in design-system/source/bundle.src.js
    return '<svg class="sn-icon" viewBox="0 0 24 24" width="%d" height="%d" aria-hidden="true" focusable="false">%s</svg>' % (size, size, icons[name])


def fill_icons(html_text, icons):
    html_text = html_text.replace("{chev}", icon_svg(icons, "chevron-right", 16))
    return re.sub(r"\{icon:([a-z0-9-]+)\}", lambda m: icon_svg(icons, m.group(1), 16), html_text)


def drawer(icons):
    E = render.E
    rows = ['<li><a class="sn-nav-drawer__item" href="%s/" data-key="home">%s<span class="sn-nav-drawer__label">Home</span></a></li>' % (render.APP, icon_svg(icons, "house", 20))]
    h = ['<div class="sn-nav-drawer" id="nav"><div class="sn-nav-drawer__scrim"></div>',
         '<div class="sn-nav-drawer__panel" role="dialog" aria-modal="true" aria-label="Site navigation">',
         '<div class="sn-nav-drawer__head"><span class="sn-nav-drawer__wordmark">SongNodes</span><button class="sn-btn sn-btn--quiet sn-btn--icon" type="button" data-drawer-close aria-label="Close navigation">%s</button></div>' % icon_svg(icons, "x"),
         '<nav class="sn-nav-drawer__nav" aria-label="Main"><ul class="sn-nav-drawer__list">%s</ul>' % "".join(rows)]
    for gi, (g, mods) in enumerate(render.MODULES):
        h.append('<div class="sn-nav-drawer__group"><h2 class="sn-nav-drawer__heading" id="nav-g%d">%s</h2><ul class="sn-nav-drawer__list" aria-labelledby="nav-g%d">' % (gi, g, gi))
        for key, label, ic, route in mods:
            h.append('<li><a class="sn-nav-drawer__item sn-m-%s" href="%s%s" target="_blank" rel="noopener" data-key="%s">%s<span class="sn-nav-drawer__label">%s</span><span class="sn-sr"> (opens in a new tab)</span></a></li>'
                     % (key, render.APP, route, key, icon_svg(icons, ic, 20), E(label)))
        h.append("</ul></div>")
    h.append('</nav><div class="sn-nav-drawer__foot"><a class="sn-nav-drawer__item" href="%s/preferences" target="_blank" rel="noopener">%s<span class="sn-nav-drawer__label">Preferences</span><span class="sn-sr"> (opens in a new tab)</span></a></div></div></div>'
             % (render.APP, icon_svg(icons, "sliders-horizontal", 20)))
    return "".join(h)


def toc(F, FG, mode):
    E = render.E
    items = []
    for i, (sid, name) in enumerate(sections.SECTIONS, 1):
        if mode == "web":
            items.append('<li><a class="sn-link" href="#%s"><span class="sn-report-toc__num">%d</span> %s</a></li>' % (sid, i, E(name)))
        else:
            items.append('<li><a href="#%s">%d · %s</a><span class="sn-print-toc__fill"></span><span class="sn-print-toc__page" data-page-for="%s">0</span></li>' % (sid, i, E(name), sid))
    return items


def list_of_figures(FG, mode):
    E = render.E
    out = []
    for f in FG.values():
        if mode == "web":
            out.append('<li><a class="sn-link" href="#%s"><span class="sn-report-toc__num">%s</span> %s</a></li>' % (f["id"].lower(), E(f["id"]), E(f["title"])))
        else:
            out.append('<li class="sn-print-toc__sub"><a href="#%s">%s · %s</a><span class="sn-print-toc__fill"></span><span class="sn-print-toc__page" data-page-for="%s">0</span></li>' % (f["id"].lower(), E(f["id"]), E(f["title"]), f["id"].lower()))
    return out


def head(D, title_text, scripts):
    js = ""
    if scripts:
        js = "<script>%s</script><script>window.SongNodes && SongNodes.prefs.init();</script>" % D["bundle_js"]
    return ('<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>%s</title><meta name="description" content="Data flows, page interactions and user journeys across SongNodes and the music library.">'
            '<style>/* design-system/tokens.css %s (fonts embedded) */\n%s</style><style>/* design-system/components/bundle.css %s */\n%s</style>%s</head>') % (
        render.E(title_text), D["version"], D["tokens_css"], D["version"], D["bundle_css"], js)


def web_page(F, FG, D, icons, stamp):
    E = render.E
    C = render.counts(F)
    report_js = (HERE / "report.js").read_text(encoding="utf-8")
    hdr = ('<header class="sn-app-header"><div class="sn-app-header__bar"><div class="sn-app-header__start">'
           '<button class="sn-btn sn-btn--quiet sn-btn--icon" type="button" data-opener aria-expanded="false" aria-controls="nav" aria-label="Open navigation">{icon:menu}</button>'
           '<span class="sn-app-header__wordmark">SongNodes</span></div><span class="sn-app-header__divider" aria-hidden="true"></span>'
           '<p class="sn-app-header__title"><span class="sn-lead">Report:</span> Data flow and page interaction</p>'
           '<div class="sn-app-header__end"><span class="sn-app-header__stamp">{icon:clock}<span class="sn-app-header__stamp-text">Built </span><time datetime="%s" title="Built %s">%s</time></span>'
           '<div class="sn-seg sn-segmented-control sn-segmented-control--sm" role="radiogroup" aria-label="Theme" data-theme-choice>'
           '<button type="button" role="radio" aria-checked="true" tabindex="0" data-value="system">System</button>'
           '<button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="dark">Dark</button>'
           '<button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="light">Light</button>'
           '<button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="booth">Booth</button></div>'
           '</div></div></header>') % (stamp["iso"], E(stamp["text"]), E(stamp["text"]))
    ph = ('<header class="sn-page-header"><div class="sn-page-header__main"><div class="sn-page-header__text">%s'
          '<p class="sn-page-header__desc">%s pages, %s stores, %s numbered flows and %d personas across %d repos; %d figures, every number computed from <code class="sn-mono">findings.json</code>.</p>'
          '<p class="sn-page-header__meta"><span class="sn-page-header__stamp">{icon:clock}Built <time datetime="%s">%s</time></span>%s'
          '<a class="sn-link" href="print-sheet.html" target="_blank" rel="noopener">Open the print sheet<span class="sn-sr"> (opens in a new tab)</span></a></p></div></div></header>') % (
        render.title("Investigation", "Data flow and page interaction", "title-l", "h1"), render.fmt(C["pages"]), render.fmt(C["stores"]), render.fmt(C["flows"]),
        C["personas"], C["repos"], C["figures"], stamp["iso"], E(stamp["text"]), render.pill("info", "Built and Projected", "Every figure and table names the state it shows"))
    toc_html = ('<nav class="sn-report-toc" aria-label="On this page"><p class="sn-report-toc__title label">On this page</p><ol>%s</ol>'
                '<details class="sn-disclosure"><summary><span class="sn-disclosure__chev">{chev}</span>Figures<span class="sn-disclosure__hint">%d</span></summary><div class="sn-disclosure__body"><ul>%s</ul></div></details></nav>') % (
        "".join(toc(F, FG, "web")), len(FG), "".join(list_of_figures(FG, "web")))
    mv = ('<div class="sn-media-viewer" id="mv" role="dialog" aria-modal="true" aria-labelledby="mv-name" tabindex="-1" hidden><div class="sn-media-viewer__bar">'
          '<span class="sn-media-viewer__name" id="mv-name"></span><div class="sn-media-viewer__tools">'
          '<button class="sn-btn sn-btn--icon sn-btn--quiet" type="button" data-mv-zoom="out" aria-label="Zoom out">{icon:zoom-out}</button><span class="sn-media-viewer__zoom">100%%</span>'
          '<button class="sn-btn sn-btn--icon sn-btn--quiet" type="button" data-mv-zoom="in" aria-label="Zoom in">{icon:zoom-in}</button>'
          '<button class="sn-btn sn-btn--icon sn-btn--quiet" type="button" data-mv-zoom="fit" aria-label="Fit to screen">{icon:minimize-2}</button>'
          '<button class="sn-btn sn-btn--icon sn-btn--quiet" type="button" data-mv-close aria-label="Close the viewer">{icon:x}</button></div></div>'
          '<div class="sn-media-viewer__stage"></div><div class="sn-media-viewer__caption"><span class="sn-media-viewer__title"></span><span>Source: findings.json</span><span class="sn-media-viewer__alt"></span></div></div>')
    body = ('<body><div class="sn-page" id="root"><a class="sn-skip" href="#main">Skip to main content</a><div data-drawer-inert>%s</div>'
            '<main class="sn-page__main" id="main" tabindex="-1" data-drawer-inert>%s<div class="sn-page-report">%s<div class="sn-page-report__body">%s</div></div></main>'
            '%s%s<p class="sn-sr" role="status" id="sn-live"></p></div><script>%s</script></body></html>') % (
        hdr, ph, toc_html, sections.all_sections(F, FG, "web"), drawer(icons), mv, ds.safe_js(report_js))
    return fill_icons(head(D, "SongNodes · Data flow report · %s" % stamp["date"], True) + body, icons)


def print_page(F, FG, D, icons, stamp, sha):
    E = render.E
    C = render.counts(F)
    k = F["meta"]["kpis"][:4]
    tiles = "".join('<div class="sn-figure-tile" role="listitem"><span class="sn-figure-tile__figure">%s</span><span class="sn-figure-tile__label">%s</span></div>' % (E(t["figure"]), E(t["label"])) for t in k)
    cover = ('<section class="sn-print-cover sn-print-only" aria-label="Cover"><p class="sn-print-cover__eyebrow label">SongNodes and the music library</p>%s'
             '<p class="sn-print-cover__meta body-l">%s</p><div class="sn-figure-tile-row" role="list" aria-label="At a glance">%s</div>%s'
             '<p class="sn-print-cover__meta caption">Built %s by %s · songnodes %s on %s · musicLibrary snapshot %s · design system %s · findings.json sha256 %s</p></section>') % (
        render.title("Data flow report", stamp["date"], "title-l", "h1"), E(F["summary"]["loop"]), tiles,
        render.figure_html(dict(FG["D1"], id="D1", wide=False), "print") if "D1" in FG else "",
        E(stamp["text"]), E(F["meta"]["builder"]), E(F["meta"]["songnodes_commit"][:7]), E(F["meta"]["branch"]), E(F["meta"]["ml_snapshot"]), D["version"], sha[:12])
    tocp = ('<section class="sn-print-toc-page sn-print-only" aria-label="Contents">%s<ol class="sn-print-toc">%s</ol>%s<ol class="sn-print-toc">%s</ol></section>') % (
        render.title("", "Contents", "title-m", "h2"), "".join(toc(F, FG, "print")), render.title("", "Figures", "title-m", "h2"), "".join(list_of_figures(FG, "print")))
    foot = ""   # the traceability footer is the PDF footer template (pdf.py), styled from tokens.json; see trace_footer()
    FGp = {k2: dict(v) for k2, v in FG.items()}
    for f in FGp.values():
        f.pop("projected_svg", None)
    body = ('<body class="sn-print-doc"><main class="sn-page__main" id="main">%s%s<div class="sn-page-report"><div class="sn-page-report__body">%s</div></div></main>%s</body></html>') % (
        cover, tocp, sections.all_sections(F, FGp, "print"), foot)
    html_text = head(D, "SongNodes · Data flow report · %s" % stamp["date"], False).replace('<html lang="en-AU">', '<html lang="en-AU" data-theme="light" data-density="compact">') + body
    return fill_icons(html_text, icons)


def trace_footer(F, D, stamp, sha):
    """PDF footer template (bottom left; the design system's @page margin box prints "Page X of Y" bottom right).
    Values from the design system's tokens.json: body family, caption size, light fg-3 (token import, Print and export
    "Traceability footer"). Chromium footer templates cannot read the page's CSS variables."""
    t = D["tokens"]
    cap = ds.type_style(t, "caption")
    style = "font-family:%s;font-size:%s;color:%s;width:100%%;margin:0 12mm;line-height:1.35" % (ds.family(t, "body").replace('"', "'"), cap["fontSize"], ds.token_value(t, "fg-3"))
    text = "SongNodes · Data flow report · %s · songnodes %s · musicLibrary %s · findings.json %s · built %s by %s" % (
        stamp["date"], F["meta"]["songnodes_commit"][:7], F["meta"]["ml_snapshot"], sha[:12], stamp["text"], F["meta"]["builder"].split(" for ")[0])
    return '<div style="%s">%s</div>' % (style, render.E(text))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-pdf", action="store_true")
    ap.add_argument("--no-gates", action="store_true")
    a = ap.parse_args()
    raw = (OUT / "findings.json").read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    F = json.loads(raw)
    now = dt.datetime.now(MEL)
    stamp = {"iso": now.isoformat(timespec="seconds"), "text": now.strftime("%-d %b %Y, %H:%M ") + now.tzname(), "date": now.strftime("%-d %b %Y")}
    D = ds.load()
    icons = icons_from_bundle(D["bundle_js"])
    FG = figures.build_all(F, D, OUT)            # writes standalone SVGs, returns {id: figure}
    F["figures"] = [{k: v for k, v in f.items() if k not in ("svg", "projected_svg", "table")} for f in FG.values()]
    C = render.counts(F)                         # KPI band: computed, four tiles then "More figures" (11-data-display)
    F["meta"]["kpis"] = [{"figure": render.fmt(C[key]), "label": label, "status": st} for key, label, st in F["meta"]["kpi_spec"]]
    md.write_all(F, FG, OUT, stamp, sha)
    (OUT / "report").mkdir(exist_ok=True)
    (OUT / "report" / "index.html").write_text(web_page(F, FG, D, icons, stamp), encoding="utf-8")
    sheet = print_page(F, FG, D, icons, stamp, sha)
    (OUT / "report" / "print-sheet.html").write_text(sheet, encoding="utf-8")
    print("web report, print sheet, %d figures, design system %s, findings %s" % (len(FG), D["version"], sha[:12]))
    if not a.no_pdf:
        (OUT / "report" / "pdf-footer.html").write_text(trace_footer(F, D, stamp, sha), encoding="utf-8")
        subprocess.run([sys.executable, str(HERE / "pdf.py"), str(OUT / "report" / "print-sheet.html"), str(OUT / "DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf"), str(OUT / "report" / "pdf-footer.html")], check=True)
    if not a.no_gates:
        subprocess.run([sys.executable, str(HERE / "verify.py")], check=False)


if __name__ == "__main__":
    main()
