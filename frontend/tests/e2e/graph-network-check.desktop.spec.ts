import { test } from '@playwright/test';

test('check network requests and data loading', async ({ page }) => {
  // Track all network requests
  const requests: any[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      requests.push({
        url: request.url(),
        method: request.method()
      });
      console.log('📤 Request:', request.method(), request.url());
    }
  });

  // Track all responses
  const responses: any[] = [];
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const status = response.status();
      let body = null;
      try {
        if (response.headers()['content-type']?.includes('json')) {
          body = await response.json();
        }
      } catch (e) {
        // Ignore JSON parse errors
      }

      responses.push({
        url: response.url(),
        status,
        bodyPreview: body ? JSON.stringify(body).slice(0, 200) : null
      });

      console.log('📥 Response:', status, response.url());
      if (body) {
        console.log('   Body preview:', JSON.stringify(body).slice(0, 200));
      }
    }
  });

  // Navigate and wait
  await page.goto('http://localhost:3006', { timeout: 15000 });
  await page.waitForTimeout(8000); // Wait for data loading

  console.log('\n📊 Summary:');
  console.log('Total API requests:', requests.length);
  console.log('Total API responses:', responses.length);

  // Check the store state
  const storeState = await page.evaluate(() => {
    // Access Zustand store if available
    const store = (window as any).useStore?.getState?.();
    if (!store) return { error: 'Store not available' };

    return {
      graphDataNodes: store.graphData?.nodes?.length || 0,
      graphDataEdges: store.graphData?.edges?.length || 0,
      isLoading: store.isLoading,
      error: store.error
    };
  });

  console.log('\n🗄️  Store State:', JSON.stringify(storeState, null, 2));

  // Check console for errors
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page.waitForTimeout(2000);

  const errors = consoleMessages.filter(msg => msg.includes('[error]'));
  if (errors.length > 0) {
    console.log('\n❌ Console Errors:');
    errors.forEach(err => console.log('  ', err));
  }

  console.log('\n✅ Test complete');
});
