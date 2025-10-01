import { test, expect } from '@playwright/test';

// Configure for headed mode
test.use({
  headless: false,
  video: 'on',
  screenshot: 'on',
  trace: 'on',
});

test('REAL TEST: Enter Tidal credentials via Settings UI and verify persistence', async ({ page }) => {
  // Capture console logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('UPDATE') || text.includes('SET CALLBACK') || text.includes('musicCredentials') || text.includes('Tidal')) {
      console.log(`[CONSOLE] ${text}`);
    }
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TIDAL CREDENTIALS PERSISTENCE TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Load application
  console.log('📝 STEP 1: Loading application...');
  await page.goto('http://localhost:3006');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tests/screenshots/real-test-01-app-loaded.png', fullPage: true });
  console.log('   ✅ App loaded\n');

  // Check initial localStorage
  const initialStorage = await page.evaluate(() => {
    const store = localStorage.getItem('songnodes-store');
    if (!store) return { empty: true };
    try {
      const parsed = JSON.parse(store);
      return {
        hasTidal: !!parsed?.state?.musicCredentials?.tidal,
        tidalClientId: parsed?.state?.musicCredentials?.tidal?.clientId
      };
    } catch {
      return { error: 'parse error' };
    }
  });
  console.log('   📊 Initial localStorage:', initialStorage);

  // Step 2: Open Settings
  console.log('📝 STEP 2: Opening Settings panel...');
  const settingsButton = page.locator('button').filter({ hasText: '⚙️' }).or(
    page.locator('button[aria-label="Settings"]')
  );

  await settingsButton.first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/screenshots/real-test-02-settings-opened.png', fullPage: true });
  console.log('   ✅ Settings opened\n');

  // Verify Settings panel visible
  const settingsVisible = await page.locator('text=Tidal Developer API').or(
    page.locator('text=Music Service Settings')
  ).first().isVisible();

  if (!settingsVisible) {
    console.log('   ❌ Settings panel not visible!');
    await page.screenshot({ path: 'tests/screenshots/real-test-ERROR-no-settings.png', fullPage: true });
    throw new Error('Settings panel not visible');
  }

  // Step 3: Fill in credentials
  console.log('📝 STEP 3: Filling in Tidal credentials...');

  const clientIdInput = page.locator('input[placeholder*="Client ID"]').first();
  const clientSecretInput = page.locator('input[placeholder*="Client Secret"]').first();

  await clientIdInput.waitFor({ state: 'visible', timeout: 5000 });

  // Clear and fill Client ID
  await clientIdInput.clear();
  await clientIdInput.fill('TEST-CLIENT-ID-123456');
  await page.waitForTimeout(200);

  console.log('   ✅ Entered Client ID');
  await page.screenshot({ path: 'tests/screenshots/real-test-03-client-id-entered.png', fullPage: true });

  // Clear and fill Client Secret
  await clientSecretInput.clear();
  await clientSecretInput.fill('TEST-CLIENT-SECRET-789');
  await page.waitForTimeout(200);

  console.log('   ✅ Entered Client Secret');
  await page.screenshot({ path: 'tests/screenshots/real-test-04-client-secret-entered.png', fullPage: true });

  // Check if credentials are in Zustand state after typing
  const afterTyping = await page.evaluate(() => {
    const debug = (window as any).debugZustand;
    if (!debug) return { error: 'debugZustand not available' };

    const state = debug.getMusicCredentials();
    const stored = debug.getLocalStorage();

    return {
      zustandHasTidal: !!state?.tidal,
      zustandClientId: state?.tidal?.clientId,
      localStorageHasTidal: !!stored?.state?.musicCredentials?.tidal,
      localStorageClientId: stored?.state?.musicCredentials?.tidal?.clientId
    };
  });

  console.log('   📊 After typing (before Save):');
  console.log('      Zustand:', { hasTidal: afterTyping.zustandHasTidal, clientId: afterTyping.zustandClientId });
  console.log('      localStorage:', { hasTidal: afterTyping.localStorageHasTidal, clientId: afterTyping.localStorageClientId });
  console.log('');

  // Step 4: Click Save
  console.log('📝 STEP 4: Clicking Save Settings button...');
  const saveButton = page.locator('button:has-text("Save Settings")');
  await saveButton.click();
  await page.waitForTimeout(1500);

  console.log('   ✅ Save clicked');
  await page.screenshot({ path: 'tests/screenshots/real-test-05-after-save.png', fullPage: true });

  // Check credentials after save
  const afterSave = await page.evaluate(() => {
    const debug = (window as any).debugZustand;
    const state = debug.getMusicCredentials();
    const stored = debug.getLocalStorage();

    return {
      zustand: {
        hasTidal: !!state?.tidal,
        clientId: state?.tidal?.clientId,
        clientSecret: state?.tidal?.clientSecret
      },
      localStorage: {
        hasTidal: !!stored?.state?.musicCredentials?.tidal,
        clientId: stored?.state?.musicCredentials?.tidal?.clientId,
        clientSecret: stored?.state?.musicCredentials?.tidal?.clientSecret
      }
    };
  });

  console.log('   📊 After Save:');
  console.log('      Zustand:', afterSave.zustand);
  console.log('      localStorage:', afterSave.localStorage);
  console.log('');

  // Close Settings
  const cancelButton = page.locator('button:has-text("Cancel")');
  await cancelButton.click();
  await page.waitForTimeout(500);

  // Step 5: Reload page
  console.log('📝 STEP 5: Reloading page to test persistence...');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'tests/screenshots/real-test-06-after-reload.png', fullPage: true });
  console.log('   ✅ Page reloaded\n');

  // Check credentials after reload
  const afterReload = await page.evaluate(() => {
    const debug = (window as any).debugZustand;
    const state = debug.getMusicCredentials();
    const stored = debug.getLocalStorage();

    return {
      zustand: {
        hasTidal: !!state?.tidal,
        clientId: state?.tidal?.clientId
      },
      localStorage: {
        hasTidal: !!stored?.state?.musicCredentials?.tidal,
        clientId: stored?.state?.musicCredentials?.tidal?.clientId
      }
    };
  });

  console.log('   📊 After Reload:');
  console.log('      Zustand:', afterReload.zustand);
  console.log('      localStorage:', afterReload.localStorage);
  console.log('');

  // Step 6: Open Settings again to verify UI
  console.log('📝 STEP 6: Opening Settings again to verify UI shows credentials...');
  await settingsButton.first().click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'tests/screenshots/real-test-07-settings-after-reload.png', fullPage: true });

  // Check if form fields have the values
  const formValues = {
    clientId: await clientIdInput.inputValue(),
    clientSecret: await clientSecretInput.inputValue()
  };

  console.log('   📊 Form field values:', formValues);
  console.log('');

  await page.screenshot({ path: 'tests/screenshots/real-test-08-final-state.png', fullPage: true });

  // Assertions
  console.log('📝 STEP 7: Running assertions...\n');

  console.log('   Checking localStorage persisted credentials...');
  if (!afterReload.localStorage.hasTidal) {
    console.log('   ❌ FAIL: localStorage does not have Tidal credentials');
    console.log('   Debug logs:', logs.filter(l => l.includes('UPDATE') || l.includes('PERSIST')).slice(-20));
  } else {
    console.log('   ✅ localStorage has Tidal credentials');
  }

  console.log('   Checking Zustand rehydrated credentials...');
  if (!afterReload.zustand.hasTidal) {
    console.log('   ❌ FAIL: Zustand did not rehydrate Tidal credentials');
  } else {
    console.log('   ✅ Zustand has rehydrated credentials');
  }

  console.log('   Checking UI form shows credentials...');
  if (formValues.clientId !== 'TEST-CLIENT-ID-123456') {
    console.log(`   ❌ FAIL: Form shows "${formValues.clientId}" instead of "TEST-CLIENT-ID-123456"`);
  } else {
    console.log('   ✅ Form shows correct credentials');
  }

  // Final assertions
  expect(afterReload.localStorage.hasTidal, 'localStorage should have Tidal credentials').toBe(true);
  expect(afterReload.localStorage.clientId, 'localStorage should have correct client ID').toBe('TEST-CLIENT-ID-123456');
  expect(afterReload.zustand.hasTidal, 'Zustand should have rehydrated Tidal credentials').toBe(true);
  expect(afterReload.zustand.clientId, 'Zustand should have correct client ID').toBe('TEST-CLIENT-ID-123456');
  expect(formValues.clientId, 'Form should display correct client ID').toBe('TEST-CLIENT-ID-123456');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ ALL TESTS PASSED - CREDENTIALS PERSIST!');
  console.log('═══════════════════════════════════════════════════════════\n');
});