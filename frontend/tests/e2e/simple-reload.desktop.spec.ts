import { test, expect } from '@playwright/test';

test('simple reload test', async ({ page }) => {
  console.log('1. Loading page...');
  await page.goto('http://localhost:3006');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('2. Injecting credentials...');
  await page.evaluate(() => {
    (window as any).debugZustand.injectTestCredentials();
  });
  await page.waitForTimeout(500);

  console.log('3. Checking immediately after inject...');
  const afterInject = await page.evaluate(() => {
    const store = localStorage.getItem('songnodes-store');
    return { hasStore: !!store, hasTidal: !!JSON.parse(store || '{}').state?.musicCredentials?.tidal };
  });
  console.log('After inject:', afterInject);

  console.log('4. Reloading...');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('5. Checking after reload...');
  const afterReload = await page.evaluate(() => {
    const store = localStorage.getItem('songnodes-store');
    return {
      hasStore: !!store,
      hasTidal: !!JSON.parse(store || '{}').state?.musicCredentials?.tidal,
      clientId: JSON.parse(store || '{}').state?.musicCredentials?.tidal?.clientId
    };
  });
  console.log('After reload:', afterReload);

  expect(afterReload.hasTidal).toBe(true);
  expect(afterReload.clientId).toBe('console-test-client');
  console.log('✅ SUCCESS!');
});