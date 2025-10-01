import { test, expect } from '@playwright/test';

test.describe('Debug Console Persistence Test', () => {
  test('test credentials persistence with console logging', async ({ page }) => {
    // Capture all console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to app
    console.log('📝 Step 1: Loading application...');
    await page.goto('http://localhost:3006');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for Zustand to initialize

    // Step 1: Check initial state
    console.log('\n📝 Step 2: Checking initial state...');
    const initialState = await page.evaluate(() => {
      return (window as any).debugZustand.verifyPersistence();
    });
    console.log('Initial state:', JSON.stringify(initialState, null, 2));

    // Step 2: Inject test credentials via debug utility
    console.log('\n📝 Step 3: Injecting test credentials...');
    await page.evaluate(() => {
      (window as any).debugZustand.injectTestCredentials();
    });
    await page.waitForTimeout(500); // Wait for persist middleware to save

    // Step 3: Verify credentials were saved
    console.log('\n📝 Step 4: Verifying credentials were saved...');
    const afterInject = await page.evaluate(() => {
      return (window as any).debugZustand.verifyPersistence();
    });
    console.log('After inject:', JSON.stringify(afterInject, null, 2));

    // Verify credentials exist in Zustand state
    expect(afterInject.zustandState).toBeTruthy();
    expect(afterInject.zustandState.tidal).toBeTruthy();
    expect(afterInject.zustandState.tidal.clientId).toBe('console-test-client');
    console.log('✅ Credentials exist in Zustand state');

    // Verify credentials were persisted to localStorage
    expect(afterInject.localStorageState).toBeTruthy();
    expect(afterInject.localStorageState.tidal).toBeTruthy();
    expect(afterInject.localStorageState.tidal.clientId).toBe('console-test-client');
    console.log('✅ Credentials persisted to localStorage');

    // Step 4: Reload page
    console.log('\n📝 Step 5: Reloading page to test persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for rehydration

    // Step 5: Verify persistence after reload
    console.log('\n📝 Step 6: Verifying persistence after reload...');
    const afterReload = await page.evaluate(() => {
      return (window as any).debugZustand.verifyPersistence();
    });
    console.log('After reload:', JSON.stringify(afterReload, null, 2));

    // Check localStorage first
    console.log('\n📊 LocalStorage check:');
    if (afterReload.localStorageState?.tidal) {
      console.log('  ✅ localStorage has tidal credentials');
      console.log('  Client ID:', afterReload.localStorageState.tidal.clientId);
    } else {
      console.log('  ❌ localStorage missing tidal credentials');
    }

    // Check Zustand state
    console.log('\n📊 Zustand state check:');
    if (afterReload.zustandState?.tidal) {
      console.log('  ✅ Zustand has tidal credentials');
      console.log('  Client ID:', afterReload.zustandState.tidal.clientId);
    } else {
      console.log('  ❌ Zustand missing tidal credentials');
      console.log('  Full Zustand state:', afterReload.zustandState);
    }

    // Print relevant console logs
    console.log('\n📋 Relevant console logs from browser:');
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('[PERSIST]') ||
      log.includes('[MERGE]') ||
      log.includes('[REHYDRATE]') ||
      log.includes('[UPDATE]') ||
      log.includes('musicCredentials') ||
      log.includes('tidal')
    );
    relevantLogs.forEach(log => console.log('  ', log));

    // Final assertions
    console.log('\n📝 Step 7: Running final assertions...');

    // Assert localStorage preserved credentials
    expect(afterReload.localStorageState?.tidal?.clientId).toBe('console-test-client');
    console.log('✅ PASS: localStorage preserved credentials');

    // Assert Zustand state has credentials
    expect(afterReload.zustandState?.tidal?.clientId).toBe('console-test-client');
    console.log('✅ PASS: Zustand state has credentials after reload');

    // Assert they match
    expect(afterReload.match).toBe(true);
    console.log('✅ PASS: Zustand state matches localStorage');

    console.log('\n🎉 SUCCESS: Credentials persisted across page reload!');
  });
});