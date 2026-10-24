import { readFileSync } from 'fs';
import { test, expect, openRoute } from './fixtures';

/** Library (Melbourne crate) against the checked-in public/data/music-library.json. */
const library = JSON.parse(readFileSync(new URL('../../public/data/music-library.json', import.meta.url), 'utf-8'));
const TOTAL: number = library.tracks.length;
const sample = library.tracks.find((t: { a: string; t: string }) => t.a && t.t);

test.beforeEach(async ({ page }) => {
  await openRoute(page, '/library');
  await expect(page.locator('.sn-data-table__count')).toContainText(`of ${TOTAL} tracks`);
});

test('the crate lists every track in the library file', async ({ page }) => {
  const tiles = page.getByRole('list', { name: 'Library at a glance' });
  await expect(tiles.getByRole('listitem').first()).toContainText(String(TOTAL));
  await expect(page.locator('.sn-data-table__count')).toHaveText(new RegExp(`^${TOTAL} of ${TOTAL} tracks · showing \\d+$`));
  await expect(page.locator('table.sn-table tbody tr').first()).toBeVisible();
});

test('search narrows the crate and clearing it restores every track', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search tracks' });
  await search.fill(sample.t);
  await expect(page.locator('.sn-data-table__count')).not.toContainText(`${TOTAL} of ${TOTAL}`);
  await expect(page.locator('table.sn-table tbody')).toContainText(sample.t);

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('.sn-data-table__count')).toContainText(`${TOTAL} of ${TOTAL}`);
});

test('a search with no match shows the empty state', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search tracks' }).fill('zzzz no such track zzzz');
  await expect(page.getByText('No tracks match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.sn-data-table__count')).toContainText(`${TOTAL} of ${TOTAL}`);
});

test('missing key and BPM show as an en dash, never N/A or Unknown', async ({ page }) => {
  const body = page.locator('table.sn-table tbody');
  await expect(body).not.toContainText(/N\/A|Unknown/);
  if (library.tracks.some((t: { k: string | null }) => !t.k)) {
    await expect(body.locator('.sn-none').first()).toHaveText('–');
  }
});

test('sorting by a column marks the header', async ({ page }) => {
  const header = page.locator('th[data-sortable]').first();
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', /ascending|descending/);
});

test('Build set from crate opens the set builder with the crate as the pool', async ({ page }) => {
  await page.getByRole('button', { name: 'Build set from crate' }).click();
  await expect(page).toHaveURL(/\/sets\?.*pool=crate/);
  await expect(page.locator('main#main')).toBeVisible();
});
