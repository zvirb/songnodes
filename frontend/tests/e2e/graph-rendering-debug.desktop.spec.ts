import { test, expect } from '@playwright/test';

test.describe('Graph Rendering Debug', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3006');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Wait for graph data to load
    await page.waitForFunction(() => {
      const headerText = document.querySelector('header')?.textContent || '';
      return headerText.includes('Tracks Loaded');
    }, { timeout: 10000 });
  });

  test('should render graph container with non-zero dimensions', async ({ page }) => {
    // Find the graph container
    const graphContainer = page.locator('.graph-canvas, .graph-container').first();
    await expect(graphContainer).toBeVisible({ timeout: 10000 });

    // Check container dimensions
    const box = await graphContainer.boundingBox();
    console.log('📦 Container dimensions:', box);

    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    // Log to console
    await page.evaluate((dims) => {
      console.log('✅ TEST: Container has valid dimensions:', dims);
    }, box);
  });

  test('should append PIXI canvas to DOM', async ({ page }) => {
    // Wait for PIXI canvas to be created
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Check canvas dimensions
    const canvasBox = await canvas.boundingBox();
    console.log('🎨 Canvas dimensions:', canvasBox);

    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);

    // Verify canvas has WebGL context
    const hasWebGL = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return false;

      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      return !!gl;
    });

    console.log('🔷 Canvas has WebGL:', hasWebGL);
    expect(hasWebGL).toBe(true);
  });

  test('should log PIXI initialization details', async ({ page }) => {
    // Collect console logs
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('PIXI') || text.includes('Container') || text.includes('Zoom') || text.includes('viewport')) {
        logs.push(text);
        console.log('📝', text);
      }
    });

    // Wait a bit for logs to accumulate
    await page.waitForTimeout(2000);

    // Print summary
    console.log('\n📊 Initialization Logs Summary:');
    console.log('Total relevant logs:', logs.length);

    // Check for key log messages
    const hasInitLog = logs.some(log => log.includes('PIXI initialization complete'));
    const hasZoomLog = logs.some(log => log.includes('Setting initial D3 zoom transform'));
    const hasContainerLog = logs.some(log => log.includes('Container debug info'));

    console.log('✅ PIXI initialized:', hasInitLog);
    console.log('✅ Zoom transform set:', hasZoomLog);
    console.log('✅ Container logged:', hasContainerLog);

    // Verify critical logs exist
    expect(hasInitLog).toBe(true);
  });

  test('should have nodes and edges in the DOM', async ({ page }) => {
    // Wait for graph to render
    await page.waitForTimeout(3000);

    // Check for PIXI containers in the stage
    const nodeCount = await page.evaluate(() => {
      // Access PIXI app from window if exposed
      const app = (window as any).pixiApp;
      if (!app) return 0;

      // Count children in the stage
      let count = 0;
      const countChildren = (container: any): number => {
        let total = 0;
        if (container.children) {
          total += container.children.length;
          container.children.forEach((child: any) => {
            total += countChildren(child);
          });
        }
        return total;
      };

      return countChildren(app.stage);
    });

    console.log('🔢 Total PIXI objects in stage:', nodeCount);
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('should verify viewport and transform state', async ({ page }) => {
    // Get viewport and transform details from console logs
    const transformLog = await page.evaluate(() => {
      return new Promise((resolve) => {
        const originalLog = console.log;
        const logs: any[] = [];

        console.log = function(...args) {
          logs.push(args);
          originalLog.apply(console, args);
        };

        // Wait for transform log
        setTimeout(() => {
          const zoomLog = logs.find(log =>
            typeof log[0] === 'string' && log[0].includes('🎯 Zoom handler')
          );

          console.log = originalLog;
          resolve(zoomLog ? zoomLog[1] : null);
        }, 2000);
      });
    });

    console.log('🎯 Transform state:', transformLog);
    expect(transformLog).not.toBeNull();
  });

  test('should check for edge rendering', async ({ page }) => {
    // Wait for rendering
    await page.waitForTimeout(3000);

    // Check console for edge rendering logs
    const edgeLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('edge') && (text.includes('visible') || text.includes('rendered'))) {
        edgeLogs.push(text);
        console.log('🔗', text);
      }
    });

    await page.waitForTimeout(2000);

    console.log('\n🔗 Edge Rendering Logs:');
    edgeLogs.forEach(log => console.log('  ', log));

    // We should have some edge rendering logs
    expect(edgeLogs.length).toBeGreaterThan(0);
  });

  test('should take screenshot of current state', async ({ page }) => {
    // Wait for everything to settle
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/graph-debug.png',
      fullPage: true
    });

    console.log('📸 Screenshot saved to tests/e2e/screenshots/graph-debug.png');
  });
});
