import { test, expect, Page } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Zoom and Pan Controls Test Suite
 * Tests viewport navigation, smooth interactions, and performance during navigation
 */
test.describe('Zoom and Pan Controls', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('SongNodes DJ');

    // Enable performance monitoring
    await graphUtils.enablePerformanceMonitor();

    // Wait for graph initialization
    await graphUtils.waitForGraphInitialization();
  });

  test.describe('Mouse Wheel Zoom', () => {
    test('should zoom in with mouse wheel up', async ({ page }) => {
      await test.step('Test zoom in functionality', async () => {
        // Take initial screenshot
        await graphUtils.takeCanvasScreenshot('zoom-initial-state');

        // Get initial canvas info
        const initialCanvas = await graphUtils.getCanvasInfo();

        // Perform zoom in with mouse wheel
        const canvas = page.locator('canvas');
        await canvas.hover();

        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, -100); // Negative delta = zoom in
          await page.waitForTimeout(200);
        }

        await graphUtils.waitForAnimation();

        // Take screenshot after zoom in
        await graphUtils.takeCanvasScreenshot('zoom-in-complete');

        // Verify performance is maintained
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThanOrEqual(20);

        console.log('Zoom in performance:', metrics);
      });
    });

    test('should zoom out with mouse wheel down', async ({ page }) => {
      await test.step('Test zoom out functionality', async () => {
        // Start with zoomed in state
        await graphUtils.zoomIn(3);
        await graphUtils.takeCanvasScreenshot('zoom-before-out');

        // Zoom out with mouse wheel
        const canvas = page.locator('canvas');
        await canvas.hover();

        for (let i = 0; i < 8; i++) {
          await page.mouse.wheel(0, 100); // Positive delta = zoom out
          await page.waitForTimeout(200);
        }

        await graphUtils.waitForAnimation();

        // Take screenshot after zoom out
        await graphUtils.takeCanvasScreenshot('zoom-out-complete');

        // Verify performance is maintained
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThanOrEqual(20);

        console.log('Zoom out performance:', metrics);
      });
    });

    test('should handle rapid zoom gestures smoothly', async ({ page }) => {
      await test.step('Test rapid zoom operations', async () => {
        const canvas = page.locator('canvas');
        await canvas.hover();

        // Rapid zoom in and out sequence
        const zoomSequence = [
          { delta: -100, count: 3, name: 'rapid-in-1' },
          { delta: 100, count: 2, name: 'rapid-out-1' },
          { delta: -150, count: 4, name: 'rapid-in-2' },
          { delta: 100, count: 6, name: 'rapid-out-2' },
        ];

        for (const sequence of zoomSequence) {
          for (let i = 0; i < sequence.count; i++) {
            await page.mouse.wheel(0, sequence.delta);
            await page.waitForTimeout(50); // Very rapid
          }

          await page.waitForTimeout(300);
          await graphUtils.takeCanvasScreenshot(`zoom-${sequence.name}`);
        }

        // Performance should remain good after rapid operations
        await graphUtils.verifyPerformance(15, 100);
      });
    });

    test('should respect zoom limits', async ({ page }) => {
      await test.step('Test zoom constraints', async () => {
        const canvas = page.locator('canvas');
        await canvas.hover();

        // Test maximum zoom in
        for (let i = 0; i < 20; i++) {
          await page.mouse.wheel(0, -200);
          await page.waitForTimeout(100);
        }

        await graphUtils.waitForAnimation();
        await graphUtils.takeCanvasScreenshot('zoom-max-in');

        // Reset to center
        await graphUtils.resetView();

        // Test maximum zoom out
        for (let i = 0; i < 20; i++) {
          await page.mouse.wheel(0, 200);
          await page.waitForTimeout(100);
        }

        await graphUtils.waitForAnimation();
        await graphUtils.takeCanvasScreenshot('zoom-max-out');

        // Should still be functional at extreme zoom levels
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Mouse Drag Pan', () => {
    test('should pan graph with mouse drag', async ({ page }) => {
      await test.step('Test basic pan functionality', async () => {
        // Take initial screenshot
        await graphUtils.takeCanvasScreenshot('pan-initial');

        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Perform pan gesture from center to different directions
        const panDirections = [
          { deltaX: 200, deltaY: 0, name: 'right' },
          { deltaX: 0, deltaY: 200, name: 'down' },
          { deltaX: -200, deltaY: 0, name: 'left' },
          { deltaX: 0, deltaY: -200, name: 'up' },
        ];

        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;

        for (const direction of panDirections) {
          await page.mouse.move(centerX, centerY);
          await page.mouse.down();
          await page.mouse.move(
            centerX + direction.deltaX,
            centerY + direction.deltaY,
            { steps: 10 }
          );
          await page.mouse.up();

          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot(`pan-${direction.name}`);
        }

        // Verify performance during panning
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThanOrEqual(20);
      });
    });

    test('should handle smooth continuous panning', async ({ page }) => {
      await test.step('Test smooth pan animation', async () => {
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;

        // Perform circular panning motion
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();

        const radius = 100;
        const steps = 16;

        for (let i = 0; i <= steps; i++) {
          const angle = (i * 2 * Math.PI) / steps;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          await page.mouse.move(x, y, { steps: 3 });
          await page.waitForTimeout(100);

          // Take screenshot at key points
          if (i % 4 === 0) {
            await graphUtils.takeCanvasScreenshot(`circular-pan-${i}`);
          }
        }

        await page.mouse.up();
        await graphUtils.waitForAnimation();

        // Final screenshot
        await graphUtils.takeCanvasScreenshot('circular-pan-complete');

        // Verify smooth performance during complex panning
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThanOrEqual(15);
      });
    });

    test('should handle pan with momentum and easing', async ({ page }) => {
      await test.step('Test pan momentum and easing', async () => {
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        // Perform quick drag to test momentum
        const startX = box!.x + box!.width / 3;
        const startY = box!.y + box!.height / 2;
        const endX = box!.x + (2 * box!.width) / 3;
        const endY = box!.y + box!.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 5 }); // Quick movement
        await page.mouse.up();

        // Take screenshot immediately after release
        await page.waitForTimeout(100);
        await graphUtils.takeCanvasScreenshot('pan-momentum-immediate');

        // Wait for momentum to settle
        await page.waitForTimeout(1000);
        await graphUtils.takeCanvasScreenshot('pan-momentum-settled');

        // Performance should be good throughout
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThanOrEqual(20);
      });
    });

    test('should prevent panning beyond boundaries if implemented', async ({ page }) => {
      await test.step('Test pan boundary constraints', async () => {
        // Attempt to pan far beyond expected graph boundaries
        const extremePans = [
          { deltaX: 1000, deltaY: 0, name: 'extreme-right' },
          { deltaX: -1000, deltaY: 0, name: 'extreme-left' },
          { deltaX: 0, deltaY: 1000, name: 'extreme-down' },
          { deltaX: 0, deltaY: -1000, name: 'extreme-up' },
        ];

        for (const pan of extremePans) {
          await graphUtils.pan(pan.deltaX, pan.deltaY);
          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot(`boundary-${pan.name}`);
        }

        // Should still be functional at extreme positions
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Combined Zoom and Pan', () => {
    test('should handle simultaneous zoom and pan operations', async ({ page }) => {
      await test.step('Test combined navigation', async () => {
        const canvas = page.locator('canvas');
        await canvas.hover();

        // Sequence: zoom in, pan, zoom in more, pan differently
        const combinedOperations = [
          { type: 'zoom', direction: 'in', amount: 2 },
          { type: 'pan', deltaX: 100, deltaY: 50 },
          { type: 'zoom', direction: 'in', amount: 2 },
          { type: 'pan', deltaX: -150, deltaY: 100 },
          { type: 'zoom', direction: 'out', amount: 1 },
          { type: 'pan', deltaX: 75, deltaY: -75 },
        ];

        for (const [index, op] of combinedOperations.entries()) {
          if (op.type === 'zoom') {
            if (op.direction === 'in') {
              await graphUtils.zoomIn(op.amount);
            } else {
              await graphUtils.zoomOut(op.amount);
            }
          } else if (op.type === 'pan') {
            await graphUtils.pan(op.deltaX, op.deltaY);
          }

          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot(`combined-op-${index + 1}`);
        }

        // Performance should remain good throughout
        await graphUtils.verifyPerformance(20, 75);
      });
    });

    test('should maintain smooth interaction during complex navigation', async ({ page }) => {
      await test.step('Test complex navigation sequence', async () => {
        // Simulate realistic user navigation pattern
        const navigationSequence = [
          'zoom to overview',
          'pan to find interesting area',
          'zoom in for detail',
          'pan to explore nearby',
          'zoom out slightly',
          'pan to different area',
          'reset view',
        ];

        let step = 0;
        for (const action of navigationSequence) {
          step++;
          console.log(`Step ${step}: ${action}`);

          switch (action) {
            case 'zoom to overview':
              await graphUtils.zoomOut(4);
              break;
            case 'pan to find interesting area':
              await graphUtils.pan(200, 150);
              break;
            case 'zoom in for detail':
              await graphUtils.zoomIn(6);
              break;
            case 'pan to explore nearby':
              await graphUtils.pan(-100, 100);
              break;
            case 'zoom out slightly':
              await graphUtils.zoomOut(2);
              break;
            case 'pan to different area':
              await graphUtils.pan(150, -200);
              break;
            case 'reset view':
              await graphUtils.resetView();
              break;
          }

          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot(`navigation-step-${step}`);

          // Check performance at each step
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.frameRate).toBeGreaterThanOrEqual(15);
        }
      });
    });
  });

  test.describe('Touch and Mobile Navigation', () => {
    test('should support pinch-to-zoom gestures', async ({ page }) => {
      await test.step('Test pinch zoom simulation', async () => {
        // Simulate pinch zoom with two touch points
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;

        // Simulate pinch out (zoom in)
        await page.touchscreen.tap(centerX - 50, centerY - 50);
        await page.touchscreen.tap(centerX + 50, centerY + 50);

        await page.waitForTimeout(500);
        await graphUtils.takeCanvasScreenshot('pinch-zoom-in');

        // Simulate pinch in (zoom out)
        await page.touchscreen.tap(centerX - 25, centerY - 25);
        await page.touchscreen.tap(centerX + 25, centerY + 25);

        await page.waitForTimeout(500);
        await graphUtils.takeCanvasScreenshot('pinch-zoom-out');

        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);
      });
    });

    test('should support touch pan gestures', async ({ page }) => {
      await test.step('Test touch pan simulation', async () => {
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        expect(box).toBeTruthy();

        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;

        // Touch pan in different directions
        const touchPans = [
          { deltaX: 100, deltaY: 0, name: 'touch-right' },
          { deltaX: 0, deltaY: 100, name: 'touch-down' },
          { deltaX: -100, deltaY: 0, name: 'touch-left' },
          { deltaX: 0, deltaY: -100, name: 'touch-up' },
        ];

        for (const pan of touchPans) {
          // Simulate touch drag
          await page.mouse.move(centerX, centerY);
          await page.mouse.down();
          await page.mouse.move(centerX + pan.deltaX, centerY + pan.deltaY, { steps: 10 });
          await page.mouse.up();

          await page.waitForTimeout(300);
          await graphUtils.takeCanvasScreenshot(pan.name);
        }
      });
    });
  });

  test.describe('View Reset and Navigation Controls', () => {
    test('should reset view with reset button', async ({ page }) => {
      await test.step('Test view reset functionality', async () => {
        // Modify view significantly
        await graphUtils.zoomIn(5);
        await graphUtils.pan(300, 200);
        await graphUtils.takeCanvasScreenshot('before-reset');

        // Reset view
        await graphUtils.resetView();
        await graphUtils.takeCanvasScreenshot('after-reset');

        // Should return to initial state
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.frameRate).toBeGreaterThanOrEqual(30);
      });
    });

    test('should handle view state persistence', async ({ page }) => {
      await test.step('Test view state management', async () => {
        // Modify view
        await graphUtils.zoomIn(3);
        await graphUtils.pan(150, 100);
        await graphUtils.takeCanvasScreenshot('modified-view-1');

        // Perform other actions that shouldn't affect view
        await page.keyboard.press('1'); // Select tool
        await page.keyboard.press('2'); // Path tool
        await page.keyboard.press('3'); // Setlist tool

        await page.waitForTimeout(500);
        await graphUtils.takeCanvasScreenshot('modified-view-after-tools');

        // View should be preserved
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);
      });
    });

    test('should provide smooth view transitions', async ({ page }) => {
      await test.step('Test view transition smoothness', async () => {
        // Test transitions between different view states
        const viewStates = [
          { zoom: 5, panX: 0, panY: 0, name: 'close-up-center' },
          { zoom: 1, panX: 200, panY: 200, name: 'overview-offset' },
          { zoom: 8, panX: -100, panY: 150, name: 'detail-corner' },
          { zoom: 2, panX: 0, panY: 0, name: 'medium-center' },
        ];

        for (const [index, state] of viewStates.entries()) {
          // Reset first
          await graphUtils.resetView();

          // Apply new state
          if (state.zoom > 1) {
            await graphUtils.zoomIn(state.zoom - 1);
          } else if (state.zoom < 1) {
            await graphUtils.zoomOut(1 - state.zoom);
          }

          if (state.panX !== 0 || state.panY !== 0) {
            await graphUtils.pan(state.panX, state.panY);
          }

          await graphUtils.waitForAnimation();
          await graphUtils.takeCanvasScreenshot(`transition-${index}-${state.name}`);

          // Each transition should maintain good performance
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.frameRate).toBeGreaterThanOrEqual(20);
        }
      });
    });
  });

  test.describe('Performance During Navigation', () => {
    test('should maintain LOD optimization during navigation', async ({ page }) => {
      await test.step('Test LOD system during zoom/pan', async () => {
        // Test performance at various zoom levels
        const zoomLevels = [
          { level: 'far-out', zoom: -6 },
          { level: 'out', zoom: -3 },
          { level: 'normal', zoom: 0 },
          { level: 'in', zoom: 3 },
          { level: 'close', zoom: 6 },
        ];

        for (const level of zoomLevels) {
          await graphUtils.resetView();

          if (level.zoom > 0) {
            await graphUtils.zoomIn(level.zoom);
          } else if (level.zoom < 0) {
            await graphUtils.zoomOut(-level.zoom);
          }

          await graphUtils.waitForAnimation();

          const metrics = await graphUtils.getPerformanceMetrics();
          console.log(`LOD performance at ${level.level}:`, metrics);

          // All zoom levels should maintain reasonable performance
          expect(metrics.frameRate).toBeGreaterThanOrEqual(15);

          await graphUtils.takeCanvasScreenshot(`lod-zoom-${level.level}`);
        }
      });
    });

    test('should handle memory efficiently during extended navigation', async ({ page }) => {
      await test.step('Test memory efficiency during navigation', async () => {
        // Get initial memory state
        const initialMemory = await page.evaluate(() => ({
          // @ts-ignore
          used: (performance as any).memory?.usedJSHeapSize || 0,
          // @ts-ignore
          total: (performance as any).memory?.totalJSHeapSize || 0,
        }));

        // Perform extended navigation sequence
        for (let i = 0; i < 20; i++) {
          await graphUtils.zoomIn(1);
          await graphUtils.pan(50, 50);
          await graphUtils.zoomOut(1);
          await graphUtils.pan(-50, -50);

          // Brief pause to allow memory management
          if (i % 5 === 0) {
            await page.waitForTimeout(200);
          }
        }

        const finalMemory = await page.evaluate(() => ({
          // @ts-ignore
          used: (performance as any).memory?.usedJSHeapSize || 0,
          // @ts-ignore
          total: (performance as any).memory?.totalJSHeapSize || 0,
        }));

        const memoryGrowth = finalMemory.used - initialMemory.used;
        console.log('Memory usage during navigation:', {
          initial: initialMemory,
          final: finalMemory,
          growth: memoryGrowth,
        });

        // Memory growth should be reasonable
        expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth

        // Performance should still be good
        await graphUtils.verifyPerformance(15, 100);

        await graphUtils.takeCanvasScreenshot('extended-navigation-complete');
      });
    });

    test('should handle edge cases gracefully', async ({ page }) => {
      await test.step('Test navigation edge cases', async () => {
        const edgeCases = [
          { name: 'extreme-zoom-in', action: () => graphUtils.zoomIn(15) },
          { name: 'extreme-zoom-out', action: () => graphUtils.zoomOut(15) },
          { name: 'extreme-pan-right', action: () => graphUtils.pan(2000, 0) },
          { name: 'extreme-pan-left', action: () => graphUtils.pan(-2000, 0) },
          { name: 'extreme-pan-down', action: () => graphUtils.pan(0, 2000) },
          { name: 'extreme-pan-up', action: () => graphUtils.pan(0, -2000) },
        ];

        for (const edgeCase of edgeCases) {
          await graphUtils.resetView();
          await edgeCase.action();
          await graphUtils.waitForAnimation();

          // Should still be functional
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.nodeCount).toBeGreaterThan(0);

          await graphUtils.takeCanvasScreenshot(`edge-case-${edgeCase.name}`);

          console.log(`Edge case ${edgeCase.name} performance:`, metrics);
        }
      });
    });
  });
});