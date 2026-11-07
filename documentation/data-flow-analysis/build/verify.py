#!/usr/bin/env python3
"""Phase 6d verification gates. Writes ../gates.json and prints one line per gate. Exit 1 if any gate fails.

 1 linter      design-system/linters/check.py on the report's own markup (inlined design-system files stripped)
 2 tokens      zero colour, font-size, spacing or radius literals in the report's own markup and figure SVGs
 3 parity      every page, store, flow, persona, step, gap, module and task appears in web, sheet and PDF;
               every flow is drawn in a D2 panel; every chart recomputes (charts.recompute, run in the build)
 4 diagrams    check_diagrams.mjs (overflow, collisions, min px at print) + generator checks (edges through nodes)
 5 pdf         blank pages, U+FFFD/.notdef, fonts embedded, section order, page X of Y, TOC links
 6 colour      no module colour in any figure; design-system contrast report passes; greyscale screenshots for QA
 7 conformance screenshots of report and reference page (HomePage preview) at 1440/820/390 in every theme, for QA
 8 offline     loads with all network blocked, zero console errors, every in-page anchor resolves
 9 secrets     no secret-shaped strings in any output
10 claims      every PR URL in the handover answers on the GitHub REST API
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
ROOT = HERE.parents[2]
DSDIR = ROOT / "design-system"
WEB, SHEET, PDF = OUT / "report" / "index.html", OUT / "report" / "print-sheet.html", OUT / "DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf"
SHOTS = OUT / "build" / "evidence"
R = {}


def gate(n, name, ok, note, detail=None):
    R[n] = {"name": name, "state": "pass" if ok is True else ("warn" if ok == "warn" else "fail"), "note": note, "detail": detail}
    print("%-2s %-12s %-4s %s" % (n, name, R[n]["state"], note))


def own_markup(html):
    """The report's own markup: drop the inlined design-system style blocks and the bundle script."""
    html = re.sub(r"<style>/\* design-system/[^*]*\*/.*?</style>", "", html, flags=re.S)
    html = re.sub(r"<script>/\* @ds-bundle.*?</script>", "", html, flags=re.S)
    return html


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def main():
    F = json.loads((OUT / "findings.json").read_text(encoding="utf-8"))
    web, sheet = WEB.read_text(encoding="utf-8"), SHEET.read_text(encoding="utf-8")
    import html as htmllib
    web_txt, sheet_txt = htmllib.unescape(web), htmllib.unescape(sheet)      # parity compares decoded markup
    tmp = OUT / "build" / "evidence"
    tmp.mkdir(exist_ok=True)
    (tmp / "web-own.html").write_text(own_markup(web), encoding="utf-8")
    (tmp / "sheet-own.html").write_text(own_markup(sheet), encoding="utf-8")

    # 1 linter
    r = run([sys.executable, str(DSDIR / "linters" / "check.py"), str(tmp / "web-own.html"), str(tmp / "sheet-own.html"), "--json"])
    try:
        found = json.loads(r.stdout or "[]")
    except json.JSONDecodeError:
        found = [{"raw": r.stdout[-500:]}]
    gate(1, "linter", not found, "%d findings from design-system/linters/check.py" % len(found), found[:20])

    # 2 token audit (own markup + every standalone figure body)
    rx = {"colour": r"(?<!&)#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(", "font-size": r"font-size\s*[:=]\s*['\"]?\d", "spacing": r"(?:margin|padding|gap)\s*:\s*\d", "radius": r"(?:border-radius\s*:\s*\d|\brx\s*[:=]\s*['\"]?\d)",
          "inline-style": r'style="[^"]*\d(?:px|rem|pt|mm)'}
    hits = []
    def styling(t):
        """Only what can carry style: tags (attributes, inline style) and <style> blocks, never the copy between tags."""
        t = re.sub(r"<script\b[^>]*>.*?</script\b[^>]*>", "", t, flags=re.S | re.I)
        return "\n".join(re.findall(r"<style>.*?</style>|<[^>]+>", t, flags=re.S))
    for label, text in (("web", own_markup(web)), ("sheet", own_markup(sheet))):
        body = styling(re.sub(r"<svg class=\"sn-icon\".*?</svg>", "", text, flags=re.S))       # design-system icon markup
        for k, p in rx.items():
            for m in re.finditer(p, body):
                hits.append("%s %s: %s" % (label, k, body[max(0, m.start() - 40):m.end() + 20].replace("\n", " ")))
    for svgf in sorted(OUT.glob("*.svg")):
        t = svgf.read_text(encoding="utf-8")
        t = styling(re.sub(r"<style>.*?</style>", "", t, flags=re.S))                 # the inlined design system removed
        for k, p in rx.items():
            for m in re.finditer(p, t):
                hits.append("%s %s: %s" % (svgf.name, k, t[max(0, m.start() - 30):m.end() + 20]))
    for name in ("64-diagram.css", "65-report-charts.css", "63-report.css", "62-print-document.css"):
        p = DSDIR / "source" / "css" / name
        if p.exists():
            t = p.read_text(encoding="utf-8")
            t = re.sub(r"@page[^{]*\{[^}]*\}", "", t)
            for m in re.finditer(r"(?<!&)#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(", t):
                hits.append("%s colour: %s" % (name, t[max(0, m.start() - 30):m.end() + 10]))
    gate(2, "tokens", not hits, "%d literal colours, sizes, spacing or radii outside design-system definitions" % len(hits), hits[:30])

    # 3 parity
    import pypdf
    pdf_text = re.sub(r"\s+", " ", " ".join((p.extract_text() or "") for p in pypdf.PdfReader(str(PDF)).pages)) if PDF.exists() else ""
    pdf_flat = re.sub(r"\s+", "", pdf_text)
    miss = []
    kinds = {"page": F["pages"], "store": F["stores"], "flow": F["flows"], "gap": F["gaps"], "module": F["modules"], "task": F["tasks"]}
    for kind, items in kinds.items():
        for x in items:
            for label, doc in (("web", web_txt), ("sheet", sheet_txt)):
                if 'data-id="%s"' % x["id"] not in doc and 'id="%s"' % x["id"] not in doc:
                    miss.append("%s %s missing in %s" % (kind, x["id"], label))
    pdf_needle = {"page": lambda p: p["title"][:40], "store": lambda s: s["id"], "flow": lambda f: f.get("label", "")[:30], "gap": lambda g: g["id"], "module": lambda m: m["name"], "task": lambda t: t["id"]}
    for kind, items in kinds.items():
        for x in items:
            n = re.sub(r"\s+", "", pdf_needle[kind](x))       # wrapped cells split words across lines: compare without whitespace
            if n and n not in pdf_flat:
                miss.append("%s %s not found in PDF text (%r)" % (kind, x["id"], n))
    for p in F["personas"]:
        if re.sub(r"\s+", "", p["name"]) not in pdf_flat:
            miss.append("persona %s not in PDF" % p["id"])
        for s in p["steps"]:
            sid = "%s-s%d" % (p["id"], s["n"])
            if 'data-id="%s"' % sid not in web_txt or 'data-id="%s"' % sid not in sheet_txt:
                miss.append("step %s missing" % sid)
    d2 = "".join(re.findall(r'<figure[^>]*data-figure="D2[a-z]?".*?</figure>', web, flags=re.S))
    undrawn = [f["id"] for f in F["flows"] if not re.search(r'data-flow="%d"' % f["n"], d2) and not ('data-from="%s"' % f["from"] in d2 and 'data-to="%s"' % f["to"] in d2)]
    miss += ["flow %s not drawn in D2" % u for u in undrawn]
    gate(3, "parity", not miss, "%d items missing from a figure or table in web, sheet or PDF; %d flows undrawn" % (len(miss), len(undrawn)), miss[:40])

    # 4 diagrams
    svgs = sorted(OUT.glob("*.svg"))
    r = run(["node", str(HERE / "check_diagrams.mjs"), str(OUT)], cwd=str(HERE)) if (HERE / "check_diagrams.mjs").exists() else None
    res = {}
    if r is not None:
        try:
            res = json.loads(r.stdout)
        except Exception:
            res = {"error": (r.stdout + r.stderr)[-800:]}
    bad = {k: v for k, v in res.items() if isinstance(v, dict) and (v.get("overflow") or v.get("collisions") or (v.get("min_px_at_print") or 99) < 9.5)}
    reg = json.loads((OUT / "figures.json").read_text(encoding="utf-8")) if (OUT / "figures.json").exists() else []
    gen = [f for f in reg if f.get("checks")]
    through = sum(f["checks"].get("edges_through_nodes", 0) for f in gen)
    crossings = {f["id"]: f["checks"].get("crossings") for f in gen}
    ok4 = r is not None and r.returncode == 0 and not bad and "error" not in res and through == 0
    gate(4, "diagrams", ok4, "%d SVGs checked; %d with overflow, collision or text under 9.5 px; %d edges through nodes; crossings %s" % (len(svgs), len(bad), through, crossings), bad or res.get("error"))

    # 5 pdf
    notes, fails = [], []
    if PDF.exists():
        info = run(["pdfinfo", str(PDF)]).stdout
        pages = int(re.search(r"Pages:\s+(\d+)", info).group(1))
        fonts = run(["pdffonts", str(PDF)]).stdout.splitlines()[2:]
        notemb = [l for l in fonts if l.split() and len(l.split()) > 4 and l.split()[-5] != "yes"]
        if notemb:
            fails.append("fonts not embedded: %s" % notemb[:3])
        txt = run(["pdftotext", "-layout", str(PDF), "-"]).stdout
        if "�" in txt or ".notdef" in txt:
            fails.append("missing glyphs (U+FFFD/.notdef) in extracted text")
        per = txt.split("\f")
        secs = [int(m) for m in re.findall(r"Section (\d+):", "".join(per[2:]))]
        firsts = [n for i, n in enumerate(secs) if n not in secs[:i]]
        if firsts != sorted(firsts) or (firsts and firsts != list(range(1, len(firsts) + 1))):
            fails.append("section numbers not sequential: %s" % firsts)
        wrong = [i + 1 for i, t in enumerate(per[:pages]) if "Page %d of %d" % (i + 1, pages) not in t]
        if wrong:
            fails.append("pages without the right 'Page X of Y': %s" % wrong[:10])
        rd = pypdf.PdfReader(str(PDF))
        links = sum(1 for a in (rd.pages[1].get("/Annots") or []) if a.get_object().get("/Subtype") == "/Link")
        if links < 13:
            fails.append("contents page has %d links (need at least 13)" % links)
        for old in list(tmp.glob("pg-*.pgm")) + list(SHOTS.glob("pdf-*.png")):
            old.unlink()                                                   # images from an earlier, longer render
        run(["pdftoppm", "-r", "30", "-gray", str(PDF), str(tmp / "pg")])
        from PIL import Image
        blanks = []
        imgs = sorted(tmp.glob("pg-*.pgm"))
        for i, p in enumerate(imgs):
            im = Image.open(p)
            w, h = im.size
            px = im.load()
            body_end = int(h * 0.88)                                 # above the footer band
            rows = [y for y in range(int(h * 0.04), body_end) if any(px[x, y] < 235 for x in range(0, w, 2))]
            empty = 1 - ((rows[-1] - rows[0]) / (body_end - h * 0.04) if rows else 0)
            land = [float(pg.mediabox.width) > float(pg.mediabox.height) for pg in rd.pages]
            before_turn = i + 1 < len(land) and land[i + 1] != land[i]      # a landscape page cannot start mid-page
            if 0 < i < len(imgs) - 1 and empty > 0.40 and not before_turn:
                blanks.append((i + 1, round(empty, 2)))
        if blanks:
            fails.append("pages over 40%% empty (pages before an orientation change exempt): %s" % blanks)
        notes.append("%d pages" % pages)
        run(["pdftoppm", "-r", "70", "-png", str(PDF), str(SHOTS / "pdf")])
    else:
        fails.append("no PDF")
    # Chromium shrinks every printed page when any portrait block is wider than the portrait content width
    ov = run(["node", "-e", "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:703,height:1000}});"
              "await p.goto('file://%s');await p.emulateMedia({media:'print'});"
              "console.log(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>!e.closest('.sn-print-wide')&&e.getBoundingClientRect().right>705).length));await b.close()})()" % SHEET], cwd=str(HERE))
    n_ov = int((ov.stdout or "-1").strip() or -1)
    notes.append("%d portrait elements wider than the page" % n_ov)
    if n_ov != 0:
        fails.append("%d elements overflow the portrait width (the whole PDF would be shrunk)" % n_ov)
    gate(5, "pdf", not fails, "; ".join(notes + fails) if (notes or fails) else "ok", fails)

    # 6 colour
    figsvg = "".join(f.read_text(encoding="utf-8").split("</style>", 1)[-1] for f in svgs)
    mods = len(re.findall(r"var\(--mod-|--m-|sn-m-", figsvg))
    import shutil, tempfile
    with tempfile.TemporaryDirectory() as td:                      # run the generator on a copy, never in the repo
        cp = Path(td) / "ds"
        shutil.copytree(DSDIR / "source", cp / "source")
        r = run([sys.executable, str(cp / "source" / "build_tokens.py"), str(cp)])
    contrast_ok = "all pairs pass" in r.stdout
    gate(6, "colour", mods == 0 and contrast_ok, "%d module-colour uses in figures; design-system contrast report %s; greyscale shots for QA in build/evidence" % (mods, "passes" if contrast_ok else "FAILS"))

    # 7 + 8 browser checks
    import ds as dsmod                       # the reference page (HomePage preview) with the design system loaded, as its preview harness does
    D = dsmod.load()
    ref = (DSDIR / "components" / "HomePage" / "preview.html").read_text(encoding="utf-8")
    inject = "<style>%s</style><style>%s</style><script>%s</script><script>SongNodes.prefs.init();</script>" % (D["tokens_css"], D["bundle_css"], D["bundle_js"])
    ref = ref.replace("<head>", "<head>" + inject, 1)
    (SHOTS / "reference-home.html").write_text(ref, encoding="utf-8")
    r = run(["node", str(HERE / "browser_gates.mjs"), str(WEB), str(SHOTS / "reference-home.html"), str(SHOTS)], cwd=str(HERE))
    try:
        b = json.loads(r.stdout)
    except Exception:
        b = {"error": (r.stdout + r.stderr)[-800:]}
    gate(7, "conformance", "error" not in b and b.get("shots", 0) >= 18, "%s screenshots (report and reference, 3 widths × themes) for QA" % b.get("shots"), b.get("error"))
    gate(8, "offline", "error" not in b and not b.get("console_errors") and not b.get("bad_anchors") and not b.get("network"),
         "%d console errors, %d unresolved anchors, %d network requests with the network blocked" % (len(b.get("console_errors", [])), len(b.get("bad_anchors", [])), len(b.get("network", []))),
         {k: b.get(k) for k in ("console_errors", "bad_anchors", "network")})

    # 9 secrets
    pat = r"(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|(?:secret|password|token)[\"']?\s*[:=]\s*[\"'][^\"'\s]{12,}[\"'])"
    shits = []
    for f in [WEB, SHEET, OUT / "findings.json"] + list(OUT.glob("*.md")) + list(OUT.glob("todo/*.md")):
        for m in re.finditer(pat, own_markup(f.read_text(encoding="utf-8")), re.I):
            shits.append("%s: %s…" % (f.name, m.group(0)[:12]))
    if PDF.exists():
        for m in re.finditer(pat, pdf_text, re.I):
            shits.append("PDF: %s…" % m.group(0)[:12])
    gate(9, "secrets", not shits, "%d secret-shaped strings in outputs" % len(shits), shits[:10])

    # 10 claims
    HO = json.loads((HERE / "handover.json").read_text(encoding="utf-8")) if (HERE / "handover.json").exists() else F["handover"]
    urls = [v for k, v in HO["items"] if str(v).startswith("https://github.com/")]
    bad10 = []
    for u in urls:
        m = re.search(r"github\.com/([^/]+/[^/]+)/pull/(\d+)", u)
        if m:
            rr = run(["gh", "api", "repos/%s/pulls/%s" % (m.group(1), m.group(2)), "--jq", ".html_url"])
            if rr.stdout.strip() != u:
                bad10.append(u)
    gate(10, "claims", "warn" if not urls else not bad10, "%d PR URLs in the handover, %d not confirmed by the GitHub API" % (len(urls), len(bad10)), bad10)

    (OUT / "gates.json").write_text(json.dumps(R, indent=1, ensure_ascii=False), encoding="utf-8")
    sys.exit(0 if all(g["state"] != "fail" for g in R.values()) else 1)


if __name__ == "__main__":
    main()
