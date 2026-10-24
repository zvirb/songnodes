#!/usr/bin/env python3
"""Interaction check: python3 -I pw.py <Comp> <theme> <width> <out.png> [keys/actions...]
actions: 'focus:<css>' 'key:<Key>' 'hover:<css>' 'click:<css>' 'js:<expr>' 'clip:<css>'"""
import sys, os, re, asyncio
from playwright.async_api import async_playwright
here = os.path.dirname(os.path.abspath(__file__)); PROJ = os.path.join(here, "..", "ds", "project")
PROJ = os.path.abspath(PROJ)
comp, th, w, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
acts = sys.argv[5:]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None)
        pg = await b.new_page(viewport={"width": w, "height": 600})
        pg.on("console", lambda m: print("console", m.type, m.text) if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: print("pageerror", e))
        src = open(os.path.join(PROJ, "components", comp, "preview.html"), encoding="utf-8").read()
        inject = (f'<link rel="stylesheet" href="file://{PROJ}/tokens.css"><link rel="stylesheet" href="file://{PROJ}/components/bundle.css"><script src="file://{PROJ}/components/bundle.js"></script>')
        doc = re.sub(r"<html([^>]*)>", lambda m: f'<html{m.group(1)} data-theme="{th}">', src, count=1).replace("<head>", "<head>" + inject, 1)
        tmp = os.path.join(PROJ, "components", comp, ".pw.html"); open(tmp, "w").write(doc)
        await pg.goto("file://" + tmp); await pg.wait_for_timeout(300)
        clip = None
        for a in acts:
            k, _, v = a.partition(":")
            if k == "focus": await pg.focus(v)
            elif k == "key": await pg.keyboard.press(v)
            elif k == "hover": await pg.hover(v)
            elif k == "click": await pg.click(v)
            elif k == "js": print("js ->", await pg.evaluate(v))
            elif k == "clip": clip = v
            await pg.wait_for_timeout(120)
        if clip:
            await pg.locator(clip).first.screenshot(path=out)
        else:
            await pg.screenshot(path=out, full_page=True)
        os.remove(tmp); await b.close()
asyncio.run(main())
