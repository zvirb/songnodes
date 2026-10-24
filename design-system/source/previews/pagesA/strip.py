import sys,re
for c in sys.argv[1:]:
    p=f"/tmp/claude-0/-home-claude/c3c20043-1610-5b47-bb08-58c5e935351c/scratchpad/ds/project/components/{c}/preview.html"
    L=open(p).read().split("\n"); out=[]; skip=False
    for l in L:
        if "/* preview helper" in l or "/* chart kit" in l: skip=True; out.append("  [helper stripped: "+l.strip()[:80]+"]"); continue
        if skip and (l.strip()=="" or l.startswith("})();")): skip=False; continue
        if not skip: out.append(l)
    print("=====",c); print("\n".join(out))
