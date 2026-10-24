#!/usr/bin/env python3
"""Render component previews the way the design-system page frames them.
Usage: python3 render.py <ComponentName|all> [--themes dark,light,booth] [--width 960]
Rebuilds components/bundle.css + bundle.js first, then for each preview writes
shots/<Comp>-<theme>.png and prints console errors, page errors and horizontal overflow."""
import sys, os, re, subprocess, asyncio, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(os.path.dirname(HERE), "project")
SHOTS = os.path.join(os.path.dirname(HERE), "shots")
os.makedirs(SHOTS, exist_ok=True)
ap = argparse.ArgumentParser(); ap.add_argument("comp"); ap.add_argument("--themes", default="dark,light,booth"); ap.add_argument("--width", type=int, default=960)
a = ap.parse_args()
subprocess.run([sys.executable, "-I", os.path.join(PROJ, "source", "build_bundle.py")], check=True, cwd=PROJ, stdout=subprocess.DEVNULL)
comps = sorted(d for d in os.listdir(os.path.join(PROJ, "components")) if os.path.isfile(os.path.join(PROJ, "components", d, "preview.html"))) if a.comp == "all" else a.comp.split(",")

from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None)
        for c in comps:
            path = os.path.join(PROJ, "components", c, "preview.html")
            src = open(path, encoding="utf-8").read()
            m = re.match(r"<!--\s*@dsCard([^>]*)-->", src)
            h = 400
            if m:
                hm = re.search(r"height=(\d+)", m.group(1)); h = int(hm.group(1)) if hm else 120
            else:
                print(f"[{c}] MISSING @dsCard marker on line 1")
            for th in a.themes.split(","):
                pg = await b.new_page(viewport={"width": a.width, "height": max(h, 80)})
                errs = []
                pg.on("console", lambda msg: errs.append(f"console.{msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
                pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
                # inject the frame preload: tokens.css, bundle.css, bundle.js, data-theme
                inject = (f'<link rel="stylesheet" href="file://{PROJ}/tokens.css">'
                          f'<link rel="stylesheet" href="file://{PROJ}/components/bundle.css">'
                          f'<script src="file://{PROJ}/components/bundle.js"></script>')
                doc = src
                doc = re.sub(r"<html([^>]*)>", lambda mm: f'<html{mm.group(1)} data-theme="{th}">', doc, count=1) if "<html" in doc else f'<html data-theme="{th}">' + doc
                doc = doc.replace("<head>", "<head>" + inject, 1) if "<head>" in doc else doc.replace(f'data-theme="{th}">', f'data-theme="{th}"><head>{inject}</head>', 1)
                tmp = os.path.join(PROJ, "components", c, f".render-{th}.html")
                open(tmp, "w", encoding="utf-8").write(doc)
                await pg.goto("file://" + tmp)
                await pg.wait_for_timeout(350)
                over = await pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                full_h = await pg.evaluate("() => document.documentElement.scrollHeight")
                await pg.screenshot(path=os.path.join(SHOTS, f"{c}-{th}.png"), full_page=True)
                os.remove(tmp)
                notes = []
                if over > 1: notes.append(f"horizontal overflow {over}px")
                if full_h > h + 40: notes.append(f"content {full_h}px taller than marker height {h}")
                print(f"[{c}/{th}] " + ("; ".join(errs + notes) if (errs or notes) else "ok"))
                await pg.close()
        await b.close()
asyncio.run(main())
