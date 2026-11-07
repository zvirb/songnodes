// Diagram checks: node build/check_diagrams.mjs <dir-of-standalone-svgs> [printedWidthWide=1032] [printedWidthPortrait=703]
// Loads each SVG in Chromium and measures every <text> with getBBox():
//  - overflow: text inside .sn-diagram__node must sit inside that node's rect.sn-diagram__box,
//              text inside .sn-diagram__badge / .sn-diagram__mark inside its box; any text outside the viewBox
//  - collisions: two text boxes that overlap (text-to-text)
//  - min_px_at_print: smallest computed font size x printed scale (width 1032 when the viewBox is landscape, else 703;
//                     height-bound when the drawing is taller than the page aspect allows)
// Prints JSON {file: {overflow:[], collisions:[], min_px_at_print, texts}} and exits 1 on any overflow or collision.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(process.cwd() + '/');
let pw;
try { pw = require('playwright'); } catch (e) { pw = createRequire(import.meta.url)('playwright'); }
const { chromium } = pw;

(async () => {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: check_diagrams.mjs <dir>'); process.exit(2); }
  const PW = Number(process.argv[3] || 1032), PP = Number(process.argv[4] || 703);
  // orientation from the figure registry (figures.json "wide"), not from the drawing's aspect ratio
  let WIDE = {};
  try { for (const f of JSON.parse(fs.readFileSync(dir + '/figures.json', 'utf8'))) if (f.file) WIDE[f.file] = !!f.wide; } catch (e) { /* no registry: fall back to aspect */ }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const out = {};
  let bad = false;
  for (const f of files) {
    const svg = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^<\?xml[^>]*>\s*/, '');
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const r = await page.evaluate(({ PW, PP, W }) => {
      const root = document.querySelector('svg');
      const vb = root.viewBox.baseVal;
      const wide = W === null ? vb.width >= vb.height : W;
      const pw = wide ? PW : PP, aspect = wide ? 0.55 : 1.3;   // print-wide-h / print-wide-w (150 mm / 273 mm)
      const scale = Math.min(pw / vb.width, (pw * aspect) / vb.height);
      const res = { overflow: [], collisions: [], min_px_at_print: null, texts: 0, viewbox: [vb.width, vb.height] };
      const boxes = [];
      let minFs = Infinity;
      const tol = 0.75;
      // Box in root user units, through the element's own transform (rotated axis labels included).
      const rootInv = root.getScreenCTM().inverse();
      const bb = el => {
        const b = el.getBBox(), m = rootInv.multiply(el.getScreenCTM());
        const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      };
      const inside = (a, c) => a.x >= c.x - tol && a.y >= c.y - tol && a.x + a.w <= c.x + c.w + tol && a.y + a.h <= c.y + c.h + tol;
      for (const t of root.querySelectorAll('text')) {
        if (!t.textContent.trim()) continue;
        res.texts++;
        const fs_ = parseFloat(getComputedStyle(t).fontSize);
        if (fs_ < minFs) minFs = fs_;
        const b = bb(t);
        const label = t.textContent.slice(0, 60);
        boxes.push({ b, label, el: t });
        if (!inside(b, { x: vb.x, y: vb.y, w: vb.width, h: vb.height })) res.overflow.push({ text: label, where: 'viewBox', box: b });
        const holder = t.closest('.sn-diagram__badge, .sn-diagram__mark, .sn-diagram__node');
        if (!holder) continue;
        let rect = null;
        if (holder.classList.contains('sn-diagram__node')) rect = holder.querySelector(':scope > rect.sn-diagram__box');
        else rect = holder.querySelector(':scope > rect.sn-diagram__badge-box, :scope > rect.sn-diagram__mark-box');
        if (!rect) { res.overflow.push({ text: label, where: 'no box in ' + holder.getAttribute('class') }); continue; }
        const rb = bb(rect);
        if (!inside(b, rb)) res.overflow.push({ text: label, where: holder.getAttribute('data-node') || holder.getAttribute('class'), box: b, rect: rb });
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].b, c = boxes[j].b;
          // line boxes of stacked lines touch; require a real overlap of at least 1.5 units both ways
          const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
          const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
          if (ox > 1.5 && oy > 3) res.collisions.push([boxes[i].label, boxes[j].label]);
        }
      }
      res.min_px_at_print = Math.round(minFs * scale * 100) / 100;
      return res;
    }, { PW, PP, W: f in WIDE ? WIDE[f] : null });
    out[f] = r;
    if (r.overflow.length || r.collisions.length || r.min_px_at_print < 9.5) bad = true;
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  process.exit(bad ? 1 : 0);
})();
