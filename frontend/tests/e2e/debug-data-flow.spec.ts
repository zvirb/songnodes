import { test, expect } from '@playwright/test';

test('Trace data flow from API to rendering', async ({ page }) => {
  const consoleLogs: string[] = [];
  const errors: string[] = [];
  const networkRequests: Array<{url: string, status: number}> = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  // Capture network requests
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/graph')) {
      networkRequests.push({ url, status: response.status() });
      console.log(`\n📡 API REQUEST: ${url} -> ${response.status()}`);
    }
  });

  console.log('\n=== LOADING APPLICATION ===');
  await page.goto('http://localhost:30006', { waitUntil: 'networkidle' });

  console.log('\n=== WAITING FOR DATA LOAD ===');
  await page.waitForTimeout(5000);

  console.log('\n=== NETWORK REQUESTS ===');
  console.log('Requests to /api/graph:', networkRequests);

  console.log('\n=== CONSOLE LOGS (filtered) ===');
  const relevantLogs = consoleLogs.filter(log =>
    log.includes('[GraphVisualization]') ||
    log.includes('Graph ready') ||
    log.includes('Failed to load') ||
    log.includes('useDataLoader') ||
    log.includes('Store subscription')
  );
  relevantLogs.forEach(log => console.log(log));

  console.log('\n=== ERRORS ===');
  errors.forEach(err => console.log('❌', err));

  console.log('\n=== ZUSTAND STORE STATE ===');
  const storeState = await page.evaluate(() => {
    // @ts-ignore
    const state = window.debugZustand?.getState();
    return {
      graphDataNodes: state?.graphData?.nodes?.length || 0,
      graphDataEdges: state?.graphData?.edges?.length || 0,
      isLoading: state?.isLoading,
      error: state?.error,
      metricsNodeCount: state?.performanceMetrics?.nodeCount || 0,
      metricsEdgeCount: state?.performanceMetrics?.edgeCount || 0
    };
  });
  console.log(JSON.stringify(storeState, null, 2));

  // Take screenshot
  await page.screenshot({ path: '/tmp/data-flow-debug.png', fullPage: true });
  console.log('\n=== Screenshot saved to /tmp/data-flow-debug.png ===');

  // Assert API was called
  expect(networkRequests.length).toBeGreaterThan(0);
  expect(networkRequests.some(req => req.url.includes('/api/graph/data'))).toBeTruthy();
});
