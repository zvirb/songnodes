import { test, expect } from '@playwright/test';

test.describe('Tidal Credentials Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:3006');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should persist Tidal credentials across page reloads', async ({ page }) => {
    console.log('🧪 Test: Tidal credentials should persist across page reloads');

    // Navigate to the app
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');

    // Open Settings panel
    console.log('📝 Step 1: Opening Settings panel...');
    const settingsButton = page.locator('button[title="Settings"], button[aria-label="Settings"]');
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Verify Settings panel is open
    await expect(page.locator('text=Music Service Settings')).toBeVisible();
    console.log('✅ Settings panel opened');

    // Enter Tidal credentials
    console.log('📝 Step 2: Entering Tidal credentials...');
    const clientIdInput = page.locator('input[placeholder*="Client ID"]').first();
    const clientSecretInput = page.locator('input[placeholder*="Client Secret"]').first();

    await clientIdInput.fill('test-client-id-12345');
    await clientSecretInput.fill('test-client-secret-67890');
    console.log('✅ Credentials entered');

    // Save credentials
    console.log('📝 Step 3: Saving credentials...');
    const saveButton = page.locator('button:has-text("Save Settings")');
    await saveButton.click();

    // Wait for save confirmation
    await expect(page.locator('text=Saved').or(page.locator('text=✓ Saved'))).toBeVisible({ timeout: 3000 });
    console.log('✅ Credentials saved');

    // Verify credentials are in localStorage
    const storedCreds = await page.evaluate(() => {
      const store = localStorage.getItem('songnodes-store');
      if (!store) return null;
      const parsed = JSON.parse(store);
      return parsed?.state?.musicCredentials?.tidal;
    });

    console.log('📊 Stored credentials:', storedCreds);
    expect(storedCreds).toBeTruthy();
    expect(storedCreds.clientId).toBe('test-client-id-12345');
    expect(storedCreds.clientSecret).toBe('test-client-secret-67890');

    // Close settings
    const closeButton = page.locator('button:has-text("Cancel")');
    await closeButton.click();
    await page.waitForTimeout(500);

    // Reload the page
    console.log('📝 Step 4: Reloading page to test persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    console.log('✅ Page reloaded');

    // Open Settings again
    console.log('📝 Step 5: Opening Settings again...');
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Verify credentials are still there
    console.log('📝 Step 6: Verifying credentials persisted...');
    const persistedClientId = await clientIdInput.inputValue();
    const persistedClientSecret = await clientSecretInput.inputValue();

    console.log('📊 Persisted values:', {
      clientId: persistedClientId,
      clientSecret: persistedClientSecret
    });

    expect(persistedClientId).toBe('test-client-id-12345');
    expect(persistedClientSecret).toBe('test-client-secret-67890');
    console.log('✅ Credentials successfully persisted!');
  });

  test('should migrate legacy OAuth tokens to Zustand', async ({ page }) => {
    console.log('🧪 Test: Legacy OAuth tokens should be migrated to Zustand');

    // Navigate to the app
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');

    // Inject legacy tokens into localStorage
    console.log('📝 Step 1: Injecting legacy OAuth tokens...');
    await page.evaluate(() => {
      const legacyTokens = {
        access_token: 'legacy-access-token-abc123',
        refresh_token: 'legacy-refresh-token-xyz789',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'collection.read playlists.read'
      };
      localStorage.setItem('tidal_oauth_tokens', JSON.stringify(legacyTokens));
    });
    console.log('✅ Legacy tokens injected');

    // Reload the page to trigger migration
    console.log('📝 Step 2: Reloading page to trigger migration...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for migration to complete
    await page.waitForTimeout(1000);

    // Verify tokens were migrated to Zustand
    console.log('📝 Step 3: Verifying tokens migrated to Zustand...');
    const migratedTokens = await page.evaluate(() => {
      const store = localStorage.getItem('songnodes-store');
      if (!store) return null;
      const parsed = JSON.parse(store);
      return parsed?.state?.musicCredentials?.tidal;
    });

    console.log('📊 Migrated tokens:', migratedTokens);
    expect(migratedTokens).toBeTruthy();
    expect(migratedTokens.accessToken).toBe('legacy-access-token-abc123');
    expect(migratedTokens.refreshToken).toBe('legacy-refresh-token-xyz789');
    expect(migratedTokens.isConnected).toBe(true);
    console.log('✅ Tokens successfully migrated!');

    // Verify legacy storage was cleaned up
    console.log('📝 Step 4: Verifying legacy storage cleaned up...');
    const legacyTokensRemaining = await page.evaluate(() => {
      return localStorage.getItem('tidal_oauth_tokens');
    });

    expect(legacyTokensRemaining).toBeNull();
    console.log('✅ Legacy storage cleaned up!');
  });

  test('should show connection status when tokens exist', async ({ page }) => {
    console.log('🧪 Test: Should show connection status when tokens exist');

    // Navigate to the app
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');

    // Inject credentials with connection status
    await page.evaluate(() => {
      const store = localStorage.getItem('songnodes-store');
      const parsed = store ? JSON.parse(store) : { state: {}, version: 6 };

      if (!parsed.state.musicCredentials) {
        parsed.state.musicCredentials = {};
      }

      parsed.state.musicCredentials.tidal = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        isConnected: true,
        lastValidated: Date.now()
      };

      localStorage.setItem('songnodes-store', JSON.stringify(parsed));
    });

    // Reload to pick up the credentials
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open Settings
    console.log('📝 Opening Settings panel...');
    const settingsButton = page.locator('button[title="Settings"], button[aria-label="Settings"]');
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Verify connection status is shown
    console.log('📝 Verifying connection status...');
    const connectedStatus = page.locator('text=Connected to Tidal').or(page.locator('text=✅ Connected'));
    await expect(connectedStatus).toBeVisible({ timeout: 2000 });
    console.log('✅ Connection status displayed correctly!');
  });

  test('should clear credentials when Clear All is clicked', async ({ page }) => {
    console.log('🧪 Test: Should clear credentials when Clear All is clicked');

    // Navigate and inject credentials
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const store = localStorage.getItem('songnodes-store');
      const parsed = store ? JSON.parse(store) : { state: {}, version: 6 };

      if (!parsed.state.musicCredentials) {
        parsed.state.musicCredentials = {};
      }

      parsed.state.musicCredentials.tidal = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      };

      localStorage.setItem('songnodes-store', JSON.stringify(parsed));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open Settings
    const settingsButton = page.locator('button[title="Settings"], button[aria-label="Settings"]');
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Verify credentials are there
    const clientIdInput = page.locator('input[placeholder*="Client ID"]').first();
    const initialValue = await clientIdInput.inputValue();
    expect(initialValue).toBe('test-client-id');
    console.log('✅ Initial credentials verified');

    // Click Clear All (handle confirm dialog)
    console.log('📝 Clicking Clear All...');
    page.on('dialog', dialog => dialog.accept());
    const clearButton = page.locator('button:has-text("Clear All")');
    await clearButton.click();
    await page.waitForTimeout(500);

    // Verify credentials are cleared in the UI
    console.log('📝 Verifying credentials cleared...');
    const clearedValue = await clientIdInput.inputValue();
    expect(clearedValue).toBe('');
    console.log('✅ Credentials cleared from UI!');

    // Verify credentials are cleared in localStorage
    const storedCreds = await page.evaluate(() => {
      const store = localStorage.getItem('songnodes-store');
      if (!store) return null;
      const parsed = JSON.parse(store);
      return parsed?.state?.musicCredentials?.tidal;
    });

    expect(storedCreds).toBeUndefined();
    console.log('✅ Credentials cleared from storage!');
  });
});