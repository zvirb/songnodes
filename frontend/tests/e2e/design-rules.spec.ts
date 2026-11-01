import { test, expect, openRoute, SHELL_ROUTES } from './fixtures';
import { type ChainElement, type Rect, formatFinding, tightTextInset } from '../../src/lib/textInset';

/**
 * Design-system rules that hold on every page (docs/sdlc/SDLC.md gate V3,
 * CLAUDE.md §4): at most one primary button per view, no horizontal scroll at
 * phone width, no "N/A"/"Unknown" placeholders, en-AU on the document, and a
 * page gutter (design-system/13-page-patterns.md, Page container).
 */

for (const route of SHELL_ROUTES) {
  test.describe(route, () => {
    test('has at most one primary button', async ({ page }) => {
      await openRoute(page, route);
      const primaries = page.locator('main#main .sn-btn--primary:visible');
      expect(await primaries.count()).toBeLessThanOrEqual(1);
    });

    test('has no horizontal scroll at 390px', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openRoute(page, route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('has no N/A or Unknown placeholders and declares en-AU', async ({ page }) => {
      await openRoute(page, route);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-AU');
      await expect(page.locator('main#main')).not.toContainText(/\bN\/A\b|\bUnknown\b/);
    });

    test('survives text size XL without horizontal scroll', async ({ page }) => {
      await page.addInitScript(() => {
        try { localStorage.setItem('sn-text-size', 'xl'); } catch { /* storage blocked */ }
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await openRoute(page, route);
      await expect(page.locator('html')).toHaveAttribute('data-text-size', 'xl');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

/**
 * Page gutter (design-system 13-page-patterns, Page container; 05-layout gutters).
 * Static checks catch a missing sn-page__main; this checks what actually renders:
 * main has the side gutter for the width, and no visible text inside main starts
 * closer to the window edge than that gutter. The graph canvas is the only
 * full-bleed page.
 */
const GUTTER_ROUTES = [...SHELL_ROUTES.filter((r) => r !== '/graph'), '/sources/import'];
const GUTTERS: [number, number][] = [[390, 16], [1440, 32]];

for (const route of GUTTER_ROUTES) {
  for (const [width, gutter] of GUTTERS) {
    test(`${route} keeps the ${gutter}px page gutter at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openRoute(page, route);
      const result = await page.evaluate((min) => {
        const main = document.querySelector('main#main');
        if (!main) return { padding: -1, offenders: ['no main#main'] };
        const padding = parseFloat(getComputedStyle(main).paddingLeft);
        const offenders: string[] = [];
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent || !n.textContent.trim()) continue;
          const el = n.parentElement;
          if (!el || el.closest('[aria-hidden="true"], .sn-sr, [hidden]')) continue;
          // Content inside a horizontal scroller may run past the edge; that is scrolling, not a missing gutter.
          let scroller = false;
          for (let a: HTMLElement | null = el; a && a !== main; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if ((ox === 'auto' || ox === 'scroll') && a.scrollWidth > a.clientWidth) { scroller = true; break; }
          }
          if (scroller) continue;
          // Inside a panel parked off-screen (a closed drawer or sheet)
          let parked = false;
          for (let a: HTMLElement | null = el; a && a !== main; a = a.parentElement) {
            const b = a.getBoundingClientRect();
            if (b.width > 0 && (b.left >= window.innerWidth || b.right <= 0)) { parked = true; break; }
          }
          if (parked) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width === 0 || r.height === 0) continue;
            if (r.right <= 0 || r.left >= window.innerWidth) continue; // parked off-screen (closed drawer)
            // Measure only the visible part: clip by ancestors that hide their overflow (ellipsis, visually hidden).
            let left = r.left;
            let right = r.right;
            for (let a: HTMLElement | null = el; a && a !== main; a = a.parentElement) {
              const cs = getComputedStyle(a);
              if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') {
                const b = a.getBoundingClientRect();
                left = Math.max(left, b.left);
                right = Math.min(right, b.right);
              }
            }
            if (right - left < 1) continue;
            if (left < min - 0.5 || right > window.innerWidth - min + 0.5) {
              offenders.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${n.textContent.trim().slice(0, 40)}" at ${Math.round(r.left)}..${Math.round(r.right)}`);
              break;
            }
          }
          if (offenders.length >= 5) break;
        }
        return { padding, offenders };
      }, gutter);
      expect(result.padding, 'main#main side padding').toBeGreaterThanOrEqual(gutter);
      expect(result.offenders, 'text inside the page gutter').toEqual([]);
    });
  }
}

/**
 * Text inset (DR-050; design-system/05-layout.md, Text inset; 17-governance conformance row).
 * Text whose nearest box draws an inline edge (a border, a fill different from what is behind it,
 * or an inset ring) must sit at least space-2 (8px) from that box's padding edge. 4 to under 8px is
 * tight and fails here; under 4px is a separate defect this check does not judge. The browser only
 * collects rendered rects and computed styles; src/lib/textInset.ts (unit-tested) decides.
 *
 * Not measured, by design:
 * - text outside main#main (AppHeader, NavDrawer: their own cards set their insets);
 * - the value of input, select and textarea (not text nodes: TextField, SelectField, NumberField and
 *   ChipInput pad their own fields with tokens);
 * - SVG text (charts, Sparkline, EnergyWave place labels by chart geometry, not box padding);
 * - hidden or screen-reader-only text, closed or off-screen panels;
 * - boxes listed in EXCLUDED_BOX_CLASSES (src/lib/textInset.ts), each citing its card.
 */
interface InsetSample { text: string; rects: Rect[]; chain: number[]; scope: number }

const INSET_ROUTES = [...SHELL_ROUTES, '/sources/import'];
const INSET_WIDTHS = [390, 1440];

for (const route of INSET_ROUTES) {
  for (const width of INSET_WIDTHS) {
    test(`${route} keeps text at least 8px inside its box at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openRoute(page, route);
      const sample = await page.evaluate(() => {
        const main = document.querySelector('main#main');
        const elements: ChainElement[] = [];
        const index = new Map<Element, number>();
        const sides = ['top', 'right', 'bottom', 'left'];
        const four = (cs: CSSStyleDeclaration, prop: string) =>
          sides.map((s) => cs.getPropertyValue(`border-${s}-${prop}`)) as [string, string, string, string];
        const snap = (el: Element): number => {
          const known = index.get(el);
          if (known !== undefined) return known;
          const cs = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          const w = four(cs, 'width').map((v) => parseFloat(v) || 0) as [number, number, number, number];
          const classes = [...el.classList];
          elements.push({
            label: `${el.tagName.toLowerCase()}${classes.slice(0, 3).map((c) => `.${c}`).join('')}`,
            classes,
            style: {
              backgroundColor: cs.backgroundColor,
              backgroundImage: cs.backgroundImage,
              borderWidth: w,
              borderStyle: four(cs, 'style'),
              borderColor: four(cs, 'color'),
              boxShadow: cs.boxShadow,
            },
            paddingBox: { left: b.left + w[3], right: b.right - w[1], top: b.top + w[0], bottom: b.bottom - w[2] },
          });
          index.set(el, elements.length - 1);
          return elements.length - 1;
        };
        const samples: InsetSample[] = [];
        if (!main) return { elements, samples, error: 'no main#main' };
        const skip = '[aria-hidden="true"], .sn-sr, [hidden], svg, input, select, textarea, option, script, style, template';
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = n.textContent ?? '';
          if (!text.trim()) continue;
          const el = n.parentElement;
          if (!el || el.closest(skip)) continue;
          if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          const ancestors: Element[] = [];
          for (let a: Element | null = el; a; a = a.parentElement) ancestors.push(a);
          const scope = ancestors.indexOf(main);
          const inside = ancestors.slice(0, scope);
          // Inside a panel parked off-screen (a closed drawer or sheet)
          const parked = inside.some((a) => {
            const b = a.getBoundingClientRect();
            return b.width > 0 && (b.left >= window.innerWidth || b.right <= 0);
          });
          if (parked) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const rects: Rect[] = [];
          for (const r of Array.from(range.getClientRects())) {
            if (r.width === 0 || r.height === 0) continue;
            // Measure only what shows: clip by ancestors that clip their overflow. Ellipsis text is
            // drawn inside the content box, so it clips there; anything else clips at the padding edge.
            let left = r.left;
            let right = r.right;
            for (const a of inside) {
              const cs = getComputedStyle(a);
              if (cs.overflowX === 'visible') continue;
              const b = a.getBoundingClientRect();
              const ellipsis = cs.textOverflow === 'ellipsis';
              const padL = ellipsis ? parseFloat(cs.paddingLeft) || 0 : 0;
              const padR = ellipsis ? parseFloat(cs.paddingRight) || 0 : 0;
              left = Math.max(left, b.left + (parseFloat(cs.borderLeftWidth) || 0) + padL);
              right = Math.min(right, b.right - (parseFloat(cs.borderRightWidth) || 0) - padR);
            }
            if (right - left < 1) continue;
            rects.push({ left, right, top: r.top, bottom: r.bottom });
          }
          if (!rects.length) continue;
          samples.push({ text, rects, chain: ancestors.map(snap), scope });
        }
        return { elements, samples, error: '' };
      });
      expect(sample.error, 'page container').toBe('');
      // Every offender, not just the first: the failure message is the list to fix.
      const offenders = new Set<string>();
      for (const s of sample.samples) {
        const finding = tightTextInset(s.text, s.rects, s.chain.map((i) => sample.elements[i]), s.scope);
        if (finding) offenders.add(formatFinding(route, width, finding));
      }
      expect([...offenders], 'text 4 to 7px from the edge of its box (DR-050: needs 8px, space-2)').toEqual([]);
    });
  }
}
