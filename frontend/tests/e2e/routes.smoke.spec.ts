import { test, expect, openRoute } from './fixtures';

/**
 * Every route in the shell loads and renders its main landmark. The shared fixture
 * fails the test on any console error or uncaught page error.
 */
const ROUTES = ['/', '/library', '/sets', '/settings', '/sources', '/graph', '/paths', '/harmony', '/pipeline'];

for (const route of ROUTES) {
  test(`route ${route} loads without console errors`, async ({ page }) => {
    await openRoute(page, route);
  });
}

test('/harmony opens the Camelot explorer', async ({ page }) => {
  await openRoute(page, '/harmony');
  await expect(page.getByRole('heading', { name: 'Harmonic Modulation Explorer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Camelot Wheel' })).toBeVisible();
});

test('/pipeline opens the telemetry dashboard', async ({ page }) => {
  await openRoute(page, '/pipeline');
  await expect(page.getByRole('heading', { name: 'Pipeline Telemetry' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Global Pipeline Health' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Medallion Pipeline Flow' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Scrapers' })).toHaveCount(0);
});

test('/sources redirects to target tracks', async ({ page }) => {
  await openRoute(page, '/sources');
  await expect(page).toHaveURL(/\/sources\/targets$/);
});

test('an unknown route shows the not-found page without console errors', async ({ page }) => {
  await openRoute(page, '/no-such-page');
  await expect(page.getByRole('heading', { name: 'There is no page here' })).toBeVisible();
  await expect(page.locator('main#main')).toContainText('/no-such-page');
  await page.getByRole('link', { name: 'Go to Home' }).click();
  await expect(page).toHaveURL(/\/$/);
});
