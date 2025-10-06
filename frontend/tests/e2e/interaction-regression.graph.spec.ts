import { test, expect } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Interaction Regression Test
 *
 * Tests critical user interactions that have regressed:
 * 1. Zoom-to-cursor functionality
 * 2. Node selection camera centering
 * 3. Right-click context menu display
 */
test.describe('Interaction Regression Tests', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('SongNodes DJ', { timeout: 10000 });
    await graphUtils.waitForGraphInitialization();
  });

  test('zoom-to-cursor should work correctly', async ({ page }) => {
    const canvas = page.locator('canvas[data-testid="pixi-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Get initial viewport state
    const initialState = await page.evaluate(() => {
      const viewport = (window as any).viewportRef?.current;
      return {
        zoom: viewport?.zoom || 1,
        x: viewport?.x || 0,
        y: viewport?.y || 0
      };
    });

    console.log('🔍 Initial viewport:', initialState);

    // Get canvas bounding box
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Zoom in at a specific point (not center)
    const zoomPoint = {
      x: canvasBox.x + canvasBox.width * 0.7,  // 70% from left
      y: canvasBox.y + canvasBox.height * 0.3   // 30% from top
    };

    console.log('🎯 Zooming at point:', zoomPoint);

    // Perform wheel zoom
    await page.mouse.move(zoomPoint.x, zoomPoint.y);
    await page.mouse.wheel(0, -300); // Zoom in
    await page.waitForTimeout(500);

    // Check if zoom happened and if it zoomed toward cursor
    const afterZoomState = await page.evaluate(() => {
      const viewport = (window as any).viewportRef?.current;
      return {
        zoom: viewport?.zoom || 1,
        x: viewport?.x || 0,
        y: viewport?.y || 0
      };
    });

    console.log('🔍 After zoom viewport:', afterZoomState);

    // Zoom should have increased
    expect(afterZoomState.zoom).toBeGreaterThan(initialState.zoom);

    // Pan should have changed (zoom-to-cursor effect)
    const panChanged = afterZoomState.x !== initialState.x || afterZoomState.y !== initialState.y;

    if (!panChanged) {
      console.error('❌ Zoom-to-cursor FAILED: Pan did not change');
      console.error('Expected: Pan values should change when zooming off-center');
      console.error('Actual: Pan stayed the same:', { initial: initialState, after: afterZoomState });
    }

    await graphUtils.takeCanvasScreenshot('zoom-to-cursor-test');

    expect(panChanged).toBeTruthy();
  });

  test('node selection should center camera on node', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(2000);

    // Get a node's position
    const nodeInfo = await page.evaluate(() => {
      const nodes = (window as any).enhancedNodesRef?.current;
      if (!nodes || nodes.size === 0) return null;

      const firstNode = Array.from(nodes.values())[0] as any;
      return {
        id: firstNode.id,
        x: firstNode.x,
        y: firstNode.y,
        pixiExists: !!firstNode.pixiNode
      };
    });

    expect(nodeInfo).toBeTruthy();
    console.log('🎯 Target node:', nodeInfo);

    // Get initial viewport
    const initialViewport = await page.evaluate(() => {
      const vp = (window as any).viewportRef?.current;
      return { x: vp?.x || 0, y: vp?.y || 0, zoom: vp?.zoom || 1 };
    });

    console.log('📍 Initial viewport:', initialViewport);

    // Click on the node to select it
    const canvas = page.locator('canvas[data-testid="pixi-canvas"]');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Calculate where the node appears on screen
    const screenX = (nodeInfo!.x * initialViewport.zoom) + (canvasBox.width / 2) + initialViewport.x;
    const screenY = (nodeInfo!.y * initialViewport.zoom) + (canvasBox.height / 2) + initialViewport.y;

    console.log('🖱️ Clicking at screen position:', { screenX, screenY });

    await page.mouse.click(canvasBox.x + screenX, canvasBox.y + screenY);
    await page.waitForTimeout(1000); // Wait for camera centering animation

    // Check if camera centered on node
    const afterViewport = await page.evaluate(() => {
      const vp = (window as any).viewportRef?.current;
      return { x: vp?.x || 0, y: vp?.y || 0, zoom: vp?.zoom || 1 };
    });

    console.log('📍 After selection viewport:', afterViewport);

    // Camera should have moved
    const cameraMoved = afterViewport.x !== initialViewport.x || afterViewport.y !== initialViewport.y;

    if (!cameraMoved) {
      console.error('❌ Camera centering FAILED: Viewport did not move');
      console.error('Expected: Camera should center on selected node');
      console.error('Actual: Viewport stayed at:', afterViewport);
    }

    await graphUtils.takeCanvasScreenshot('node-selection-centering-test');

    expect(cameraMoved).toBeTruthy();
  });

  test('right-click context menu should display correctly', async ({ page }) => {
    // Wait for nodes to load
    await page.waitForTimeout(2000);

    // Get canvas dimensions BEFORE right-click
    const canvas = page.locator('canvas[data-testid="pixi-canvas"]');
    const initialCanvasBox = await canvas.boundingBox();
    console.log('📏 Initial canvas dimensions:', initialCanvasBox);

    // Right-click on a node
    const nodeInfo = await page.evaluate(() => {
      const nodes = (window as any).enhancedNodesRef?.current;
      if (!nodes || nodes.size === 0) return null;

      const firstNode = Array.from(nodes.values())[0] as any;
      const viewport = (window as any).viewportRef?.current;

      return {
        id: firstNode.id,
        worldX: firstNode.x,
        worldY: firstNode.y,
        screenX: (firstNode.x * viewport.zoom) + (viewport.width / 2) + viewport.x,
        screenY: (firstNode.y * viewport.zoom) + (viewport.height / 2) + viewport.y
      };
    });

    expect(nodeInfo).toBeTruthy();
    console.log('🎯 Right-clicking node:', nodeInfo);

    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    // Perform right-click
    await page.mouse.click(
      canvasBox.x + nodeInfo!.screenX,
      canvasBox.y + nodeInfo!.screenY,
      { button: 'right' }
    );

    await page.waitForTimeout(500);

    // Check if context menu appeared
    const contextMenu = page.locator('.context-menu, [role="menu"], .node-context-menu');
    const menuVisible = await contextMenu.isVisible().catch(() => false);

    console.log('🍔 Context menu visible:', menuVisible);

    // Take screenshot
    await page.screenshot({
      path: 'frontend/tests/screenshots/context-menu-test.png',
      fullPage: false
    });

    // Check canvas dimensions AFTER context menu
    const afterCanvasBox = await canvas.boundingBox();
    console.log('📏 After context menu canvas dimensions:', afterCanvasBox);

    // Check if canvas got "scrunched"
    if (initialCanvasBox && afterCanvasBox) {
      const widthDiff = Math.abs(afterCanvasBox.width - initialCanvasBox.width);
      const heightDiff = Math.abs(afterCanvasBox.height - initialCanvasBox.height);

      if (widthDiff > 10 || heightDiff > 10) {
        console.error('❌ CANVAS CORRUPTION DETECTED!');
        console.error('Canvas dimensions changed after context menu:');
        console.error('  Before:', initialCanvasBox);
        console.error('  After:', afterCanvasBox);
        console.error('  Width diff:', widthDiff, 'Height diff:', heightDiff);

        expect(widthDiff).toBeLessThan(10);
        expect(heightDiff).toBeLessThan(10);
      }
    }

    expect(menuVisible).toBeTruthy();
  });
});
