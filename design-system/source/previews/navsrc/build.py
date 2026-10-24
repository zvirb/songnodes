import os, re, sys, glob
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.normpath(os.path.join(here, "..", "..", "..", "components"))
snip = {n: open(os.path.join(here, "_" + n + ".js")).read() for n in ("menu", "seg", "drawer")}
for p in sorted(glob.glob(os.path.join(here, "*.html"))):
    c = os.path.basename(p)[:-5]
    s = open(p).read()
    s = re.sub(r"/\*@@(\w+)@@\*/", lambda m: snip[m.group(1)], s)
    os.makedirs(os.path.join(out, c), exist_ok=True)
    open(os.path.join(out, c, "preview.html"), "w").write(s)
    print("built", c)
