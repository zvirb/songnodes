import { test, expect } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';
import { PerformanceTestHelpers } from '../utils/performance-test-helpers';

/**
 * WebGL Stress Testing
 *
 * Tests the graph visualization under high stress conditions
 * to ensure WebGL context stability and performance.
 */

test.describe('WebGL Stress Testing', () => {
  let graphUtils: GraphTestUtils;
  let perfHelpers: PerformanceTestHelpers;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);
    perfHelpers = new PerformanceTestHelpers(page);

    await page.goto('/');
    await graphUtils.waitForGraphInitialization();
    await graphUtils.enablePerformanceMonitor();
    await perfHelpers.initializePerformanceMonitoring();
  });

  test('should handle extreme zoom stress test', async ({ page }) => {
    await test.step('Perform rapid zoom operations', async () => {
      // Perform 100 rapid zoom operations
      for (let i = 0; i < 50; i++) {
        await graphUtils.zoomIn(2);
        await graphUtils.zoomOut(2);
        await page.waitForTimeout(50); // Brief pause
      }

      // Verify graph is still functional
      const metrics = await graphUtils.getPerformanceMetrics();
      expect(metrics.nodeCount).toBeGreaterThan(0);
      expect(metrics.frameRate).toBeGreaterThan(15); // Allow some performance degradation

      await graphUtils.takeCanvasScreenshot('extreme-zoom-stress-final');
    });

    await test.step('Test zoom performance under stress', async () => {
      const zoomLevels = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0];
      const performanceResults = await perfHelpers.benchmarkZoomLevels(zoomLevels);

      // Verify all zoom levels are functional
      performanceResults.forEach((metrics, zoomLevel) => {
        expect(metrics.averageFrameRate).toBeGreaterThan(10);
        console.log(`Zoom ${zoomLevel}x: ${metrics.averageFrameRate} FPS`);
      });
    });
  });

  test('should handle continuous pan stress test', async ({ page }) => {
    await test.step('Perform continuous panning', async () => {
      // Continuous panning in a circular pattern
      const radius = 200;
      const steps = 36; // 10-degree increments

      for (let step = 0; step < steps * 3; step++) { // 3 full circles
        const angle = (step / steps) * 2 * Math.PI;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        await graphUtils.pan(x, y);
        await page.waitForTimeout(50);
      }

      // Verify graph is still responsive
      const metrics = await graphUtils.getPerformanceMetrics();
      expect(metrics.frameRate).toBeGreaterThan(15);

      await graphUtils.takeCanvasScreenshot('continuous-pan-stress-final');
    });
  });

  test('should handle memory stress test', async ({ page }) => {
    await test.step('Monitor memory usage during stress operations', async () => {
      // Start memory monitoring
      const memoryTest = await perfHelpers.testMemoryUsage(15000);

      // Perform stress operations while monitoring memory
      for (let i = 0; i < 20; i++) {
        await graphUtils.zoomIn(3);
        await graphUtils.pan(100, 100);
        await graphUtils.zoomOut(3);
        await graphUtils.pan(-100, -100);
        await page.waitForTimeout(100);
      }

      // Check for memory leaks
      expect(memoryTest.leakDetected).toBe(false);
      console.log('Memory usage:', memoryTest);

      await graphUtils.takeCanvasScreenshot('memory-stress-final');
    });
  });

  test('should handle WebGL context pressure', async ({ page }) => {
    await test.step('Stress WebGL context with multiple operations', async () => {
      // Perform operations that stress the WebGL context
      for (let i = 0; i < 100; i++) {
        // Rapid viewport changes
        await page.setViewportSize({
          width: 800 + (i % 400),
          height: 600 + (i % 300)
        });

        // Zoom operations
        const zoomFactor = 0.5 + (i % 10) * 0.2;
        await graphUtils.zoomIn(zoomFactor);

        await page.waitForTimeout(25);
      }

      // Reset viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);

      // Verify WebGL context is still valid
      await graphUtils.verifyWebGLFunctionality();

      const metrics = await graphUtils.getPerformanceMetrics();
      expect(metrics.nodeCount).toBeGreaterThan(0);

      await graphUtils.takeCanvasScreenshot('webgl-context-pressure-final');
    });
  });

  test('should handle large dataset stress test', async ({ page }) => {
    await test.step('Load maximum dataset and test performance', async () => {
      // This would need to be implemented based on your data loading API
      await page.evaluate(() => {
        // Mock loading large dataset
        if (window.loadMaxDataset) {
          window.loadMaxDataset();
        }
      });

      await page.waitForTimeout(5000); // Wait for large dataset to load

      const initialMetrics = await graphUtils.getPerformanceMetrics();
      console.log('Large dataset metrics:', initialMetrics);

      // Perform operations with large dataset
      await graphUtils.zoomIn(2);
      await graphUtils.pan(200, 200);
      await graphUtils.zoomOut(4);

      const finalMetrics = await graphUtils.getPerformanceMetrics();
      expect(finalMetrics.frameRate).toBeGreaterThan(10); // Lower threshold for large datasets

      await graphUtils.takeCanvasScreenshot('large-dataset-stress');
    });
  });

  test('should recover from WebGL context loss', async ({ page }) => {
    await test.step('Simulate WebGL context loss and recovery', async () => {
      // Take initial screenshot
      await graphUtils.takeCanvasScreenshot('before-context-loss');

      // Force WebGL context loss
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (canvas) {
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.loseContext();
            }
          }
        }
      });

      await page.waitForTimeout(2000);

      // Restore context
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (canvas) {
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.restoreContext();
            }
          }
        }
      });

      await page.waitForTimeout(3000);

      // Verify recovery
      await graphUtils.verifyWebGLFunctionality();
      const metrics = await graphUtils.getPerformanceMetrics();
      expect(metrics.nodeCount).toBeGreaterThan(0);

      await graphUtils.takeCanvasScreenshot('after-context-recovery');
    });
  });

  test('should handle rapid interaction stress test', async ({ page }) => {
    await test.step('Simulate rapid user interactions', async () => {
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();

      if (!box) throw new Error('Canvas not found');

      // Rapid clicking across the canvas
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * box.width;
        const y = Math.random() * box.height;

        await graphUtils.clickOnCanvas(x, y);
        await page.waitForTimeout(25);
      }

      // Rapid zoom and pan combinations
      for (let i = 0; i < 25; i++) {
        await Promise.all([
          graphUtils.zoomIn(1.5),
          graphUtils.pan(50, -50)
        ]);
        await page.waitForTimeout(50);
      }

      // Verify stability
      const metrics = await graphUtils.getPerformanceMetrics();
      expect(metrics.frameRate).toBeGreaterThan(15);

      await graphUtils.takeCanvasScreenshot('rapid-interaction-stress-final');
    });
  });

  test('should maintain performance during prolonged usage', async ({ page }) => {
    await test.step('Run prolonged performance test', async () => {
      // Run continuous operations for 30 seconds
      const duration = 30000;
      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        // Cycle through different operations
        const operation = Math.floor(Math.random() * 4);

        switch (operation) {
          case 0:
            await graphUtils.zoomIn(1.2);
            break;
          case 1:
            await graphUtils.zoomOut(1.2);
            break;
          case 2:
            await graphUtils.pan(50, 0);
            break;
          case 3:
            await graphUtils.pan(0, 50);
            break;
        }

        await page.waitForTimeout(100);
      }

      // Measure final performance
      const benchmark = await perfHelpers.runPerformanceBenchmark('Prolonged Usage', 3000);

      expect(benchmark.metrics.averageFrameRate).toBeGreaterThan(20);
      expect(benchmark.metrics.droppedFrames).toBeLessThan(50);

      console.log('Prolonged usage benchmark:', benchmark.metrics);

      await graphUtils.takeCanvasScreenshot('prolonged-usage-final');
    });
  });
});