import { test, expect, openRoute } from './fixtures';

/**
 * Graph route shell and modes. Assertions about nodes and edges wait for the
 * real-world data run (no synthetic graph data is seeded or mocked here).
 */

test('the graph route renders its toolbar and canvas panel', async ({ page }) => {
  await openRoute(page, '/graph');
  const toolbar = page.getByRole('toolbar', { name: 'Graph tools' });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Filters' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Track graph' })).toBeVisible();
  // Counts are read from the API, whatever they are
  await expect(toolbar).toContainText(/\d+ (track|tracks)/);
  await expect(toolbar).toContainText(/\d+ (connection|connections)/);
});

test('switching to Plan updates the URL and shows the Plan tools', async ({ page }) => {
  await openRoute(page, '/graph');
  await page.getByRole('toolbar', { name: 'Graph tools' }).getByRole('radio', { name: 'Plan' }).click();
  await expect(page).toHaveURL(/[?&]mode=plan/);
  await expect(page.getByRole('region', { name: 'Plan tools' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('region', { name: 'Plan tools' })).toBeHidden();
});

test('a deep link to a Plan tab opens Plan mode on that tab', async ({ page }) => {
  await openRoute(page, '/graph?tab=pathfinder');
  await expect(page.getByRole('region', { name: 'Plan tools' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Pathfinder/ })).toHaveAttribute('aria-selected', 'true');
});

test('the planned module pages link into the graph', async ({ page }) => {
  await openRoute(page, '/paths');
  await page.getByRole('link', { name: 'Open Pathfinder in Graph' }).click();
  await expect(page).toHaveURL(/\/graph\?tab=pathfinder/);
  await expect(page.getByRole('tab', { name: /Pathfinder/ })).toHaveAttribute('aria-selected', 'true');
  await page.waitForLoadState('networkidle');
});
