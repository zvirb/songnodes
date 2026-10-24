#!/usr/bin/env python3
"""Pages agent B: writes components/<Page>/preview.html from src/<Page>.html,
inlining src/common.js at /*@COMMON@*/ and src/kit.js at /*@KIT@*/. Re-run after editing src/."""
import os, glob
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
common = open(os.path.join(HERE, "src", "common.js"), encoding="utf-8").read()
kit = open(os.path.join(HERE, "src", "kit.js"), encoding="utf-8").read()
for p in sorted(glob.glob(os.path.join(HERE, "src", "*.html"))):
    name = os.path.basename(p)[:-5]
    s = open(p, encoding="utf-8").read().replace("/*@COMMON@*/", common).replace("/*@KIT@*/", kit)
    assert "</script" not in common and "</script" not in kit
    out = os.path.join(PROJ, "components", name)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, "preview.html"), "w", encoding="utf-8").write(s)
    print("wrote", name, len(s))
