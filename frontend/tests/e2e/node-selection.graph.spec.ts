import { test, expect } from '@playwright/test';

test.describe('Node Selection Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3006');

    // Wait for graph to load
    await page.waitForSelector('canvas', { timeout: 10000 });

    // Wait for nodes to be rendered (give simulation time to settle)
    await page.waitForTimeout(3000);
  });

  test('should select only one node at a time when clicking different nodes', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/01-initial-state.png', fullPage: true });

    // Find all node elements (SVG circles or PIXI rendered nodes)
    // We'll click at specific coordinates on the canvas
    const canvas = await page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Click first node (approximate center-left position)
    const node1X = canvasBox.x + canvasBox.width * 0.3;
    const node1Y = canvasBox.y + canvasBox.height * 0.5;

    await page.mouse.click(node1X, node1Y);
    await page.waitForTimeout(500);

    // Screenshot after first selection
    await page.screenshot({ path: 'test-results/02-first-node-selected.png', fullPage: true });

    // Check console for selection state
    const selectedCount1 = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__?.getState?.() || {};
      return state.viewState?.selectedNodes?.size || 0;
    });

    console.log('Selected nodes after first click:', selectedCount1);

    // Click second node (different position)
    const node2X = canvasBox.x + canvasBox.width * 0.7;
    const node2Y = canvasBox.y + canvasBox.height * 0.5;

    await page.mouse.click(node2X, node2Y);
    await page.waitForTimeout(500);

    // Screenshot after second selection
    await page.screenshot({ path: 'test-results/03-second-node-selected.png', fullPage: true });

    // Check selection count - should still be 1
    const selectedCount2 = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__?.getState?.() || {};
      const selectedNodes = state.viewState?.selectedNodes;
      return {
        count: selectedNodes?.size || 0,
        ids: selectedNodes ? Array.from(selectedNodes) : []
      };
    });

    console.log('Selected nodes after second click:', selectedCount2);

    // ASSERTION: Only one node should be selected
    expect(selectedCount2.count).toBe(1);

    // Click third node
    const node3X = canvasBox.x + canvasBox.width * 0.5;
    const node3Y = canvasBox.y + canvasBox.height * 0.3;

    await page.mouse.click(node3X, node3Y);
    await page.waitForTimeout(500);

    // Screenshot after third selection
    await page.screenshot({ path: 'test-results/04-third-node-selected.png', fullPage: true });

    // Check selection count
    const selectedCount3 = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__?.getState?.() || {};
      return state.viewState?.selectedNodes?.size || 0;
    });

    console.log('Selected nodes after third click:', selectedCount3);

    // ASSERTION: Still only one node should be selected
    expect(selectedCount3).toBe(1);
  });

  test('should show visual selection indicator (blue tint) on selected node', async ({ page }) => {
    const canvas = await page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    // Click a node
    const nodeX = canvasBox.x + canvasBox.width * 0.5;
    const nodeY = canvasBox.y + canvasBox.height * 0.5;

    await page.mouse.click(nodeX, nodeY);
    await page.waitForTimeout(500);

    // Take screenshot showing selected node
    await page.screenshot({ path: 'test-results/05-visual-selection.png', fullPage: true });

    // Check if there's a visual indicator in the DOM or canvas
    const hasSelection = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__?.getState?.() || {};
      return state.viewState?.selectedNodes?.size > 0;
    });

    expect(hasSelection).toBe(true);
  });

  test('should deselect node when clicking the same node again', async ({ page }) => {
    const canvas = await page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas not found');
    }

    const nodeX = canvasBox.x + canvasBox.width * 0.5;
    const nodeY = canvasBox.y + canvasBox.height * 0.5;

    // First click to select
    await page.mouse.click(nodeX, nodeY);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/06-before-deselect.png', fullPage: true });

    const selectedBefore = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__?.getState?.() || {};
      return state.viewState?.selectedNodes?.size || 0;
    });

    console.log('Selected before second click:', selectedBefore);

    // Second click to deselect
    await page.mouse.click(nodeX, nodeY);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/07-after-deselect.png', fullPage: true });

    const selectedAfter = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__?.getState?.() || {};
      return state.viewState?.selectedNodes?.size || 0;
    });

    console.log('Selected after second click:', selectedAfter);

    // ASSERTION: Should be deselected
    expect(selectedAfter).toBe(0);
  });

  test('should clear selection state from localStorage on page load', async ({ page }) => {
    // Inject some selection state into localStorage
    await page.evaluate(() => {
      const fakeState = {
        state: {
          viewState: {
            selectedNodes: ['fake-node-1', 'fake-node-2', 'fake-node-3']
          }
        }
      };
      localStorage.setItem('songnodes-storage', JSON.stringify(fakeState));
    });

    // Reload the page
    await page.reload();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Screenshot after reload
    await page.screenshot({ path: 'test-results/08-after-reload-with-fake-state.png', fullPage: true });

    // Check that selection was cleared
    const selectedCount = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__?.getState?.() || {};
      return state.viewState?.selectedNodes?.size || 0;
    });

    console.log('Selected nodes after reload with fake localStorage:', selectedCount);

    // ASSERTION: No nodes should be selected after page load
    expect(selectedCount).toBe(0);
  });
});
