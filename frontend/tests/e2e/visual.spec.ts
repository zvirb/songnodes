import { fileURLToPath } from 'url';
import { test, expect, openRoute } from './fixtures';

const stylePath = fileURLToPath(new URL('./visual.css', import.meta.url));

/**
 * Visual baselines (docs/sdlc/SDLC.md gate V3) in dark and light, at desktop and
 * phone width. Baselines come only from the Linux Playwright image (scripts/e2e-docker.sh);
 * this spec runs in the chromium project only. Relative times and build stamps are hidden
 * by visual.css (masks would paint over the open NavDrawer).
 * The crate is taller than SwiftShader's 8192px maximum texture, where a full-page
 * capture wraps, so the library is captured at viewport height.
 */
const PAGES: [string, string, boolean][] = [
  ['home', '/', true],
  ['library', '/library', false],
  ['sets', '/sets', true],
  ['settings', '/settings', true],
  ['planned-module', '/pipeline', true],
  ['not-found', '/no-such-page', true],
];
const WIDTHS: [string, number, number][] = [['desktop', 1440, 900], ['phone', 390, 844]];

for (const theme of ['dark', 'light'] as const) {
  for (const [wName, width, height] of WIDTHS) {
    for (const [name, route, fullPage] of PAGES) {
      test(`${name} ${theme} ${wName}`, async ({ page }) => {
        await page.addInitScript((t) => {
          try { localStorage.setItem('sn-theme', t); } catch { /* storage blocked */ }
        }, theme);
        await page.setViewportSize({ width, height });
        await openRoute(page, route);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${name}-${theme}-${wName}.png`, {
          fullPage,
          animations: 'disabled',
          caret: 'hide',
          stylePath,
        });
      });
    }

    test(`nav drawer ${theme} ${wName}`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('sn-theme', t); } catch { /* storage blocked */ }
      }, theme);
      await page.setViewportSize({ width, height });
      await openRoute(page, '/');
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('dialog', { name: 'Site navigation' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`nav-drawer-${theme}-${wName}.png`, {
        animations: 'disabled',
        caret: 'hide',
        stylePath,
      });
    });
  }
}
