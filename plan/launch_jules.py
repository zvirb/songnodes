#!/usr/bin/env python3
"""Start Jules sessions for the work packages in plan/agents (the single launcher; see plan/RESTRUCTURE.md).

Dry run by default: writes plan/jules_payloads/*.txt and prints the first line of each.
  python plan/launch_jules.py --wave 1             # dry run of wave 1
  python plan/launch_jules.py --wave 1 --cli       # start wave 1 with the logged-in jules CLI
  python plan/launch_jules.py --only R1,G1 --cli   # start named packages
Sending needs every package's STATUS.md slot on origin/main, because Jules only sees main.
Send a wave only when the previous wave's PRs are merged (each brief also names its own dependencies).
"""
import argparse, pathlib, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parent
REPO = "zvirb/songnodes"
sys.path.insert(0, str(ROOT))
from build_rs_prompts import WAVES  # noqa: E402

# replaced by the restructure (plan/RESTRUCTURE.md, section 4); never send these
RETIRED = {"WP2", "WP4", "WP5", "BE1", "FE1", "FE3", "FE4", "FE11", "FEW", "SEC6"}
# sent only when named in --only, after the packages it depends on are merged
HOLD = {"DS16"}


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True).stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--wave", default="")
    ap.add_argument("--cli", action="store_true")
    ap.add_argument("--delay", type=int, default=30)
    ap.add_argument("--force-base", action="store_true")
    a = ap.parse_args()
    only = {c for c in a.only.split(",") if c}
    if a.wave:
        if a.wave not in WAVES:
            sys.exit(f"unknown wave {a.wave}; waves: {', '.join(WAVES)}")
        only |= set(WAVES[a.wave])
    if a.cli and not only:
        sys.exit("name a --wave or --only list; sending every package at once is not allowed")
    if only & RETIRED:
        sys.exit(f"retired packages requested: {', '.join(sorted(only & RETIRED))}")
    base = sh("git", "ls-remote", "origin", "main").split()[0]
    print(f"base: origin/main {base[:7]}")
    status = sh("git", "show", "origin/main:STATUS.md") if a.cli and not a.force_base else ""
    out = ROOT / "jules_payloads"
    out.mkdir(exist_ok=True)
    jobs = []
    for f in sorted((ROOT / "agents").glob("*.md")):
        code = f.name.split("_")[0]
        if code in RETIRED or (only and code not in only) or (code in HOLD and code not in only):
            continue
        if status and f"SLOT:{code} BEGIN" not in status:
            sys.exit(f"{code}: its STATUS.md slot is not on origin/main yet; merge the plan PR first (or --force-base)")
        text = f.read_text(encoding="utf-8").replace("BASE_SHA", base)
        (out / f"{code}.txt").write_text(text, encoding="utf-8")
        print(text.splitlines()[0])
        jobs.append((code, text))
    missing = sorted(only - {c for c, _ in jobs})
    if missing:
        print(f"no brief found for: {', '.join(missing)}")
    if not a.cli:
        print(f"dry run only ({len(jobs)} packages); add --cli to start sessions")
        return
    for i, (code, text) in enumerate(jobs):
        if i:
            time.sleep(a.delay)
        r = subprocess.run(["jules", "remote", "new", "--repo", REPO], input=text, text=True, shell=sys.platform == "win32")
        if r.returncode:
            sys.exit(f"{code} failed; stopping")
        print(f"started {code}")


main()
