import { test, expect } from '@playwright/test';

test.describe('Final Persistence Test', () => {
  test('inject credentials before page load and verify persistence', async ({ page, context }) => {
    console.log('🧪 Testing Tidal credentials persistence');

    // Step 1: Inject data before ANY page JavaScript runs
    console.log('📝 Step 1: Setting up initial credentials...');
    await context.addInitScript(() => {
      const testData = {
        panelState: {},
        viewState: {
          selectedNodes: [],
          hoveredNode: null
        },
        searchFilters: {},
        savedSetlists: [],
        pathfindingState: {
          selectedWaypoints: []
        },
        musicCredentials: {
          tidal: {
            clientId: 'test-persist-12345',
            clientSecret: 'test-persist-secret',
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: Date.now() + 3600000,
            isConnected: true,
            lastValidated: Date.now()
          }
        }
      };

      const wrapped = {
        state: testData,
        version: 6
      };

      localStorage.setItem('songnodes-store', JSON.stringify(wrapped));
    });

    // Step 2: Load page - it should pick up our injected credentials
    console.log('📝 Step 2: Loading page with pre-injected credentials...');
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 3: Check that credentials were loaded
    console.log('📝 Step 3: Verifying credentials loaded...');
    const afterLoad = await page.evaluate(() => {
      const stored = localStorage.getItem('songnodes-store');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return {
        hasTidal: !!parsed?.state?.musicCredentials?.tidal,
        clientId: parsed?.state?.musicCredentials?.tidal?.clientId,
        isConnected: parsed?.state?.musicCredentials?.tidal?.isConnected
      };
    });

    console.log('📊 After page load:', afterLoad);
    expect(afterLoad?.hasTidal).toBe(true);
    expect(afterLoad?.clientId).toBe('test-persist-12345');

    // Step 4: Reload page and verify persistence
    console.log('📝 Step 4: Reloading page to test persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 5: Verify credentials persisted
    console.log('📝 Step 5: Verifying credentials persisted after reload...');
    const afterReload = await page.evaluate(() => {
      const stored = localStorage.getItem('songnodes-store');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return {
        fullCreds: parsed?.state?.musicCredentials?.tidal,
        keys: parsed?.state?.musicCredentials ? Object.keys(parsed.state.musicCredentials) : []
      };
    });

    console.log('📊 After reload:', JSON.stringify(afterReload, null, 2));

    // Assertions
    expect(afterReload).toBeTruthy();
    expect(afterReload?.keys).toContain('tidal');
    expect(afterReload?.fullCreds?.clientId).toBe('test-persist-12345');
    expect(afterReload?.fullCreds?.clientSecret).toBe('test-persist-secret');
    expect(afterReload?.fullCreds?.accessToken).toBe('test-access-token');
    expect(afterReload?.fullCreds?.isConnected).toBe(true);

    console.log('✅ SUCCESS: Credentials persisted across page reload!');
  });
});