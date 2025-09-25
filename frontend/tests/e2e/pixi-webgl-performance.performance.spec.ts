import { test, expect, Page } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * PIXI.js WebGL Performance Test Suite
 * Tests WebGL rendering performance, memory management, and PIXI.js optimization
 */
test.describe('PIXI.js WebGL Performance Tests', () => {
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

  test.describe('WebGL Rendering Performance', () => {
    test('should maintain 60 FPS with full graph loaded', async ({ page }) => {
      await test.step('Verify initial performance baseline', async () => {
        await graphUtils.waitForAnimation();

        const metrics = await graphUtils.getPerformanceMetrics();
        console.log('Initial performance metrics:', metrics);

        // Should maintain good FPS with full dataset
        expect(metrics.frameRate).toBeGreaterThanOrEqual(50);
        expect(metrics.nodeCount).toBeGreaterThan(240);
        expect(metrics.edgeCount).toBeGreaterThan(1549);

        await graphUtils.takeCanvasScreenshot('performance-baseline');
      });
    });

    test('should handle rapid zoom operations efficiently', async ({ page }) => {
      await test.step('Rapid zoom stress test', async () => {
        const startTime = Date.now();

        // Perform rapid zoom operations
        for (let i = 0; i < 20; i++) {
          if (i % 2 === 0) {
            await graphUtils.zoomIn(1);
          } else {
            await graphUtils.zoomOut(1);
          }
          await page.waitForTimeout(25); // Very rapid
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete zoom operations quickly
        expect(duration).toBeLessThan(2000); // Under 2 seconds

        // Performance should still be good after stress
        await graphUtils.waitForAnimation();
        await graphUtils.verifyPerformance(30, 50);

        await graphUtils.takeCanvasScreenshot('rapid-zoom-stress');
      });
    });

    test('should handle continuous pan operations efficiently', async ({ page }) => {
      await test.step('Continuous pan stress test', async () => {
        const startTime = Date.now();

        // Perform continuous pan operations
        const panDistance = 50;
        for (let i = 0; i < 16; i++) {
          const angle = (i * Math.PI * 2) / 16;
          const deltaX = Math.cos(angle) * panDistance;
          const deltaY = Math.sin(angle) * panDistance;
          await graphUtils.pan(deltaX, deltaY);
          await page.waitForTimeout(100);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`Pan operations completed in ${duration}ms`);

        // Should maintain performance during panning
        await graphUtils.verifyPerformance(25, 75);

        await graphUtils.takeCanvasScreenshot('continuous-pan-stress');
      });
    });

    test('should optimize rendering with LOD system', async ({ page }) => {
      await test.step('Test LOD performance optimization', async () => {
        // Test performance at different zoom levels
        const zoomLevels = [
          { name: 'zoomed-out', zoom: 'out', steps: 8 },
          { name: 'normal', zoom: 'reset', steps: 0 },
          { name: 'zoomed-in', zoom: 'in', steps: 5 },
        ];

        for (const level of zoomLevels) {
          if (level.zoom === 'out') {
            await graphUtils.zoomOut(level.steps);
          } else if (level.zoom === 'in') {
            await graphUtils.zoomIn(level.steps);
          } else {
            await graphUtils.resetView();
          }

          await graphUtils.waitForAnimation();
          const metrics = await graphUtils.getPerformanceMetrics();

          console.log(`LOD Performance at ${level.name}:`, metrics);

          // All zoom levels should maintain reasonable performance
          expect(metrics.frameRate).toBeGreaterThanOrEqual(20);

          await graphUtils.takeCanvasScreenshot(`lod-performance-${level.name}`);
        }
      });
    });
  });

  test.describe('WebGL Context Management', () => {
    test('should properly manage WebGL resources', async ({ page }) => {
      await test.step('Verify WebGL resource usage', async () => {
        const webglInfo = await graphUtils.getWebGLInfo();

        expect(webglInfo).toBeTruthy();
        expect(webglInfo.maxTextureSize).toBeGreaterThanOrEqual(2048);

        console.log('WebGL Resource Info:', {
          maxTextureSize: webglInfo.maxTextureSize,
          maxViewportDims: webglInfo.maxViewportDims,
          extensions: webglInfo.extensions?.length,
        });
      });
    });

    test('should handle context switching efficiently', async ({ page }) => {
      await test.step('Context switching performance test', async () => {
        // Switch between different rendering-intensive operations
        const operations = [
          () => graphUtils.zoomIn(3),
          () => graphUtils.pan(200, 200),
          () => graphUtils.zoomOut(3),
          () => graphUtils.pan(-200, -200),
          () => graphUtils.resetView(),
        ];

        for (let i = 0; i < 3; i++) {
          for (const operation of operations) {
            await operation();
            await page.waitForTimeout(200);

            // Check that WebGL context is still valid
            const webglInfo = await graphUtils.getWebGLInfo();
            expect(webglInfo).toBeTruthy();
            expect(webglInfo.vendor).toBeTruthy();
          }
        }

        await graphUtils.takeCanvasScreenshot('context-switching-test');
      });
    });

    test('should recover from WebGL context loss', async ({ page }) => {
      await test.step('Test WebGL context recovery', async () => {
        // Get initial state
        const initialMetrics = await graphUtils.getPerformanceMetrics();
        const initialWebGL = await graphUtils.getWebGLInfo();

        expect(initialWebGL).toBeTruthy();

        // Force context loss
        await page.evaluate(() => {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement;
          const gl = canvas?.getContext('webgl') || canvas?.getContext('experimental-webgl');
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.loseContext();
              console.log('WebGL context lost');
            }
          }
        });

        await page.waitForTimeout(1000);

        // Verify recovery or graceful degradation
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        // Try to restore context
        await page.evaluate(() => {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement;
          const gl = canvas?.getContext('webgl') || canvas?.getContext('experimental-webgl');
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.restoreContext();
              console.log('WebGL context restored');
            }
          }
        });

        await page.waitForTimeout(2000);

        // Verify that the application is still functional
        const finalMetrics = await graphUtils.getPerformanceMetrics();
        expect(finalMetrics.nodeCount).toBeGreaterThan(0);

        await graphUtils.takeCanvasScreenshot('webgl-context-recovery');
      });
    });
  });

  test.describe('Memory Management', () => {
    test('should manage PIXI.js memory efficiently', async ({ page }) => {
      await test.step('Memory usage monitoring', async () => {
        // Monitor memory usage during operations
        const getMemoryInfo = async () => {
          return await page.evaluate(() => {
            return {
              // @ts-ignore
              jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit,
              // @ts-ignore
              totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
              // @ts-ignore
              usedJSHeapSize: (performance as any).memory?.usedJSHeapSize,
            };
          });
        };

        const initialMemory = await getMemoryInfo();

        // Perform memory-intensive operations
        for (let i = 0; i < 10; i++) {
          await graphUtils.zoomIn(2);
          await graphUtils.pan(100, 100);
          await graphUtils.zoomOut(2);
          await graphUtils.pan(-100, -100);
          await page.waitForTimeout(200);
        }

        const finalMemory = await getMemoryInfo();

        console.log('Memory Usage:', {
          initial: initialMemory,
          final: finalMemory,
          growth: finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize,
        });

        // Memory should not grow excessively
        const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth

        await graphUtils.takeCanvasScreenshot('memory-management-test');
      });
    });

    test('should handle texture management efficiently', async ({ page }) => {
      await test.step('Texture memory management', async () => {
        const webglInfo = await graphUtils.getWebGLInfo();

        // Verify texture capabilities
        expect(webglInfo.maxTextureSize).toBeGreaterThanOrEqual(2048);

        // Test various visual operations that create/destroy textures
        const operations = [
          () => page.click('[title*="Labels"]'), // Toggle labels (text textures)
          () => page.click('[title*="Edges"]'), // Toggle edges
          () => graphUtils.zoomIn(5), // Zoom changes require texture updates
          () => graphUtils.zoomOut(5),
        ];

        for (const operation of operations) {
          await operation();
          await graphUtils.waitForAnimation();

          // Should maintain performance throughout
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.frameRate).toBeGreaterThanOrEqual(15);
        }

        await graphUtils.takeCanvasScreenshot('texture-management-test');
      });
    });
  });

  test.describe('PIXI.js Optimization Features', () => {
    test('should utilize PIXI.js culling effectively', async ({ page }) => {
      await test.step('Test frustum culling optimization', async () => {
        // Test that culling reduces rendering load when panned away from main content
        const centralMetrics = await graphUtils.getPerformanceMetrics();

        // Pan to empty area
        await graphUtils.pan(1000, 1000);
        await graphUtils.waitForAnimation();

        const emptyAreaMetrics = await graphUtils.getPerformanceMetrics();

        console.log('Culling Performance:', {
          central: centralMetrics,
          emptyArea: emptyAreaMetrics,
        });

        // Performance should improve when fewer objects are visible
        // (This might not always be the case with hardware acceleration, but worth testing)
        expect(emptyAreaMetrics.frameRate).toBeGreaterThanOrEqual(centralMetrics.frameRate - 10);

        await graphUtils.takeCanvasScreenshot('culling-optimization');
      });
    });

    test('should implement sprite batching effectively', async ({ page }) => {
      await test.step('Test batch rendering performance', async () => {
        // Zoom to level where many nodes are visible
        await graphUtils.resetView();
        await graphUtils.waitForAnimation();

        const metrics = await graphUtils.getPerformanceMetrics();

        // With 240+ nodes, should still maintain good performance due to batching
        expect(metrics.frameRate).toBeGreaterThanOrEqual(25);
        expect(metrics.visibleNodes).toBeGreaterThan(50);

        console.log('Sprite Batching Performance:', metrics);

        await graphUtils.takeCanvasScreenshot('sprite-batching-test');
      });
    });

    test('should handle high-DPI displays correctly', async ({ page }) => {
      await test.step('Test high-DPI rendering', async () => {
        // Simulate high-DPI display
        await page.evaluate(() => {
          // Override devicePixelRatio
          Object.defineProperty(window, 'devicePixelRatio', {
            value: 2,
            writable: true,
          });
        });

        // Reload to apply DPI changes
        await page.reload();
        await graphUtils.waitForGraphInitialization();

        const canvasInfo = await graphUtils.getCanvasInfo();
        const metrics = await graphUtils.getPerformanceMetrics();

        console.log('High-DPI Performance:', { canvas: canvasInfo, metrics });

        // Should handle high-DPI without major performance degradation
        expect(metrics.frameRate).toBeGreaterThanOrEqual(20);

        await graphUtils.takeCanvasScreenshot('high-dpi-test');
      });
    });
  });

  test.describe('Stress Testing', () => {
    test('should handle continuous heavy operations', async ({ page }) => {
      await test.step('Extended stress test', async () => {
        const startTime = Date.now();
        const duration = 10000; // 10 seconds

        let operationCount = 0;

        while (Date.now() - startTime < duration) {
          const operations = [
            () => graphUtils.zoomIn(1),
            () => graphUtils.zoomOut(1),
            () => graphUtils.pan(50, 0),
            () => graphUtils.pan(-50, 0),
            () => graphUtils.pan(0, 50),
            () => graphUtils.pan(0, -50),
          ];

          const randomOperation = operations[Math.floor(Math.random() * operations.length)];
          await randomOperation();
          operationCount++;

          await page.waitForTimeout(50);
        }

        console.log(`Completed ${operationCount} operations in ${duration}ms`);

        // Should maintain reasonable performance after stress
        await graphUtils.waitForAnimation();
        await graphUtils.verifyPerformance(15, 100);

        await graphUtils.takeCanvasScreenshot('stress-test-complete');
      });
    });

    test('should handle rapid viewport changes', async ({ page }) => {
      await test.step('Rapid viewport change stress test', async () => {
        const viewportSizes = [
          { width: 1920, height: 1080 },
          { width: 1280, height: 720 },
          { width: 800, height: 600 },
          { width: 1600, height: 900 },
        ];

        for (let i = 0; i < 10; i++) {
          const size = viewportSizes[i % viewportSizes.length];
          await page.setViewportSize(size);
          await page.waitForTimeout(200);

          // Should maintain functionality after each resize
          const metrics = await graphUtils.getPerformanceMetrics();
          expect(metrics.nodeCount).toBeGreaterThan(0);
        }

        // Final performance check
        await graphUtils.verifyPerformance(20, 75);

        await graphUtils.takeCanvasScreenshot('viewport-stress-complete');
      });
    });
  });

  test.describe('Browser Compatibility', () => {
    test('should work with WebGL 1.0 fallback', async ({ page }) => {
      await test.step('Test WebGL 1.0 compatibility', async () => {
        // Force WebGL 1.0 by disabling WebGL 2.0
        await page.addInitScript(() => {
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(contextType: string, ...args: any[]) {
            if (contextType === 'webgl2') {
              return null; // Force fallback to WebGL 1.0
            }
            return originalGetContext.call(this, contextType, ...args);
          };
        });

        await page.reload();
        await graphUtils.waitForGraphInitialization();

        const webglInfo = await graphUtils.getWebGLInfo();
        expect(webglInfo).toBeTruthy();

        // Should still render with WebGL 1.0
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);

        await graphUtils.takeCanvasScreenshot('webgl-1-compatibility');
      });
    });

    test('should handle limited GPU resources gracefully', async ({ page }) => {
      await test.step('Simulate limited GPU resources', async () => {
        // This is challenging to simulate, but we can test with reduced texture size
        await page.addInitScript(() => {
          // Override WebGL parameters to simulate limited GPU
          const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(pname: number) {
            if (pname === this.MAX_TEXTURE_SIZE) {
              return 1024; // Limit texture size
            }
            if (pname === this.MAX_VIEWPORT_DIMS) {
              return [1024, 1024]; // Limit viewport
            }
            return originalGetParameter.call(this, pname);
          };
        });

        await page.reload();
        await graphUtils.waitForGraphInitialization();

        // Should still function with limited resources
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(0);

        await graphUtils.takeCanvasScreenshot('limited-gpu-resources');
      });
    });
  });
});