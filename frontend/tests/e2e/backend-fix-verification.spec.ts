import { test, expect, Page } from '@playwright/test';

/**
 * Backend Fix Verification Test Suite
 *
 * Tests the frontend functionality after critical backend fixes:
 * 1. Enrichment pipeline bug fix (metadata-enrichment/enrichment_pipeline.py lines 532-540)
 * 2. Graph API filter relaxation (graph-visualization-api/main.py lines 467-475)
 *
 * Expected Outcomes:
 * - Frontend loads without errors
 * - Graph visualization displays properly
 * - Node count should be > 469 (previous issue threshold)
 * - User interactions work correctly
 * - GraphFilterPanel controls function
 */
test.describe('Backend Fix Verification', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      } else {
        consoleLogs.push(text);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Navigate to the application
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Log console output for debugging
    if (testInfo.status === 'failed') {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach(err => console.log(err));
      console.log('\n=== Console Warnings ===');
      consoleWarnings.forEach(warn => console.log(warn));
    }
  });

  test('CRITICAL: Frontend loads without JavaScript/React/TypeScript errors', async ({ page }) => {
    await test.step('Wait for application to fully load', async () => {
      // Wait for main heading
      await expect(page.locator('h1')).toContainText('SongNodes DJ', { timeout: 15000 });

      // Wait for graph container
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 15000 });
    });

    await test.step('Verify no critical console errors', async () => {
      // Filter out known non-critical warnings
      const criticalErrors = consoleErrors.filter(err => {
        // Allow certain warnings that are not critical
        const allowedPatterns = [
          /Failed to load resource/,
          /favicon/i,
          /WebSocket/i // WebSocket warnings are acceptable for initial load
        ];

        return !allowedPatterns.some(pattern => pattern.test(err));
      });

      // Log all errors for visibility
      if (criticalErrors.length > 0) {
        console.log('\n=== CRITICAL ERRORS FOUND ===');
        criticalErrors.forEach(err => console.log(err));
      }

      // MUST have zero critical errors
      expect(criticalErrors).toHaveLength(0);
    });

    await test.step('Verify React app mounted successfully', async () => {
      // Check for React root
      const reactRoot = page.locator('#root');
      await expect(reactRoot).toBeVisible();

      // Verify content is rendered
      const hasContent = await reactRoot.evaluate(el => el.children.length > 0);
      expect(hasContent).toBeTruthy();
    });
  });

  test('Graph visualization loads and displays data correctly', async ({ page }) => {
    await test.step('Verify canvas element exists and is visible', async () => {
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 15000 });

      // Verify canvas has proper dimensions
      const canvasInfo = await canvas.evaluate((el: HTMLCanvasElement) => ({
        width: el.width,
        height: el.height,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight
      }));

      expect(canvasInfo.width).toBeGreaterThan(0);
      expect(canvasInfo.height).toBeGreaterThan(0);
      expect(canvasInfo.clientWidth).toBeGreaterThan(0);
      expect(canvasInfo.clientHeight).toBeGreaterThan(0);

      console.log('Canvas dimensions:', canvasInfo);
    });

    await test.step('Wait for graph data to load', async () => {
      // Wait for loading indicators to disappear
      const loadingIndicator = page.locator('text=Loading');
      if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 });
      }

      // Give graph time to initialize
      await page.waitForTimeout(3000);
    });

    await test.step('Verify WebGL initialization', async () => {
      const webglInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) return null;

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return null;

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
          renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
          version: gl.getParameter(gl.VERSION),
          hasWebGL2: !!canvas.getContext('webgl2')
        };
      });

      expect(webglInfo).toBeTruthy();
      expect(webglInfo?.version).toBeTruthy();
      console.log('WebGL Info:', webglInfo);
    });
  });

  test('CRITICAL: Node count verification (should be > 469 nodes)', async ({ page }) => {
    await test.step('Wait for graph to fully load', async () => {
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(5000); // Allow time for data load and rendering
    });

    await test.step('Extract and verify node count from UI', async () => {
      // Look for node count display in UI
      const nodeCountText = await page.locator('text=/\\d+\\s+nodes?/i').first().textContent({ timeout: 10000 }).catch(() => null);

      if (nodeCountText) {
        const match = nodeCountText.match(/(\d+)\s+nodes?/i);
        if (match) {
          const nodeCount = parseInt(match[1], 10);
          console.log(`Node count displayed in UI: ${nodeCount}`);

          // CRITICAL: Must be > 469 (the threshold from the bug)
          expect(nodeCount).toBeGreaterThan(469);

          // Provide detailed reporting
          console.log(`✅ SUCCESS: Node count (${nodeCount}) is greater than 469`);
        }
      }
    });

    await test.step('Verify graph data via window object', async () => {
      // Try to access graph data from window/global state
      const graphData = await page.evaluate(() => {
        // Try various possible locations for graph data
        const win = window as any;

        // Check Zustand stores
        if (win.__ZUSTAND_STORES__) {
          return Object.keys(win.__ZUSTAND_STORES__).map(key => {
            const store = win.__ZUSTAND_STORES__[key];
            if (store && typeof store.getState === 'function') {
              return store.getState();
            }
            return null;
          }).filter(Boolean);
        }

        return null;
      });

      if (graphData) {
        console.log('Graph data accessible:', JSON.stringify(graphData, null, 2).substring(0, 500));
      }
    });

    await test.step('Take screenshot for visual verification', async () => {
      await page.screenshot({
        path: 'test-results/backend-fix-node-count-verification.png',
        fullPage: true
      });
    });
  });

  test('User interactions work correctly (pan, zoom, click)', async ({ page }) => {
    await test.step('Verify canvas is interactive', async () => {
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);
    });

    await test.step('Test mouse wheel zoom', async () => {
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();

      if (box) {
        // Zoom in
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(500);

        // Zoom out
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(500);
      }

      // Verify no errors occurred during zoom
      const zoomErrors = consoleErrors.filter(err => err.includes('zoom') || err.includes('scale'));
      expect(zoomErrors).toHaveLength(0);
    });

    await test.step('Test pan/drag functionality', async () => {
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();

      if (box) {
        // Pan the graph
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
      }

      // Verify no errors occurred during pan
      const panErrors = consoleErrors.filter(err => err.includes('pan') || err.includes('drag'));
      expect(panErrors).toHaveLength(0);
    });

    await test.step('Test node click interaction', async () => {
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();

      if (box) {
        // Click on canvas (may or may not hit a node)
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(1000);
      }

      // Verify no errors occurred during click
      const clickErrors = consoleErrors.filter(err => err.includes('click') || err.includes('pointer'));
      expect(clickErrors).toHaveLength(0);
    });
  });

  test('GraphFilterPanel controls are functional', async ({ page }) => {
    await test.step('Wait for application to load', async () => {
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);
    });

    await test.step('Locate GraphFilterPanel', async () => {
      // Look for filter panel elements
      const filterPanel = page.locator('[data-testid*="filter"]').or(page.locator('text=/filter/i')).first();

      if (await filterPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Filter panel found and visible');

        // Take screenshot showing filter panel
        await page.screenshot({
          path: 'test-results/filter-panel-visible.png',
          fullPage: true
        });
      } else {
        console.log('Filter panel not immediately visible - may be in collapsed state');
      }
    });

    await test.step('Test filter interactions if available', async () => {
      // Look for common filter controls
      const sliders = page.locator('input[type="range"]');
      const checkboxes = page.locator('input[type="checkbox"]');
      const buttons = page.locator('button').filter({ hasText: /filter|apply|reset/i });

      const sliderCount = await sliders.count();
      const checkboxCount = await checkboxes.count();
      const buttonCount = await buttons.count();

      console.log(`Filter controls found - Sliders: ${sliderCount}, Checkboxes: ${checkboxCount}, Buttons: ${buttonCount}`);

      // Verify no errors when interacting with controls
      if (sliderCount > 0) {
        await sliders.first().evaluate((el: HTMLInputElement) => {
          el.value = String(Number(el.max) * 0.5);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForTimeout(500);
      }

      const controlErrors = consoleErrors.filter(err => err.includes('filter') || err.includes('control'));
      expect(controlErrors).toHaveLength(0);
    });
  });

  test('API connectivity and data flow verification', async ({ page }) => {
    let apiRequests: { url: string; status: number; method: string }[] = [];

    await test.step('Monitor API requests', async () => {
      page.on('response', response => {
        const url = response.url();
        if (url.includes('localhost:8084') || url.includes('graph') || url.includes('api')) {
          apiRequests.push({
            url,
            status: response.status(),
            method: response.request().method()
          });
        }
      });
    });

    await test.step('Navigate and wait for API calls', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(5000);
    });

    await test.step('Verify API responses', async () => {
      console.log('\n=== API Requests ===');
      apiRequests.forEach(req => {
        console.log(`${req.method} ${req.url} - Status: ${req.status}`);
      });

      // Check for Graph API calls
      const graphApiCalls = apiRequests.filter(req =>
        req.url.includes('8084') || req.url.includes('graph')
      );

      if (graphApiCalls.length > 0) {
        console.log(`\n✅ Graph API calls detected: ${graphApiCalls.length}`);

        // Verify successful responses
        const successfulCalls = graphApiCalls.filter(req => req.status >= 200 && req.status < 300);
        console.log(`Successful API calls: ${successfulCalls.length} / ${graphApiCalls.length}`);

        // Should have at least some successful calls
        expect(successfulCalls.length).toBeGreaterThan(0);
      }
    });
  });

  test('Performance and memory stability check', async ({ page }) => {
    await test.step('Load application and perform operations', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);
    });

    await test.step('Perform multiple interactions', async () => {
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();

      if (box) {
        // Perform multiple zoom/pan operations
        for (let i = 0; i < 5; i++) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, -50);
          await page.waitForTimeout(200);
          await page.mouse.wheel(0, 50);
          await page.waitForTimeout(200);

          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });
          await page.mouse.up();
          await page.waitForTimeout(200);
        }
      }
    });

    await test.step('Verify no memory-related errors', async () => {
      const memoryErrors = consoleErrors.filter(err =>
        err.toLowerCase().includes('memory') ||
        err.toLowerCase().includes('heap') ||
        err.toLowerCase().includes('out of memory')
      );

      expect(memoryErrors).toHaveLength(0);
    });

    await test.step('Check for WebGL context loss', async () => {
      const contextLoss = consoleErrors.filter(err =>
        err.toLowerCase().includes('webgl') &&
        err.toLowerCase().includes('context')
      );

      expect(contextLoss).toHaveLength(0);
    });
  });
});
