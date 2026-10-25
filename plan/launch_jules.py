#!/usr/bin/env python3
"""Start Jules sessions for the QA work packages in plan/agents.

Dry run by default: writes plan/jules_payloads/*.txt and prints the first line of each.
  python plan/launch_jules.py                      # dry run, all packages
  python plan/launch_jules.py --only QA1,QA2 --cli # start sessions with the logged-in jules CLI
Briefs get the current origin/main SHA. Sending needs PR #n (this plan) merged first, because Jules only sees main.
"""
import argparse, pathlib, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parent
REPO = "zvirb/songnodes"
RETIRED: set[str] = set()
# sent only when named in --only, after the packages it depends on are merged
HOLD = {"DS16"}


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True).stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--cli", action="store_true")
    ap.add_argument("--delay", type=int, default=30)
    ap.add_argument("--force-base", action="store_true")
    a = ap.parse_args()
    only = {c for c in a.only.split(",") if c}
    base = sh("git", "ls-remote", "origin", "main").split()[0]
    print(f"base: origin/main {base[:7]}")
    if a.cli and not a.force_base and "QA1" not in sh("git", "show", "origin/main:STATUS.md"):
        sys.exit("the QA status slots are not on origin/main yet; merge the plan PR first (or --force-base)")
    out = ROOT / "jules_payloads"
    out.mkdir(exist_ok=True)
    jobs = []
    for f in sorted((ROOT / "agents").glob("*.md")):
        code = f.name.split("_")[0]
        if code in RETIRED or (only and code not in only) or (code in HOLD and code not in only):
            continue
        text = f.read_text(encoding="utf-8").replace("BASE_SHA", base)
        (out / f"{code}.txt").write_text(text, encoding="utf-8")
        print(text.splitlines()[0])
        jobs.append((code, text))
    if not a.cli:
        print("dry run only; add --cli to start sessions")
        return
    for i, (code, text) in enumerate(jobs):
        if i:
            time.sleep(a.delay)
        r = subprocess.run(["jules", "remote", "new", "--repo", REPO], input=text, text=True, shell=sys.platform == "win32")
        if r.returncode:
            sys.exit(f"{code} failed; stopping")
        print(f"started {code}")


main()
