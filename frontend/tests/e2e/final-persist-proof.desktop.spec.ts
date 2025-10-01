import { test, expect } from '@playwright/test';

test('FINAL PROOF: credentials persist across reload', async ({ page }) => {
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[UPDATE]') || text.includes('[SET CALLBACK]') || text.includes('[PERSIST/PARTIALIZE]') || text.includes('Tidal')) {
      console.log(`[BROWSER] ${text}`);
    }
  });

  console.log('🧪 TEST: Verify credentials persist across reload\n');

  // Step 1: Load page and inject credentials programmatically
  console.log('Step 1: Loading page...');
  await page.goto('http://localhost:3006');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('\nStep 2: Injecting credentials via debugZustand...');
  await page.evaluate(() => {
    (window as any).debugZustand.injectTestCredentials();
  });
  await page.waitForTimeout(500);

  // Verify injection worked
  const afterInject = await page.evaluate(() => {
    const stored = localStorage.getItem('songnodes-store');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      hasTidal: !!parsed?.state?.musicCredentials?.tidal,
      clientId: parsed?.state?.musicCredentials?.tidal?.clientId
    };
  });

  console.log('After inject:', afterInject);
  expect(afterInject?.hasTidal).toBe(true);
  expect(afterInject?.clientId).toBe('console-test-client');
  console.log('✅ Credentials injected and saved to localStorage\n');

  // Step 3: Reload page
  console.log('Step 3: Reloading page...');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000); // Wait for rehydration

  // Step 4: Verify persistence
  console.log('\nStep 4: Verifying credentials persisted...');
  const afterReload = await page.evaluate(() => {
    const stored = localStorage.getItem('songnodes-store');
    if (!stored) return { error: 'localStorage is empty' };
    const parsed = JSON.parse(stored);

    // Also check Zustand state
    const zustandState = (window as any).debugZustand?.getMusicCredentials();

    return {
      localStorage: {
        hasTidal: !!parsed?.state?.musicCredentials?.tidal,
        clientId: parsed?.state?.musicCredentials?.tidal?.clientId,
        clientSecret: parsed?.state?.musicCredentials?.tidal?.clientSecret
      },
      zustandState: {
        hasTidal: !!zustandState?.tidal,
        clientId: zustandState?.tidal?.clientId,
        clientSecret: zustandState?.tidal?.clientSecret
      }
    };
  });

  console.log('After reload:', JSON.stringify(afterReload, null, 2));

  // Assertions
  console.log('\nStep 5: Running assertions...');
  expect(afterReload.localStorage.hasTidal).toBe(true);
  expect(afterReload.localStorage.clientId).toBe('console-test-client');
  console.log('✅ localStorage has persisted credentials');

  expect(afterReload.zustandState.hasTidal).toBe(true);
  expect(afterReload.zustandState.clientId).toBe('console-test-client');
  console.log('✅ Zustand state has rehydrated credentials');

  console.log('\n🎉 SUCCESS: Credentials persist across page reload!');
});