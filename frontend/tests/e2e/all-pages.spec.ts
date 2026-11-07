import { readFileSync, readdirSync, existsSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, openRoute } from './fixtures';
import { useLibraryFixture } from './libraryApi';

// Discover route declarations so newly registered pages cannot silently escape this audit.
const src = new URL('../../src/', import.meta.url);
const features = new URL('features/', src);
const sources = [new URL('App.tsx', src), new URL('routes/registry.tsx', src),
  ...readdirSync(features, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => new URL(`${entry.name}/route.tsx`, features)).filter(existsSync)];
const paths = new Set(sources.flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/\bpath\s*(?::|=)\s*['"]([^'"]+)['"]/g)].map((match) => match[1])));
const library = JSON.parse(readFileSync(new URL('data/library.fixture.json', import.meta.url), 'utf8'));
const routes = [...paths].map((path) => path === '*' ? '/__audit_not_found__' : path
  .replace(':settingId', 'theme').replace(':service', 'reddit')
  .replace(':id', encodeURIComponent(library.tracks[0].id)));

async function prepare(page: Page, theme: string) {
  await page.addInitScript((value) => localStorage.setItem('sn-theme', value), theme);
  await useLibraryFixture(page);
  // Explicit anonymous-session fixture; no real account or provider credentials are used.
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false, user: null }),
  }));
}

async function audit(page: Page, route: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRoute(page, route);
  const main = page.locator('main#main');
  await expect(main).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(await main.locator('.sn-btn--primary:visible').count()).toBeLessThanOrEqual(1);
  await expect(main).not.toContainText(/\bN\/A\b|\bUnknown\b/);
  expect(await page.evaluate(() => (window as unknown as { SongNodes: { version: string } }).SongNodes.version)).toBe('1.10.0');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
    .map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

for (const theme of ['dark', 'light', 'booth']) {
  for (const route of routes) {
    test(`${route} complies in ${theme}`, async ({ page }) => {
      await prepare(page, theme);
      if (route.startsWith('/callback/') || route === '/oauth/callback') {
        // Keep the callback's explicit missing-parameters state visible during inspection.
        await page.clock.install({ time: new Date('2026-11-07T00:00:00Z') });
        await page.clock.pauseAt(new Date('2026-11-07T00:00:01Z'));
      }
      await audit(page, route);
    });
  }
  test(`every offered settings page complies in ${theme}`, async ({ page }) => {
    test.setTimeout(180000);
    await prepare(page, theme);
    await openRoute(page, '/settings');
    const links = await page.locator('main a[href^="/settings/"]').evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => node.getAttribute('href')!))]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) await audit(page, link);
  });
}
