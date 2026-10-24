import { test, expect, openRoute } from './fixtures';

/** Set builder: build from the library file, save, reopen after reload, delete through ConfirmDialog. */

test.beforeEach(async ({ page }) => {
  await openRoute(page, '/sets');
});

/** The header's primary Build set button (the empty wave has its own call to action). */
const buildSet = (page: import('@playwright/test').Page) =>
  page.locator('.sn-btn--primary').filter({ hasText: 'Build set' }).click();

test('Build set fills the running order and announces it', async ({ page }) => {
  await buildSet(page);
  await expect(page.getByText(/^Built .+: \d+ tracks/)).toBeVisible();

  const order = page.getByRole('list', { name: /^Running order/ });
  const filled = order.locator('li.sn-set-slot:not(.sn-set-slot--empty)');
  expect(await filled.count()).toBeGreaterThan(1);
});

test('a saved set is listed, survives a reload and can be deleted after confirming', async ({ page }) => {
  const aside = page.locator('aside.sn-page-sets__aside');
  await expect(aside.getByText('No saved sets yet')).toBeVisible();

  await buildSet(page);
  await page.locator('.sn-page-header__secondary', { hasText: 'Save set' }).click();
  await expect(page.getByText(/^Saved .+ · \d+ tracks/)).toBeVisible();

  const card = aside.locator('article.sn-set-card').first();
  await expect(card).toBeVisible();
  const name = (await card.locator('.sn-set-card__name').textContent())!.trim();

  await page.reload();
  await expect(aside.locator('.sn-set-card__name').first()).toHaveText(name);

  await aside.getByRole('button', { name: `Delete ${name}…` }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(`Delete “${name}”?`);
  await dialog.getByRole('button', { name: 'Delete set' }).click();

  // <q> supplies the quotation marks through CSS, so they are not in the text
  await expect(page.getByText(`Deleted ${name}. Its tracks stay in the library.`)).toBeVisible();
  await expect(aside.getByText('No saved sets yet')).toBeVisible();
});

test('cancelling the delete keeps the set', async ({ page }) => {
  await buildSet(page);
  await page.locator('.sn-page-header__secondary', { hasText: 'Save set' }).click();
  const aside = page.locator('aside.sn-page-sets__aside');
  const name = (await aside.locator('.sn-set-card__name').first().textContent())!.trim();

  await aside.getByRole('button', { name: `Delete ${name}…` }).click();
  // ConfirmDialog opens with focus on Cancel (the safe choice)
  await expect(page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(aside.locator('.sn-set-card__name').first()).toHaveText(name);

  await aside.getByRole('button', { name: `Delete ${name}…` }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(aside.locator('.sn-set-card__name').first()).toHaveText(name);
});
