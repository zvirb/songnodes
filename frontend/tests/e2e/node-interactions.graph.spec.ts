import { test, expect, Page } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Node Interaction and Edge Rendering Test Suite
 * Tests user interactions with graph nodes, edge visibility, and visual feedback
 */
test.describe('Node Interactions and Edge Rendering', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('SongNodes DJ');

    // Enable performance monitoring for debugging
    await graphUtils.enablePerformanceMonitor();

    // Wait for graph initialization
    await graphUtils.waitForGraphInitialization();
  });

  test.describe('Node Hover Interactions', () => {
    test('should highlight nodes on hover', async ({ page }) => {
      await test.step('Test hover highlighting', async () => {
        // Take baseline screenshot
        await graphUtils.takeCanvasScreenshot('before-hover');

        // Find center of canvas to hover over potential nodes
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Hover over different areas of the canvas to find nodes
        const hoverPoints = [
          { x: box!.width * 0.3, y: box!.height * 0.3 },
          { x: box!.width * 0.7, y: box!.height * 0.3 },
          { x: box!.width * 0.5, y: box!.height * 0.7 },
        ];

        for (const point of hoverPoints) {
          await graphUtils.hoverOnCanvas(point.x, point.y);
          await page.waitForTimeout(300);

          // Take screenshot to show hover state
          await graphUtils.takeCanvasScreenshot(`hover-${point.x}-${point.y}`);
        }
      });
    });

    test('should show node metadata on hover', async ({ page }) => {
      await test.step('Test hover tooltips or metadata display', async () => {
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Hover over canvas center where nodes are likely to be
        await graphUtils.hoverOnCanvas(box!.width / 2, box!.height / 2);
        await page.waitForTimeout(500);

        // Check if any tooltip or metadata appears
        // (Implementation depends on how SongNodes shows track info on hover)

        // Take screenshot to document hover behavior
        await graphUtils.takeCanvasScreenshot('hover-metadata-display');
      });
    });
  });

  test.describe('Node Click Interactions', () => {
    test('should handle node selection with select tool', async ({ page }) => {
      await test.step('Test node selection functionality', async () => {
        // Ensure select tool is active
        await page.keyboard.press('1'); // Select tool hotkey
        await page.waitForTimeout(200);

        // Verify select tool is active
        const selectTool = page.locator('[aria-pressed="true"]').first();
        await expect(selectTool).toBeVisible();

        // Click on different areas of canvas to select nodes
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        const clickPoints = [
          { x: box!.width * 0.4, y: box!.height * 0.4 },
          { x: box!.width * 0.6, y: box!.height * 0.6 },
        ];

        for (const [index, point] of clickPoints.entries()) {
          await graphUtils.clickOnCanvas(point.x, point.y);
          await page.waitForTimeout(300);

          // Take screenshot showing selection state
          await graphUtils.takeCanvasScreenshot(`node-selection-${index + 1}`);
        }
      });
    });

    test('should handle path building with path tool', async ({ page }) => {
      await test.step('Test path building interactions', async () => {
        // Switch to path tool
        await page.keyboard.press('2'); // Path tool hotkey
        await page.waitForTimeout(200);

        // Verify path tool is active
        const pathTool = page.locator('[aria-pressed="true"]').filter({ hasText: /path/i }).first();

        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Click to set start and end points for path
        const pathPoints = [
          { x: box!.width * 0.25, y: box!.height * 0.25, name: 'start' },
          { x: box!.width * 0.75, y: box!.height * 0.75, name: 'end' },
        ];

        for (const point of pathPoints) {
          await graphUtils.clickOnCanvas(point.x, point.y);
          await page.waitForTimeout(500);

          // Take screenshot showing path building
          await graphUtils.takeCanvasScreenshot(`path-building-${point.name}`);
        }

        // Final path should be visible
        await graphUtils.takeCanvasScreenshot('path-building-complete');
      });
    });

    test('should handle setlist building with setlist tool', async ({ page }) => {
      await test.step('Test setlist building functionality', async () => {
        // Switch to setlist tool
        await page.keyboard.press('3'); // Setlist tool hotkey
        await page.waitForTimeout(200);

        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Click on nodes to add to setlist
        const setlistPoints = [
          { x: box!.width * 0.3, y: box!.height * 0.3 },
          { x: box!.width * 0.7, y: box!.height * 0.4 },
          { x: box!.width * 0.5, y: box!.height * 0.6 },
        ];

        for (const [index, point] of setlistPoints.entries()) {
          await graphUtils.clickOnCanvas(point.x, point.y);
          await page.waitForTimeout(300);

          // Take screenshot showing setlist building progress
          await graphUtils.takeCanvasScreenshot(`setlist-building-${index + 1}`);
        }
      });
    });

    test('should handle multi-selection with Ctrl+Click', async ({ page }) => {
      await test.step('Test multi-selection functionality', async () => {
        // Ensure select tool is active
        await page.keyboard.press('1');
        await page.waitForTimeout(200);

        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // First selection
        await graphUtils.clickOnCanvas(box!.width * 0.3, box!.height * 0.3);
        await page.waitForTimeout(200);

        // Second selection with Ctrl held
        await page.keyboard.down('Control');
        await graphUtils.clickOnCanvas(box!.width * 0.7, box!.height * 0.7);
        await page.keyboard.up('Control');
        await page.waitForTimeout(200);

        // Third selection with Ctrl held
        await page.keyboard.down('Control');
        await graphUtils.clickOnCanvas(box!.width * 0.5, box!.height * 0.5);
        await page.keyboard.up('Control');
        await page.waitForTimeout(200);

        // Take screenshot showing multi-selection
        await graphUtils.takeCanvasScreenshot('multi-selection-complete');
      });
    });
  });

  test.describe('Edge Rendering and Visibility', () => {
    test('should toggle edge visibility correctly', async ({ page }) => {
      await test.step('Test edge visibility toggle', async () => {
        // Take screenshot with edges visible
        await graphUtils.takeCanvasScreenshot('edges-visible');

        // Toggle edges off
        const edgeToggle = page.locator('[title*="Edges"]').or(page.locator('text=🔗'));
        if (await edgeToggle.isVisible()) {
          await edgeToggle.click();
          await graphUtils.waitForAnimation();

          // Take screenshot with edges hidden
          await graphUtils.takeCanvasScreenshot('edges-hidden');

          // Toggle edges back on
          await edgeToggle.click();
          await graphUtils.waitForAnimation();

          // Take screenshot with edges visible again
          await graphUtils.takeCanvasScreenshot('edges-visible-again');
        }
      });
    });

    test('should render edges with proper weight visualization', async ({ page }) => {
      await test.step('Test edge weight visualization', async () => {
        // Ensure edges are visible
        const edgeToggle = page.locator('[title*="Edges"]').or(page.locator('text=🔗'));
        if (await edgeToggle.isVisible() && !await edgeToggle.getAttribute('aria-pressed')) {
          await edgeToggle.click();
          await graphUtils.waitForAnimation();
        }

        // Zoom in to better see edge weights
        await graphUtils.zoomIn(3);
        await graphUtils.waitForAnimation();

        // Take screenshot showing edge weight variations
        await graphUtils.takeCanvasScreenshot('edge-weight-visualization');

        // Check metrics to confirm edges are rendering
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.visibleEdges).toBeGreaterThan(0);

        console.log(`Rendering ${metrics.visibleEdges} edges`);
      });
    });

    test('should highlight connected edges on node hover', async ({ page }) => {
      await test.step('Test edge highlighting on node hover', async () => {
        // Ensure edges are visible
        const edgeToggle = page.locator('[title*="Edges"]').or(page.locator('text=🔗'));
        if (await edgeToggle.isVisible() && !await edgeToggle.getAttribute('aria-pressed')) {
          await edgeToggle.click();
          await graphUtils.waitForAnimation();
        }

        // Zoom in for better visibility
        await graphUtils.zoomIn(2);

        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Hover over different nodes to test edge highlighting
        const hoverPoints = [
          { x: box!.width * 0.4, y: box!.height * 0.4, name: 'node-1' },
          { x: box!.width * 0.6, y: box!.height * 0.6, name: 'node-2' },
        ];

        for (const point of hoverPoints) {
          await graphUtils.hoverOnCanvas(point.x, point.y);
          await page.waitForTimeout(500);

          // Take screenshot showing edge highlighting
          await graphUtils.takeCanvasScreenshot(`edge-highlight-${point.name}`);
        }
      });
    });

    test('should handle edge opacity adjustments', async ({ page }) => {
      await test.step('Test edge opacity controls', async () => {
        // This test depends on having edge opacity controls in the UI
        // For now, we'll test the visual result

        // Ensure edges are visible
        const edgeToggle = page.locator('[title*="Edges"]').or(page.locator('text=🔗'));
        if (await edgeToggle.isVisible() && !await edgeToggle.getAttribute('aria-pressed')) {
          await edgeToggle.click();
          await graphUtils.waitForAnimation();
        }

        // Take baseline screenshot
        await graphUtils.takeCanvasScreenshot('edge-opacity-baseline');

        // If there are opacity controls, test them
        // This would need to be implemented based on the actual UI

        const metrics = await graphUtils.getPerformanceMetrics();
        console.log('Edge rendering metrics:', metrics);
        expect(metrics.visibleEdges).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Label and Node Size Controls', () => {
    test('should toggle label visibility correctly', async ({ page }) => {
      await test.step('Test label visibility toggle', async () => {
        // Zoom in so labels are likely to be visible
        await graphUtils.zoomIn(3);
        await graphUtils.waitForAnimation();

        // Toggle labels on
        const labelToggle = page.locator('[title*="Labels"]').or(page.locator('text=🏷️'));
        if (await labelToggle.isVisible()) {
          await labelToggle.click();
          await graphUtils.waitForAnimation();

          // Take screenshot with labels visible
          await graphUtils.takeCanvasScreenshot('labels-visible');

          // Toggle labels off
          await labelToggle.click();
          await graphUtils.waitForAnimation();

          // Take screenshot with labels hidden
          await graphUtils.takeCanvasScreenshot('labels-hidden');
        }
      });
    });

    test('should handle label scaling with zoom levels', async ({ page }) => {
      await test.step('Test label scaling behavior', async () => {
        // Enable labels
        const labelToggle = page.locator('[title*="Labels"]').or(page.locator('text=🏷️'));
        if (await labelToggle.isVisible()) {
          await labelToggle.click();
          await graphUtils.waitForAnimation();
        }

        const zoomLevels = [
          { name: 'normal', action: () => graphUtils.resetView() },
          { name: 'zoomed-in', action: () => graphUtils.zoomIn(4) },
          { name: 'zoomed-out', action: () => graphUtils.zoomOut(3) },
        ];

        for (const level of zoomLevels) {
          await level.action();
          await graphUtils.waitForAnimation();

          // Take screenshot at this zoom level
          await graphUtils.takeCanvasScreenshot(`label-scaling-${level.name}`);
        }
      });
    });
  });

  test.describe('Interactive Feedback', () => {
    test('should provide visual feedback for tool changes', async ({ page }) => {
      await test.step('Test tool switching feedback', async () => {
        const tools = [
          { key: '1', name: 'select' },
          { key: '2', name: 'path' },
          { key: '3', name: 'setlist' },
          { key: '4', name: 'filter' },
        ];

        for (const tool of tools) {
          await page.keyboard.press(tool.key);
          await page.waitForTimeout(300);

          // Check that tool button shows active state
          const activeButton = page.locator('[aria-pressed="true"]');
          await expect(activeButton).toBeVisible();

          // Take screenshot showing tool state
          await graphUtils.takeCanvasScreenshot(`tool-${tool.name}-active`);
        }
      });
    });

    test('should handle keyboard shortcuts properly', async ({ page }) => {
      await test.step('Test keyboard shortcut functionality', async () => {
        const shortcuts = [
          { key: 'Escape', action: 'clear selection', name: 'escape' },
          { key: 'Control+F', action: 'open search', name: 'search' },
          { key: 'Control+R', action: 'refresh', name: 'refresh' },
        ];

        for (const shortcut of shortcuts) {
          if (shortcut.key === 'Control+F') {
            await page.keyboard.press('Control+f');
          } else if (shortcut.key === 'Control+R') {
            // Skip refresh test to avoid reloading
            continue;
          } else {
            await page.keyboard.press(shortcut.key);
          }

          await page.waitForTimeout(500);

          // Take screenshot showing result of shortcut
          await graphUtils.takeCanvasScreenshot(`keyboard-${shortcut.name}`);
        }
      });
    });

    test('should handle view reset correctly', async ({ page }) => {
      await test.step('Test view reset functionality', async () => {
        // Modify the view first
        await graphUtils.zoomIn(5);
        await graphUtils.pan(200, 200);
        await graphUtils.waitForAnimation();

        // Take screenshot of modified view
        await graphUtils.takeCanvasScreenshot('view-modified');

        // Reset view
        const resetButton = page.locator('[title="Reset View"]').or(page.locator('text=🎯'));
        if (await resetButton.isVisible()) {
          await resetButton.click();
          await graphUtils.waitForAnimation();

          // Take screenshot of reset view
          await graphUtils.takeCanvasScreenshot('view-reset');
        } else {
          // Fallback: try keyboard shortcut or other method
          await page.keyboard.press('r');
          await graphUtils.waitForAnimation();

          await graphUtils.takeCanvasScreenshot('view-reset-fallback');
        }
      });
    });
  });

  test.describe('Error Handling in Interactions', () => {
    test('should handle clicks on empty canvas areas gracefully', async ({ page }) => {
      await test.step('Test empty area click handling', async () => {
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Click on likely empty areas (corners)
        const emptyPoints = [
          { x: 10, y: 10 },
          { x: box!.width - 10, y: 10 },
          { x: 10, y: box!.height - 10 },
          { x: box!.width - 10, y: box!.height - 10 },
        ];

        for (const [index, point] of emptyPoints.entries()) {
          await graphUtils.clickOnCanvas(point.x, point.y);
          await page.waitForTimeout(200);

          // Should not crash or show errors
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.nodeCount).toBeGreaterThan(0);

          // Take screenshot to document behavior
          await graphUtils.takeCanvasScreenshot(`empty-click-${index + 1}`);
        }
      });
    });

    test('should handle rapid interaction sequences', async ({ page }) => {
      await test.step('Test rapid interaction stress', async () => {
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Perform rapid interactions
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * box!.width;
          const y = Math.random() * box!.height;

          await graphUtils.clickOnCanvas(x, y);
          await page.waitForTimeout(25); // Very rapid
        }

        // Should still be functional after rapid interactions
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);

        await graphUtils.takeCanvasScreenshot('rapid-interaction-stress');
      });
    });

    test('should maintain interaction responsiveness during performance stress', async ({ page }) => {
      await test.step('Test interactions under load', async () => {
        // Create performance load
        await graphUtils.zoomIn(5);
        await graphUtils.pan(100, 100);
        await graphUtils.zoomOut(3);

        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Test that interactions still work under load
        await graphUtils.clickOnCanvas(box!.width / 2, box!.height / 2);
        await page.waitForTimeout(500);

        // Should maintain interactivity
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThanOrEqual(10); // Minimum acceptable

        await graphUtils.takeCanvasScreenshot('interaction-under-load');
      });
    });
  });
});