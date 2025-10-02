import { test, expect } from '@playwright/test';

test.describe('Simple Persistence Test', () => {
  test('manual localStorage test', async ({ page }) => {
    console.log('🧪 Starting manual localStorage persistence test');

    // Navigate to app first to set up context
    await page.goto('http://localhost:3006');

    // Inject test data BEFORE Zustand initializes by doing it immediately
    console.log('📝 Step 1: Injecting test credentials into fresh localStorage...');
    await page.evaluate(() => {
      // Clear and inject atomically before Zustand can react
      localStorage.clear();

      const testData = {
        // This is what partialize returns
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
            clientId: 'test-client-12345',
            clientSecret: 'test-secret-67890'
          }
        }
      };

      // Zustand persist v4+ stores with this structure
      const wrapped = {
        state: testData,
        version: 6
      };

      localStorage.setItem('songnodes-store', JSON.stringify(wrapped));
      console.log('✅ Test data injected');
    });

    // Now reload to pick up the injected data
    console.log('📝 Step 2: Reloading to initialize Zustand with injected data...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for Zustand rehydration

    // Alternative: inject data in a new context before page loads at all
    /*
    await page.addInitScript(() => {
      const testData = {
        // This is what partialize returns
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
            clientId: 'test-client-12345',
            clientSecret: 'test-secret-67890'
          }
        }
      };

      // Zustand persist v4+ stores with this structure
      const wrapped = {
        state: testData,
        version: 6
      };

      localStorage.setItem('songnodes-store', JSON.stringify(wrapped));
      console.log('✅ Test data injected:', testData);
    });
    */

    // Verify injection worked
    const injectedData = await page.evaluate(() => {
      const stored = localStorage.getItem('songnodes-store');
      return stored ? JSON.parse(stored) : null;
    });
    console.log('📊 Injected data structure:', JSON.stringify(injectedData, null, 2));
    expect(injectedData).toBeTruthy();
    expect(injectedData.state.musicCredentials.tidal.clientId).toBe('test-client-12345');

    // Reload the page
    console.log('📝 Step 2: Reloading page...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for Zustand rehydration

    // Check if data persisted
    console.log('📝 Step 3: Checking if data persisted...');
    const persistedData = await page.evaluate(() => {
      const stored = localStorage.getItem('songnodes-store');
      return stored ? JSON.parse(stored) : null;
    });

    console.log('📊 Persisted data:', JSON.stringify(persistedData, null, 2));

    // Verify persistence
    expect(persistedData).toBeTruthy();
    expect(persistedData.state).toBeTruthy();
    expect(persistedData.state.musicCredentials).toBeTruthy();
    expect(persistedData.state.musicCredentials.tidal).toBeTruthy();
    expect(persistedData.state.musicCredentials.tidal.clientId).toBe('test-client-12345');
    expect(persistedData.state.musicCredentials.tidal.clientSecret).toBe('test-secret-67890');

    console.log('✅ PASS: Credentials persisted across reload!');
  });
});