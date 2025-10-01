import { test, expect } from '@playwright/test';

test.describe('UI Credentials Persistence Test', () => {
  test('enter credentials in Settings UI and verify persistence', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

    console.log('📝 Step 1: Loading application...');
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/01-initial-load.png', fullPage: true });
    console.log('📸 Screenshot: 01-initial-load.png');

    // Open Settings panel by clicking settings button
    console.log('\n📝 Step 2: Opening Settings panel...');
    const settingsButton = page.locator('button').filter({ hasText: '⚙️' }).or(
      page.locator('button[title="Settings"]')
    ).or(
      page.locator('button[aria-label="Settings"]')
    );

    await settingsButton.first().click();
    await page.waitForTimeout(1000);

    // Take screenshot of Settings panel
    await page.screenshot({ path: 'tests/screenshots/02-settings-opened.png', fullPage: true });
    console.log('📸 Screenshot: 02-settings-opened.png');

    // Verify Settings panel is visible
    const settingsPanel = page.locator('text=Music Service Settings').or(
      page.locator('text=Tidal Developer API')
    );
    await expect(settingsPanel.first()).toBeVisible({ timeout: 5000 });
    console.log('✅ Settings panel is visible');

    // Find and fill Client ID input
    console.log('\n📝 Step 3: Entering credentials...');
    const clientIdInput = page.locator('input[placeholder*="Client ID"]').first();
    await clientIdInput.waitFor({ state: 'visible', timeout: 5000 });
    await clientIdInput.clear();
    await clientIdInput.fill('playwright-test-client-id-12345');
    console.log('✅ Entered Client ID');

    // Find and fill Client Secret input
    const clientSecretInput = page.locator('input[placeholder*="Client Secret"]').first();
    await clientSecretInput.waitFor({ state: 'visible', timeout: 5000 });
    await clientSecretInput.clear();
    await clientSecretInput.fill('playwright-test-secret-67890');
    console.log('✅ Entered Client Secret');

    // Take screenshot after entering credentials
    await page.screenshot({ path: 'tests/screenshots/03-credentials-entered.png', fullPage: true });
    console.log('📸 Screenshot: 03-credentials-entered.png');

    // Click Save Settings button
    console.log('\n📝 Step 4: Clicking Save Settings...');
    const saveButton = page.locator('button:has-text("Save Settings")');
    await saveButton.click();
    await page.waitForTimeout(1500); // Wait for save operation and persist middleware

    // Take screenshot after saving
    await page.screenshot({ path: 'tests/screenshots/04-after-save.png', fullPage: true });
    console.log('📸 Screenshot: 04-after-save.png');

    // Check localStorage directly
    const afterSave = await page.evaluate(() => {
      const stored = localStorage.getItem('songnodes-store');
      if (!stored) return { error: 'localStorage is empty' };
      const parsed = JSON.parse(stored);
      return {
        hasState: !!parsed.state,
        hasMusicCreds: !!parsed.state?.musicCredentials,
        hasTidal: !!parsed.state?.musicCredentials?.tidal,
        tidalClientId: parsed.state?.musicCredentials?.tidal?.clientId,
        fullCreds: parsed.state?.musicCredentials?.tidal
      };
    });
    console.log('\n📊 After save - localStorage:', JSON.stringify(afterSave, null, 2));

    // Verify save was successful
    if (afterSave.hasTidal && afterSave.tidalClientId) {
      console.log('✅ Credentials saved to localStorage');
    } else {
      console.log('❌ Credentials NOT in localStorage!');
      console.log('localStorage content:', afterSave);
    }

    // Close Settings panel
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();
    await page.waitForTimeout(500);

    // Reload the page
    console.log('\n📝 Step 5: Reloading page to test persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for rehydration

    // Take screenshot after reload
    await page.screenshot({ path: 'tests/screenshots/05-after-reload.png', fullPage: true });
    console.log('📸 Screenshot: 05-after-reload.png');

    // Check localStorage after reload
    const afterReload = await page.evaluate(() => {
      const stored = localStorage.getItem('songnodes-store');
      if (!stored) return { error: 'localStorage is empty after reload' };
      const parsed = JSON.parse(stored);
      return {
        hasState: !!parsed.state,
        hasMusicCreds: !!parsed.state?.musicCredentials,
        hasTidal: !!parsed.state?.musicCredentials?.tidal,
        tidalClientId: parsed.state?.musicCredentials?.tidal?.clientId,
        tidalClientSecret: parsed.state?.musicCredentials?.tidal?.clientSecret
      };
    });
    console.log('\n📊 After reload - localStorage:', JSON.stringify(afterReload, null, 2));

    // Open Settings panel again
    console.log('\n📝 Step 6: Opening Settings panel again...');
    await settingsButton.first().click();
    await page.waitForTimeout(1000);

    // Take screenshot of Settings panel after reload
    await page.screenshot({ path: 'tests/screenshots/06-settings-after-reload.png', fullPage: true });
    console.log('📸 Screenshot: 06-settings-after-reload.png');

    // Check if credentials are still in the form
    console.log('\n📝 Step 7: Checking if credentials persisted in UI...');
    const persistedClientId = await clientIdInput.inputValue();
    const persistedClientSecret = await clientSecretInput.inputValue();

    console.log('📊 Form values after reload:');
    console.log('  Client ID:', persistedClientId);
    console.log('  Client Secret:', persistedClientSecret);

    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/07-final-verification.png', fullPage: true });
    console.log('📸 Screenshot: 07-final-verification.png');

    // Final assertions
    console.log('\n📝 Step 8: Running assertions...');

    // Assert localStorage preserved credentials
    expect(afterReload.hasTidal).toBe(true);
    expect(afterReload.tidalClientId).toBe('playwright-test-client-id-12345');
    console.log('✅ PASS: localStorage preserved credentials');

    // Assert UI form has credentials
    expect(persistedClientId).toBe('playwright-test-client-id-12345');
    expect(persistedClientSecret).toBe('playwright-test-secret-67890');
    console.log('✅ PASS: UI form shows persisted credentials');

    console.log('\n🎉 SUCCESS: Credentials persisted across page reload!');
    console.log('\n📁 Screenshots saved to tests/screenshots/');
  });
});

// Configure this test to run in headed mode
test.use({
  headless: false,
  video: 'retain-on-failure',
  screenshot: 'on',
  trace: 'retain-on-failure'
});