#!/usr/bin/env python3
"""Builds components/bundle.css (all source/css/*.css in name order) and components/bundle.js
(source/bundle.src.js with the Lucide icon map inlined). Run from project/: python3 source/build_bundle.py"""
import json, glob, os, re
here = os.path.dirname(os.path.abspath(__file__)); proj = os.path.dirname(here)
os.makedirs(os.path.join(proj, "components"), exist_ok=True)
css = "/* SongNodes component styles — built from source/css/*.css; load after tokens.css */\n"
for p in sorted(glob.glob(os.path.join(here, "css", "*.css"))):
    css += "\n" + open(p, encoding="utf-8").read()
assert "</style" not in css.lower()
open(os.path.join(proj, "components", "bundle.css"), "w", encoding="utf-8").write(css)
icons = {}
for p in sorted(glob.glob(os.path.join(proj, "assets", "Icons", "*.svg"))):
    s = open(p, encoding="utf-8").read()
    inner = re.search(r"-->\s*(.*)</svg>", s, re.S).group(1).strip()
    icons[os.path.basename(p)[:-4]] = inner
js = open(os.path.join(here, "bundle.src.js"), encoding="utf-8").read().replace("__ICONS__", json.dumps(icons, ensure_ascii=False))
header = '/* @ds-bundle: {"format":4,"namespace":"SongNodes","components":[]} */\n'
js = header + js
assert "</script" not in js.lower() and "<!--" not in js
open(os.path.join(proj, "components", "bundle.js"), "w", encoding="utf-8").write(js)
print("bundle.css", len(css), "bundle.js", len(js), "icons", len(icons))
