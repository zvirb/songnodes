import { test, expect, openRoute } from './fixtures';

/** AppHeader and NavDrawer (design-system 10-navigation): the drawer is the only site navigation. */

const DRAWER_ROWS: [string, RegExp][] = [
  ['Home', /\/$/],
  ['Set builder', /\/sets$/],
  ['Pathfinder', /\/paths$/],
  ['Graph', /\/graph/],
  ['Library', /\/library/],
  ['Key & mood', /\/harmony$/],
  ['Sources', /\/sources\/targets$/],
  ['Pipeline', /\/pipeline$/],
  ['Services', /\/settings$/],
  ['Preferences', /\/settings#display$/],
];

test('the drawer opens from the header and closes with Escape, returning focus', async ({ page }) => {
  await openRoute(page, '/');
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Site navigation' });
  await expect(drawer).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  // Focus starts on the current page's row
  await expect(drawer.getByRole('link', { name: 'Home' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
});

test('the close button and the scrim close the drawer', async ({ page }) => {
  await openRoute(page, '/');
  const drawer = page.getByRole('dialog', { name: 'Site navigation' });

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await drawer.getByRole('button', { name: 'Close navigation' }).click();
  await expect(drawer).toBeHidden();

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(drawer).toBeVisible();
  await page.mouse.click(page.viewportSize()!.width - 10, page.viewportSize()!.height / 2);
  await expect(drawer).toBeHidden();
});

test('every drawer row navigates and is then marked current', async ({ page }) => {
  await openRoute(page, '/');
  for (const [label, url] of DRAWER_ROWS) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Site navigation' });
    await drawer.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.locator('main#main')).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Open navigation' }).click();
    // Preferences is a section of the Services settings page, so Services is the current row there
    const current = label === 'Preferences' ? 'Services' : label;
    await expect(drawer.getByRole('link', { name: current, exact: true })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
  }
});

test('Back and Forward move between pages', async ({ page }) => {
  await openRoute(page, '/');
  await openRoute(page, '/library');
  await openRoute(page, '/settings');

  await page.goBack();
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Melbourne crate');

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/library/);
});

test('the header search and Ctrl+K go to the library search field', async ({ page }) => {
  await openRoute(page, '/');
  await page.getByRole('button', { name: /Search/ }).click();
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole('searchbox', { name: 'Search tracks' })).toBeFocused();

  await openRoute(page, '/settings');
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole('searchbox', { name: 'Search tracks' })).toBeFocused();
});

test('the skip link moves focus to the main content', async ({ page }) => {
  await openRoute(page, '/library');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test('the header title and document title follow the page', async ({ page }) => {
  await openRoute(page, '/library');
  await expect(page.locator('.sn-app-header__title')).toHaveText('Library: Melbourne crate');
  await expect(page).toHaveTitle('Melbourne crate · Library · SongNodes');

  await openRoute(page, '/');
  await expect(page).toHaveTitle('SongNodes');
});
