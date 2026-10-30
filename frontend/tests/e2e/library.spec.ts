import { readFileSync } from 'fs';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, openRoute } from './fixtures';

/** Library (Melbourne crate) against the checked-in frontend/tests/e2e/data/library.fixture.json. */
const library = JSON.parse(readFileSync(new URL('./data/library.fixture.json', import.meta.url), 'utf-8'));
const TOTAL: number = library.tracks.length;
const sample = library.tracks.find((t: { a: string; t: string }) => t.a && t.t);

test.beforeEach(async ({ page, withLibraryApi }) => {
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
  const search = page.getByRole('combobox', { name: 'Search tracks' });
  await search.fill(sample.t);
  await expect(page.locator('.sn-data-table__count')).not.toContainText(`${TOTAL} of ${TOTAL}`);
  await expect(page.locator('table.sn-table tbody')).toContainText(sample.t);

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('.sn-data-table__count')).toContainText(`${TOTAL} of ${TOTAL}`);
});

test('a search with no match shows the empty state', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Search tracks' }).fill('zzzz no such track zzzz');
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
  // The set builder reads ?pool=crate and then clears the query (replace), so assert the result
  await expect(page).toHaveURL(/\/sets(\?|$)/);
  await expect(page.getByRole('combobox', { name: 'Pool' })).toHaveValue('crate');
});

/**
 * AX2: the row icon buttons meet WCAG 2.5.8 target size (24 × 24 CSS px; the design system draws them at
 * control-sm, 32px) and name their track. The accessibility spec opens /library without the fixture, so on a
 * fresh database it sees no rows; this checks the rows themselves in both themes.
 */
for (const theme of ['dark', 'light'] as const) {
  test(`row icon buttons meet the target size and name their track in ${theme}`, async ({ page }) => {
    await page.evaluate((t) => { try { localStorage.setItem('sn-theme', t); } catch { /* storage blocked */ } }, theme);
    await openRoute(page, '/library');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    const row = page.locator('table.sn-table tbody tr[data-id]').first();
    const id = await row.getAttribute('data-id');
    const track = library.tracks.find((t: { id: string }) => t.id === id);
    await expect(row.getByRole('button', { name: `Add ${track.a} – ${track.t} to set`, exact: true })).toBeVisible();
    const labels = await page.locator('.sn-data-table__actions button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).toMatch(/^(Add|Retry adding) .+ – .+ to (target tracks|set)$/);

    const results = await new AxeBuilder({ page }).include('table.sn-table tbody').withRules(['target-size']).analyze();
    expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual([]);
    expect(results.passes.flatMap((v) => v.nodes).length).toBeGreaterThan(0);
  });
}
