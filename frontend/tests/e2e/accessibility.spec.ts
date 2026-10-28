import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { test, expect, openRoute, SHELL_ROUTES } from './fixtures';

/** docs/sdlc/SDLC.md gate V2: axe reports no serious or critical violations (WCAG 2.2 AA). */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Approved exceptions (docs/design-system/EXCEPTIONS.md). Each one removes only the
 * named rule on the named element; any other node or rule still fails the test.
 */
const EXCEPTIONS: { id: string; rule: string; matches: (html: string) => boolean }[] = [
  // EX-001 and EX-002 were closed in design system 1.2.0 (fixed); none are open.
];

function blocking(violations: Result[]): string[] {
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => !EXCEPTIONS.some((e) => e.rule === v.id && e.matches(n.html))),
    }))
    .filter((v) => v.nodes.length > 0)
    .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')})`);
}

for (const theme of ['dark', 'light'] as const) {
  for (const route of SHELL_ROUTES) {
    test(`${route} in ${theme} has no serious or critical axe violations`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('sn-theme', t); } catch { /* storage blocked */ }
      }, theme);
      await openRoute(page, route);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(blocking(results.violations)).toEqual([]);
    });
  }
}

test('the open NavDrawer has no serious or critical axe violations', async ({ page }) => {
  await openRoute(page, '/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Site navigation' })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('#sn-nav').withTags(TAGS).analyze();
  expect(blocking(results.violations)).toEqual([]);
});

test('the fixes that closed EX-001 and EX-002 stay in place', async ({ page }) => {
  await openRoute(page, '/');
  // EX-002: each launcher card's link is its title, so the accessible name is the visible text.
  const links = page.locator('.sn-launcher-card .sn-launcher-card__link');
  expect(await links.count()).toBeGreaterThan(0);
  const first = links.first();
  await expect(first).toHaveAccessibleName((await first.innerText()).replace(/\s+/g, ' ').trim());
  // EX-001: the wordmark is present and checked by axe like any other text (no exception).
  await expect(page.locator('.sn-app-header__wordmark')).toHaveCount(1);
});
