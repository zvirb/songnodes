import { test, expect } from '@playwright/test';

test.describe('Debug Persistence', () => {
  test('debug localStorage structure', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check initial localStorage
    const initialStorage = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const data: Record<string, any> = {};
      keys.forEach(key => {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      });
      return data;
    });

    console.log('📊 Initial localStorage:', JSON.stringify(initialStorage, null, 2));

    // Inject test data directly into Zustand store
    await page.evaluate(() => {
      const testData = {
        state: {
          musicCredentials: {
            tidal: {
              clientId: 'debug-client-id',
              clientSecret: 'debug-client-secret'
            }
          },
          viewState: {
            selectedNodes: [],
            hoveredNode: null
          },
          panelState: {},
          searchFilters: {},
          savedSetlists: [],
          pathfindingState: {
            selectedWaypoints: []
          }
        },
        version: 6
      };

      localStorage.setItem('songnodes-store', JSON.stringify(testData));
      console.log('✅ Test data injected');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if data persisted
    const afterReload = await page.evaluate(() => {
      const store = localStorage.getItem('songnodes-store');
      return store ? JSON.parse(store) : null;
    });

    console.log('📊 After reload:', JSON.stringify(afterReload, null, 2));

    // Verify the structure
    expect(afterReload).toBeTruthy();
    expect(afterReload.state).toBeTruthy();
    expect(afterReload.state.musicCredentials).toBeTruthy();
    expect(afterReload.state.musicCredentials.tidal).toBeTruthy();
    expect(afterReload.state.musicCredentials.tidal.clientId).toBe('debug-client-id');

    console.log('✅ Basic persistence working!');
  });
});