// Gates 7 and 8: visual-conformance screenshots and the offline check.
// node browser_gates.mjs <report index.html> <reference page html> <evidence dir>
// Prints JSON: {shots, console_errors[], bad_anchors[], network[]}
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [report, reference, outDir] = process.argv.slice(2);
const widths = [["desktop", 1440, 900], ["tablet", 820, 1180], ["mobile", 390, 844]];
const themes = ["dark", "light", "booth"];
const res = { shots: 0, console_errors: [], bad_anchors: [], network: [] };

const browser = await chromium.launch();
try {
  // 8 offline: every non-file request is blocked and recorded; console errors collected
  const ctx = await browser.newContext({ offline: true });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") res.console_errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => res.console_errors.push(String(e).slice(0, 200)));
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:") || u.startsWith("data:")) return r.continue(); res.network.push(u); return r.abort(); });
  await page.goto(pathToFileURL(report).href, { waitUntil: "load" });
  await page.waitForTimeout(400);
  res.bad_anchors = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute("href").slice(1)).filter((id) => id && !document.getElementById(id)));
  // interactions smoke test: sort, filter, tab, toggle, zoom must not throw
  await page.evaluate(() => {
    const b = document.querySelector("th[data-sortable] button"); if (b) b.click();
    const c = document.querySelector(".sn-filter-chip"); if (c) { c.click(); c.click(); }
    const t = document.querySelectorAll('[role="tab"]')[1]; if (t) t.click();
    const z = document.querySelector('[data-zoom="in"]'); if (z) z.click();
    const s = document.querySelector('[data-state-toggle] [data-value="projected"]'); if (s) s.click();
    const n = document.querySelector(".sn-figure [data-node]"); if (n) { n.dispatchEvent(new Event("pointerenter")); n.dispatchEvent(new MouseEvent("click", { bubbles: true })); n.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });
  await page.waitForTimeout(200);
  await ctx.close();

  // 7 conformance: report and reference at three widths in every theme; plus greyscale report
  for (const [label, file] of [["report", report], ["reference", reference]]) {
    for (const theme of themes) {
      for (const [wname, w, h] of widths) {
        const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
        await c.addInitScript((t) => { try { localStorage.setItem("sn-theme", t); } catch (e) {} document.documentElement.setAttribute("data-theme", t); }, theme);
        const p = await c.newPage();
        await p.goto(pathToFileURL(file).href, { waitUntil: "load" });
        await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await p.waitForTimeout(250);
        await p.screenshot({ path: path.join(outDir, `${label}-${theme}-${wname}.png`) });
        res.shots++;
        await c.close();
      }
    }
  }
  const g = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const gp = await g.newPage();
  await gp.goto(pathToFileURL(report).href + "#catalogue", { waitUntil: "load" });
  await gp.addStyleTag({ content: "html{filter:grayscale(1)}" });
  await gp.screenshot({ path: path.join(outDir, "report-greyscale-figures.png"), fullPage: false });
  await g.close();
} catch (e) {
  res.error = String(e).slice(0, 500);
}
await browser.close();
console.log(JSON.stringify(res));
