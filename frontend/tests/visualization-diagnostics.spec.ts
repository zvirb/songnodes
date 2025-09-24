import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Graph Visualization Diagnostics', () => {
  test('comprehensive data flow analysis with screenshots', async ({ page }) => {
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    let stepCount = 1;
    const takeScreenshot = async (name: string) => {
      await page.screenshot({
        path: path.join(screenshotDir, `${stepCount.toString().padStart(2, '0')}-${name}.png`),
        fullPage: true
      });
      stepCount++;
    };

    // Enable console logging
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Monitor network requests
    const apiRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });

    const apiResponses: any[] = [];
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        let body = null;
        try {
          body = await response.json();
        } catch (e) {
          body = await response.text();
        }
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          body: body
        });
      }
    });

    console.log('📸 Step 1: Navigating to application...');
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle' });
    await takeScreenshot('initial-load');

    // Wait for initial render
    await page.waitForTimeout(2000);
    await takeScreenshot('after-wait');

    console.log('🔍 Step 2: Checking DOM elements...');

    // Check if canvas exists
    const canvasExists = await page.locator('canvas').count();
    console.log(`Canvas elements found: ${canvasExists}`);

    // Check if loading message is visible
    const loadingMessage = await page.locator('text=/waiting|loading/i').count();
    console.log(`Loading messages found: ${loadingMessage}`);

    // Check node/edge count display
    const nodeCountText = await page.locator('text=/Nodes:/').textContent().catch(() => 'Not found');
    const edgeCountText = await page.locator('text=/Edges:/').textContent().catch(() => 'Not found');
    console.log(`Node count display: ${nodeCountText}`);
    console.log(`Edge count display: ${edgeCountText}`);

    await takeScreenshot('dom-check');

    console.log('📊 Step 3: Checking Redux state...');

    // Inject script to check Redux state
    const reduxState = await page.evaluate(() => {
      const store = (window as any).__REDUX_STORE__;
      if (store) {
        return store.getState();
      }

      // Try to find store from React DevTools
      const reactRoot = document.querySelector('#root');
      if (reactRoot && (reactRoot as any)._reactRootContainer) {
        const fiber = (reactRoot as any)._reactRootContainer._internalRoot?.current;
        if (fiber) {
          let node = fiber;
          while (node) {
            if (node.memoizedProps?.store) {
              return node.memoizedProps.store.getState();
            }
            node = node.child || node.sibling || node.return;
          }
        }
      }
      return null;
    });

    console.log('Redux state:', JSON.stringify(reduxState, null, 2));
    await takeScreenshot('redux-state');

    console.log('🌐 Step 4: Checking API responses...');

    // Check API requests made
    console.log(`API requests made: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`  - ${req.method} ${req.url}`);
    });

    // Check API responses
    console.log(`API responses received: ${apiResponses.length}`);
    apiResponses.forEach(res => {
      console.log(`  - ${res.status} ${res.url}`);
      if (res.status === 200 && res.body) {
        if (res.body.nodes) {
          console.log(`    Nodes returned: ${res.body.nodes.length}`);
        }
        if (res.body.edges) {
          console.log(`    Edges returned: ${res.body.edges.length}`);
        }
      }
    });

    console.log('🔧 Step 5: Attempting manual data load...');

    // Try to manually trigger data load
    const manualLoadResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/graph/nodes?limit=10');
        const data = await response.json();
        return { success: true, data, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    });

    console.log('Manual load result:', manualLoadResult);
    await takeScreenshot('manual-load');

    console.log('🎨 Step 6: Checking D3/Canvas rendering...');

    // Check if D3 is initialized
    const d3Status = await page.evaluate(() => {
      const d3 = (window as any).d3;
      if (!d3) return 'D3 not found';

      // Check for force simulation
      const simulations = document.querySelectorAll('.force-graph');
      return {
        d3Version: d3.version || 'unknown',
        simulationsFound: simulations.length,
        svgElements: document.querySelectorAll('svg').length,
        canvasElements: document.querySelectorAll('canvas').length
      };
    });

    console.log('D3 Status:', d3Status);
    await takeScreenshot('d3-status');

    // Wait for potential async updates
    await page.waitForTimeout(3000);
    await takeScreenshot('final-state');

    // Generate diagnostic report
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      canvasExists,
      loadingMessage,
      nodeCountText,
      edgeCountText,
      reduxState: reduxState ? 'Found' : 'Not Found',
      apiRequests: apiRequests.length,
      apiResponses: apiResponses.length,
      successfulApiCalls: apiResponses.filter(r => r.status === 200).length,
      d3Status,
      manualLoadResult: manualLoadResult.success,
      consoleLogs: consoleLogs.slice(-20), // Last 20 console logs
      screenshotsGenerated: stepCount - 1
    };

    console.log('\n📋 DIAGNOSTIC REPORT:');
    console.log('====================');
    console.log(JSON.stringify(report, null, 2));

    // Save report to file
    fs.writeFileSync(
      path.join(screenshotDir, 'diagnostic-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Assertions to identify issues
    expect(canvasExists, 'Canvas should exist').toBeGreaterThan(0);
    expect(apiResponses.some(r => r.status === 200), 'At least one API call should succeed').toBeTruthy();
  });
});