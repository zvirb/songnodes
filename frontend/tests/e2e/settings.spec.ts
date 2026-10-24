import { test, expect, openRoute } from './fixtures';

/** Settings and the PreferencesPanel: preferences apply live and persist on this device. */

test.beforeEach(async ({ page }) => {
  await openRoute(page, '/settings');
});

test('choosing a theme applies it and survives a reload', async ({ page }) => {
  const themes = page.getByRole('radiogroup', { name: 'Theme' });
  for (const [label, value] of [['Light', 'light'], ['Booth', 'booth'], ['Dark', 'dark']]) {
    await themes.getByRole('radio', { name: label }).click();
    await expect(themes.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', value);
    await expect(page.getByRole('status').filter({ hasText: `Theme set to ${label}` })).toBeAttached();
  }

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(themes.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
});

test('text size and density apply to the document', async ({ page }) => {
  await page.getByRole('radiogroup', { name: 'Text size' }).getByRole('radio', { name: 'XL' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'xl');

  await page.getByRole('radiogroup', { name: 'Row density' }).getByRole('radio', { name: 'Compact' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
});

test('arrow keys move through a segmented control', async ({ page }) => {
  const size = page.getByRole('radiogroup', { name: 'Text size' });
  await size.getByRole('radio', { name: 'M', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await expect(size.getByRole('radio', { name: 'L', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(size.getByRole('radio', { name: 'L', exact: true })).toBeFocused();
});

test('reduce motion can be forced on', async ({ page }) => {
  await page.getByRole('radio', { name: 'Always reduce motion' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
});

test('reset restores the defaults', async ({ page }) => {
  await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Light' }).click();
  await page.getByRole('radiogroup', { name: 'Text size' }).getByRole('radio', { name: 'XL' }).click();
  await page.getByRole('button', { name: 'Reset to defaults' }).click();

  await expect(page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radiogroup', { name: 'Text size' }).getByRole('radio', { name: 'M', exact: true })).toHaveAttribute('aria-checked', 'true');
  // The default size is the absence of the attribute
  await expect(page.locator('html')).not.toHaveAttribute('data-text-size', /./);
  await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
});

test('the About section shows the design-system version and locale', async ({ page }) => {
  const about = page.locator('#about');
  await expect(about).toContainText('1.1.0');
  await expect(about).toContainText('en-AU');
  await expect(about).toContainText('Australia/Melbourne');
});
