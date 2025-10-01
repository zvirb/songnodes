import { test } from '@playwright/test';

test('minimal credential inject test', async ({ page }) => {
  // Capture ALL console logs
  page.on('console', msg => {
    const text = msg.text();
    // Only show logs related to credentials
    if (text.includes('[UPDATE]') ||
        text.includes('[SET') ||
        text.includes('[PERSIST') ||
        text.includes('[MERGE]') ||
        text.includes('musicCredentials') ||
        text.includes('Debugging utilities')) {
      console.log(`[BROWSER] ${text}`);
    }
  });

  console.log('Loading page...');
  await page.goto('http://localhost:3006');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('\nInjecting credentials...');
  await page.evaluate(() => {
    (window as any).debugZustand.injectTestCredentials();
  });

  await page.waitForTimeout(1000);

  console.log('\nChecking localStorage...');
  const result = await page.evaluate(() => {
    const stored = localStorage.getItem('songnodes-store');
    if (!stored) return { error: 'localStorage is empty' };
    const parsed = JSON.parse(stored);
    return {
      hasTidal: !!parsed?.state?.musicCredentials?.tidal,
      clientId: parsed?.state?.musicCredentials?.tidal?.clientId,
      allKeys: Object.keys(parsed?.state?.musicCredentials || {})
    };
  });

  console.log('Result:', JSON.stringify(result, null, 2));
});