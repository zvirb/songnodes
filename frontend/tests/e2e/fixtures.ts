import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared test: every test fails if the page logs a console error or throws an
 * uncaught error (CLAUDE.md §4: zero console errors). Nothing is filtered out.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()} (${msg.location().url})`);
      });
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      await use(errors);
      expect(errors, 'console errors and uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Routes in the shell, as listed in the NavDrawer (plus Home). */
export const SHELL_ROUTES = ['/', '/graph', '/library', '/sets', '/paths', '/harmony', '/sources/targets', '/pipeline', '/settings'];

/** Open a route and wait until its page has rendered and its requests have settled. */
export async function openRoute(page: Page, route: string) {
  const response = await page.goto(route);
  expect(response?.status(), `HTTP status of ${route}`).toBe(200);
  await expect(page.locator('main#main')).toBeVisible();
  await expect(page.locator('main#main[aria-busy="true"]')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
}
