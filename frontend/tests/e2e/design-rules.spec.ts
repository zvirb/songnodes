import { test, expect, openRoute, SHELL_ROUTES } from './fixtures';

/**
 * Design-system rules that hold on every page (docs/sdlc/SDLC.md gate V3,
 * CLAUDE.md §4): at most one primary button per view, no horizontal scroll at
 * phone width, no "N/A"/"Unknown" placeholders, and en-AU on the document.
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
