#!/usr/bin/env python3
"""Static print sheet -> A4 PDF, two passes so the contents and list of figures carry real page numbers.

Pass 1 renders the sheet; the page of every section heading ("Section N: Name") and figure title ("ID: Title")
is read back from the PDF text; the numbers are written into the sheet's data-page-for spans; pass 2 renders the
final PDF. Paper size, margins, landscape pages and "Page X of Y" come from the design system's @page rules
(@page doc / @page wide, design system 1.10.0); this script declares none. Requires Python Playwright + pypdf.
    python3 pdf.py <print-sheet.html> <out.pdf>
"""
import html as htmllib
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from pypdf import PdfReader


def norm(s):
    return re.sub(r"\s+", " ", s.replace("­", "")).strip().lower()


FOOTER = ""


def render(page, html_path, pdf_path):
    page.goto(Path(html_path).resolve().as_uri(), wait_until="load")
    page.evaluate("document.fonts.ready")
    page.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True, outline=True, tagged=True,
             display_header_footer=bool(FOOTER), header_template="<span></span>", footer_template=FOOTER or "<span></span>")


def page_map(pdf_path, targets):
    texts = [norm(p.extract_text() or "") for p in PdfReader(str(pdf_path)).pages]
    found = {}
    for key, needle in targets.items():
        n = norm(needle)
        for i, t in enumerate(texts):
            if i < 1:             # the cover repeats the D1 hero title; contents entries use "N · Name", never the heading form
                continue
            if n in t:
                found[key] = i + 1
                break
    return found, len(texts)


def main(html_path, pdf_path, footer_path=None):
    global FOOTER
    FOOTER = Path(footer_path).read_text(encoding="utf-8") if footer_path else ""
    html = Path(html_path).read_text(encoding="utf-8")
    targets = {}
    for m in re.finditer(r'id="([a-z0-9-]+)-t"><span class="sn-lead">(Section \d+):</span> ([^<]+)</h2>', html):
        targets[m.group(1)] = "%s: %s" % (m.group(2), htmllib.unescape(m.group(3)))
    for m in re.finditer(r'<figure class="sn-figure[^"]*" id="([a-z0-9-]+)" data-figure="([^"]+)"[^>]*><div class="sn-figure__head"><div class="sn-chart-frame__titles"><h3 class="sn-title title-s"><span class="sn-lead">[^<]+:</span> ([^<]+)</h3>', html):
        targets[m.group(1)] = "%s: %s" % (m.group(2), htmllib.unescape(m.group(3)))
    tmp = Path(pdf_path).with_suffix(".pass1.pdf")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        render(pg, html_path, tmp)
        found, total = page_map(tmp, targets)
        missing = sorted(set(targets) - set(found))
        filled = re.sub(r'(<span class="sn-print-toc__page" data-page-for="([a-z0-9-]+)">)0(</span>)', lambda m: m.group(1) + str(found.get(m.group(2), "–")) + m.group(3), html)
        Path(html_path).write_text(filled, encoding="utf-8")
        render(pg, html_path, pdf_path)
        found2, total2 = page_map(pdf_path, targets)
        b.close()
    tmp.unlink()
    moved = {k: (found.get(k), found2.get(k)) for k in targets if found.get(k) != found2.get(k)}
    print("pdf: %d pages, %d targets located, %d missing %s, %d moved between passes %s" % (total2, len(found2), len(missing), missing[:5], len(moved), list(moved.items())[:5]))
    Path(pdf_path).with_suffix(".pages.json").write_text(__import__("json").dumps({"pages": total2, "toc": found2, "missing": missing, "moved": moved}, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(*sys.argv[1:4])
