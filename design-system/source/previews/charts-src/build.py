#!/usr/bin/env python3
"""Inline kit.js into each chart preview source (charts-src/<Comp>.html) and write
DS/project/components/<Comp>/preview.html. Usage: python3 -I build.py [Comp,...]"""
import os, sys, glob
here = os.path.dirname(os.path.abspath(__file__))
proj = os.path.normpath(os.path.join(here, "..", "..", ".."))
kit = open(os.path.join(here, "kit.js"), encoding="utf-8").read()
want = sys.argv[1].split(",") if len(sys.argv) > 1 else None
for p in sorted(glob.glob(os.path.join(here, "*.html"))):
    name = os.path.basename(p)[:-5]
    if want and name not in want:
        continue
    src = open(p, encoding="utf-8").read().replace("/*KIT*/", kit)
    assert "</script" not in kit
    out = os.path.join(proj, "components", name)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, "preview.html"), "w", encoding="utf-8").write(src)
    print("wrote", name)
