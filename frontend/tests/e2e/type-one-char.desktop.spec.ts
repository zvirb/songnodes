import { test } from '@playwright/test';

test.use({ headless: false });

test('type one character and check logs', async ({ page }) => {
  const updateLogs: string[] = [];
  const allLogs: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    allLogs.push(text);

    // Log ALL important initialization and persistence logs, plus all errors
    if (type === 'error' || type === 'warning' ||
        text.includes('UPDATE') || text.includes('SET CALLBACK') ||
        text.includes('MERGE') || text.includes('RAW localStorage') ||
        text.includes('[INIT]') || text.includes('[MAIN.TSX]') ||
        text.includes('[TEST]') || text.includes('[REHYDRATE]') ||
        text.includes('[PERSIST') || text.includes('PARTIALIZE')) {
      console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);

      if (text.includes('UPDATE') || text.includes('SET CALLBACK')) {
        updateLogs.push(text);
      }
    }
  });

  console.log('Loading app...');
  await page.goto('http://localhost:3006');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Opening settings...');
  const settingsBtn = page.locator('button').filter({ hasText: '⚙️' });
  await settingsBtn.first().click();
  await page.waitForTimeout(1000);

  console.log('Finding input...');
  const input = page.locator('input[placeholder*="Client ID"]').first();
  await input.waitFor({ state: 'visible' });

  console.log('Typing "A"...');
  await input.type('A', { delay: 100 });
  await page.waitForTimeout(1000);

  console.log(`\nCaptured ${updateLogs.length} UPDATE logs:`);
  updateLogs.forEach(log => console.log(`  ${log}`));

  if (updateLogs.length === 0) {
    console.log('\n❌ NO UPDATE LOGS! onChange is not calling updateCredentials!');
  } else {
    console.log('\n✅ UPDATE logs found - onChange is working');
  }

  // Check localStorage
  const storage = await page.evaluate(() => {
    const store = localStorage.getItem('songnodes-store');
    if (!store) return { error: 'No store' };
    const parsed = JSON.parse(store);

    // DEBUG: Log the full structure
    console.log('🔍 [TEST] Top-level keys:', Object.keys(parsed));
    console.log('🔍 [TEST] Has state wrapper?', !!parsed.state);
    console.log('🔍 [TEST] State keys:', parsed.state ? Object.keys(parsed.state) : 'NO STATE');
    console.log('🔍 [TEST] Has musicCredentials in state?', !!(parsed.state?.musicCredentials));
    console.log('🔍 [TEST] musicCredentials:', JSON.stringify(parsed.state?.musicCredentials));

    return {
      hasTidal: !!parsed?.state?.musicCredentials?.tidal,
      clientId: parsed?.state?.musicCredentials?.tidal?.clientId,
      // Also try without state wrapper
      hasTidalDirect: !!parsed?.musicCredentials?.tidal,
      clientIdDirect: parsed?.musicCredentials?.tidal?.clientId
    };
  });

  console.log('\nLocalStorage after typing:', storage);

  if ((storage.hasTidal && storage.clientId === 'A') ||
      (storage.hasTidalDirect && storage.clientIdDirect === 'A')) {
    console.log('✅ localStorage HAS the typed credential!');
    console.log(`   Found at: ${storage.hasTidal ? 'state.musicCredentials' : 'musicCredentials (direct)'}`);
  } else {
    console.log('❌ localStorage does NOT have the credential!');
  }

  // Now reload and check again
  console.log('\nReloading page...');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const afterReload = await page.evaluate(() => {
    const store = localStorage.getItem('songnodes-store');
    if (!store) return { error: 'No store' };
    const parsed = JSON.parse(store);

    // DEBUG: Log the full structure after reload
    console.log('🔍 [TEST] Top-level keys after reload:', Object.keys(parsed));
    console.log('🔍 [TEST] Has state wrapper after reload?', !!parsed.state);
    console.log('🔍 [TEST] State keys after reload:', parsed.state ? Object.keys(parsed.state) : 'NO STATE');
    console.log('🔍 [TEST] Has musicCredentials after reload?', !!(parsed.state?.musicCredentials));
    console.log('🔍 [TEST] musicCredentials after reload:', JSON.stringify(parsed.state?.musicCredentials));

    return {
      hasTidal: !!parsed?.state?.musicCredentials?.tidal,
      clientId: parsed?.state?.musicCredentials?.tidal?.clientId,
      // Also try without state wrapper
      hasTidalDirect: !!parsed?.musicCredentials?.tidal,
      clientIdDirect: parsed?.musicCredentials?.tidal?.clientId
    };
  });

  console.log('LocalStorage after reload:', afterReload);

  if ((afterReload.hasTidal && afterReload.clientId === 'A') ||
      (afterReload.hasTidalDirect && afterReload.clientIdDirect === 'A')) {
    console.log('✅ PERSISTENCE WORKS! Credential survived reload!');
    console.log(`   Found at: ${afterReload.hasTidal ? 'state.musicCredentials' : 'musicCredentials (direct)'}`);
  } else {
    console.log('❌ PERSISTENCE BROKEN! Credential lost after reload!');
    console.log(`   Checked both state.musicCredentials and direct musicCredentials paths`);

    // Show relevant logs from reload
    console.log('\n📋 MERGE logs from reload:');
    const mergeLogs = allLogs.filter(log => log.includes('MERGE') || log.includes('RAW localStorage'));
    if (mergeLogs.length > 0) {
      mergeLogs.slice(-5).forEach(log => console.log(`  ${log}`));
    } else {
      console.log('  (No MERGE logs found)');
    }
  }

  await page.waitForTimeout(2000);
});