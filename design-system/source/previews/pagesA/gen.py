#!/usr/bin/env python3
"""Pages A generator: src/<Page>.html with /*KIT*/ -> ds/project/components/<Page>/preview.html.
Re-run after editing src/ or kit_*.js. Keeps the shared shell helpers identical across pages."""
import os, sys
H = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(H, "..", "..", "..", "components"))
kit = open(os.path.join(H, "kit_base.js")).read() + "\n" + open(os.path.join(H, "kit_page.js")).read()
for f in sorted(os.listdir(os.path.join(H, "src"))):
    if not f.endswith(".html"): continue
    name = f[:-5]
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    src = open(os.path.join(H, "src", f)).read()
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    open(os.path.join(OUT, name, "preview.html"), "w").write(src.replace("/*KIT*/", kit))
    print("wrote", name)
