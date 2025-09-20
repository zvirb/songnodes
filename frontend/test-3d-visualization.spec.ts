import { test, expect } from '@playwright/test';
import { writeFileSync } from 'fs';

test.describe('3D Visualization Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`Console: ${msg.text()}`));

    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Direct 3D Mode Navigation', async ({ page }) => {
    console.log('🔍 Testing direct 3D mode navigation...');

    // Navigate directly to 3D mode using URL parameter
    await page.goto('http://localhost:3007?mode=3d');

    // Wait for the app to load
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/3d-mode-initial.png', fullPage: true });

    // Check if 3D mode is actually enabled
    const debugInfo = await page.locator('.absolute.top-2.right-2').textContent();
    console.log('Debug info:', debugInfo);

    expect(debugInfo).toContain('3D Mode');

    // Check console for 3D mode initialization
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await page.reload();
    await page.waitForTimeout(2000);

    // Look for 3D-specific elements
    const canvasElements = await page.locator('canvas').count();
    console.log(`Found ${canvasElements} canvas elements`);

    // Take screenshot after reload
    await page.screenshot({ path: 'test-results/3d-mode-after-reload.png', fullPage: true });
  });

  test('3D Mode Toggle Functionality', async ({ page }) => {
    console.log('🔍 Testing 3D mode toggle functionality...');

    // Start in 2D mode
    await page.goto('http://localhost:3007');
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

    // Take 2D mode screenshot
    await page.screenshot({ path: 'test-results/2d-mode-initial.png', fullPage: true });

    // Open Overview dropdown
    await page.click('button:has-text("Overview")');
    await page.waitForSelector('text=Visualization Mode:', { timeout: 5000 });

    // Take screenshot of toggle interface
    await page.screenshot({ path: 'test-results/toggle-interface.png', fullPage: true });

    // Click 3D Space button
    await page.click('button:has-text("3D Space")');

    // Wait for mode change
    await page.waitForTimeout(1000);

    // Verify 3D mode is active
    const debugInfo = await page.locator('.absolute.top-2.right-2').textContent();
    console.log('Debug info after toggle:', debugInfo);
    expect(debugInfo).toContain('3D Mode');

    // Take screenshot after switching to 3D
    await page.screenshot({ path: 'test-results/3d-mode-after-toggle.png', fullPage: true });

    // Check URL was updated
    const url = page.url();
    expect(url).toContain('mode=3d');

    // Switch back to 2D
    await page.click('button:has-text("2D Graph")');
    await page.waitForTimeout(1000);

    // Verify 2D mode
    const debugInfo2D = await page.locator('.absolute.top-2.right-2').textContent();
    expect(debugInfo2D).toContain('2D Mode');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/2d-mode-after-toggle.png', fullPage: true });
  });

  test('3D Canvas Rendering Check', async ({ page }) => {
    console.log('🔍 Testing 3D canvas rendering...');

    // Navigate to 3D mode
    await page.goto('http://localhost:3007?mode=3d');
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

    // Wait for potential data loading
    await page.waitForTimeout(3000);

    // Check for canvas elements
    const canvasElements = await page.locator('canvas').all();
    console.log(`Found ${canvasElements.length} canvas element(s)`);

    if (canvasElements.length > 0) {
      for (let i = 0; i < canvasElements.length; i++) {
        const canvas = canvasElements[i];
        const boundingBox = await canvas.boundingBox();
        console.log(`Canvas ${i} dimensions:`, boundingBox);

        // Check if canvas has content
        const canvasHandle = await canvas.elementHandle();
        const hasContent = await page.evaluate((canvas) => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Check if any pixel is not transparent
            for (let i = 3; i < imageData.data.length; i += 4) {
              if (imageData.data[i] !== 0) return true;
            }
          }
          return false;
        }, canvasHandle);

        console.log(`Canvas ${i} has content:`, hasContent);
      }
    }

    // Look for Three.js or WebGL indicators
    const threeJsElements = await page.evaluate(() => {
      // Check for Three.js specific elements
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.map(canvas => ({
        width: canvas.width,
        height: canvas.height,
        context: canvas.getContext('webgl') ? 'webgl' : canvas.getContext('2d') ? '2d' : 'none',
        className: canvas.className,
        parentElement: canvas.parentElement?.className || 'none'
      }));
    });

    console.log('Canvas analysis:', JSON.stringify(threeJsElements, null, 2));

    // Take detailed screenshot
    await page.screenshot({ path: 'test-results/3d-canvas-analysis.png', fullPage: true });

    // Check for specific 3D-related error messages
    const errorMessages = await page.evaluate(() => {
      const messages = [];
      // Check console for Three.js errors
      const logs = (window as any).consoleHistory || [];
      logs.forEach((log: any) => {
        if (log && log.toLowerCase().includes('three')) {
          messages.push(log);
        }
      });
      return messages;
    });

    console.log('Three.js related messages:', errorMessages);
  });

  test('Node Data Availability for 3D', async ({ page }) => {
    console.log('🔍 Testing node data availability for 3D rendering...');

    await page.goto('http://localhost:3007?mode=3d');
    await page.waitForSelector('[data-testid="graph-container"]', { timeout: 10000 });

    // Wait for data loading
    await page.waitForTimeout(5000);

    // Check Redux state for nodes and edges
    const stateInfo = await page.evaluate(() => {
      const state = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || (window as any).store?.getState();
      if (state) {
        const graphState = typeof state === 'function' ? state().graph : state.graph;
        return {
          nodesCount: graphState?.nodes?.length || 0,
          edgesCount: graphState?.edges?.length || 0,
          loading: graphState?.loading,
          nodes: graphState?.nodes?.slice(0, 3).map((n: any) => ({ id: n.id, type: n.type, title: n.title })) || []
        };
      }
      return { nodesCount: 0, edgesCount: 0, loading: true, nodes: [] };
    });

    console.log('Redux state info:', JSON.stringify(stateInfo, null, 2));

    // Check if we have the "Waiting for graph data" message
    const waitingMessage = await page.locator('text=Waiting for graph data').count();
    console.log('Waiting for data message count:', waitingMessage);

    // Check node count display
    const nodeCountElement = await page.locator('[data-testid="node-count"]').textContent();
    console.log('Node count display:', nodeCountElement);

    // Take screenshot showing current state
    await page.screenshot({ path: 'test-results/node-data-state.png', fullPage: true });

    // If no nodes, try to understand why
    if (stateInfo.nodesCount === 0) {
      console.log('❌ No nodes found - checking data loading process...');

      // Check for data loading attempts
      const dataLoadingLogs = await page.evaluate(() => {
        const logs = [];
        // Check for specific loading messages
        const consoleHistory = (window as any).consoleHistory || [];
        consoleHistory.forEach((log: string) => {
          if (log.includes('Loading') || log.includes('Data') || log.includes('nodes') || log.includes('edges')) {
            logs.push(log);
          }
        });
        return logs;
      });

      console.log('Data loading logs:', dataLoadingLogs);
    }
  });
});