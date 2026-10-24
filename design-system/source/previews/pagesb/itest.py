import asyncio, os, re, sys
from playwright.async_api import async_playwright
PROJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ds", "project")
PROJ = os.path.abspath(PROJ)
def doc(c):
    src = open(f"{PROJ}/components/{c}/preview.html").read()
    inj = f'<link rel="stylesheet" href="file://{PROJ}/tokens.css"><link rel="stylesheet" href="file://{PROJ}/components/bundle.css"><script src="file://{PROJ}/components/bundle.js"></script>'
    src = src.replace("<html>", '<html data-theme="dark">',1).replace("<head>", "<head>"+inj,1)
    p = f"{PROJ}/components/{c}/.itest.html"; open(p,"w").write(src); return p
STEPS = {
 "LogPage": [("click", '[data-act="add"]'), ("shot",), ("key","Escape"), ("click", "#body tr input[type=checkbox]"), ("click", "#body tr:nth-child(2) input[type=checkbox]"), ("click", '[data-bulk="archived"]'), ("click", "#body tr input[type=checkbox]"), ("click",'[data-bulk="delete"]'), ("shot",), ("click","#confirm [data-confirm]"), ("click", '#body tr .sn-overflow-menu button'), ("shot",)],
 "MatrixPage": [("click", "#t-key"), ("wait",), ("shot",), ("click", "#kToggle"), ("click", '#head [data-sort="pbs"]')],
 "WeeklyGridPage": [("click", 'td[data-r="0"][data-c="5"]'), ("key","ArrowRight"), ("wait",), ("shot",)],
 "DailyViewPage": [("key","["), ("wait",), ("shot",), ("key","]")],
 "MonitoringPage": [("click", '[data-act="run"]'), ("click", "#sh-open"), ("shot",)],
}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium" if os.path.exists("/opt/pw-browsers/chromium") else None)
        for c, steps in STEPS.items():
            pg = await b.new_page(viewport={"width":1280,"height":900}); errs=[]
            pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
            await pg.goto("file://"+doc(c)); await pg.wait_for_timeout(300); n=0
            for s in steps:
                try:
                    if s[0]=="click": await pg.click(s[1], timeout=2000)
                    elif s[0]=="key": await pg.keyboard.press(s[1])
                    elif s[0]=="wait": await pg.wait_for_timeout(700)
                    elif s[0]=="shot": n+=1; await pg.screenshot(path=f"{PROJ}/../shots/it-{c}-{n}.png")
                except Exception as e: errs.append(f"step {s}: {str(e)[:120]}")
            print(c, errs or "ok"); os.remove(f"{PROJ}/components/{c}/.itest.html"); await pg.close()
        await b.close()
asyncio.run(main())
