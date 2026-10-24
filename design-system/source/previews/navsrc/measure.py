# prints rendered height at 960 for each component preview (dark), plus overflow
import sys, os, re, asyncio
PROJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ds", "project")
PROJ = os.path.abspath(PROJ)
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None)
        for c in sys.argv[1].split(","):
            w = int(sys.argv[2]) if len(sys.argv) > 2 else 960
            src = open(os.path.join(PROJ, "components", c, "preview.html")).read()
            inject = f'<link rel="stylesheet" href="file://{PROJ}/tokens.css"><link rel="stylesheet" href="file://{PROJ}/components/bundle.css"><script src="file://{PROJ}/components/bundle.js"></script>'
            doc = re.sub(r"<html([^>]*)>", r'<html\1 data-theme="dark">', src, count=1).replace("<head>", "<head>" + inject, 1)
            tmp = os.path.join(PROJ, "components", c, ".m.html"); open(tmp, "w").write(doc)
            pg = await b.new_page(viewport={"width": w, "height": 100})
            await pg.goto("file://" + tmp); await pg.wait_for_timeout(300)
            h = await pg.evaluate("() => document.querySelector('.sn-preview').getBoundingClientRect().height")
            os.remove(tmp); print(c, "height", round(h)); await pg.close()
        await b.close()
asyncio.run(main())
