import { test, expect, openRoute, SHELL_ROUTES } from './fixtures';

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
